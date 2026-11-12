import {
  ancestors,
  childrenOf,
  type Fixture,
  type Trace,
} from "../shared/domain";

export type Span = Trace["spans"][number];
export function spanProgress(span: Span, time: number) {
  return Math.max(0, Math.min(1, (time - span.startMs) / span.durationMs));
}
export function spanState(span: Span, time: number) {
  if (time < span.startMs) return "waiting";
  if (time < span.startMs + span.durationMs) return "active";
  return span.status === "error" ? "error" : "complete";
}
export function visibleNodes(fixture: Fixture, scopeId: string) {
  const children = childrenOf(fixture, scopeId);
  return children.length
    ? children
    : fixture.nodes.filter((n) => n.id === scopeId);
}
export type FlowRoute = {
  id: string;
  from: string;
  to: string;
  edgeIds: string[];
  spanIds: string[];
};

export function projectRoutes(fixture: Fixture, scopeId: string, trace: Trace) {
  const visible = visibleNodes(fixture, scopeId);
  const project = (id: string) => {
    const path = ancestors(fixture, id);
    return visible.find((n) => path.some((a) => a.id === n.id))?.id;
  };
  const routes = new Map<string, FlowRoute>();
  const routeFor = (fromId: string, toId: string) => {
    const from = project(fromId);
    const to = project(toId);
    if (!from || !to || from === to) return;
    const id = `${from}:${to}`;
    if (!routes.has(id))
      routes.set(id, { id, from, to, edgeIds: [], spanIds: [] });
    return routes.get(id)!;
  };
  for (const edge of fixture.edges)
    routeFor(edge.from, edge.to)?.edgeIds.push(edge.id);
  for (const span of trace.spans) {
    const parent = trace.spans.find((s) => s.id === span.parentId);
    if (parent) routeFor(parent.nodeId, span.nodeId)?.spanIds.push(span.id);
  }
  return [...routes.values()];
}
