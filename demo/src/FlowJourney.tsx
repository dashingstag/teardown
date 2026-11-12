import {
  Activity,
  ArrowRight,
  Check,
  Code2,
  Database,
  Fingerprint,
  Play,
  RotateCcw,
  ShieldCheck,
  Timer,
  Zap,
} from "lucide-react";
import type { Fixture, Trace } from "../shared/domain";
import { spanProgress, spanState, type Span } from "./flow";

function iconFor(span: Span) {
  if (span.name.includes("retry")) return RotateCcw;
  if (span.status === "error") return Timer;
  if (span.name.includes("config")) return Code2;
  if (span.name.includes("inventory")) return Database;
  if (span.name.includes("payments")) return ShieldCheck;
  if (span.name.includes("fraud") || span.name.includes("velocity"))
    return Fingerprint;
  return Zap;
}

export default function FlowJourney({
  fixture,
  trace,
  time,
  runtime,
  playing,
  motion,
  onReplay,
  onInspect,
}: {
  fixture: Fixture;
  trace: Trace;
  time: number;
  runtime: boolean;
  playing: boolean;
  motion: boolean;
  onReplay: () => void;
  onInspect: (span: Span) => void;
}) {
  const ordered = [...trace.spans].sort((a, b) => a.startMs - b.startMs);
  const duration = Math.max(
    ...trace.spans.map((s) => s.startMs + s.durationMs),
  );
  const current = [...ordered]
    .reverse()
    .find((s) => spanState(s, time) === "active");
  return (
    <section
      className={`flow-journey ${runtime ? "is-runtime" : "is-illustrative"}`}
      aria-label="Visual request journey"
      data-animate={motion && (!runtime || playing)}
    >
      <header>
        <div>
          <span className="eyebrow">
            <Activity size={12} /> REQUEST CHOREOGRAPHY
          </span>
          <h3>{runtime ? trace.name : "One checkout. Every connection."}</h3>
        </div>
        <button className="flow-watch" onClick={onReplay}>
          <Play size={13} /> {runtime ? "Replay" : "Watch the flow"}
          <ArrowRight size={13} />
        </button>
      </header>
      <div className="flow-stages">
        {ordered.map((span, index) => {
          const state = runtime ? spanState(span, time) : "waiting";
          const Icon = state === "complete" ? Check : iconFor(span);
          return (
            <button
              key={span.id}
              className={`flow-stage ${state} ${state === "active" && span.status === "error" ? "timing-out" : ""}`}
              onClick={() => onInspect(span)}
              aria-label={`Inspect ${span.name}`}
              aria-current={state === "active" ? "step" : undefined}
            >
              <div className="flow-stage-top">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>
                  {runtime
                    ? state === "active"
                      ? span.status === "error"
                        ? "TIMEOUT"
                        : "IN FLIGHT"
                      : state.toUpperCase()
                    : "SPAN"}
                </span>
              </div>
              <div className="flow-glyph">
                <Icon size={21} strokeWidth={1.4} />
              </div>
              <strong>
                {fixture.nodes.find((n) => n.id === span.nodeId)?.name}
              </strong>
              <small>{span.name}</small>
              <div className="flow-stage-time">
                <span>
                  {span.durationMs}
                  <small>ms</small>
                </span>
                <ArrowRight size={12} />
              </div>
              <i
                className="flow-stage-progress"
                style={{
                  width: `${runtime ? spanProgress(span, time) * 100 : 0}%`,
                }}
              />
            </button>
          );
        })}
      </div>
      <footer>
        <span className={`flow-indicator ${playing ? "running" : ""}`} />
        <span>
          {runtime
            ? time >= duration
              ? `Request complete · ${duration}ms`
              : `${playing ? "Playing" : "Paused"} · ${current?.name ?? "Ready to start"}`
            : "Illustrative routing · replay to follow the authored trace"}
        </span>
        <span className="flow-synthetic">SYNTHETIC · NOT LIVE</span>
      </footer>
    </section>
  );
}
