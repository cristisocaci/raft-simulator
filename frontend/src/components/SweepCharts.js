import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ErrorBar,
} from "recharts";
import {
  Table, TableBody, TableCell as TCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const TOPOLOGIES = ["star", "ring", "mesh", "tree", "bus"];

const LINE_COLORS = {
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

const PARAM_INFO = {
  packet_loss:        { label: "Loss",     format: v => `${Math.round(v * 100)}%` },
  message_delay:      { label: "Delay",    format: v => `${v}t` },
  num_nodes:          { label: "Nodes",    format: v => `${v}` },
  node_failure_prob:  { label: "Failure",  format: v => `${Math.round(v * 100)}%` },
  node_recovery_prob: { label: "Recovery", format: v => `${Math.round(v * 100)}%` },
};

const METRIC_DEFS = [
  { key: "first_leader_election_time", label: "Election Time (ticks)" },
  { key: "total_messages_sent",        label: "Total Messages" },
  { key: "avg_latency_ticks",          label: "Avg Latency (ticks)" },
  { key: "convergence_time",           label: "Convergence (ticks)" },
  { key: "total_messages_dropped",     label: "Messages Dropped" },
  { key: "throughput",                 label: "Throughput" },
];

function buildLineData(results, metricKey) {
  return results.results.map(point => {
    const row = { rawValue: point.value };
    TOPOLOGIES.forEach(t => {
      const agg = point.topologies[t]?.aggregated?.[metricKey];
      row[t] = agg?.mean ?? null;
      row[`${t}_std`] = agg?.std ?? 0;
    });
    return row;
  });
}

function MetricLineChart({ results, metricKey, title }) {
  const data = buildLineData(results, metricKey);
  const paramInfo = PARAM_INFO[results.sweep_param] || { label: results.sweep_param, format: v => v };

  return (
    <div className="border border-zinc-200 p-4">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
          <XAxis
            dataKey="rawValue"
            tick={{ fontSize: 10 }}
            stroke="#A1A1AA"
            tickFormatter={paramInfo.format}
          />
          <YAxis tick={{ fontSize: 10 }} stroke="#A1A1AA" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={v => `${paramInfo.label}: ${paramInfo.format(v)}`}
            formatter={(v, name) => [v != null ? v.toFixed(1) : "—", name]}
          />
          {TOPOLOGIES.map(t => (
            <Line
              key={t}
              type="monotone"
              dataKey={t}
              stroke={LINE_COLORS[t]}
              strokeWidth={2}
              dot={{ r: 3, fill: LINE_COLORS[t] }}
              connectNulls={false}
            >
              <ErrorBar dataKey={`${t}_std`} width={4} strokeWidth={1} stroke={LINE_COLORS[t]} opacity={0.4} />
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function SweepCharts({ results }) {
  const paramInfo = PARAM_INFO[results.sweep_param] || { label: results.sweep_param, format: v => v };

  return (
    <div className="p-6 space-y-6">
      <div className="border border-zinc-200 p-3 flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          Sweep: {results.sweep_param.replace(/_/g, " ")}
        </span>
        <span className="font-mono text-xs text-zinc-700">
          {results.sweep_values.map(paramInfo.format).join(" → ")}
        </span>
        <span className="text-[10px] text-zinc-400 ml-auto">
          Lines show mean · error bars show std
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {METRIC_DEFS.map(def => (
          <MetricLineChart
            key={def.key}
            results={results}
            metricKey={def.key}
            title={def.label}
          />
        ))}
      </div>

      {/* Election time table */}
      <div className="border border-zinc-200">
        <div className="p-3 border-b border-zinc-200">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Election Time (ticks) — Mean ± Std
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-200">
              <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                {paramInfo.label}
              </TableHead>
              {TOPOLOGIES.map(t => (
                <TableHead
                  key={t}
                  className="text-[10px] uppercase tracking-wider font-bold text-center"
                  style={{ color: LINE_COLORS[t] }}
                >
                  {t}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.results.map(point => (
              <TableRow key={point.value} className="border-zinc-200">
                <TCell className="text-xs font-mono font-medium">
                  {paramInfo.format(point.value)}
                </TCell>
                {TOPOLOGIES.map(t => {
                  const agg = point.topologies[t]?.aggregated?.first_leader_election_time;
                  return (
                    <TCell key={t} className="font-mono text-xs text-center">
                      {agg ? `${agg.mean} ± ${agg.std}` : "—"}
                    </TCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
