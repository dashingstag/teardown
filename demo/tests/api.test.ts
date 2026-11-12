import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../server/app.js";

let server: Server;
let base: string;
before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(
  () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
);
const post = (body: unknown) =>
  fetch(`${base}/api/investigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("health and graph are ready and correctly versioned", async () => {
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).version, "shopsphere-1.0");
  const graph = await fetch(`${base}/api/graph`);
  assert.equal(graph.headers.get("x-content-type-options"), "nosniff");
  const data = await graph.json();
  assert.equal(data.nodes.length, 40);
  assert.equal(data.summary.percent, 68);
});
test("only allowlisted evidence and traces can be fetched", async () => {
  assert.equal((await fetch(`${base}/api/evidence/legacy-config`)).status, 200);
  assert.equal((await fetch(`${base}/api/traces/checkout-slow`)).status, 200);
  for (const path of [
    "/api/evidence/missing",
    "/api/traces/missing",
    "/api/missing",
    "/missing.js",
  ])
    assert.equal((await fetch(`${base}${path}`)).status, 404);
});
test("investigator validates prompt, node and body size", async () => {
  for (const body of [
    { prompt: "" },
    { prompt: "a".repeat(501) },
    { prompt: "risk", selectedNodeId: "missing" },
    { prompt: 7 },
    {},
  ])
    assert.equal((await post(body)).status, 400);
  assert.equal((await post({ prompt: "a".repeat(5000) })).status, 413);
  const malformed = await fetch(`${base}/api/investigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
});
test("investigator responses are bounded and selected-node aware", async () => {
  const risk = await post({ prompt: "What is the most dangerous part?" });
  assert.equal(risk.status, 200);
  const result = await risk.json();
  assert.equal(result.focusNodeId, "velocity");
  assert.equal(result.mode, "scripted");
  assert.match(result.answer, /92\/100/);
  const impact = await (
    await post({
      prompt: "What breaks if this changes?",
      selectedNodeId: "legacy-adapter",
    })
  ).json();
  assert.equal(impact.focusNodeId, "legacy-adapter");
  assert.match(impact.answer, /Payment router/);
  const unsupported = await (await post({ prompt: "Tell me a joke" })).json();
  assert.equal(unsupported.supported, false);
});
test("separate viewers do not mutate the graph", async () => {
  const first = await (await fetch(`${base}/api/graph`)).text();
  await post({ prompt: "Explain checkout", selectedNodeId: "checkout" });
  const second = await (await fetch(`${base}/api/graph`)).text();
  assert.equal(first, second);
});
