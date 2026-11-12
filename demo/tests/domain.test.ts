import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../server/fixture.js";
import {
  ancestors,
  childrenOf,
  explainability,
  impact,
  investigate,
  investigatorPrompts,
  questionKeys,
  riskBand,
  riskScore,
  rollup,
  validateFixture,
} from "../shared/domain.js";

test("fixture has the documented estate and calculated explainability", () => {
  assert.equal(fixture.nodes.length, 40);
  assert.equal(fixture.repositories.length, 5);
  assert.equal(childrenOf(fixture, "shopsphere").length, 6);
  assert.equal(fixture.nodes.filter((n) => n.assessed).length, 25);
  assert.deepEqual(explainability(fixture), {
    supported: 102,
    total: 150,
    percent: 68,
  });
});
test("risk formula, boundary bands and unknown semantics", () => {
  assert.equal(riskScore(fixture.nodes.find((n) => n.id === "velocity")!), 92);
  assert.equal(
    riskScore(fixture.nodes.find((n) => n.id === "legacy-adapter")!),
    null,
  );
  assert.equal(riskBand(null), "unknown");
  for (const [value, band] of [
    [0, "healthy"],
    [24, "healthy"],
    [25, "attention"],
    [49, "attention"],
    [50, "elevated"],
    [74, "elevated"],
    [75, "critical"],
    [100, "critical"],
  ] as const)
    assert.equal(riskBand(value), band);
  assert.deepEqual(rollup(fixture, "shopsphere"), { score: 92, unknown: 1 });
  assert.equal(rollup(fixture, "payments").unknown, 1);
});
test("hero hierarchy reaches a method without inventing containment for shared config", () => {
  assert.deepEqual(
    ancestors(fixture, "evaluate").map((n) => n.id),
    [
      "shopsphere",
      "checkout",
      "fraud-service",
      "velocity",
      "velocity-class",
      "evaluate",
    ],
  );
  assert.equal(
    fixture.nodes.find((n) => n.id === "legacy-config")!.parentId,
    "fraud-service",
  );
  assert.equal(
    fixture.edges.find((e) => e.from === "evaluate")!.to,
    "legacy-config",
  );
});
test("unknown adapter preserves exactly two supported answers", () => {
  const node = fixture.nodes.find((n) => n.id === "legacy-adapter")!;
  assert.equal(node.owner, null);
  assert.equal(node.health, null);
  assert.deepEqual(
    questionKeys.filter((k) => node.answers[k]),
    ["what", "where"],
  );
  assert.deepEqual(explainability(fixture, node.id), {
    supported: 2,
    total: 6,
    percent: 33,
  });
});
test("potential impact traverses reverse edges and terminates on cycles", () => {
  const result = impact(fixture, "velocity");
  assert.deepEqual(
    result.map((r) => [r.node.id, r.depth]),
    [
      ["fraud-service", 1],
      ["checkout-service", 2],
      ["portal-service", 3],
    ],
  );
  const cyclic = structuredClone(fixture);
  cyclic.edges.push({
    id: "cycle",
    from: "velocity",
    to: "portal-service",
    type: "calls",
    evidenceIds: ["velocity-source"],
  });
  assert.equal(impact(validateFixture(cyclic), "velocity").length, 3);
});
test("each investigator prompt resolves and every citation points to existing evidence", () => {
  for (const prompt of investigatorPrompts) {
    const response = investigate(fixture, prompt, "velocity");
    assert.equal(response.supported, true);
    assert.equal(response.mode, "scripted");
    assert.ok(fixture.nodes.some((n) => n.id === response.focusNodeId));
    assert.ok(response.evidenceIds.length);
    assert.ok(
      response.evidenceIds.every((id) =>
        fixture.evidence.some((e) => e.id === id),
      ),
    );
  }
  const unknown = investigate(fixture, "What is the weather in Paris?");
  assert.equal(unknown.supported, false);
  assert.deepEqual(unknown.evidenceIds, []);
  assert.match(
    investigate(fixture, "What breaks if this changes?", "legacy-adapter")
      .answer,
    /Payment router/,
  );
});
test("fixture validator rejects malformed graph and evidence relationships", () => {
  const corruptions = [
    (f: typeof fixture) => {
      f.nodes.push(f.nodes[0]);
    },
    (f: typeof fixture) => {
      f.nodes[1].parentId = "missing";
    },
    (f: typeof fixture) => {
      f.nodes[1].parentId = "fraud-service";
    },
    (f: typeof fixture) => {
      f.edges[0].to = "missing";
    },
    (f: typeof fixture) => {
      f.edges[0].evidenceIds = ["missing"];
    },
    (f: typeof fixture) => {
      f.evidence[0].lineEnd = 900;
    },
    (f: typeof fixture) => {
      f.traces[0].spans[0].nodeId = "missing";
    },
    (f: typeof fixture) => {
      f.traces[0].spans[1].parentId = "fraud";
    },
    (f: typeof fixture) => {
      f.traces[0].spans[1].durationMs = 10000;
    },
    (f: typeof fixture) => {
      f.nodes.find((n) => n.id === "velocity")!.answers.what!.evidenceIds = [
        "missing",
      ];
    },
  ];
  for (const mutate of corruptions) {
    const copy = structuredClone(fixture);
    mutate(copy);
    assert.throws(() => validateFixture(copy));
  }
});
test("trace fixtures keep ordered business stages and a truthful retry", () => {
  assert.equal(fixture.traces.length, 2);
  for (const trace of fixture.traces) {
    const fraud = trace.spans.find((s) => s.nodeId === "fraud-service")!;
    const stock = trace.spans.find((s) => s.nodeId === "inventory-service")!;
    const pay = trace.spans.find((s) => s.nodeId === "payments-service")!;
    assert.ok(fraud.startMs + fraud.durationMs <= stock.startMs);
    assert.ok(stock.startMs + stock.durationMs <= pay.startMs);
  }
  assert.equal(
    fixture.traces[1].spans.filter((s) => s.status === "error").length,
    1,
  );
  assert.equal(
    fixture.traces[1].spans.filter((s) => s.nodeId === "legacy-config").length,
    2,
  );
});
