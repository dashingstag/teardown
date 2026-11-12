import {
  ancestors,
  descendants,
  riskBand,
  riskScore,
  rollup,
  type Fixture,
  type TwinNode,
} from "../shared/domain";
export type Lens = "architecture" | "risk" | "runtime";
export const palette = {
  healthy: "#53cbb1",
  attention: "#e5c76e",
  elevated: "#ed9d63",
  critical: "#fa737b",
  unknown: "#ad95ec",
};
const capabilityColors: Record<string, string> = {
  checkout: "#63d9cd",
  payments: "#73a9ef",
  fraud: "#d99b67",
  inventory: "#6bb99c",
  recommendations: "#ad99e5",
  portal: "#d4ac85",
};
export function scoreFor(fixture: Fixture, node: TwinNode) {
  return node.assessed ? riskScore(node) : rollup(fixture, node.id).score;
}
export function colorFor(fixture: Fixture, node: TwinNode, lens: Lens) {
  if (lens === "risk") return palette[riskBand(scoreFor(fixture, node))];
  if (lens === "runtime") {
    const health = node.assessed
      ? node.health
      : descendants(fixture, node.id)
          .filter((n) => n.health)
          .map((n) => n.health!)
          .sort((a, b) => b.errorRate - a.errorRate)[0];
    return !health
      ? palette.unknown
      : health.errorRate > 5
        ? palette.critical
        : health.errorRate > 1
          ? palette.elevated
          : palette.healthy;
  }
  return capabilityColors[ancestors(fixture, node.id)[1]?.id] ?? "#63d9cd";
}
