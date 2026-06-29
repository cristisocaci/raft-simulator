"""
Experiment regression tests.

These re-run each of the 7 thesis experiments with the exact same configs used
in thesis/run_experiments.py and assert that the computed means match the values
stored in thesis/experiment_data.json.

Because the engine is fully deterministic given a seed, any change to the engine
that affects simulation outcomes will cause these tests to fail.

Run with:  pytest --run-slow
"""
import json
import statistics as pystats
from pathlib import Path

import pytest

from raft_engine import SimulationEngine

# ---------------------------------------------------------------------------
# Fixtures and helpers
# ---------------------------------------------------------------------------

DATA_PATH = Path(__file__).parent.parent.parent / "thesis" / "experiment_data.json"
STORED = json.loads(DATA_PATH.read_text())

TOPOLOGIES = ["star", "ring", "mesh", "tree", "bus"]
METRICS_KEYS = [
    "first_leader_election_time", "total_messages_sent", "total_messages_dropped",
    "election_count", "convergence_time", "throughput",
    "avg_latency_hops", "avg_latency_ticks", "entries_committed",
]
# Metrics that must match exactly (non-zero in most experiments).
CHECK_KEYS = ["first_leader_election_time", "total_messages_sent", "total_messages_dropped", "entries_committed"]


def run_statistical(topo, num_nodes, base_config, runs):
    all_metrics = []
    for i in range(runs):
        cfg = {**base_config, "seed": base_config.get("seed", 42) + i}
        result = SimulationEngine(topo, num_nodes, cfg).run()
        all_metrics.append(result["metrics"])
    agg = {}
    for key in METRICS_KEYS:
        vals = [m.get(key) for m in all_metrics if m.get(key) is not None]
        if vals:
            agg[key] = {
                "mean": round(pystats.mean(vals), 2),
                "std": round(pystats.stdev(vals), 2) if len(vals) > 1 else 0,
            }
        else:
            agg[key] = {"mean": 0, "std": 0}
    return agg


def assert_means_match(computed, stored, exp_label):
    for key in CHECK_KEYS:
        c_mean = computed[key]["mean"]
        s_mean = stored[key]["mean"]
        assert c_mean == s_mean, (
            f"{exp_label} — {key}: computed {c_mean} != stored {s_mean}"
        )


# ---------------------------------------------------------------------------
# Experiment 1: Baseline (5 nodes, default params, 10 runs)
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.parametrize("topo", TOPOLOGIES)
def test_exp1_baseline(topo):
    computed = run_statistical(
        topo, 5,
        {"message_delay": 10, "max_ticks": 1000, "log_entries": 5, "seed": 42},
        runs=10,
    )
    assert_means_match(computed, STORED["exp1_baseline"][topo], f"exp1/{topo}")


# ---------------------------------------------------------------------------
# Experiment 2: Varying cluster size (3, 5, 7, 9, 11, 13)
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.parametrize("topo", TOPOLOGIES)
@pytest.mark.parametrize("n", [3, 5, 7, 9, 11, 13])
def test_exp2_cluster_size(topo, n):
    computed = run_statistical(
        topo, n,
        {"message_delay": 10, "max_ticks": 1000, "log_entries": 5, "seed": 42},
        runs=5,
    )
    assert_means_match(computed, STORED["exp2_cluster_size"][str(n)][topo], f"exp2/n={n}/{topo}")


# ---------------------------------------------------------------------------
# Experiment 3: Varying message delay (2, 5, 10, 20, 30, 50)
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.parametrize("topo", TOPOLOGIES)
@pytest.mark.parametrize("delay", [2, 5, 10, 20, 30, 50])
def test_exp3_message_delay(topo, delay):
    computed = run_statistical(
        topo, 5,
        {"message_delay": delay, "max_ticks": 1000, "log_entries": 5, "seed": 42},
        runs=5,
    )
    assert_means_match(computed, STORED["exp3_message_delay"][str(delay)][topo], f"exp3/delay={delay}/{topo}")


# ---------------------------------------------------------------------------
# Experiment 4: Varying packet loss (0%, 5%, 10%, 20%, 30%, 40%)
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.parametrize("topo", TOPOLOGIES)
@pytest.mark.parametrize("loss,key", [
    (0.00, "0"), (0.05, "5"), (0.10, "10"), (0.20, "20"), (0.30, "30"), (0.40, "40"),
])
def test_exp4_packet_loss(topo, loss, key):
    computed = run_statistical(
        topo, 5,
        {"message_delay": 10, "packet_loss": loss, "max_ticks": 1000, "log_entries": 5, "seed": 42},
        runs=5,
    )
    assert_means_match(computed, STORED["exp4_packet_loss"][key][topo], f"exp4/loss={key}%/{topo}")


# ---------------------------------------------------------------------------
# Experiment 5: Fault tolerance (no failure / failure no recovery / failure with recovery)
# ---------------------------------------------------------------------------

EXP5_CONFIGS = {
    "no_failure":          {"message_delay": 10, "max_ticks": 1500, "log_entries": 5, "node_failure_prob": 0.0, "seed": 42},
    "failure_no_recovery": {"message_delay": 10, "max_ticks": 1500, "log_entries": 5, "node_failure_prob": 0.5, "node_recovery_prob": 0.0, "seed": 42},
    "failure_with_recovery": {"message_delay": 10, "max_ticks": 1500, "log_entries": 5, "node_failure_prob": 0.5, "node_recovery_prob": 0.8, "seed": 42},
}


@pytest.mark.slow
@pytest.mark.parametrize("topo", TOPOLOGIES)
@pytest.mark.parametrize("regime", ["no_failure", "failure_no_recovery", "failure_with_recovery"])
def test_exp5_fault_tolerance(topo, regime):
    computed = run_statistical(topo, 7, EXP5_CONFIGS[regime], runs=5)
    assert_means_match(computed, STORED["exp5_fault_tolerance"][regime][topo], f"exp5/{regime}/{topo}")


# ---------------------------------------------------------------------------
# Experiment 6: Leader failure injection at tick 500
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.parametrize("topo", TOPOLOGIES)
def test_exp6_leader_failure(topo):
    metrics_list = []
    for i in range(5):
        cfg = {"message_delay": 10, "max_ticks": 1500, "log_entries": 5, "inject_leader_failure_at": 500, "seed": 42 + i}
        result = SimulationEngine(topo, 5, cfg).run()
        m = dict(result["metrics"])
        re_elections = [e for e in m["leader_elections"] if e["tick"] > 500]
        m["re_election_count"] = len(re_elections)
        m["re_election_time"] = re_elections[0]["tick"] - 500 if re_elections else None
        metrics_list.append(m)

    for key in CHECK_KEYS:
        vals = [m.get(key) for m in metrics_list if m.get(key) is not None]
        if not vals:
            continue
        computed_mean = round(pystats.mean(vals), 2)
        stored_mean = STORED["exp6_leader_failure"][topo][key]["mean"]
        assert computed_mean == stored_mean, (
            f"exp6/{topo}/{key}: computed {computed_mean} != stored {stored_mean}"
        )


# ---------------------------------------------------------------------------
# Experiment 7: Stress test (high delay + packet loss + failures)
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.parametrize("topo", TOPOLOGIES)
def test_exp7_stress(topo):
    computed = run_statistical(
        topo, 7,
        {"message_delay": 25, "packet_loss": 0.15, "node_failure_prob": 0.3,
         "node_recovery_prob": 0.5, "max_ticks": 2000, "log_entries": 5, "seed": 42},
        runs=5,
    )
    assert_means_match(computed, STORED["exp7_stress"][topo], f"exp7/{topo}")
