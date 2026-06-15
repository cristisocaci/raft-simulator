# Backend

The backend consists of two Python files: the simulation engine and the API server. See the [root README](../README.md) for setup and run instructions.

---

## Table of Contents

1. [Raft Simulation Engine](#raft-simulation-engine-raft_enginepy)
2. [API Server](#api-server-serverpy)
3. [API Reference](#api-reference)
4. [File Reference](#file-reference)

---

## Raft Simulation Engine (`raft_engine.py`)

This is a discrete-event, tick-based simulation of the Raft consensus protocol. One tick represents one abstract time unit.

### Core Classes

**`RaftNode`** — Represents a single node in the Raft cluster. Each node maintains:
- A state machine with four states: `follower`, `candidate`, `leader`, `dead`.
- A current term counter, vote tracking, and an in-memory log.
- An election timer with a randomised timeout (150–300 ticks). When the timer expires without receiving a heartbeat from a leader, the node transitions to candidate and starts an election.
- A heartbeat timer (50-tick interval) used by leaders to send `AppendEntries` RPCs.

State transitions follow the Raft specification:
- **Follower → Candidate**: Election timeout expires.
- **Candidate → Leader**: Receives votes from a majority of live nodes.
- **Candidate/Leader → Follower**: Discovers a higher term from an incoming message.
- **Any → Dead**: Killed by fault injection. Dead nodes stop processing all messages.
- **Dead → Follower**: Revived by the recovery mechanism, rejoining with the highest known term.

**`TopologyManager`** — Generates network adjacency graphs and node positions for five topologies:

| Topology | Structure | Direct Neighbours per Node | Max Hops (5 nodes) |
|----------|-----------|----------------------------|---------------------|
| **Star** | Central hub, all others connect to it | Hub: N−1, Others: 1 | 2 |
| **Ring** | Circular, each node connects to two neighbours | 2 | N/2 |
| **Mesh** | Full connectivity, every node connects to every other | N−1 | 1 |
| **Tree** | Binary tree hierarchy | 1–3 (parent + up to 2 children) | O(log N) |
| **Bus** | Linear chain | 1–2 (left/right neighbours) | N−1 |

The manager also computes all-pairs shortest paths using BFS. These distances determine message delivery time and per-hop packet loss probability.

It computes 2D positions for each topology so the frontend can render them as SVG without needing a force-directed layout library.

**`SimulationEngine`** — Orchestrates the full simulation. On each tick it:

1. **Delivers messages** whose scheduled delivery tick has arrived.
2. **Processes each live node**: leaders send heartbeats; followers/candidates check their election timers.
3. **Injects faults** probabilistically (kills a random non-leader node every 200 ticks if `node_failure_prob > 0`).
4. **Recovers nodes** probabilistically (revives dead nodes every 150 ticks if `node_recovery_prob > 0`).
5. **Submits log entries** to the leader every 100 ticks to test log replication.
6. **Records snapshots** of all node states every 10 ticks for frontend playback.

### Message Routing

Messages are not delivered directly between any two nodes. Instead, the engine computes the shortest path through the topology's adjacency graph. The delivery time for a message is:

```
delivery_ticks = hops * message_delay + random_jitter(0–3)
```

Packet loss is applied per-hop:

```
probability_of_delivery = (1 - packet_loss_rate) ^ hops
```

This means topologies with more hops between nodes (Bus, Ring) experience higher effective latency and packet loss than direct-connect topologies (Mesh).

When a node dies, the engine recomputes shortest paths excluding dead nodes. If two live nodes become unreachable (e.g., the hub dies in a Star topology), messages between them are dropped, potentially causing the cluster to lose quorum.

### Metrics Collected

- **First leader election time**: Tick at which the first leader is elected.
- **Election count**: Total number of successful elections.
- **Total messages sent/received/dropped**: At the Raft RPC level.
- **Average latency**: Mean number of hops and ticks per message.
- **Convergence time**: Tick at which the cluster first achieves stable leadership.
- **Throughput**: Log entries committed per 1000 ticks.
- **Message breakdown**: Count per message type (RequestVote, VoteResponse, AppendEntries, AppendResponse).

## API Server (`server.py`)

A FastAPI application with five endpoints (all prefixed with `/api`). Uses `aiosqlite` for async SQLite access. The database is created automatically on startup with two tables: `simulations` and `comparisons`.

Each simulation request creates a `SimulationEngine` instance, runs it synchronously (the computation is fast — typically under 100ms for 1000 ticks with 5 nodes), serialises the result to JSON, stores it in SQLite, and returns it.

The statistical endpoint runs N simulations per topology (each with a different seed: `base_seed + i`) and aggregates metrics using Python's `statistics` module to compute mean, standard deviation, min, and max.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/` | Health check |
| `POST` | `/api/simulations` | Run a single simulation. Body: `{topology, num_nodes, message_delay, packet_loss, node_failure_prob, node_recovery_prob, max_ticks, log_entries, seed, inject_leader_failure_at}` |
| `POST` | `/api/simulations/compare` | Run one simulation per topology with identical parameters. Body: same as above minus `topology` and `inject_leader_failure_at`. |
| `POST` | `/api/simulations/statistical` | Run N simulations per topology. Body: includes `runs` and `base_seed` instead of `seed`. |
| `GET` | `/api/simulations/history` | Return the 50 most recent simulations (id, topology, num_nodes, created_at, metrics). |
| `GET` | `/api/simulations/{sim_id}` | Return the full stored result for a single simulation, including tick-by-tick events. |
| `GET` | `/api/comparisons/history` | Return the 50 most recent topology comparisons (id, created_at, config, summary). |
| `GET` | `/api/comparisons/{comp_id}` | Return the full per-topology results for a stored comparison (404 if no replay data). |

---

## File Reference

| File | Purpose |
|------|---------|
| `server.py` | FastAPI application. Defines all API endpoints, request models, SQLite database initialisation, and CORS middleware. |
| `raft_engine.py` | Complete Raft consensus simulation engine. Contains `RaftNode` (node state machine), `TopologyManager` (topology generation, shortest paths, layout positions), and `SimulationEngine` (tick-based simulation orchestrator with fault injection, node recovery, and metrics collection). |
| `requirements.txt` | Python dependencies: `fastapi`, `uvicorn[standard]`, `python-dotenv`, `aiosqlite`. |
| `requirements-dev.txt` | Adds `pytest` on top of `requirements.txt` for running the test suite. |
| `test_raft_engine.py` | Pytest suite covering topology generation (adjacency, shortest paths, positions) and Raft safety invariants (election safety, commit/log monotonicity, deterministic seeding) for all five topologies. |
| `.env` | Environment variables (CORS origins, legacy database keys). |
| `raft_simulator.db` | SQLite database file (auto-created on first run). Stores simulation results and comparison summaries. |
