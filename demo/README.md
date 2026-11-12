# ShopSphere · the teardown test

A read-only, synthetic software estate you can take apart. React Three Fiber renders the twin; a small Express server serves the production bundle and fixture-backed API. The original mechanical examples in the repository root remain unchanged.

## Run locally

Use Node **24.x**. From `demo/`:

```sh
npm ci
npm run dev       # Vite :5173; API :8080
```

Production:

```sh
npm test
npm run build
PORT=8080 npm start
```

The server listens on `0.0.0.0`. In development, Vite proxies `/api` to the server; the API's default port must remain 8080 unless the Vite proxy is changed too.

## Deploying on Railway

1. Create one service from this GitHub repository, with deploy branch **main**.
2. Leave **Root Directory empty**. Railway detects the root `Dockerfile`, which builds only `demo/`. Do not use the old root `npm run build`: that builds mechanical simulators.
3. The root `railway.json` configures Docker and `/health`. Leave build/start overrides empty so the Docker image's `npm start` command is used.
4. Generate a public domain. Its target port must match Railway's `PORT`, which the server reads. A successful build is not proof the public port is correct.
5. No database, volume, GitHub access token or AI credentials are needed by the app. Optional variables: `NODE_ENV=production`, `INVESTIGATOR_MODE=scripted` (the only supported provider mode). Never put secrets in `VITE_*` variables.
6. Enable Wait for CI if available. The workflow runs unit/API tests, type checks, a production build, HTTP smoke checks and a Docker health check on PRs and pushes to main. Deployment still requires an authorised merge.
7. Check `/health`, `/api/graph`, `/`, `/?node=velocity`, and missing API/asset 404s on the public URL. Check a second browser to confirm viewer state is independent.

The Dockerfile uses a multi-stage Node 24 build, production-only runtime dependencies and a non-root user. Frontend, server and fixtures ship in one image. All 3D work runs on the viewer's device; Railway needs no GPU. No persistent data means rollback needs no migration. Railway healthchecks gate deployment; they do **not** continuously monitor uptime.

```sh
# From the repository root
docker build -t shopsphere .
docker run --rm -p 8080:8080 -e PORT=8080 shopsphere
```

## Demo controls

- Click a module to inspect; double-click or choose **Take it apart** to dive. Drag to orbit, scroll to zoom.
- The explorer and **2D list view** provide keyboard/touch alternatives. WebGL failure offers the 2D fallback. Reduced motion disables ambient animation and smooth camera flights; explicit trace playback/scrubbing remains available.
- The estate opens exploded, with distinct processor, scanner, database, portal, ledger and recommendation sculptures. Luminous directional routes show projected graph dependencies. Ambient packets are illustrative, not measured traffic; use **Pause ambient animation** in the toolbar to freeze them.
- **Watch the flow** starts the authored checkout trace. The visual request journey shows each span, progress, completion, timeout and retry; choose a stage to pause at that span and inspect its node. Parent and child spans overlap (the waterfall preserves their timing). Runtime packets illustrate span progress, not network transit time; collapsed routes retain their underlying graph edges and trace spans. Active modules glow mint (processing) or red (a timeout span); idle runtime colours still reflect the separate fixture health metrics.
- Search by component, repository or description; Ctrl/Cmd+K opens search.
- **Architecture / Risk / Runtime** switch visual lenses. Unknown is purple, not healthy. Collapsed risk is maximum known assessed descendant risk; the inspector also reports unknown descendants. The runtime colour of a collapsed group reflects its worst known descendant error rate, not a measured group-level latency.
- **Runtime traces** exposes the replay, scrubber, scenario and speed controls. Playback is deliberately slowed 10× at the 1× speed setting; span durations remain actual fixture milliseconds. Pausing freezes trace progress and its request packets; ambient animation has a separate control.
- **Follow the risk** steps through Checkout, Fraud decision service, Velocity rules, VelocityRule and evaluate(). Stop, select another module or Reset to interrupt it. The legacy configuration evidence opens from the completion banner.
- **Ask the investigator** supports the four displayed question families. It is a labelled deterministic graph/template demonstration, not live AI. Its impact answer is contextual to the selected node. Out-of-scope questions are disclosed rather than invented.
- Reset restores the initial scene, lens, trace, selection and investigator. `?node=<id>` is a shareable selection, not shared server state.

## Five-minute presenter script

1. **Meet the estate (0–1 min).** Start Reset, then Guided tour. Show the assembled system and explode the six capabilities. “This is the purchase experience, not a list of repositories.”
2. **Dive to code (1–2 min).** Select Velocity rules; take it apart to VelocityRule, then evaluate(). Open Evidence → VelocityRule.evaluate(). “A business decision reaches an inspectable source boundary.”
3. **Replay a purchase (2–3 min).** Open Runtime traces and Play. Switch to Slow configuration + retry, replay, and inspect the red configuration span. “These are synthetic spans showing the behaviour we would connect to real telemetry later.”
4. **Expose what is unknown (3–4 min).** Select Payments → Payments API → Legacy Payment Adapter, or the critical-blind-spots metric. “We found the code, but cannot establish its owner, docs, runtime or tests.” TEARDOWN FAILED is an evidence-completeness failure, not proof of malfunction.
5. **Follow the risk (4–5 min).** Ask which service to modernise first, then Follow the risk. Open configuration evidence and Result. “Velocity rules is the highest *known* risk. Unknown areas may conceal more. First verify the bypass and establish a second owner.”

The Guided tour has explicit Next/Back steps and can be interrupted. The final result is also reachable from the risk completion banner.

## Fixture and scoring contract

`fixtures/shopsphere.json` is the versioned authoring source: 40 nodes, 25 assessed components, 5 virtual repositories, representative dependency edges, source/config/test/ownership/incident snapshots and 2 synthetic traces. The loader builds explicitly labelled curated component records from the authored descriptions, purpose and source paths. Those records are not scans or claims of real source analysis. Only representative files are included; a `where` answer identifies the fictional location, not a complete repository clone.

Startup validates all IDs, parents, containment cycles, references, evidence line ranges and spans. The generated API graph is also validated by the client. All answer citations and edge evidence must resolve to fixture IDs. There is no arbitrary file/URL fetching or code execution.

Risk weights are criticality 30%, ownership fragility 25%, documentation gap 20%, incident exposure 15%, coupling 10%. Velocity's factor values (100, 100, 90, 80, 70) yield **92**. These are illustrative scores, not a validated predictive model. Bands: 0–24 healthy; 25–49 attention; 50–74 elevated; 75–100 critical. Missing inputs are null/unknown.

Explainability counts evidence-backed answers to six questions per assessed component. The authored coverage is 21×4 + 2×5 + 1×6 + 1×2 = **102/150 = 68%**. Structural containers do not enlarge the denominator. Unknown questions remain unknown. Health is a separate fixture metric; replay spans are not a live monitoring feed.

Potential blast radius is reverse dependency reachability with cycle protection, not proof that a change will cause an outage. “Highest-risk contributor located” is a scenario navigation result, not automatic causal analysis.

## API

- `GET /health` — fixture version and readiness, no provider calls.
- `GET /api/graph` — graph, evidence, traces and explainability summary.
- `GET /api/traces/:id`, `GET /api/evidence/:id` — allowlisted fixture records; unknown IDs return 404.
- `POST /api/investigate` — `{ "prompt": "Why is Velocity rules risky?", "selectedNodeId": "velocity" }`; 500-character prompt limit, 4 KB body limit, validated node IDs. Returns `answer`, `evidenceIds`, `focusNodeId`, `mode: "scripted"`, `supported`.

No writes, uploads, real credentials, provider spend or customer data. If adding real estate ingestion or genuine AI later, design authentication/tenancy/retention, untrusted-evidence handling, output/citation validation, rate limits and cost controls first.

## Release checklist

- `npm test` and `npm run build` pass; production-only image serves frontend/API and correct 404s.
- Verify hero-path navigation, citations, unknown failure, trace timing, impact traversal, four investigator questions and Reset.
- Check laptop rendering, touch layout, keyboard tree, reduced motion, WebGL fallback and separate viewers. Target 30 fps on a documented mid-range laptop and useful initial content within 3 seconds on a warm service; these require measurement, not assumption.
- Rehearse twice from Reset against the public Railway URL. Record tested browsers and gaps; do not claim iOS verification from a Linux browser.
