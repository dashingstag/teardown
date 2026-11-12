import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import FlowJourney from "./FlowJourney";
import { spanState } from "./flow";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  ExternalLink,
  FileCode2,
  FolderGit2,
  GitBranch,
  Home,
  Layers3,
  ListTree,
  LoaderCircle,
  Menu,
  MousePointer2,
  Network,
  Pause,
  Play,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import {
  ancestors,
  childrenOf,
  explainability,
  investigatorPrompts,
  riskBand,
  riskScore,
  validateFixture,
  type Fixture,
  type Investigation,
} from "../shared/domain";
import Inspector, { EvidenceViewer } from "./Inspector";
import Modal from "./Modal";
import { colorFor, palette, scoreFor, type Lens } from "./view";

const Scene = lazy(() => import("./Scene"));
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return reduced;
}

export default function App() {
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/graph", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("The graph could not be loaded.");
        return r.json();
      })
      .then((raw) => setFixture(validateFixture(raw)))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, []);
  if (error)
    return (
      <div className="boot-state">
        <ShieldAlert size={36} />
        <h1>Unable to load the software twin</h1>
        <p>{error}</p>
        <button className="button" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  if (!fixture)
    return (
      <div className="boot-state">
        <div className="brand-mark">
          <Layers3 size={30} />
        </div>
        <h1>
          TEARDOWN<span className="accent">.</span>
        </h1>
        <LoaderCircle className="spin" />
        <p>Assembling the software twin</p>
      </div>
    );
  return <Workspace fixture={fixture} />;
}

function Workspace({ fixture }: { fixture: Fixture }) {
  const initial = new URLSearchParams(location.search).get("node");
  const start = fixture.nodes.find((n) => n.id === initial);
  const [selectedId, setSelectedId] = useState(start?.id ?? "shopsphere");
  const [scopeId, setScopeId] = useState(start?.parentId ?? "shopsphere");
  const [lens, setLens] = useState<Lens>("architecture");
  const [view, setView] = useState<"3d" | "list">("3d");
  const [exploded, setExploded] = useState(true);
  const [motion, setMotion] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [treeOpen, setTreeOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [expanded, setExpanded] = useState(new Set(["shopsphere", "checkout"]));
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [investigatorOpen, setInvestigatorOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState<Investigation | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [traceId, setTraceId] = useState(fixture.traces[0].id);
  const [traceTime, setTraceTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [following, setFollowing] = useState(false);
  const [located, setLocated] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [tour, setTour] = useState<number | null>(null);
  const followTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const askAbort = useRef<AbortController | null>(null);
  const reducedMotion = useReducedMotion();
  const node = fixture.nodes.find((n) => n.id === selectedId)!;
  const scope = fixture.nodes.find((n) => n.id === scopeId)!;
  const summary = explainability(fixture);
  const blindSpots = fixture.nodes.filter(
    (n) => n.assessed && riskScore(n) === null,
  );
  const searchMatches = fixture.nodes.filter((n) =>
    `${n.name} ${n.description} ${n.repoId ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const visible = childrenOf(fixture, scopeId);
  const trace = fixture.traces.find((t) => t.id === traceId)!;
  const duration = Math.max(
    ...trace.spans.map((s) => s.startMs + s.durationMs),
  );
  const activeIds =
    lens === "runtime"
      ? trace.spans
          .filter(
            (s) =>
              traceTime >= s.startMs && traceTime < s.startMs + s.durationMs,
          )
          .map((s) => s.nodeId)
      : [];
  const evidence = fixture.evidence.find((e) => e.id === evidenceId);
  function stopFollow() {
    if (followTimer.current) clearInterval(followTimer.current);
    followTimer.current = null;
    setFollowing(false);
  }
  useEffect(
    () => () => {
      if (followTimer.current) clearInterval(followTimer.current);
      askAbort.current?.abort();
    },
    [],
  );
  useEffect(() => {
    const url = new URL(location.href);
    if (selectedId === "shopsphere") url.searchParams.delete("node");
    else url.searchParams.set("node", selectedId);
    history.replaceState(null, "", url);
  }, [selectedId]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const delta = Math.min(now - previous, 100);
      previous = now;
      setTraceTime((t) => Math.min(duration, t + (delta * speed) / 10));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, duration]);
  useEffect(() => {
    if (playing && traceTime >= duration) setPlaying(false);
  }, [traceTime, duration, playing]);
  function select(id: string, locate = false) {
    stopFollow();
    setLocated(false);
    setSelectedId(id);
    setInspectorOpen(true);
    setTreeOpen(false);
    if (locate) {
      const n = fixture.nodes.find((n) => n.id === id)!;
      setScopeId(n.parentId ?? n.id);
      setExploded(true);
      setExpanded(
        (old) => new Set([...old, ...ancestors(fixture, id).map((a) => a.id)]),
      );
    }
  }
  function dive(id: string) {
    stopFollow();
    if (childrenOf(fixture, id).length) {
      setScopeId(id);
      setExploded(true);
    }
    setSelectedId(id);
    setInspectorOpen(true);
  }
  function reset() {
    stopFollow();
    askAbort.current?.abort();
    setAsking(false);
    setSelectedId("shopsphere");
    setScopeId("shopsphere");
    setLens("architecture");
    setExploded(true);
    setMotion(true);
    setResetKey((k) => k + 1);
    setPlaying(false);
    setTraceTime(0);
    setTraceId(fixture.traces[0].id);
    setSpeed(1);
    setTour(null);
    setLocated(false);
    setAnswer(null);
    setPrompt("");
    setAskError("");
    setQuery("");
    setEvidenceId(null);
    setResultOpen(false);
    setInvestigatorOpen(false);
    setTreeOpen(false);
    setInspectorOpen(false);
    setExpanded(new Set(["shopsphere", "checkout"]));
  }
  function replay() {
    stopFollow();
    setLens("runtime");
    setScopeId("shopsphere");
    setExploded(true);
    setTraceTime(0);
    setPlaying(true);
  }
  function follow() {
    stopFollow();
    setLens("risk");
    setExploded(true);
    setPlaying(false);
    setLocated(false);
    setFollowing(true);
    const path = [
      "checkout",
      "fraud-service",
      "velocity",
      "velocity-class",
      "evaluate",
    ];
    let index = 0;
    const step = () => {
      const id = path[index];
      const n = fixture.nodes.find((n) => n.id === id)!;
      setSelectedId(id);
      setScopeId(n.parentId!);
      setInspectorOpen(true);
      setExpanded(
        (old) => new Set([...old, ...ancestors(fixture, id).map((a) => a.id)]),
      );
      index++;
      if (index === path.length) {
        stopFollow();
        setLocated(true);
      }
    };
    step();
    if (index < path.length)
      followTimer.current = setInterval(step, reducedMotion ? 250 : 1500);
  }
  async function ask(text: string) {
    if (!text.trim()) return;
    askAbort.current?.abort();
    const abort = new AbortController();
    askAbort.current = abort;
    setPrompt(text);
    setAsking(true);
    setAskError("");
    try {
      const r = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, selectedNodeId: selectedId }),
        signal: abort.signal,
      });
      if (!r.ok)
        throw new Error(
          "The investigator is unavailable. Try a suggested question.",
        );
      const data: Investigation = await r.json();
      if (
        !fixture.nodes.some((n) => n.id === data.focusNodeId) ||
        !data.evidenceIds.every((id) =>
          fixture.evidence.some((e) => e.id === id),
        )
      )
        throw new Error("Invalid evidence response.");
      setAnswer(data);
      select(data.focusNodeId, true);
      if (/risk|danger|modern|first/i.test(text)) setLens("risk");
    } catch (e) {
      if (!abort.signal.aborted)
        setAskError(e instanceof Error ? e.message : "Unable to investigate.");
    } finally {
      if (askAbort.current === abort) setAsking(false);
    }
  }
  function tourStep(step: number) {
    stopFollow();
    setTour(step);
    setLocated(false);
    if (step === 0) {
      setSelectedId("shopsphere");
      setScopeId("shopsphere");
      setLens("architecture");
      setExploded(true);
      setPlaying(false);
    }
    if (step === 1) {
      select("velocity", true);
      setTour(step);
    }
    if (step === 2) replay();
    if (step === 3) {
      setPlaying(false);
      setLens("risk");
      select("legacy-adapter", true);
      setTour(step);
    }
    if (step === 4) follow();
  }
  const tourCaptions = [
    "See the estate, not just its repositories. Click a module to inspect it.",
    "From business capability to code. Take Velocity rules apart to reach evaluate().",
    "Follow a purchase. The glowing modules share a clock with the span timeline.",
    "We found the code, but not the context. Unknown does not mean safe.",
    "Follow the highest known risk. Inspect the configuration, then review the result.",
  ];
  function renderTree(id: string, depth = 0): ReactNode {
    const n = fixture.nodes.find((n) => n.id === id)!;
    const children = childrenOf(fixture, id);
    return (
      <div key={id}>
        <div
          className={`tree-row ${selectedId === id ? "selected" : ""}`}
          style={{ paddingLeft: 10 + depth * 13 }}
        >
          {children.length ? (
            <button
              className="tree-toggle"
              aria-label={`${expanded.has(id) ? "Collapse" : "Expand"} ${n.name}`}
              aria-expanded={expanded.has(id)}
              onClick={() =>
                setExpanded((old) => {
                  const next = new Set(old);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                })
              }
            >
              {expanded.has(id) ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
            </button>
          ) : (
            <span className="tree-spacer" />
          )}
          <button
            className="tree-select"
            onClick={() => select(id, true)}
            aria-current={selectedId === id ? "true" : undefined}
          >
            {n.kind === "system" ? (
              <Box size={14} />
            ) : (
              <span
                className="status-dot"
                style={{ background: colorFor(fixture, n, lens) }}
              />
            )}
            <span>{n.name}</span>
            {n.assessed && riskScore(n) === null && <CircleHelp size={12} />}
          </button>
        </div>
        {expanded.has(id) && children.map((c) => renderTree(c.id, depth + 1))}
      </div>
    );
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            reset();
          }}
          aria-label="Teardown home"
        >
          <div className="brand-mark">
            <Layers3 size={20} />
          </div>
          <span>
            teardown<span className="accent">.</span>
          </span>
        </a>
        <div className="header-divider" />
        <span className="workspace-label">
          Software intelligence <ChevronDown size={13} />
        </span>
        <div className="header-right">
          <span className="demo-badge">
            <span />
            SYNTHETIC DEMO
          </span>
          <button
            className="search-trigger"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={14} />
            <span>Find anything</span>
            <kbd>
              <Command size={10} /> K
            </kbd>
          </button>
          <button
            className="icon-button"
            aria-label="About this demo"
            onClick={() => setHelpOpen(true)}
          >
            <CircleHelp size={18} />
          </button>
          <div className="avatar header-avatar">SS</div>
        </div>
      </header>
      <div className="workspace">
        <aside className={`sidebar ${treeOpen ? "mobile-open" : ""}`}>
          <div className="sidebar-heading">
            <span className="eyebrow">WORKSPACE</span>
            <button
              className="icon-button mobile-only"
              aria-label="Close navigation"
              onClick={() => setTreeOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          <button
            className="workspace-switch"
            onClick={() => {
              setScopeId("shopsphere");
              select("shopsphere");
            }}
          >
            <div className="workspace-symbol">
              <Box size={19} />
            </div>
            <div>
              <strong>ShopSphere</strong>
              <small>Commerce platform</small>
            </div>
            <ChevronDown size={13} />
          </button>
          <div className="sidebar-section">
            <span className="eyebrow">EXPLORE</span>
            <button
              className="nav-item active"
              onClick={() => {
                setView("3d");
                setScopeId("shopsphere");
                setTreeOpen(false);
              }}
            >
              <Network size={16} />
              Software twin<span className="tiny-badge">LIVE</span>
            </button>
            <button
              className="nav-item"
              onClick={() => {
                replay();
                setTreeOpen(false);
              }}
            >
              <Activity size={16} />
              Runtime traces<span className="nav-count">2</span>
            </button>
            <button
              className="nav-item"
              onClick={() => {
                setLens("risk");
                setScopeId("shopsphere");
                setExploded(true);
                setTreeOpen(false);
              }}
            >
              <ShieldAlert size={16} />
              Risk landscape
            </button>
          </div>
          <div className="tree-heading">
            <span className="eyebrow">SYSTEM EXPLORER</span>
            <span>{fixture.nodes.length}</span>
          </div>
          <nav className="tree" aria-label="System hierarchy">
            {renderTree("shopsphere")}
          </nav>
          <div className="repo-summary">
            <FolderGit2 size={15} />
            <span>{fixture.repositories.length} virtual repositories</span>
            <button
              className="icon-button"
              aria-label="About repository fixtures"
              onClick={() => setHelpOpen(true)}
            >
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="sidebar-bottom">
            <span className="status-dot" />
            <span>All data stays synthetic</span>
            <small>{fixture.version}</small>
          </div>
        </aside>
        <main className="main-panel">
          <div className="page-heading">
            <div>
              <div className="breadcrumbs">
                <button
                  className="icon-button mobile-only"
                  aria-label="Open system navigation"
                  onClick={() => setTreeOpen(true)}
                >
                  <Menu size={17} />
                </button>
                <button
                  onClick={() => {
                    setScopeId("shopsphere");
                    select("shopsphere");
                  }}
                >
                  <Home size={12} />
                  Workspace
                </button>
                <ChevronRight size={12} />
                <span>Software twin</span>
              </div>
              <h1>
                ShopSphere<span className="environment-tag">DEMO ESTATE</span>
              </h1>
              <p>See the flow. Follow the risk. Find the unknowns.</p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary tour-start"
                onClick={() => tourStep(0)}
              >
                <Play size={14} />
                Guided tour
              </button>
              <button className="button" onClick={follow}>
                <Target size={15} />
                <span>Follow the risk</span>
              </button>
            </div>
          </div>
          <div className="metric-strip">
            <div>
              <span>BUSINESS CAPABILITIES</span>
              <strong>
                {String(childrenOf(fixture, "shopsphere").length).padStart(
                  2,
                  "0",
                )}
                <small>connected modules</small>
              </strong>
            </div>
            <div>
              <span>ASSESSED COMPONENTS</span>
              <strong>
                {fixture.nodes.filter((n) => n.assessed).length}
                <small>of {fixture.nodes.length} total nodes</small>
              </strong>
            </div>
            <div>
              <span>EXPLAINABILITY</span>
              <strong className="accent">
                {summary.percent}%
                <small>
                  {summary.supported}/{summary.total} supported answers
                </small>
              </strong>
            </div>
            <button
              className="metric-risk"
              onClick={() => select("legacy-adapter", true)}
            >
              <span>
                CRITICAL BLIND SPOTS <ArrowUpRight size={12} />
              </span>
              <strong className="purple">
                {String(blindSpots.length).padStart(2, "0")}
                <small>needs investigation</small>
              </strong>
            </button>
          </div>
          <div className="canvas-card">
            <div className="canvas-toolbar">
              <div className="lens-tabs" aria-label="Visualisation lens">
                {(
                  [
                    {
                      id: "architecture",
                      icon: Network,
                      label: "Architecture",
                    },
                    { id: "risk", icon: ShieldAlert, label: "Risk" },
                    { id: "runtime", icon: Activity, label: "Runtime" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    className={lens === t.id ? "active" : ""}
                    onClick={() => {
                      stopFollow();
                      setLens(t.id);
                      if (t.id !== "runtime") setPlaying(false);
                    }}
                  >
                    <t.icon size={14} />
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="view-actions">
                <button
                  className={`icon-button ${motion && !reducedMotion ? "active" : ""}`}
                  aria-label={
                    motion && !reducedMotion
                      ? "Pause ambient animation"
                      : "Resume ambient animation"
                  }
                  title={
                    reducedMotion
                      ? "Reduced motion is enabled on your device"
                      : "Toggle illustrative flow animation"
                  }
                  aria-pressed={motion && !reducedMotion}
                  disabled={reducedMotion}
                  onClick={() => setMotion(!motion)}
                >
                  {motion && !reducedMotion ? (
                    <Pause size={15} />
                  ) : (
                    <Play size={15} />
                  )}
                </button>
                <span />
                <button
                  className={`icon-button ${view === "3d" ? "active" : ""}`}
                  aria-label="3D view"
                  aria-pressed={view === "3d"}
                  onClick={() => setView("3d")}
                >
                  <Box size={16} />
                </button>
                <button
                  className={`icon-button ${view === "list" ? "active" : ""}`}
                  aria-label="2D list view"
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                >
                  <ListTree size={16} />
                </button>
                <span />
                <button
                  className="icon-button"
                  aria-label="Reset view and demo"
                  onClick={reset}
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            </div>
            <div
              className={`scene-area ${!motion || reducedMotion ? "motion-paused" : ""}`}
            >
              <div className="scene-topline">
                <span>
                  <span className="status-dot" /> {scope.name.toUpperCase()}{" "}
                  <small>/ {visible.length || 1} modules</small>
                </span>
                <button
                  className={`explode-toggle ${exploded ? "active" : ""}`}
                  onClick={() => setExploded(!exploded)}
                >
                  <Layers3 size={14} />
                  {exploded ? "Reassemble" : "Explode view"}
                </button>
              </div>
              <div className="scene-story">
                <span>
                  {lens === "runtime"
                    ? "SPAN PLAYBACK"
                    : lens === "risk"
                      ? "RISK LANDSCAPE"
                      : "THE LIVING ARCHITECTURE"}
                </span>
                <p>
                  {lens === "runtime"
                    ? "A request, made visible."
                    : lens === "risk"
                      ? "Every connection carries consequence."
                      : "Not a codebase. An ecosystem."}
                </p>
                <small>
                  {lens === "runtime"
                    ? "Packet position illustrates span progress, not network travel time."
                    : "Illustrative packets on evidence-backed dependencies · not live traffic"}
                </small>
              </div>
              <button
                className="scene-flow-control"
                onClick={() => {
                  if (lens !== "runtime") replay();
                  else {
                    if (traceTime >= duration) setTraceTime(0);
                    setPlaying(!playing);
                  }
                }}
              >
                {playing && lens === "runtime" ? (
                  <Pause size={14} />
                ) : (
                  <Play size={14} />
                )}
                {lens !== "runtime"
                  ? "Watch the flow"
                  : playing
                    ? "Pause visual flow"
                    : "Play visual flow"}
                {lens === "runtime" && (
                  <code>
                    {Math.round(traceTime)} / {duration} ms
                  </code>
                )}
              </button>
              {view === "3d" ? (
                <SceneBoundary
                  fallback={
                    <div className="scene-fallback">
                      <Box size={30} />
                      <h3>3D isn't available on this device.</h3>
                      <button
                        className="button"
                        onClick={() => setView("list")}
                      >
                        Open accessible 2D map
                      </button>
                    </div>
                  }
                >
                  <Suspense
                    fallback={
                      <div className="scene-fallback">
                        <LoaderCircle className="spin" />
                        <p>Preparing the scene</p>
                      </div>
                    }
                  >
                    <Scene
                      fixture={fixture}
                      scopeId={scopeId}
                      selectedId={selectedId}
                      lens={lens}
                      exploded={exploded}
                      activeIds={activeIds}
                      reducedMotion={reducedMotion}
                      motion={motion}
                      trace={trace}
                      traceTime={traceTime}
                      resetKey={resetKey}
                      onSelect={select}
                      onDive={dive}
                      onFallback={() => setView("list")}
                      onInteract={stopFollow}
                    />
                  </Suspense>
                </SceneBoundary>
              ) : (
                <div className="map-list">
                  {(visible.length ? visible : [scope]).map((n) => (
                    <div
                      key={n.id}
                      className={`map-list-item ${selectedId === n.id ? "selected" : ""}`}
                    >
                      <button onClick={() => select(n.id)}>
                        <span
                          className="map-node-icon"
                          style={{ color: colorFor(fixture, n, lens) }}
                        >
                          <Layers3 size={25} />
                        </span>
                        <span>
                          <strong>{n.name}</strong>
                          <small>{n.description}</small>
                        </span>
                        <span
                          className="list-risk"
                          style={{
                            color: palette[riskBand(scoreFor(fixture, n))],
                          }}
                        >
                          {scoreFor(fixture, n) ?? "?"}
                          <small>risk</small>
                        </span>
                      </button>
                      {childrenOf(fixture, n.id).length > 0 && (
                        <button
                          className="icon-button"
                          aria-label={`Take ${n.name} apart`}
                          onClick={() => dive(n.id)}
                        >
                          <ArrowDownRight size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="scene-bottomline">
                <div>
                  {lens === "risk" ? (
                    Object.entries(palette).map(([name, color]) => (
                      <span key={name}>
                        <i style={{ background: color }} />
                        {name}
                      </span>
                    ))
                  ) : (
                    <>
                      <span>
                        <MousePointer2 size={12} />
                        Select to inspect
                      </span>
                      <span className="desktop-hint">
                        Drag to orbit · Scroll to zoom
                      </span>
                    </>
                  )}
                </div>
                <span className="dimension-label">
                  {view === "3d" ? "3D" : "2D"} /{" "}
                  {exploded ? "EXPLODED" : "ASSEMBLED"}
                </span>
              </div>
            </div>
            <div className="scope-bar">
              <div className="scope-breadcrumbs">
                {ancestors(fixture, scopeId).map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && <ChevronRight size={12} />}
                    <button
                      onClick={() => {
                        stopFollow();
                        setScopeId(a.id);
                        setSelectedId(a.id);
                      }}
                    >
                      {i === 0 && <Box size={13} />} {a.name}
                    </button>
                  </span>
                ))}
              </div>
              <button
                className="scope-inspect"
                onClick={() => setInspectorOpen(true)}
              >
                Inspect selected <ChevronRight size={13} />
              </button>
            </div>
            <FlowJourney
              fixture={fixture}
              trace={trace}
              time={traceTime}
              runtime={lens === "runtime"}
              playing={playing && lens === "runtime"}
              motion={motion && !reducedMotion}
              onReplay={replay}
              onInspect={(span) => {
                setLens("runtime");
                setPlaying(false);
                setTraceTime(span.startMs + Math.min(40, span.durationMs / 2));
                select(span.nodeId, true);
              }}
            />
            {lens === "runtime" && (
              <div className="trace-panel">
                <div className="trace-header">
                  <span>
                    <Activity size={14} />
                    SYNTHETIC TRACE
                  </span>
                  <select
                    aria-label="Trace scenario"
                    value={traceId}
                    onChange={(e) => {
                      setTraceId(e.target.value);
                      setTraceTime(0);
                      setPlaying(false);
                    }}
                  >
                    {fixture.traces.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <span>{duration}ms</span>
                </div>
                <div className="trace-controls">
                  <button
                    className="icon-button"
                    aria-label={playing ? "Pause trace" : "Play trace"}
                    onClick={() => {
                      if (traceTime >= duration) setTraceTime(0);
                      setPlaying(!playing);
                    }}
                  >
                    {playing ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    value={traceTime}
                    aria-label="Trace playback position"
                    onChange={(e) => {
                      setTraceTime(Number(e.target.value));
                      setPlaying(false);
                    }}
                  />
                  <code>{Math.round(traceTime)}ms</code>
                  <select
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    aria-label="Playback speed"
                  >
                    <option value={0.5}>0.5×</option>
                    <option value={1}>1×</option>
                    <option value={2}>2×</option>
                  </select>
                </div>
                <div className="trace-spans">
                  {trace.spans.map((span) => (
                    <button
                      key={span.id}
                      className={`trace-span ${spanState(span, traceTime) === "active" ? "active" : ""}`}
                      onClick={() => select(span.nodeId, true)}
                    >
                      <span>{span.name}</span>
                      <div>
                        <i
                          style={{
                            left: `${(span.startMs / duration) * 100}%`,
                            width: `${(span.durationMs / duration) * 100}%`,
                            background:
                              span.status === "error" ? "#fa737b" : "#63d9cd",
                          }}
                        />
                      </div>
                      <code>{span.durationMs}ms</code>
                    </button>
                  ))}
                </div>
                <small className="muted">
                  Authored span replay · slowed 10× at 1× speed · no live
                  telemetry
                </small>
              </div>
            )}
          </div>
          {(following || located) && (
            <div
              className={`location-banner ${located ? "located" : ""}`}
              role="status"
            >
              <Target size={17} />
              <div>
                <strong>
                  {following
                    ? "Following the highest known risk…"
                    : "Highest-risk contributor located"}
                </strong>
                <span>
                  {following
                    ? node.name
                    : "Inspect evaluate() and its legacy configuration evidence. Unknown areas may conceal greater risk."}
                </span>
              </div>
              {following ? (
                <button className="text-button" onClick={stopFollow}>
                  Stop
                </button>
              ) : (
                <>
                  <button
                    className="text-button"
                    onClick={() => setEvidenceId("legacy-config")}
                  >
                    View evidence
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setResultOpen(true)}
                  >
                    Result <ArrowRight size={13} />
                  </button>
                </>
              )}
            </div>
          )}
          {tour !== null && (
            <div className="tour-bar">
              <span className="tour-step">
                {String(tour + 1).padStart(2, "0")} / 05
              </span>
              <div>
                <strong>THE TEARDOWN TEST</strong>
                <p>{tourCaptions[tour]}</p>
              </div>
              <button
                className="text-button"
                disabled={tour === 0}
                onClick={() => tourStep(tour - 1)}
              >
                Back
              </button>
              <button
                className="button"
                onClick={() =>
                  tour === 4 ? setResultOpen(true) : tourStep(tour + 1)
                }
              >
                {tour === 4 ? "See result" : "Next"}
                <ArrowRight size={14} />
              </button>
              <button
                className="icon-button"
                aria-label="End guided tour"
                onClick={() => {
                  setTour(null);
                  stopFollow();
                }}
              >
                <X size={17} />
              </button>
            </div>
          )}
          <footer className="main-footer">
            <span>
              <GitBranch size={12} />
              Curated software twin <span className="footer-dot" />
              {fixture.version}
            </span>
            <button onClick={() => setHelpOpen(true)}>
              Not another code browser <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
        <div
          className={`inspector-wrapper ${inspectorOpen ? "mobile-open" : ""}`}
        >
          <Inspector
            key={node.id}
            fixture={fixture}
            node={node}
            onSelect={(id) => select(id, true)}
            onDive={dive}
            onEvidence={setEvidenceId}
            onClose={() => setInspectorOpen(false)}
          />
        </div>
      </div>
      <button
        className="investigator-launch"
        onClick={() => setInvestigatorOpen(!investigatorOpen)}
      >
        <Sparkles size={17} />
        <span>Ask the investigator</span>
        <span className="ai-tag">DEMO</span>
      </button>
      {investigatorOpen && (
        <section
          className="investigator-panel"
          aria-label="Scripted investigator"
        >
          <header>
            <div>
              <Sparkles size={18} />
              <strong>System investigator</strong>
            </div>
            <button
              className="icon-button"
              aria-label="Close investigator"
              onClick={() => setInvestigatorOpen(false)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="investigator-context">
            <span className="status-dot" />
            GRAPH-BACKED · SCRIPTED DEMO
          </div>
          <div className="investigator-content">
            <p className="investigator-intro">
              Ask the system, not just the source.
            </p>
            <p className="muted small">
              Four supported questions. Every answer comes from the curated
              graph, never a live model.
            </p>
            <div className="prompt-list">
              {investigatorPrompts.map((p) => (
                <button key={p} disabled={asking} onClick={() => void ask(p)}>
                  {p}
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </div>
            {answer && (
              <div className="investigator-answer" aria-live="polite">
                <span className="eyebrow">
                  {answer.supported
                    ? "EVIDENCE-BASED RESPONSE"
                    : "OUTSIDE DEMO SCOPE"}
                </span>
                <p>{answer.answer}</p>
                <div>
                  {answer.evidenceIds.map((id) => (
                    <button
                      className="citation"
                      key={id}
                      onClick={() => setEvidenceId(id)}
                    >
                      <FileCode2 size={12} />
                      {fixture.evidence.find((e) => e.id === id)!.title}
                    </button>
                  ))}
                </div>
                {answer.supported && (
                  <button
                    className="text-button"
                    onClick={() => select(answer.focusNodeId, true)}
                  >
                    Locate in system <ArrowRight size={13} />
                  </button>
                )}
              </div>
            )}
            {askError && (
              <p role="alert" className="error-text">
                {askError}
              </p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(prompt);
            }}
          >
            <input
              aria-label="Question for investigator"
              maxLength={500}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask about this system…"
            />
            <button
              type="submit"
              className="icon-button"
              disabled={asking || !prompt.trim()}
              aria-label="Send question"
            >
              {asking ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Send size={16} />
              )}
            </button>
          </form>
        </section>
      )}
      {searchOpen && (
        <Modal label="Find a component" onClose={() => setSearchOpen(false)}>
          <section className="search-modal">
            <header>
              <Search size={19} />
              <input
                autoFocus
                placeholder="Find a service, class or method…"
                aria-label="Search components"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="icon-button"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
              >
                <X size={17} />
              </button>
            </header>
            <div>
              {searchMatches.slice(0, 12).map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    select(n.id, true);
                    setSearchOpen(false);
                  }}
                >
                  <span
                    className="status-dot"
                    style={{
                      background: colorFor(fixture, n, "architecture"),
                    }}
                  />
                  <span>
                    {n.name}
                    <small>{n.repoId ?? n.kind}</small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))}
              {!searchMatches.length && (
                <p className="empty-state">
                  No matching component. Try a service name or repository.
                </p>
              )}
            </div>
            <footer>
              Search the curated estate · {fixture.nodes.length} nodes
            </footer>
          </section>
        </Modal>
      )}
      {evidence && (
        <EvidenceViewer
          evidence={evidence}
          onClose={() => setEvidenceId(null)}
        />
      )}
      {helpOpen && (
        <Modal
          label="About the teardown demo"
          onClose={() => setHelpOpen(false)}
        >
          <section className="info-modal">
            <header>
              <div className="brand-mark">
                <Layers3 size={23} />
              </div>
              <button
                className="icon-button"
                aria-label="Close about"
                onClick={() => setHelpOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <span className="eyebrow">THE TEARDOWN TEST</span>
            <h2>Inside the software.</h2>
            <p>
              A digital twin you can take apart, inspect and explain. ShopSphere
              is fictional. All code snapshots, ownership records, incidents and
              traces are authored synthetic fixtures.
            </p>
            <p>
              The investigator uses deterministic graph-backed templates, not a
              live AI model. Scores are an illustrative rubric, not predictions.
              Unknown means missing evidence, never safe.
            </p>
            <h3>Five virtual repository snapshots</h3>
            {fixture.repositories.map((r) => (
              <div className="repo-info" key={r.id}>
                <FolderGit2 size={16} />
                <span>
                  <strong>{r.name}</strong>
                  <small>{r.description}</small>
                </span>
              </div>
            ))}
            <p className="muted small">
              3D controls: click to inspect, double-click to dive, drag to
              orbit, scroll to zoom. Use the explorer or 2D list for keyboard
              navigation. Escape closes dialogs.
            </p>
            <a
              href="https://github.com/dashingstag/teardown"
              target="_blank"
              rel="noreferrer"
              className="text-button"
            >
              View the project <ExternalLink size={13} />
            </a>
          </section>
        </Modal>
      )}
      {resultOpen && (
        <Modal label="Teardown result" onClose={() => setResultOpen(false)}>
          <section className="result-modal">
            <header>
              <span className="eyebrow">
                TEARDOWN COMPLETE / SYNTHETIC DEMO
              </span>
              <button
                className="icon-button"
                aria-label="Close result"
                onClick={() => setResultOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="result-icon">
              <Target size={32} />
            </div>
            <h2>
              Understanding is
              <br />
              the first intervention.
            </h2>
            <div className="result-score">
              <strong>{summary.percent}%</strong>
              <span>
                overall explainability
                <small>
                  {summary.supported} of {summary.total} evidence-backed answers
                </small>
              </span>
            </div>
            <div className="result-risk">
              <ShieldAlert size={20} />
              <div>
                <span className="eyebrow">
                  HIGHEST KNOWN RISK ·{" "}
                  {riskScore(fixture.nodes.find((n) => n.id === "velocity")!)}
                  /100
                </span>
                <h3>Velocity rules</h3>
                <p>
                  Business-critical. One maintainer. Weak documentation. Twelve
                  synthetic recent failures.
                </p>
              </div>
            </div>
            <div className="result-unknown">
              <CircleHelp size={18} />
              <p>
                <strong>One critical blind spot.</strong> Legacy Payment Adapter
                still lacks ownership, documentation, runtime and test evidence.
                Unknown risk may be greater.
              </p>
            </div>
            <div className="next-action">
              <Check size={16} />
              <span>
                Next: verify the legacy configuration, establish a second owner
                and add contract tests.
              </span>
            </div>
            <button
              className="button full"
              onClick={() => {
                setResultOpen(false);
                setTour(null);
                select("velocity", true);
                setLens("risk");
              }}
            >
              Explore the evidence <ArrowRight size={15} />
            </button>
          </section>
        </Modal>
      )}
    </div>
  );
}
