import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = ["#09090B", "#52525B", "#A1A1AA", "#D4D4D8"];

export default function MetricsPanel({ metrics, events }) {
  if (!metrics) return null;

  const cards = [
    { label: "Election Time", value: metrics.first_leader_election_time ?? "---", unit: "ticks" },
    { label: "Total Messages", value: metrics.total_messages_sent, unit: "msgs" },
    { label: "Avg Latency", value: metrics.avg_latency_ticks, unit: "ticks" },
    { label: "Elections", value: metrics.election_count, unit: "" },
    { label: "Convergence", value: metrics.convergence_time, unit: "ticks" },
    { label: "Throughput", value: metrics.throughput, unit: "/1k" },
    { label: "Dropped", value: metrics.total_messages_dropped, unit: "msgs" },
    { label: "Committed", value: metrics.entries_committed, unit: "entries" },
  ];

  // Messages over time
  const msgOverTime = [];
  if (events) {
    const buckets = {};
    events
      .filter((e) => e.type === "message_sent")
      .forEach((e) => {
        const bucket = Math.floor(e.tick / 50) * 50;
        buckets[bucket] = (buckets[bucket] || 0) + 1;
      });
    Object.entries(buckets)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([tick, count]) => {
        msgOverTime.push({ tick: parseInt(tick), count });
      });
  }

  // Message breakdown
  const breakdownData = Object.entries(metrics.message_breakdown || {}).map(([key, value]) => ({
    name: key.replace(/_/g, " "),
    value: value,
  }));

  // Election timeline
  const electionData = (metrics.leader_elections || []).map((el) => ({
    tick: el.tick,
    leader: `N${el.leader}`,
    term: el.term,
    votes: el.votes,
  }));

  return (
    <div className="p-4 space-y-4" data-testid="metrics-panel">
      <h2 className="font-chivo font-bold text-sm uppercase tracking-[0.1em]">
        Simulation Metrics
      </h2>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-0">
        {cards.map((c) => (
          <div
            key={c.label}
            className="border border-zinc-200 p-3 -ml-px -mt-px first:ml-0 first:mt-0"
            data-testid={`metric-${c.label.toLowerCase().replace(/\s/g, "-")}`}
          >
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
              {c.label}
            </div>
            <div className="font-mono text-xl font-semibold tracking-tighter mt-1">
              {c.value}
              {c.unit && (
                <span className="text-[10px] text-zinc-400 font-normal ml-1">{c.unit}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Messages over time */}
        <div className="border border-zinc-200 p-4" data-testid="messages-timeline-chart">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
            Messages Over Time
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={msgOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis dataKey="tick" tick={{ fontSize: 10 }} stroke="#A1A1AA" />
              <YAxis tick={{ fontSize: 10 }} stroke="#A1A1AA" />
              <Tooltip
                contentStyle={{
                  border: "1px solid #27272A",
                  borderRadius: 0,
                  fontSize: 11,
                  fontFamily: "IBM Plex Mono",
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#09090B"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Message breakdown pie */}
        <div className="border border-zinc-200 p-4" data-testid="message-breakdown-chart">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
            Message Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={breakdownData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                strokeWidth={1}
                stroke="#fff"
              >
                {breakdownData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  border: "1px solid #27272A",
                  borderRadius: 0,
                  fontSize: 11,
                  fontFamily: "IBM Plex Mono",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {breakdownData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 inline-block"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="text-[10px] text-zinc-500 capitalize">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Election timeline */}
        <div className="border border-zinc-200 p-4" data-testid="election-timeline-chart">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
            Leader Elections
          </h3>
          {electionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={electionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                <XAxis dataKey="tick" tick={{ fontSize: 10 }} stroke="#A1A1AA" />
                <YAxis dataKey="votes" tick={{ fontSize: 10 }} stroke="#A1A1AA" />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #27272A",
                    borderRadius: 0,
                    fontSize: 11,
                    fontFamily: "IBM Plex Mono",
                  }}
                />
                <Bar dataKey="votes" fill="#0033CC" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-zinc-400 text-xs font-mono">
              No elections recorded
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
