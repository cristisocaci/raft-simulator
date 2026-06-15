# Thesis Experiments

`run_experiments.py` runs the full batch of experiments used in the dissertation directly against `SimulationEngine` (no API server required) and writes the results to `experiment_data.json`.

## Running

```bash
cd thesis
pip install -r ../backend/requirements.txt
python run_experiments.py
```

## Experiments

It runs seven experiments across all five topologies, each averaged over multiple seeded runs:

1. **Baseline comparison** — 5 nodes, default parameters, 10 runs per topology.
2. **Cluster size** — varies node count (3, 5, 7, 9, 11, 13), 5 runs per topology/size.
3. **Message delay** — varies per-hop delay (2–50 ticks), 5 runs per topology/delay.
4. **Packet loss** — varies per-hop loss rate (0%–40%), 5 runs per topology/rate.
5. **Fault tolerance** — node failures with and without recovery, 7 nodes, 5 runs per topology/scenario.
6. **Leader failure injection** — kills the leader at tick 500 and measures re-election count/time, 5 runs per topology.
7. **Stress test** — combined high delay, packet loss, and failure/recovery probabilities, 7 nodes, 5 runs per topology.

Each experiment aggregates `first_leader_election_time`, `total_messages_sent`, `total_messages_dropped`, `election_count`, `convergence_time`, `throughput`, `avg_latency_hops`, `avg_latency_ticks`, and `entries_committed` (mean, std, min, max) per topology. The resulting `experiment_data.json` is consumed by the LaTeX source in `main.tex` to populate tables and figures.
