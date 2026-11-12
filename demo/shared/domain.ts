import { z } from "zod";

export const questionKeys = [
  "what",
  "why",
  "where",
  "depends",
  "breaks",
  "evidence",
] as const;
export type Question = (typeof questionKeys)[number];
export const questionLabels: Record<Question, string> = {
  what: "What is it?",
  why: "Why does it exist?",
  where: "Where does it live?",
  depends: "What does it depend on?",
  breaks: "What breaks if it changes?",
  evidence: "What is the evidence?",
};
const answer = z.object({
  text: z.string().min(1),
  evidenceIds: z.array(z.string()).min(1),
});
const factors = z.object({
  criticality: z.number().min(0).max(100),
  ownership: z.number().min(0).max(100),
  documentation: z.number().min(0).max(100),
  incidents: z.number().min(0).max(100),
  coupling: z.number().min(0).max(100),
});
export const nodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum([
    "system",
    "capability",
    "service",
    "component",
    "class",
    "method",
    "repository",
  ]),
  parentId: z.string().nullable(),
  repoId: z.string().optional(),
  description: z.string(),
  owner: z.string().nullable().optional(),
  assessed: z.boolean().default(false),
  factors: factors.nullable().optional(),
  health: z
    .object({
      latencyMs: z.number().nonnegative(),
      errorRate: z.number().min(0).max(100),
    })
    .nullable()
    .optional(),
  answers: z
    .object({
      what: answer.optional(),
      why: answer.optional(),
      where: answer.optional(),
      depends: answer.optional(),
      breaks: answer.optional(),
      evidence: answer.optional(),
    })
    .default({}),
});
const evidenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum([
    "source",
    "config",
    "test",
    "runbook",
    "ownership",
    "incident",
    "note",
  ]),
  repoId: z.string(),
  path: z.string(),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  content: z.string(),
  provenance: z.literal("synthetic fixture"),
});
const spanSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  nodeId: z.string(),
  name: z.string(),
  startMs: z.number().nonnegative(),
  durationMs: z.number().positive(),
  status: z.enum(["ok", "error"]),
});
export const fixtureSchema = z.object({
  version: z.string(),
  system: z.string(),
  repositories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      language: z.string(),
      description: z.string(),
    }),
  ),
  nodes: z.array(nodeSchema),
  edges: z.array(
    z.object({
      id: z.string(),
      from: z.string(),
      to: z.string(),
      type: z.enum(["calls", "depends-on", "reads-config"]),
      evidenceIds: z.array(z.string()).min(1),
    }),
  ),
  evidence: z.array(evidenceSchema),
  traces: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      synthetic: z.literal(true),
      description: z.string(),
      spans: z.array(spanSchema).min(1),
    }),
  ),
});
export type Fixture = z.infer<typeof fixtureSchema>;
export type TwinNode = z.infer<typeof nodeSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Trace = Fixture["traces"][number];
export type RiskFactors = z.infer<typeof factors>;
export const factorWeights: Record<keyof RiskFactors, number> = {
  criticality: 0.3,
  ownership: 0.25,
  documentation: 0.2,
  incidents: 0.15,
  coupling: 0.1,
};
export const factorLabels: Record<keyof RiskFactors, string> = {
  criticality: "Business criticality",
  ownership: "Ownership fragility",
  documentation: "Documentation gap",
  incidents: "Incident exposure",
  coupling: "Dependency coupling",
};

export function riskScore(node: TwinNode): number | null {
  if (!node.factors) return null;
  return Math.round(
    Object.entries(factorWeights).reduce(
      (sum, [key, weight]) =>
        sum + node.factors![key as keyof RiskFactors] * weight,
      0,
    ),
  );
}
export function riskBand(score: number | null) {
  return score === null
    ? "unknown"
    : score >= 75
      ? "critical"
      : score >= 50
        ? "elevated"
        : score >= 25
          ? "attention"
          : "healthy";
}
export function childrenOf(fixture: Fixture, id: string) {
  return fixture.nodes.filter((n) => n.parentId === id);
}
export function ancestors(fixture: Fixture, id: string): TwinNode[] {
  const path: TwinNode[] = [];
  const visited = new Set<string>();
  let node = fixture.nodes.find((n) => n.id === id);
  while (node && !visited.has(node.id)) {
    path.unshift(node);
    visited.add(node.id);
    node = fixture.nodes.find((n) => n.id === node!.parentId);
  }
  return path;
}
export function descendants(fixture: Fixture, id: string): TwinNode[] {
  const found: TwinNode[] = [];
  const queue = [id];
  const visited = new Set<string>();
  while (queue.length) {
    const next = queue.shift()!;
    if (visited.has(next)) continue;
    visited.add(next);
    const node = fixture.nodes.find((n) => n.id === next);
    if (node) found.push(node);
    queue.push(...childrenOf(fixture, next).map((n) => n.id));
  }
  return found;
}
export function rollup(fixture: Fixture, id: string) {
  const assessed = descendants(fixture, id).filter((n) => n.assessed);
  const known = assessed.map(riskScore).filter((s): s is number => s !== null);
  return {
    score: known.length ? Math.max(...known) : null,
    unknown: assessed.filter((n) => riskScore(n) === null).length,
  };
}
export function explainability(fixture: Fixture, id = "shopsphere") {
  const nodes = descendants(fixture, id).filter((n) => n.assessed);
  const supported = nodes.reduce(
    (sum, n) => sum + questionKeys.filter((k) => n.answers[k]).length,
    0,
  );
  const total = nodes.length * questionKeys.length;
  return {
    supported,
    total,
    percent: total ? Math.round((supported / total) * 100) : null,
  };
}
export function impact(fixture: Fixture, id: string) {
  const result: { node: TwinNode; depth: number }[] = [];
  const visited = new Set([id]);
  const queue = [{ id, depth: 0 }];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of fixture.edges.filter((e) => e.to === current.id)) {
      if (visited.has(edge.from)) continue;
      visited.add(edge.from);
      const node = fixture.nodes.find((n) => n.id === edge.from)!;
      result.push({ node, depth: current.depth + 1 });
      queue.push({ id: node.id, depth: current.depth + 1 });
    }
  }
  return result;
}
export function validateFixture(raw: unknown): Fixture {
  const fixture = fixtureSchema.parse(raw);
  const assert = (test: unknown, message: string) => {
    if (!test) throw new Error(`Invalid fixture: ${message}`);
  };
  for (const [label, rows] of [
    ["nodes", fixture.nodes],
    ["repositories", fixture.repositories],
    ["evidence", fixture.evidence],
    ["edges", fixture.edges],
    ["traces", fixture.traces],
  ] as const)
    assert(
      new Set(rows.map((r) => r.id)).size === rows.length,
      `duplicate ${label} ID`,
    );
  const ids = new Set(fixture.nodes.map((n) => n.id));
  const repos = new Set(fixture.repositories.map((r) => r.id));
  const evid = new Set(fixture.evidence.map((e) => e.id));
  const roots = fixture.nodes.filter((n) => n.parentId === null);
  assert(
    roots.length === 1 && roots[0].id === "shopsphere",
    "one shopsphere root required",
  );
  for (const node of fixture.nodes) {
    assert(
      !node.parentId || ids.has(node.parentId),
      `missing parent for ${node.id}`,
    );
    assert(
      !node.repoId || repos.has(node.repoId),
      `missing repo for ${node.id}`,
    );
    const visited = new Set([node.id]);
    let parent = node.parentId;
    while (parent) {
      assert(!visited.has(parent), "containment cycle");
      visited.add(parent);
      parent = fixture.nodes.find((n) => n.id === parent)?.parentId ?? null;
    }
    for (const item of Object.values(node.answers))
      for (const id of item.evidenceIds)
        assert(evid.has(id), `missing answer evidence ${id}`);
  }
  for (const edge of fixture.edges) {
    assert(ids.has(edge.from) && ids.has(edge.to), `invalid edge ${edge.id}`);
    for (const id of edge.evidenceIds)
      assert(evid.has(id), `missing edge evidence ${id}`);
  }
  for (const item of fixture.evidence) {
    assert(repos.has(item.repoId), `invalid evidence repo ${item.id}`);
    assert(
      item.lineStart <= item.lineEnd &&
        item.lineEnd <= item.content.split("\n").length,
      `invalid line range ${item.id}`,
    );
  }
  for (const trace of fixture.traces) {
    const spans = new Set(trace.spans.map((s) => s.id));
    assert(spans.size === trace.spans.length, `duplicate span in ${trace.id}`);
    assert(
      trace.spans.filter((s) => s.parentId === null).length === 1,
      `one root span required in ${trace.id}`,
    );
    for (const span of trace.spans) {
      assert(ids.has(span.nodeId), `invalid trace node ${span.nodeId}`);
      assert(
        !span.parentId || spans.has(span.parentId),
        `invalid span parent ${span.id}`,
      );
      const visited = new Set([span.id]);
      let parentId = span.parentId;
      while (parentId) {
        assert(!visited.has(parentId), `span cycle in ${trace.id}`);
        visited.add(parentId);
        parentId = trace.spans.find((s) => s.id === parentId)?.parentId ?? null;
      }
      const parent = trace.spans.find((s) => s.id === span.parentId);
      if (parent)
        assert(
          span.startMs >= parent.startMs &&
            span.startMs + span.durationMs <=
              parent.startMs + parent.durationMs,
          `span outside parent ${span.id}`,
        );
    }
  }
  return fixture;
}

export const investigatorPrompts = [
  "Why is Velocity rules risky?",
  "Which service should we modernise first?",
  "What breaks if this changes?",
  "Explain Checkout as if I joined yesterday.",
];
export type Investigation = {
  answer: string;
  evidenceIds: string[];
  focusNodeId: string;
  mode: "scripted";
  supported: boolean;
};
export function investigate(
  fixture: Fixture,
  prompt: string,
  selectedId = "velocity",
): Investigation {
  const text = prompt.toLowerCase();
  const result = (
    answer: string,
    evidenceIds: string[],
    focusNodeId: string,
    supported = true,
  ): Investigation => ({
    answer,
    evidenceIds,
    focusNodeId,
    mode: "scripted",
    supported,
  });
  if (/break|impact|depend|change/.test(text)) {
    const node =
      fixture.nodes.find((n) => n.id === selectedId) ??
      fixture.nodes.find((n) => n.id === "velocity")!;
    const affected = impact(fixture, node.id);
    return result(
      affected.length
        ? `Changing ${node.name} could affect ${affected.map((i) => `${i.node.name} (${i.depth === 1 ? "direct" : "transitive"})`).join(", ")}. This is potential impact from declared dependencies, not proof of an outage. Validate contracts and replay the checkout tests before changing it.`
        : `No incoming dependencies are declared for ${node.name} in this curated graph. That is not proof nothing depends on it; additional runtime evidence is needed.`,
      [
        ...new Set(
          fixture.edges
            .filter(
              (e) =>
                e.to === node.id || affected.some((a) => a.node.id === e.from),
            )
            .flatMap((e) => e.evidenceIds),
        ),
      ],
      node.id,
    );
  }
  if (/join|explain|onboard/.test(text))
    return result(
      "Checkout coordinates the customer purchase. It asks Fraud for a decision, reserves Inventory, then authorises Payments. Fraud reads shared legacy configuration through Velocity rules. Start with the checkout contract and replay CHK-432; the legacy payment adapter is an explicit blind spot, not an understood dependency.",
      ["checkout-contract", "checkout-test", "legacy-config"],
      "checkout",
    );
  if (/risk|danger|modern|first|worst/.test(text)) {
    const ranked = fixture.nodes
      .filter((n) => n.assessed && riskScore(n) !== null)
      .sort((a, b) => riskScore(b)! - riskScore(a)!);
    const node = ranked[0];
    return result(
      `${node.name} is the highest known risk at ${riskScore(node)}/100. It gates checkout approval, has one maintainer, lacks a runbook, and is linked to 12 synthetic recent failures. The weighted scoring rubric is illustrative, not a validated prediction. First verify the legacy bypass configuration, establish a second owner, and add contract tests. The unknown Legacy Payment Adapter may conceal greater risk and needs separate discovery.`,
      ["velocity-source", "ownership-note", "incident-log", "legacy-config"],
      node.id,
    );
  }
  return result(
    "This investigator is a scripted, graph-backed demonstration, not a general AI model. Try one of the four suggested questions. It cannot infer missing owners, documentation or runtime behaviour.",
    [],
    selectedId,
    false,
  );
}
