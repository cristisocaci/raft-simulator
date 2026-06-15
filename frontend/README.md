# Frontend

The frontend is a React single-page application with three pages: **Dashboard** (single simulation), **Comparison** (multi-topology analysis), and **History** (browse and replay past runs). See the [root README](../README.md) for setup and run instructions.

---

## Table of Contents

1. [Dashboard Page](#dashboard-page-pagesdashboardjs)
2. [Comparison Page](#comparison-page-pagescomparisonpagejs)
3. [History Page](#history-page-pageshistorypagejs)
4. [Component Details](#component-details)
5. [CSV Export](#csv-export-utilscsvexportjs)
6. [File Reference](#file-reference)

---

## Dashboard Page (`pages/Dashboard.js`)

This is the primary workspace. It manages three categories of state:

1. **Configuration state**: Topology type, node count, message delay, packet loss, failure/recovery probabilities, duration, seed, and optional leader failure injection tick.
2. **Simulation state**: The full result object returned from the API (graph, events, snapshots, metrics).
3. **Playback state**: Current snapshot index, playing/paused flag, and playback speed.

The layout is a 12-column CSS grid:
- **Left column (3 cols)**: `SimulationPanel` — all configuration controls.
- **Centre column (6 cols)**: `NetworkGraph` — SVG topology visualisation with playback controls below it.
- **Right column (3 cols)**: Node state badges at the top, then a scrollable `EventLog`.
- **Bottom row (12 cols)**: `MetricsPanel` — metric cards and charts. Appears after a simulation completes.

### Playback System

The simulation returns snapshots every 10 ticks. Playback works by advancing a snapshot index via `setInterval`, where the interval is `1000ms / speed`. Available speeds are 1x, 5x, 10x, and 25x. A slider allows manual scrubbing to any snapshot. All components (network graph, node states, event log) react to the current snapshot index.

## Comparison Page (`pages/ComparisonPage.js`)

Operates in two modes controlled by the "Runs" slider:

- **Single run** (Runs = 1): Calls `POST /api/simulations/compare`, which runs one simulation per topology with the same seed. Results are displayed as bar charts and a summary table.
- **Statistical mode** (Runs > 1): Calls `POST /api/simulations/statistical`, which runs N simulations per topology with incrementing seeds. Charts display mean values with error bars (standard deviation), and the table shows `mean +/- std` for each metric.

## History Page (`pages/HistoryPage.js`)

Lists the 50 most recent simulations (`GET /api/simulations/history`) and topology comparisons (`GET /api/comparisons/history`) in two tables, showing key metrics (election time, messages, latency, election count) and, for comparisons, the best-performing topology by first leader election time. Clicking a row or its "Replay" button navigates to the Dashboard or Comparison page with a `?replay=<id>` query parameter, which loads the stored result via `GET /api/simulations/{sim_id}` or `GET /api/comparisons/{comp_id}` instead of running a new simulation.

## Component Details

**`NetworkGraph`** — Renders the topology as an SVG with a `viewBox` of 600x400. Node positions are computed by the backend's `TopologyManager`. Edges are drawn as grey lines. Recent messages (last 10 `message_sent` events) are overlaid as animated dashed green lines using a CSS `@keyframes` animation. Nodes are coloured by state:
- Blue (`#0033CC`): Leader (with a pulsing outer ring)
- Amber (`#F59E0B`): Candidate
- Grey (`#71717A`): Follower
- Red (`#EF4444`): Dead

**`SimulationPanel`** — Configuration form using Shadcn UI `Select` (topology dropdown) and `Slider` (all numeric parameters). Includes a `Switch` toggle for leader failure injection with a secondary slider for the failure tick.

**`MetricsPanel`** — Displays 8 metric cards in a grid, followed by three Recharts visualisations:
1. A line chart of messages sent over time (bucketed in 50-tick intervals).
2. A pie chart showing the breakdown of message types.
3. A bar chart of leader elections (votes received per election).

**`EventLog`** — A scrollable list of simulation events, colour-coded by type. A toggle button shows/hides the high-volume `message_sent` events to make state changes and elections easier to read.

**`ComparisonCharts`** — Renders 6 bar charts (one per key metric) and a detailed table. In statistical mode, uses Recharts' `ErrorBar` component to show standard deviation on each bar. Small SVG topology thumbnails are displayed at the top in single-run mode.

## CSV Export (`utils/csvExport.js`)

Three client-side export functions that generate CSV strings and trigger browser downloads:
- `exportSimulationCSV`: Single simulation metrics + config + election history.
- `exportComparisonCSV`: Side-by-side metrics for all 5 topologies.
- `exportStatisticalCSV`: Mean/std/min/max for all metrics across all topologies.

---

## File Reference

All paths relative to `frontend/src`.

| File | Purpose |
|------|---------|
| `index.js` | React entry point. Renders `<App />` into the DOM. |
| `index.css` | Global styles. Imports Google Fonts (Chivo, IBM Plex Sans, IBM Plex Mono), defines Tailwind base layer and CSS custom properties for the Shadcn UI theme. |
| `App.js` | Root component. Sets up React Router with three routes (`/` → Dashboard, `/compare` → ComparisonPage, `/history` → HistoryPage) and the top navigation bar. |
| `App.css` | Application-specific CSS animations: dashed message flow (`@keyframes dash-flow`), leader node pulse, fade-in transitions, Recharts style overrides, and scrollbar styling. |
| `pages/Dashboard.js` | Main simulation page. Manages configuration, simulation results, and playback state. Renders the 12-column grid layout with all child components and inline playback controls. Supports replaying a stored simulation via `?replay=<id>`. |
| `pages/ComparisonPage.js` | Multi-topology comparison page. Handles single-run and statistical analysis modes, parameter configuration, and CSV export. Supports replaying a stored comparison via `?replay=<id>`. |
| `pages/HistoryPage.js` | Lists past simulations and comparisons from SQLite, with links to replay each one on the Dashboard or Comparison page. |
| `components/NetworkGraph.js` | SVG-based network topology visualisation. Renders nodes (coloured by Raft state), edges, message flow animations, and state labels. |
| `components/SimulationPanel.js` | Configuration sidebar. Contains topology selector, parameter sliders (nodes, delay, loss, failure, recovery, duration, log entries), and leader failure injection toggle. |
| `components/MetricsPanel.js` | Metrics dashboard. Displays 8 key metric cards and 3 Recharts visualisations (messages timeline, message type breakdown, election history). |
| `components/EventLog.js` | Scrollable event log with colour-coded entries. Supports toggling message-level events for readability. |
| `components/ComparisonCharts.js` | Comparison visualisations. Renders 6 metric bar charts (with error bars in statistical mode), topology thumbnails, and a detailed metrics table. |
| `utils/csvExport.js` | Client-side CSV generation and download for single simulations, comparisons, and statistical analyses. |
| `lib/utils.js` | Tailwind CSS class merging utility (`cn` function) used by Shadcn UI components. |
| `hooks/use-toast.js` | Toast notification hook (Shadcn UI). |
| `components/ui/*` | Shadcn UI component library (Button, Card, Select, Slider, Table, Badge, ScrollArea, Switch, Tabs, Tooltip, etc.). |
