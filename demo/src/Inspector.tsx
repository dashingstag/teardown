import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Code2,
  FileText,
  GitBranch,
  HelpCircle,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  childrenOf,
  explainability,
  factorLabels,
  factorWeights,
  impact,
  questionKeys,
  questionLabels,
  riskBand,
  riskScore,
  rollup,
  type Evidence,
  type Fixture,
  type RiskFactors,
  type TwinNode,
} from "../shared/domain";
import { palette } from "./view";
import Modal from "./Modal";

export function EvidenceViewer({
  evidence,
  onClose,
}: {
  evidence: Evidence;
  onClose: () => void;
}) {
  return (
    <Modal label={evidence.title} onClose={onClose}>
      <section className="evidence-modal">
        <header>
          <div>
            <span className="eyebrow">EVIDENCE / {evidence.type}</span>
            <h2 id="evidence-title">{evidence.title}</h2>
          </div>
          <button
            autoFocus
            className="icon-button"
            onClick={onClose}
            aria-label="Close evidence"
          >
            <X size={19} />
          </button>
        </header>
        <div className="evidence-path">
          <Code2 size={15} />
          {evidence.repoId}/{evidence.path}
          <span>
            L{evidence.lineStart}–{evidence.lineEnd}
          </span>
        </div>
        <div className="source-lines">
          {evidence.content.split("\n").map((line, i) => (
            <div
              key={i}
              className={
                i + 1 >= evidence.lineStart && i + 1 <= evidence.lineEnd
                  ? "cited-line"
                  : ""
              }
            >
              <span>{i + 1}</span>
              <code>{line || " "}</code>
            </div>
          ))}
        </div>
        <footer>
          <span className="status-dot" />
          {evidence.provenance} · read-only snapshot, not executed source
        </footer>
      </section>
    </Modal>
  );
}

export default function Inspector({
  fixture,
  node,
  onSelect,
  onDive,
  onEvidence,
  onClose,
}: {
  fixture: Fixture;
  node: TwinNode;
  onSelect: (id: string) => void;
  onDive: (id: string) => void;
  onEvidence: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("overview");
  const score = node.assessed
    ? riskScore(node)
    : rollup(fixture, node.id).score;
  const band = riskBand(score);
  const coverage = explainability(fixture, node.id);
  const children = childrenOf(fixture, node.id);
  const nodeEvidence = [
    ...new Set([
      ...Object.values(node.answers).flatMap((a) => a.evidenceIds),
      ...fixture.edges
        .filter((e) => e.from === node.id || e.to === node.id)
        .flatMap((e) => e.evidenceIds),
    ]),
  ];
  if (["velocity", "velocity-class", "evaluate"].includes(node.id))
    nodeEvidence.unshift(
      "velocity-source",
      "ownership-note",
      "incident-log",
      "tribal-note",
    );
  if (node.id === "legacy-config")
    nodeEvidence.unshift("legacy-config", "tribal-note");
  const affected = impact(fixture, node.id);
  return (
    <aside className="inspector">
      <div className="inspector-header">
        <span className="eyebrow">COMPONENT INSPECTOR</span>
        <button
          className="icon-button mobile-only"
          onClick={onClose}
          aria-label="Close inspector"
        >
          <X size={18} />
        </button>
      </div>
      <div className="inspector-identity">
        <div className={`component-icon ${band}`}>
          <GitBranch size={23} />
        </div>
        <span className="tag">{node.kind}</span>
        <h2>{node.name}</h2>
        <p>{node.description}</p>
        <div className="owner">
          <span className="avatar">{node.owner?.[0] ?? "?"}</span>
          {node.owner ??
            (node.assessed ? "Owner unknown" : "Structural grouping")}
        </div>
      </div>
      <div
        className="inspector-tabs"
        role="tablist"
        aria-label="Inspector sections"
      >
        {["overview", "impact", "evidence"].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "evidence" && <span>{new Set(nodeEvidence).size}</span>}
          </button>
        ))}
      </div>
      <div className="inspector-body" role="tabpanel">
        {tab === "overview" && (
          <>
            <div className="score-row">
              <div>
                <span className="eyebrow">
                  {node.assessed ? "RISK SCORE" : "HIGHEST KNOWN RISK"}
                </span>
                <div className="risk-number" style={{ color: palette[band] }}>
                  {score ?? "—"}
                  <small>{score !== null ? "/100" : "unknown"}</small>
                </div>
              </div>
              <span className={`risk-pill ${band}`}>{band}</span>
            </div>
            {!node.assessed && (
              <p className="muted small">
                Maximum of assessed descendants ·{" "}
                {rollup(fixture, node.id).unknown} unknown. Structural groups
                have no independent assessment.
              </p>
            )}
            <div className="coverage">
              <div>
                <span>Explainability</span>
                <strong>
                  {coverage.percent === null
                    ? "Not assessed"
                    : `${coverage.percent}%`}
                </strong>
              </div>
              <div className="progress-track">
                <i style={{ width: `${coverage.percent ?? 0}%` }} />
              </div>
              <span className="muted small">
                {coverage.supported} / {coverage.total} evidence-backed answers
              </span>
            </div>
            {node.id === "legacy-adapter" && (
              <div className="failure-card">
                <HelpCircle size={21} />
                <span className="eyebrow">TEARDOWN FAILED</span>
                <p>We found the code. We couldn't establish the context.</p>
                <ul>
                  <li>Owner unknown</li>
                  <li>No documentation evidence</li>
                  <li>No runtime behaviour evidence</li>
                  <li>No test coverage evidence</li>
                </ul>
                <small>Missing knowledge, not proof of malfunction.</small>
              </div>
            )}
            {node.factors && (
              <section className="factor-section">
                <h3>
                  What drives the score <ShieldAlert size={14} />
                </h3>
                {(Object.keys(factorWeights) as (keyof RiskFactors)[]).map(
                  (k) => (
                    <div className="factor" key={k}>
                      <div>
                        <span>{factorLabels[k]}</span>
                        <span>
                          {node.factors![k]}{" "}
                          <small>× {Math.round(factorWeights[k] * 100)}%</small>
                        </span>
                      </div>
                      <div className="factor-track">
                        <i
                          style={{
                            width: `${node.factors![k]}%`,
                            background: palette[band],
                          }}
                        />
                      </div>
                    </div>
                  ),
                )}
                <p className="muted small">
                  Illustrative weighted rubric, not a validated risk prediction.
                </p>
              </section>
            )}
            {node.assessed && (
              <section className="questions">
                <h3>
                  The explainability test <BookOpen size={14} />
                </h3>
                {questionKeys.map((k) => (
                  <details key={k}>
                    <summary>
                      <span
                        className={`answer-dot ${node.answers[k] ? "known" : ""}`}
                      />
                      {questionLabels[k]}
                      <ChevronRight size={13} />
                    </summary>
                    <p>
                      {node.answers[k]?.text ??
                        "Unknown. There is not enough evidence in this fixture to establish an answer."}
                    </p>
                    {node.answers[k]?.evidenceIds.map((id) => (
                      <button
                        key={id}
                        className="citation"
                        onClick={() => onEvidence(id)}
                      >
                        <FileText size={12} />
                        {fixture.evidence.find((e) => e.id === id)?.title}
                      </button>
                    ))}
                  </details>
                ))}
              </section>
            )}
            {node.health && (
              <div className="runtime-summary">
                <span className="eyebrow">SYNTHETIC RUNTIME</span>
                <div>
                  <strong>
                    {node.health.latencyMs}
                    <small>ms latency</small>
                  </strong>
                  <strong>
                    {node.health.errorRate}%<small>error rate</small>
                  </strong>
                </div>
              </div>
            )}
            {children.length > 0 && (
              <button className="button full" onClick={() => onDive(node.id)}>
                Take it apart <ArrowDownRight size={16} />
              </button>
            )}
            {!node.assessed && children.length > 0 && (
              <section className="child-list">
                <h3>Inside this module</h3>
                {children.map((child) => (
                  <button key={child.id} onClick={() => onSelect(child.id)}>
                    <GitBranch size={14} />
                    {child.name}
                    <ChevronRight size={14} />
                  </button>
                ))}
              </section>
            )}
          </>
        )}
        {tab === "impact" && (
          <>
            <h3>Potential blast radius</h3>
            <p className="muted small">
              Reverse traversal of declared dependencies. Potential impact is
              not a proven outage.
            </p>
            {affected.length ? (
              affected.map(({ node: n, depth }) => (
                <button
                  className="impact-item"
                  key={n.id}
                  onClick={() => onSelect(n.id)}
                >
                  <ArrowUpRight size={17} />
                  <span>
                    {n.name}
                    <small>
                      {depth === 1
                        ? "Direct dependant"
                        : `${depth} hops · transitive`}
                    </small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))
            ) : (
              <div className="empty-state">
                <GitBranch size={25} />
                <p>No incoming dependencies declared.</p>
                <small>
                  This does not prove that nothing depends on this module.
                </small>
              </div>
            )}
            <h3 className="section-gap">Depends on</h3>
            {fixture.edges
              .filter((e) => e.from === node.id)
              .map((e) => (
                <button
                  className="impact-item"
                  key={e.id}
                  onClick={() => onSelect(e.to)}
                >
                  <ArrowDownRight size={17} />
                  <span>
                    {fixture.nodes.find((n) => n.id === e.to)!.name}
                    <small>{e.type}</small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))}
          </>
        )}
        {tab === "evidence" && (
          <>
            <h3>Evidence, not assumptions</h3>
            <p className="muted small">
              All records are authored synthetic fixtures. Select one to inspect
              its exact cited lines.
            </p>
            {[...new Set(nodeEvidence)].map((id) => {
              const e = fixture.evidence.find((e) => e.id === id)!;
              return (
                <button
                  key={id}
                  className="evidence-item"
                  onClick={() => onEvidence(id)}
                >
                  <div>
                    <FileText size={17} />
                    <span className="tag">{e.type}</span>
                    <ArrowUpRight size={14} />
                  </div>
                  <strong>{e.title}</strong>
                  <small>
                    {e.repoId}/{e.path}
                  </small>
                </button>
              );
            })}
            {!nodeEvidence.length && (
              <div className="empty-state">
                <FileText size={25} />
                <p>No independent evidence for this grouping.</p>
                <small>Inspect an assessed child component.</small>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
