import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  fixtureSchema,
  nodeSchema,
  validateFixture,
  type Evidence,
  type TwinNode,
} from "../shared/domain.js";

const authoredSchema = fixtureSchema.extend({
  nodes: z.array(
    nodeSchema.extend({
      purpose: z.string().optional(),
      path: z.string().optional(),
      coverage: z
        .enum(["standard", "extended", "complete", "unknown"])
        .default("standard"),
    }),
  ),
});

export function loadFixture() {
  const path = fileURLToPath(
    new URL("../../fixtures/shopsphere.json", import.meta.url),
  );
  // The compiled server lives one directory deeper than its source.
  const sourcePath = fileURLToPath(
    new URL("../fixtures/shopsphere.json", import.meta.url),
  );
  const raw = authoredSchema.parse(
    JSON.parse(
      readFileSync(
        import.meta.url.includes("/dist/") ? path : sourcePath,
        "utf8",
      ),
    ),
  );
  const evidence: Evidence[] = [...raw.evidence];
  const nodes: TwinNode[] = raw.nodes.map((node) => {
    if (!node.assessed) return node;
    if (!node.repoId || !node.purpose || !node.path)
      throw new Error(
        `Assessed node ${node.id} needs repository, purpose and path`,
      );
    const evidenceId = `catalog-${node.id}`;
    const text = `# Curated synthetic component record\nName: ${node.name}\nWhat: ${node.description}\nWhy: ${node.purpose}\nWhere: ${node.repoId}/${node.path}\nThis record is authored demo evidence, not static analysis.`;
    evidence.push({
      id: evidenceId,
      title: `${node.name} · curated record`,
      type: "note",
      repoId: node.repoId!,
      path: `catalog/${node.id}.md`,
      lineStart: 1,
      lineEnd: 6,
      content: text,
      provenance: "synthetic fixture",
    });
    const ans = (text: string, evidenceIds = [evidenceId]) => ({
      text,
      evidenceIds,
    });
    if (node.coverage === "unknown")
      return {
        ...node,
        answers: {
          what: ans(node.description, ["legacy-source"]),
          where: ans(`${node.repoId}/${node.path}`, ["legacy-source"]),
        },
      };
    const answers: TwinNode["answers"] = {
      what: ans(node.description),
      why: ans(node.purpose!),
      where: ans(`${node.repoId}/${node.path}`),
      evidence: ans(
        "An explicitly authored component record supports this description. Source snippets, test records and incidents are synthetic and available in the evidence browser.",
      ),
    };
    if (node.coverage === "extended" || node.coverage === "complete") {
      const dependencies = raw.edges.filter((e) => e.from === node.id);
      answers.depends = ans(
        dependencies
          .map((e) => raw.nodes.find((n) => n.id === e.to)!.name)
          .join(", "),
        [...new Set(dependencies.flatMap((e) => e.evidenceIds))],
      );
    }
    if (node.coverage === "complete")
      answers.breaks = ans(
        "Fraud decisions, Checkout API and the Storefront may be affected through declared dependency edges. This is potential impact, not proven failure.",
        ["checkout-contract", "velocity-source"],
      );
    return { ...node, answers };
  });
  return validateFixture({ ...raw, nodes, evidence });
}

export const fixture = loadFixture();
