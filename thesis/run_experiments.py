"""
Run all experiments for the dissertation thesis.
Outputs structured JSON data for embedding in LaTeX.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from raft_engine import SimulationEngine
import json
import statistics as stats

TOPOLOGIES = ["star", "ring", "mesh", "tree", "bus"]
METRICS_KEYS = [
    "first_leader_election_time", "total_messages_sent", "total_messages_dropped",
    "election_count", "convergence_time", "throughput",
    "avg_latency_hops", "avg_latency_ticks", "entries_committed",
]

def run_single(topo, num_nodes, config):
    engine = SimulationEngine(topo, num_nodes, config)
    return engine.run()["metrics"]

def run_statistical(topo, num_nodes, base_config, runs=10):
    all_metrics = []
    for i in range(runs):
        cfg = {**base_config, "seed": base_config.get("seed", 42) + i}
        m = run_single(topo, num_nodes, cfg)
        all_metrics.append(m)
    agg = {}
    for key in METRICS_KEYS:
        vals = [m.get(key) for m in all_metrics if m.get(key) is not None]
        if vals:
            agg[key] = {
                "mean": round(stats.mean(vals), 2),
                "std": round(stats.stdev(vals), 2) if len(vals) > 1 else 0,
                "min": round(min(vals), 2),
                "max": round(max(vals), 2),
            }
        else:
            agg[key] = {"mean": 0, "std": 0, "min": 0, "max": 0}
    return agg

results = {}

# Experiment 1: Baseline comparison (5 nodes, default params, 10 runs each)
print("Experiment 1: Baseline statistical comparison...")
exp1 = {}
for topo in TOPOLOGIES:
    exp1[topo] = run_statistical(topo, 5, {"message_delay": 10, "max_ticks": 1000, "log_entries": 5, "seed": 42}, runs=10)
results["exp1_baseline"] = exp1

# Experiment 2: Varying cluster size (3, 5, 7, 9, 11, 13)
print("Experiment 2: Varying cluster size...")
exp2 = {}
for n in [3, 5, 7, 9, 11, 13]:
    exp2[str(n)] = {}
    for topo in TOPOLOGIES:
        exp2[str(n)][topo] = run_statistical(topo, n, {"message_delay": 10, "max_ticks": 1000, "log_entries": 5, "seed": 42}, runs=5)
results["exp2_cluster_size"] = exp2

# Experiment 3: Varying message delay (2, 5, 10, 20, 30, 50)
print("Experiment 3: Varying message delay...")
exp3 = {}
for delay in [2, 5, 10, 20, 30, 50]:
    exp3[str(delay)] = {}
    for topo in TOPOLOGIES:
        exp3[str(delay)][topo] = run_statistical(topo, 5, {"message_delay": delay, "max_ticks": 1000, "log_entries": 5, "seed": 42}, runs=5)
results["exp3_message_delay"] = exp3

# Experiment 4: Varying packet loss (0%, 5%, 10%, 20%, 30%, 40%)
print("Experiment 4: Varying packet loss...")
exp4 = {}
for loss in [0.0, 0.05, 0.10, 0.20, 0.30, 0.40]:
    key = str(int(loss * 100))
    exp4[key] = {}
    for topo in TOPOLOGIES:
        exp4[key][topo] = run_statistical(topo, 5, {"message_delay": 10, "packet_loss": loss, "max_ticks": 1000, "log_entries": 5, "seed": 42}, runs=5)
results["exp4_packet_loss"] = exp4

# Experiment 5: Fault tolerance (node failure with and without recovery)
print("Experiment 5: Fault tolerance...")
exp5 = {}
# No failures
exp5["no_failure"] = {}
for topo in TOPOLOGIES:
    exp5["no_failure"][topo] = run_statistical(topo, 7, {"message_delay": 10, "max_ticks": 1500, "log_entries": 5, "node_failure_prob": 0.0, "seed": 42}, runs=5)
# Failures without recovery
exp5["failure_no_recovery"] = {}
for topo in TOPOLOGIES:
    exp5["failure_no_recovery"][topo] = run_statistical(topo, 7, {"message_delay": 10, "max_ticks": 1500, "log_entries": 5, "node_failure_prob": 0.5, "node_recovery_prob": 0.0, "seed": 42}, runs=5)
# Failures with recovery
exp5["failure_with_recovery"] = {}
for topo in TOPOLOGIES:
    exp5["failure_with_recovery"][topo] = run_statistical(topo, 7, {"message_delay": 10, "max_ticks": 1500, "log_entries": 5, "node_failure_prob": 0.5, "node_recovery_prob": 0.8, "seed": 42}, runs=5)
results["exp5_fault_tolerance"] = exp5

# Experiment 6: Leader failure at tick 500
print("Experiment 6: Leader failure injection...")
exp6 = {}
for topo in TOPOLOGIES:
    metrics_list = []
    for i in range(5):
        cfg = {"message_delay": 10, "max_ticks": 1500, "log_entries": 5, "inject_leader_failure_at": 500, "seed": 42 + i}
        engine = SimulationEngine(topo, 5, cfg)
        r = engine.run()
        m = r["metrics"]
        # Count re-elections after tick 500
        re_elections = [e for e in r["metrics"]["leader_elections"] if e["tick"] > 500]
        m["re_election_count"] = len(re_elections)
        m["re_election_time"] = re_elections[0]["tick"] - 500 if re_elections else None
        metrics_list.append(m)
    # Aggregate
    agg = {}
    for key in METRICS_KEYS + ["re_election_count", "re_election_time"]:
        vals = [m.get(key) for m in metrics_list if m.get(key) is not None]
        if vals:
            agg[key] = {"mean": round(stats.mean(vals), 2), "std": round(stats.stdev(vals), 2) if len(vals) > 1 else 0}
        else:
            agg[key] = {"mean": 0, "std": 0}
    exp6[topo] = agg
results["exp6_leader_failure"] = exp6

# Experiment 7: Combined stress test (high delay + packet loss + failures)
print("Experiment 7: Stress test...")
exp7 = {}
for topo in TOPOLOGIES:
    exp7[topo] = run_statistical(topo, 7, {
        "message_delay": 25, "packet_loss": 0.15, "node_failure_prob": 0.3,
        "node_recovery_prob": 0.5, "max_ticks": 2000, "log_entries": 5, "seed": 42
    }, runs=5)
results["exp7_stress"] = exp7

print("All experiments complete.")
output_path = Path(__file__).resolve().parent / "experiment_data.json"
with open(output_path, "w") as f:
    json.dump(results, f, indent=2)
print(f"Data saved to {output_path}")
