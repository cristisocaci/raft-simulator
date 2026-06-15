# Raft Consensus Algorithm — Network Topology Simulator

A full-stack simulation tool built for academic research that demonstrates how different network topologies (Star, Ring, Mesh, Tree, Bus) influence the behaviour of the Raft consensus algorithm. Designed as a companion tool for a dissertation thesis on distributed systems.

---

## Table of Contents

1. [How to Run](#how-to-run)
2. [Architecture Overview](#architecture-overview)
3. [Further Documentation](#further-documentation)

---

## How to Run

### Prerequisites

- Python 3.10+
- Node.js 20+ and Yarn
- No external database required (uses SQLite)

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
# or, equivalently:
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The backend starts on `http://localhost:8001`. The SQLite database (`raft_simulator.db`) is created automatically on first startup.

### Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

The test suite (`test_raft_engine.py`) checks topology generation (adjacency, shortest paths) and Raft safety invariants (election safety, commit/log monotonicity, deterministic seeding) for all five topologies.

### Thesis Experiments

```bash
cd thesis
pip install -r ../backend/requirements.txt
python run_experiments.py
```

Runs the full batch of experiments used in the dissertation directly against `SimulationEngine` (no API server required) and writes the results to `thesis/experiment_data.json`. See [thesis/README.md](thesis/README.md) for details on what each experiment measures.

### Frontend

```bash
cd frontend
yarn install
```

Create a `.env` file in the `frontend/` directory:

```
REACT_APP_BACKEND_URL=http://localhost:8001
```

Then start the development server:

```bash
yarn start
```

The frontend starts on `http://localhost:3000`.

---

## Architecture Overview

```
Browser (React)                        Server (FastAPI)
     |                                       |
     |  POST /api/simulations          raft_engine.py
     |  ─────────────────────────►  SimulationEngine.run()
     |                                       |
     |  JSON (graph, events,                 |  Discrete-tick simulation
     |   snapshots, metrics)                 |  with multi-hop routing
     |  ◄─────────────────────────           |
     |                                       |
     |  Stored in SQLite              raft_simulator.db
```

The backend is a stateless compute layer. The frontend sends simulation parameters, the backend runs the Raft simulation to completion in a single request, and returns the full result set. Results are also persisted to SQLite for history retrieval.

---

## Further Documentation

- [backend/README.md](backend/README.md) — Raft simulation engine internals, message routing, metrics, API reference, and backend file reference.
- [frontend/README.md](frontend/README.md) — Page and component breakdown (Dashboard, Comparison, History), playback system, CSV export, and frontend file reference.
- [thesis/README.md](thesis/README.md) — Running the dissertation experiments and what each one measures.

