function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSimulationCSV(simulation) {
  const m = simulation.metrics;
  const rows = [
    ["Raft Topology Simulation Results"],
    [""],
    ["Parameter", "Value"],
    ["Topology", simulation.topology],
    ["Nodes", simulation.num_nodes],
    ["Message Delay", simulation.config?.message_delay],
    ["Packet Loss", simulation.config?.packet_loss],
    ["Node Failure Prob", simulation.config?.node_failure_prob],
    ["Max Ticks", simulation.config?.max_ticks],
    [""],
    ["Metric", "Value"],
    ["First Leader Election Time (ticks)", m.first_leader_election_time ?? "N/A"],
    ["Total Messages Sent", m.total_messages_sent],
    ["Total Messages Received", m.total_messages_received],
    ["Total Messages Dropped", m.total_messages_dropped],
    ["Election Count", m.election_count],
    ["Convergence Time (ticks)", m.convergence_time],
    ["Throughput (entries/1k ticks)", m.throughput],
    ["Avg Latency Hops", m.avg_latency_hops],
    ["Avg Latency (ticks)", m.avg_latency_ticks],
    ["Entries Committed", m.entries_committed],
    [""],
    ["Message Type", "Count"],
    ...Object.entries(m.message_breakdown || {}).map(([k, v]) => [k, v]),
    [""],
    ["Leader Elections"],
    ["Tick", "Leader Node", "Term", "Votes"],
    ...(m.leader_elections || []).map((el) => [el.tick, el.leader, el.term, el.votes]),
  ];

  const csv = rows.map((r) => r.join(",")).join("\n");
  downloadCSV(csv, `raft_sim_${simulation.topology}_${simulation.num_nodes}nodes.csv`);
}

export function exportComparisonCSV(results) {
  const topologies = Object.keys(results);
  const metricDefs = [
    ["First Leader Election Time (ticks)", "first_leader_election_time"],
    ["Total Messages Sent", "total_messages_sent"],
    ["Total Messages Received", "total_messages_received"],
    ["Total Messages Dropped", "total_messages_dropped"],
    ["Election Count", "election_count"],
    ["Convergence Time (ticks)", "convergence_time"],
    ["Throughput (entries/1k ticks)", "throughput"],
    ["Avg Latency Hops", "avg_latency_hops"],
    ["Avg Latency (ticks)", "avg_latency_ticks"],
    ["Entries Committed", "entries_committed"],
  ];

  const header = ["Metric", ...topologies.map((t) => t.charAt(0).toUpperCase() + t.slice(1))];
  const rows = [
    ["Raft Topology Comparison"],
    [""],
    header,
    ...metricDefs.map(([label, key]) => [
      label,
      ...topologies.map((t) => results[t]?.metrics?.[key] ?? ""),
    ]),
  ];

  const csv = rows.map((r) => r.join(",")).join("\n");
  downloadCSV(csv, "raft_topology_comparison.csv");
}

export function exportStatisticalCSV(results, config) {
  const topologies = Object.keys(results);
  const metricDefs = [
    ["First Leader Election Time", "first_leader_election_time"],
    ["Total Messages Sent", "total_messages_sent"],
    ["Total Messages Dropped", "total_messages_dropped"],
    ["Election Count", "election_count"],
    ["Convergence Time", "convergence_time"],
    ["Throughput", "throughput"],
    ["Avg Latency Hops", "avg_latency_hops"],
    ["Avg Latency (ticks)", "avg_latency_ticks"],
    ["Entries Committed", "entries_committed"],
  ];

  const header = [
    "Metric",
    ...topologies.flatMap((t) => {
      const T = t.charAt(0).toUpperCase() + t.slice(1);
      return [`${T} Mean`, `${T} Std`, `${T} Min`, `${T} Max`];
    }),
  ];

  const rows = [
    [`Raft Statistical Analysis (${config?.runs || "N"} runs per topology)`],
    [""],
    header,
    ...metricDefs.map(([label, key]) => [
      label,
      ...topologies.flatMap((t) => {
        const agg = results[t]?.aggregated?.[key] || {};
        return [agg.mean ?? "", agg.std ?? "", agg.min ?? "", agg.max ?? ""];
      }),
    ]),
  ];

  const csv = rows.map((r) => r.join(",")).join("\n");
  downloadCSV(csv, `raft_statistical_${config?.runs || "N"}runs.csv`);
}
