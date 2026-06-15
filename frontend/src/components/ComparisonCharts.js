import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ErrorBar,
  Cell,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell as TCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TOPOLOGIES = ["star", "ring", "mesh", "tree", "bus"];

const BAR_COLORS = {
  star: "#0033CC",
  ring: "#F59E0B",
  mesh: "#09090B",
  tree: "#10B981",
  bus: "#EF4444",
};

const TOOLTIP_STYLE = {
  border: "1px solid #27272A",
  borderRadius: 0,
  fontSize: 11,
  fontFamily: "IBM Plex Mono",
};

function SmallTopologyGraph({ graph }) {
  if (!graph) return null;
  const nodeMap = {};
  graph.nodes.forEach((n) => {
    nodeMap[n.id] = n;
  });
  const sx = 120 / 600;
  const sy = 80 / 400;

  return (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      {graph.edges.map((edge, i) => {
        const src = nodeMap[edge.source];
        const dst = nodeMap[edge.target];
        if (!src || !dst) return null;
        return (
          <line
            key={i}
            x1={src.x * sx}
            y1={src.y * sy}
            x2={dst.x * sx}
            y2={dst.y * sy}
            stroke="#D4D4D8"
            strokeWidth={0.5}
          />
        );
      })}
      {graph.nodes.map((n) => (
        <circle key={n.id} cx={n.x * sx} cy={n.y * sy} r={4} fill="#71717A" />
      ))}
    </svg>
  );
}

function MetricBarChart({ data, dataKey, title, isStatistical }) {
  return (
    <div className="border border-zinc-200 p-4" data-testid={`comparison-chart-${dataKey}`}>
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
          <XAxis dataKey="topology" tick={{ fontSize: 10 }} stroke="#A1A1AA" />
          <YAxis tick={{ fontSize: 10 }} stroke="#A1A1AA" />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey={dataKey}>
            {isStatistical && <ErrorBar dataKey={`${dataKey}_std`} width={4} strokeWidth={1.5} stroke="#52525B" />}
            {data.map((entry) => (
              <Cell
                key={entry.topology}
                fill={BAR_COLORS[entry.topology.toLowerCase()] || "#09090B"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const METRIC_DEFS = [
  { label: "Election Time (ticks)", key: "first_leader_election_time", short: "election_time" },
  { label: "Total Messages", key: "total_messages_sent", short: "total_messages" },
  { label: "Avg Latency (ticks)", key: "avg_latency_ticks", short: "avg_latency" },
  { label: "Convergence (ticks)", key: "convergence_time", short: "convergence" },
  { label: "Messages Dropped", key: "total_messages_dropped", short: "dropped" },
  { label: "Throughput", key: "throughput", short: "throughput" },
];

const TABLE_METRICS = [
  { label: "Election Time (ticks)", key: "first_leader_election_time" },
  { label: "Total Messages", key: "total_messages_sent" },
  { label: "Avg Latency (ticks)", key: "avg_latency_ticks" },
  { label: "Avg Hops", key: "avg_latency_hops" },
  { label: "Convergence (ticks)", key: "convergence_time" },
  { label: "Messages Dropped", key: "total_messages_dropped" },
  { label: "Elections Count", key: "election_count" },
  { label: "Throughput", key: "throughput" },
  { label: "Entries Committed", key: "entries_committed" },
];

function buildSingleRunData(results) {
  return TOPOLOGIES.map((t) => {
    const m = results[t]?.metrics || {};
    const row = { topology: t.charAt(0).toUpperCase() + t.slice(1) };
    METRIC_DEFS.forEach((def) => {
      row[def.short] = m[def.key] ?? 0;
    });
    return row;
  });
}

function buildStatData(statResults) {
  return TOPOLOGIES.map((t) => {
    const agg = statResults[t]?.aggregated || {};
    const row = { topology: t.charAt(0).toUpperCase() + t.slice(1) };
    METRIC_DEFS.forEach((def) => {
      const stat = agg[def.key] || {};
      row[def.short] = stat.mean ?? 0;
      row[`${def.short}_std`] = stat.std ?? 0;
    });
    return row;
  });
}

export default function ComparisonCharts({ results, statResults, isStatistical }) {
  const data = isStatistical ? buildStatData(statResults) : buildSingleRunData(results || {});
  const displayResults = isStatistical ? statResults : results;

  if (!displayResults) return null;

  return (
    <div className="p-6 space-y-6" data-testid="comparison-results">
      {/* Topology thumbnails (only for single-run mode with graph data) */}
      {!isStatistical && results && (
        <div className="grid grid-cols-5 gap-4">
          {TOPOLOGIES.map((t) => (
            <div key={t} className="border border-zinc-200 p-2" data-testid={`topology-thumb-${t}`}>
              <div
                className="text-[10px] font-bold uppercase tracking-wider text-center mb-1"
                style={{ color: BAR_COLORS[t] }}
              >
                {t}
              </div>
              <div className="h-16">
                <SmallTopologyGraph graph={results[t]?.graph} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistical mode header */}
      {isStatistical && (
        <div className="border border-zinc-200 p-3 flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Statistical Analysis
          </span>
          <span className="font-mono text-xs text-zinc-700">
            {statResults[TOPOLOGIES[0]]?.num_runs || "N"} runs per topology
          </span>
          <span className="text-[10px] text-zinc-400 ml-auto">
            Bars show mean values. Error bars show standard deviation.
          </span>
        </div>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {METRIC_DEFS.map((def) => (
          <MetricBarChart
            key={def.short}
            data={data}
            dataKey={def.short}
            title={def.label}
            isStatistical={isStatistical}
          />
        ))}
      </div>

      {/* Summary table */}
      <div className="border border-zinc-200" data-testid="comparison-table">
        <div className="p-3 border-b border-zinc-200">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {isStatistical ? "Statistical Summary (Mean \u00B1 Std)" : "Detailed Comparison"}
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-200">
              <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                Metric
              </TableHead>
              {TOPOLOGIES.map((t) => (
                <TableHead
                  key={t}
                  className="text-[10px] uppercase tracking-wider font-bold text-center"
                  style={{ color: BAR_COLORS[t] }}
                >
                  {t}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {TABLE_METRICS.map((row) => (
              <TableRow key={row.key} className="border-zinc-200">
                <TCell className="text-xs font-medium">{row.label}</TCell>
                {TOPOLOGIES.map((t) => (
                  <TCell key={t} className="font-mono text-xs text-center">
                    {isStatistical
                      ? (() => {
                          const agg = statResults?.[t]?.aggregated?.[row.key];
                          if (!agg) return "---";
                          return `${agg.mean} \u00B1 ${agg.std}`;
                        })()
                      : results?.[t]?.metrics?.[row.key] ?? "---"}
                  </TCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
