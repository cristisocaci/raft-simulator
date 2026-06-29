"""
Tests for the /api/simulations/sweep endpoint.
"""
import pytest
from fastapi.testclient import TestClient

from server import app

FAST_BASE = {
    "num_nodes": 5,
    "message_delay": 10,
    "max_ticks": 300,
    "log_entries": 3,
    "base_seed": 42,
    "runs": 1,
}

TOPOLOGIES = {"star", "ring", "mesh", "tree", "bus"}
METRIC_KEYS = {
    "first_leader_election_time", "total_messages_sent", "total_messages_dropped",
    "election_count", "convergence_time", "throughput",
    "avg_latency_hops", "avg_latency_ticks", "entries_committed",
}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


class TestSweepShape:
    def test_response_has_required_top_level_keys(self, client):
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "packet_loss",
            "sweep_values": [0.0, 0.1],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert {"sweep_param", "sweep_values", "results", "config"} <= data.keys()

    def test_results_length_matches_sweep_values(self, client):
        values = [0.0, 0.1, 0.2, 0.3]
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "packet_loss",
            "sweep_values": values,
        })
        assert len(resp.json()["results"]) == len(values)

    def test_each_point_has_correct_value_field(self, client):
        values = [0.0, 0.2, 0.4]
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "packet_loss",
            "sweep_values": values,
        })
        returned_values = [p["value"] for p in resp.json()["results"]]
        assert returned_values == values

    def test_each_point_has_all_five_topologies(self, client):
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "packet_loss",
            "sweep_values": [0.0, 0.1],
        })
        for point in resp.json()["results"]:
            assert set(point["topologies"].keys()) == TOPOLOGIES

    def test_each_topology_has_aggregated_with_all_metrics(self, client):
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "message_delay",
            "sweep_values": [5, 20],
        })
        agg = resp.json()["results"][0]["topologies"]["mesh"]["aggregated"]
        assert METRIC_KEYS <= agg.keys()

    def test_each_metric_has_mean_std_min_max(self, client):
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "packet_loss",
            "sweep_values": [0.0],
            "runs": 2,
        })
        agg = resp.json()["results"][0]["topologies"]["star"]["aggregated"]
        for key in METRIC_KEYS:
            assert {"mean", "std", "min", "max"} <= agg[key].keys(), f"metric {key} missing stat fields"

    def test_config_is_echoed_in_response(self, client):
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "packet_loss",
            "sweep_values": [0.0],
            "runs": 3,
            "base_seed": 99,
        })
        cfg = resp.json()["config"]
        assert cfg["runs"] == 3
        assert cfg["base_seed"] == 99
        assert cfg["num_nodes"] == 5


class TestSweepValidation:
    def test_invalid_sweep_param_returns_422(self, client):
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "topology",
            "sweep_values": [0.0, 0.1],
        })
        assert resp.status_code == 422

    def test_empty_sweep_values_returns_422(self, client):
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "packet_loss",
            "sweep_values": [],
        })
        assert resp.status_code == 422

    @pytest.mark.parametrize("param", [
        "packet_loss", "message_delay", "num_nodes", "node_failure_prob", "node_recovery_prob"
    ])
    def test_all_valid_sweep_params_accepted(self, client, param):
        value_map = {
            "packet_loss": [0.0, 0.1],
            "message_delay": [5, 10],
            "num_nodes": [3, 5],
            "node_failure_prob": [0.0, 0.1],
            "node_recovery_prob": [0.0, 0.5],
        }
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": param,
            "sweep_values": value_map[param],
        })
        assert resp.status_code == 200


class TestSweepSemantics:
    def test_sweep_is_deterministic(self, client):
        req = {**FAST_BASE, "sweep_param": "packet_loss", "sweep_values": [0.0, 0.1], "runs": 2}
        a = client.post("/api/simulations/sweep", json=req).json()["results"]
        b = client.post("/api/simulations/sweep", json=req).json()["results"]
        assert a == b

    def test_higher_packet_loss_increases_drops(self, client):
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "packet_loss",
            "sweep_values": [0.0, 0.4],
            "runs": 3,
            "max_ticks": 500,
        })
        results = resp.json()["results"]
        drops_low = results[0]["topologies"]["star"]["aggregated"]["total_messages_dropped"]["mean"]
        drops_high = results[1]["topologies"]["star"]["aggregated"]["total_messages_dropped"]["mean"]
        assert drops_high > drops_low

    def test_higher_delay_increases_election_time(self, client):
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "message_delay",
            "sweep_values": [1, 30],
            "runs": 3,
            "max_ticks": 1000,
        })
        results = resp.json()["results"]
        t_low = results[0]["topologies"]["mesh"]["aggregated"]["first_leader_election_time"]["mean"]
        t_high = results[1]["topologies"]["mesh"]["aggregated"]["first_leader_election_time"]["mean"]
        assert t_high > t_low

    def test_num_nodes_sweep_uses_correct_cluster_sizes(self, client):
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "num_nodes",
            "sweep_values": [3, 9],
            "runs": 2,
            "max_ticks": 500,
        })
        results = resp.json()["results"]
        msgs_small = results[0]["topologies"]["mesh"]["aggregated"]["total_messages_sent"]["mean"]
        msgs_large = results[1]["topologies"]["mesh"]["aggregated"]["total_messages_sent"]["mean"]
        assert msgs_large > msgs_small

    def test_mesh_drops_fewer_messages_than_bus_under_packet_loss(self, client):
        resp = client.post("/api/simulations/sweep", json={
            **FAST_BASE,
            "sweep_param": "packet_loss",
            "sweep_values": [0.2],
            "runs": 5,
            "max_ticks": 500,
        })
        agg = resp.json()["results"][0]["topologies"]
        mesh_drops = agg["mesh"]["aggregated"]["total_messages_dropped"]["mean"]
        bus_drops = agg["bus"]["aggregated"]["total_messages_dropped"]["mean"]
        assert mesh_drops < bus_drops
