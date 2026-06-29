from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import aiosqlite
import json
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, List
import uuid
import statistics as pystats
from datetime import datetime, timezone

from raft_engine import SimulationEngine

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

DB_PATH = str(ROOT_DIR / "raft_simulator.db")

app = FastAPI()
api_router = APIRouter(prefix="/api")


@app.on_event("startup")
async def init_db():
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS simulations (
                id TEXT PRIMARY KEY,
                topology TEXT,
                num_nodes INTEGER,
                created_at TEXT,
                metrics TEXT,
                full_result TEXT
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS comparisons (
                id TEXT PRIMARY KEY,
                type TEXT,
                created_at TEXT,
                config TEXT,
                summary TEXT,
                full_results TEXT
            )
        """)
        # Migration: add full_results column to existing tables
        try:
            await conn.execute("ALTER TABLE comparisons ADD COLUMN full_results TEXT")
        except Exception:
            pass
        await conn.commit()


class SimulationRequest(BaseModel):
    topology: str = "mesh"
    num_nodes: int = 5
    message_delay: int = 10
    packet_loss: float = 0.0
    node_failure_prob: float = 0.0
    node_recovery_prob: float = 0.0
    max_ticks: int = 1000
    log_entries: int = 5
    seed: Optional[int] = 42
    inject_leader_failure_at: Optional[int] = None


class CompareRequest(BaseModel):
    num_nodes: int = 5
    message_delay: int = 10
    packet_loss: float = 0.0
    node_failure_prob: float = 0.0
    node_recovery_prob: float = 0.0
    max_ticks: int = 1000
    log_entries: int = 5
    seed: Optional[int] = 42


class StatisticalRequest(BaseModel):
    num_nodes: int = 5
    message_delay: int = 10
    packet_loss: float = 0.0
    node_failure_prob: float = 0.0
    node_recovery_prob: float = 0.0
    max_ticks: int = 1000
    log_entries: int = 5
    base_seed: int = 42
    runs: int = 10


class SweepRequest(BaseModel):
    sweep_param: str
    sweep_values: List[float]
    num_nodes: int = 5
    message_delay: int = 10
    packet_loss: float = 0.0
    node_failure_prob: float = 0.0
    node_recovery_prob: float = 0.0
    max_ticks: int = 1000
    log_entries: int = 5
    base_seed: int = 42
    runs: int = 5


@api_router.get("/")
async def root():
    return {"message": "Raft Topology Simulator API"}


VALID_TOPOLOGIES = {"star", "ring", "mesh", "tree", "bus"}


@api_router.post("/simulations")
async def run_simulation(req: SimulationRequest):
    if req.topology not in VALID_TOPOLOGIES:
        raise HTTPException(status_code=422, detail=f"Invalid topology '{req.topology}'. Must be one of: {', '.join(VALID_TOPOLOGIES)}")
    if req.num_nodes < 3:
        raise HTTPException(status_code=422, detail="num_nodes must be at least 3 for Raft consensus")
    config = {
        "message_delay": req.message_delay,
        "packet_loss": req.packet_loss,
        "node_failure_prob": req.node_failure_prob,
        "node_recovery_prob": req.node_recovery_prob,
        "max_ticks": req.max_ticks,
        "log_entries": req.log_entries,
        "seed": req.seed,
        "inject_leader_failure_at": req.inject_leader_failure_at,
    }

    engine = SimulationEngine(req.topology, req.num_nodes, config)
    results = engine.run()

    doc = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        **results,
    }
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute(
            "INSERT INTO simulations (id, topology, num_nodes, created_at, metrics, full_result) VALUES (?, ?, ?, ?, ?, ?)",
            (doc["id"], doc["topology"], doc["num_nodes"], doc["created_at"],
             json.dumps(doc["metrics"]), json.dumps(doc)),
        )
        await conn.commit()

    return doc


@api_router.post("/simulations/compare")
async def compare_topologies(req: CompareRequest):
    if req.num_nodes < 3:
        raise HTTPException(status_code=422, detail="num_nodes must be at least 3 for Raft consensus")
    topologies = ["star", "ring", "mesh", "tree", "bus"]
    results = {}

    for topo in topologies:
        config = {
            "message_delay": req.message_delay,
            "packet_loss": req.packet_loss,
            "node_failure_prob": req.node_failure_prob,
            "node_recovery_prob": req.node_recovery_prob,
            "max_ticks": req.max_ticks,
            "log_entries": req.log_entries,
            "seed": req.seed,
        }
        engine = SimulationEngine(topo, req.num_nodes, config)
        result = engine.run()
        results[topo] = result

    comparison_doc = {
        "id": str(uuid.uuid4()),
        "type": "comparison",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "config": {
            "num_nodes": req.num_nodes,
            "message_delay": req.message_delay,
            "packet_loss": req.packet_loss,
            "node_failure_prob": req.node_failure_prob,
            "node_recovery_prob": req.node_recovery_prob,
            "max_ticks": req.max_ticks,
            "log_entries": req.log_entries,
            "seed": req.seed,
        },
        "summary": {topo: r["metrics"] for topo, r in results.items()},
    }
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute(
            "INSERT INTO comparisons (id, type, created_at, config, summary, full_results) VALUES (?, ?, ?, ?, ?, ?)",
            (comparison_doc["id"], comparison_doc["type"], comparison_doc["created_at"],
             json.dumps(comparison_doc["config"]), json.dumps(comparison_doc["summary"]),
             json.dumps(results)),
        )
        await conn.commit()

    return {"comparison_id": comparison_doc["id"], "results": results}


@api_router.post("/simulations/statistical")
async def run_statistical(req: StatisticalRequest):
    if req.num_nodes < 3:
        raise HTTPException(status_code=422, detail="num_nodes must be at least 3")
    if req.runs < 2:
        raise HTTPException(status_code=422, detail="runs must be at least 2")

    topologies = ["star", "ring", "mesh", "tree", "bus"]
    metric_keys = [
        "first_leader_election_time", "total_messages_sent", "total_messages_received",
        "total_messages_dropped", "election_count", "convergence_time",
        "throughput", "avg_latency_hops", "avg_latency_ticks", "entries_committed",
    ]
    results = {}

    for topo in topologies:
        run_metrics = []
        for i in range(req.runs):
            config = {
                "message_delay": req.message_delay,
                "packet_loss": req.packet_loss,
                "node_failure_prob": req.node_failure_prob,
                "node_recovery_prob": req.node_recovery_prob,
                "max_ticks": req.max_ticks,
                "log_entries": req.log_entries,
                "seed": req.base_seed + i,
            }
            engine = SimulationEngine(topo, req.num_nodes, config)
            result = engine.run()
            run_metrics.append(result["metrics"])

        aggregated = {}
        for key in metric_keys:
            values = [r.get(key) for r in run_metrics if r.get(key) is not None]
            if values:
                mean_val = pystats.mean(values)
                std_val = pystats.stdev(values) if len(values) > 1 else 0
                aggregated[key] = {
                    "mean": round(mean_val, 2),
                    "std": round(std_val, 2),
                    "min": round(min(values), 2),
                    "max": round(max(values), 2),
                }
            else:
                aggregated[key] = {"mean": 0, "std": 0, "min": 0, "max": 0}

        results[topo] = {"aggregated": aggregated, "num_runs": req.runs}

    return {
        "results": results,
        "config": {
            "num_nodes": req.num_nodes,
            "message_delay": req.message_delay,
            "packet_loss": req.packet_loss,
            "node_failure_prob": req.node_failure_prob,
            "node_recovery_prob": req.node_recovery_prob,
            "max_ticks": req.max_ticks,
            "runs": req.runs,
        },
    }


@api_router.post("/simulations/sweep")
async def run_sweep(req: SweepRequest):
    valid_params = {"packet_loss", "message_delay", "num_nodes", "node_failure_prob", "node_recovery_prob"}
    if req.sweep_param not in valid_params:
        raise HTTPException(status_code=422, detail=f"Invalid sweep_param. Must be one of: {', '.join(sorted(valid_params))}")
    if not req.sweep_values:
        raise HTTPException(status_code=422, detail="sweep_values must not be empty")

    topologies = ["star", "ring", "mesh", "tree", "bus"]
    metric_keys = [
        "first_leader_election_time", "total_messages_sent", "total_messages_received",
        "total_messages_dropped", "election_count", "convergence_time",
        "throughput", "avg_latency_hops", "avg_latency_ticks", "entries_committed",
    ]
    sweep_results = []

    for sweep_val in req.sweep_values:
        topo_results = {}
        for topo in topologies:
            run_metrics = []
            for i in range(req.runs):
                config = {
                    "message_delay": req.message_delay,
                    "packet_loss": req.packet_loss,
                    "node_failure_prob": req.node_failure_prob,
                    "node_recovery_prob": req.node_recovery_prob,
                    "max_ticks": req.max_ticks,
                    "log_entries": req.log_entries,
                    "seed": req.base_seed + i,
                }
                num_nodes = req.num_nodes
                if req.sweep_param == "num_nodes":
                    num_nodes = max(3, int(round(sweep_val)))
                else:
                    config[req.sweep_param] = sweep_val

                engine = SimulationEngine(topo, num_nodes, config)
                result = engine.run()
                run_metrics.append(result["metrics"])

            aggregated = {}
            for key in metric_keys:
                values = [r.get(key) for r in run_metrics if r.get(key) is not None]
                if values:
                    mean_val = pystats.mean(values)
                    std_val = pystats.stdev(values) if len(values) > 1 else 0
                    aggregated[key] = {
                        "mean": round(mean_val, 2),
                        "std": round(std_val, 2),
                        "min": round(min(values), 2),
                        "max": round(max(values), 2),
                    }
                else:
                    aggregated[key] = {"mean": 0, "std": 0, "min": 0, "max": 0}

            topo_results[topo] = {"aggregated": aggregated, "num_runs": req.runs}

        sweep_results.append({"value": sweep_val, "topologies": topo_results})

    return {
        "sweep_param": req.sweep_param,
        "sweep_values": req.sweep_values,
        "results": sweep_results,
        "config": {
            "num_nodes": req.num_nodes,
            "message_delay": req.message_delay,
            "packet_loss": req.packet_loss,
            "node_failure_prob": req.node_failure_prob,
            "node_recovery_prob": req.node_recovery_prob,
            "max_ticks": req.max_ticks,
            "runs": req.runs,
            "base_seed": req.base_seed,
        },
    }


@api_router.get("/simulations/history")
async def get_history():
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT id, topology, num_nodes, created_at, metrics FROM simulations ORDER BY created_at DESC LIMIT 50"
        )
        rows = await cursor.fetchall()
        return [
            {
                "id": row["id"],
                "topology": row["topology"],
                "num_nodes": row["num_nodes"],
                "created_at": row["created_at"],
                "metrics": json.loads(row["metrics"]),
            }
            for row in rows
        ]


@api_router.get("/simulations/{sim_id}")
async def get_simulation(sim_id: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT full_result FROM simulations WHERE id = ?", (sim_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Simulation not found")
        return json.loads(row["full_result"])


@api_router.get("/comparisons/history")
async def get_comparison_history():
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT id, created_at, config, summary FROM comparisons ORDER BY created_at DESC LIMIT 50"
        )
        rows = await cursor.fetchall()
        return [
            {
                "id": row["id"],
                "created_at": row["created_at"],
                "config": json.loads(row["config"]),
                "summary": json.loads(row["summary"]),
            }
            for row in rows
        ]


@api_router.get("/comparisons/{comp_id}")
async def get_comparison(comp_id: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT full_results FROM comparisons WHERE id = ?", (comp_id,)
        )
        row = await cursor.fetchone()
        if not row or not row["full_results"]:
            raise HTTPException(status_code=404, detail="Comparison not found or no replay data")
        return {"results": json.loads(row["full_results"])}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
