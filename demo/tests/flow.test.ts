import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../server/fixture.js";
import {
  projectRoutes,
  spanProgress,
  spanState,
  visibleNodes,
} from "../src/flow.js";
import { ancestors } from "../shared/domain.js";

const normal = fixture.traces.find((t) => t.id === "checkout-normal")!;
const slow = fixture.traces.find((t) => t.id === "checkout-slow")!;

test("flow progress clamps at span boundaries and distinguishes retry from timeout", () => {
  const failed = slow.spans.find((s) => s.id === "config-fail")!;
  const retry = slow.spans.find((s) => s.id === "config-retry")!;
  assert.equal(spanProgress(failed, 0), 0);
  assert.equal(
    spanProgress(failed, failed.startMs + failed.durationMs / 2),
    0.5,
  );
  assert.equal(spanProgress(failed, 9999), 1);
  assert.equal(spanState(failed, 54), "waiting");
  assert.equal(spanState(failed, 55), "active");
  assert.equal(spanState(failed, 905), "error");
  assert.equal(spanState(retry, 905), "waiting");
  assert.equal(spanState(retry, 965), "active");
  assert.equal(spanState(failed, 965), "error");
  assert.equal(spanState(retry, 1385), "complete");
});

test("estate routes collapse graph edges without inventing a checkout call to the fraud capability", () => {
  const routes = projectRoutes(fixture, "shopsphere", normal);
  const inventory = routes.find(
    (r) => r.from === "checkout" && r.to === "inventory",
  )!;
  assert.deepEqual(inventory.edgeIds, ["e02"]);
  assert.deepEqual(inventory.spanIds, ["stock"]);
  assert.deepEqual(
    routes.find((r) => r.from === "checkout" && r.to === "payments")!.spanIds,
    ["pay"],
  );
  assert.equal(
    routes.some((r) => r.from === "checkout" && r.to === "fraud"),
    false,
  );
  assert.ok(routes.some((r) => r.from === "portal" && r.to === "checkout"));
  assert.ok(routes.every((r) => r.from !== r.to));
});

test("projected configuration route keeps both retry spans and all supporting edges", () => {
  const routes = projectRoutes(fixture, "fraud-service", slow);
  const config = routes.find(
    (r) => r.from === "velocity" && r.to === "legacy-config",
  )!;
  assert.deepEqual(config.spanIds, ["config-fail", "config-retry"]);
  assert.deepEqual(config.edgeIds, ["e05", "e06"]);
  assert.deepEqual(
    visibleNodes(fixture, "evaluate").map((n) => n.id),
    ["evaluate"],
  );
  assert.deepEqual(projectRoutes(fixture, "evaluate", slow), []);
});

test("every projected route is visible, directed and backed by valid graph/trace endpoints", () => {
  for (const scope of fixture.nodes) {
    const visible = new Set(visibleNodes(fixture, scope.id).map((n) => n.id));
    for (const trace of fixture.traces) {
      const routes = projectRoutes(fixture, scope.id, trace);
      assert.equal(new Set(routes.map((r) => r.id)).size, routes.length);
      for (const route of routes) {
        assert.ok(visible.has(route.from) && visible.has(route.to));
        assert.notEqual(route.from, route.to);
        for (const id of route.edgeIds) {
          const edge = fixture.edges.find((e) => e.id === id)!;
          assert.ok(
            ancestors(fixture, edge.from).some((n) => n.id === route.from),
          );
          assert.ok(ancestors(fixture, edge.to).some((n) => n.id === route.to));
        }
        for (const id of route.spanIds) {
          const span = trace.spans.find((s) => s.id === id)!;
          const parent = trace.spans.find((s) => s.id === span.parentId)!;
          assert.ok(
            ancestors(fixture, parent.nodeId).some((n) => n.id === route.from),
          );
          assert.ok(
            ancestors(fixture, span.nodeId).some((n) => n.id === route.to),
          );
        }
      }
    }
  }
});
