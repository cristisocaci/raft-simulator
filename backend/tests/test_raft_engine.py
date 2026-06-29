import pytest

from raft_engine import SimulationEngine, TopologyManager

TOPOLOGIES = ["star", "ring", "mesh", "tree", "bus"]


# ---------------------------------------------------------------------------
# Topology generation
# ---------------------------------------------------------------------------

class TestTopologyAdjacency:
    @pytest.mark.parametrize("topology", TOPOLOGIES)
    @pytest.mark.parametrize("n", [3, 5, 7])
    def test_adjacency_is_symmetric(self, topology, n):
        adj = TopologyManager.create_adjacency(topology, n)
        for node, neighbors in adj.items():
            for neighbor in neighbors:
                assert node in adj.get(neighbor, set()), (
                    f"{topology}: edge {node}->{neighbor} is not reciprocated"
                )

    @pytest.mark.parametrize("n", [3, 5, 7])
    def test_star_edge_count_and_hub(self, n):
        adj = TopologyManager.create_adjacency("star", n)
        edges = sum(len(neighbors) for neighbors in adj.values()) // 2
        assert edges == n - 1
        assert adj[0] == set(range(1, n))
        for i in range(1, n):
            assert adj[i] == {0}

    @pytest.mark.parametrize("n", [3, 5, 7])
    def test_ring_every_node_has_two_neighbors(self, n):
        adj = TopologyManager.create_adjacency("ring", n)
        edges = sum(len(neighbors) for neighbors in adj.values()) // 2
        assert edges == n
        for neighbors in adj.values():
            assert len(neighbors) == 2

    @pytest.mark.parametrize("n", [3, 5, 7])
    def test_mesh_is_complete_graph(self, n):
        adj = TopologyManager.create_adjacency("mesh", n)
        edges = sum(len(neighbors) for neighbors in adj.values()) // 2
        assert edges == n * (n - 1) // 2
        for i in range(n):
            assert adj[i] == set(range(n)) - {i}

    @pytest.mark.parametrize("n", [3, 5, 7])
    def test_tree_edge_count(self, n):
        adj = TopologyManager.create_adjacency("tree", n)
        edges = sum(len(neighbors) for neighbors in adj.values()) // 2
        assert edges == n - 1

    @pytest.mark.parametrize("n", [3, 5, 7])
    def test_bus_is_a_chain(self, n):
        adj = TopologyManager.create_adjacency("bus", n)
        edges = sum(len(neighbors) for neighbors in adj.values()) // 2
        assert edges == n - 1
        endpoints = [i for i, neighbors in adj.items() if len(neighbors) == 1]
        assert len(endpoints) == 2


# ---------------------------------------------------------------------------
# Shortest paths
# ---------------------------------------------------------------------------

class TestShortestPaths:
    def test_mesh_all_distances_are_one_hop(self):
        n = 5
        adj = TopologyManager.create_adjacency("mesh", n)
        distances = TopologyManager.compute_shortest_paths(adj, n)
        for src in range(n):
            for dst in range(n):
                if src != dst:
                    assert distances[src][dst] == 1

    def test_star_leaf_to_leaf_is_two_hops(self):
        n = 5
        adj = TopologyManager.create_adjacency("star", n)
        distances = TopologyManager.compute_shortest_paths(adj, n)
        for leaf in range(1, n):
            assert distances[0][leaf] == 1
        assert distances[1][2] == 2

    def test_ring_distance_is_shortest_arc(self):
        n = 6
        adj = TopologyManager.create_adjacency("ring", n)
        distances = TopologyManager.compute_shortest_paths(adj, n)
        # Opposite node in a 6-node ring is 3 hops away.
        assert distances[0][3] == 3
        assert distances[0][1] == 1


# ---------------------------------------------------------------------------
# Position computation
# ---------------------------------------------------------------------------

class TestPositions:
    @pytest.mark.parametrize("topology", TOPOLOGIES)
    @pytest.mark.parametrize("n", [3, 5, 7])
    def test_returns_one_position_per_node(self, topology, n):
        positions = TopologyManager.compute_positions(topology, n)
        assert len(positions) == n
        for pos in positions:
            assert "x" in pos and "y" in pos


# ---------------------------------------------------------------------------
# Simulation engine: determinism and result shape
# ---------------------------------------------------------------------------

BENIGN_CONFIG = {"message_delay": 10, "max_ticks": 600, "log_entries": 5}


class TestSimulationDeterminism:
    @pytest.mark.parametrize("topology", TOPOLOGIES)
    def test_same_seed_yields_same_metrics(self, topology):
        config = {**BENIGN_CONFIG, "seed": 42}
        result_a = SimulationEngine(topology, 5, config).run()
        result_b = SimulationEngine(topology, 5, config).run()
        assert result_a["metrics"] == result_b["metrics"]

    @pytest.mark.parametrize("topology", TOPOLOGIES)
    def test_results_config_echoes_all_inputs(self, topology):
        config = {
            "message_delay": 10,
            "packet_loss": 0.1,
            "node_failure_prob": 0.2,
            "node_recovery_prob": 0.5,
            "max_ticks": 50,
            "log_entries": 3,
            "seed": 7,
            "inject_leader_failure_at": 25,
        }
        result = SimulationEngine(topology, 5, config).run()
        assert result["config"] == config


# ---------------------------------------------------------------------------
# Raft safety invariants
# ---------------------------------------------------------------------------

class TestRaftSafetyInvariants:
    @pytest.mark.parametrize("topology", TOPOLOGIES)
    @pytest.mark.parametrize("seed", [1, 2, 3])
    def test_election_safety_at_most_one_leader_per_term(self, topology, seed):
        config = {**BENIGN_CONFIG, "seed": seed}
        result = SimulationEngine(topology, 5, config).run()
        terms = [election["term"] for election in result["metrics"]["leader_elections"]]
        assert len(terms) == len(set(terms)), (
            f"{topology}/seed={seed}: multiple leaders elected for the same term: {terms}"
        )

    @pytest.mark.parametrize("topology", TOPOLOGIES)
    @pytest.mark.parametrize("seed", [1, 2, 3])
    def test_commit_index_is_monotonic_per_node(self, topology, seed):
        config = {**BENIGN_CONFIG, "seed": seed}
        result = SimulationEngine(topology, 5, config).run()
        per_node_commits = {}
        for snapshot in result["snapshots"]:
            for node in snapshot["nodes"]:
                history = per_node_commits.setdefault(node["id"], [])
                history.append(node["commit_index"])
        for node_id, history in per_node_commits.items():
            for prev, curr in zip(history, history[1:]):
                assert curr >= prev, (
                    f"{topology}/seed={seed}: node {node_id} commit_index decreased "
                    f"({prev} -> {curr})"
                )

    @pytest.mark.parametrize("topology", TOPOLOGIES)
    @pytest.mark.parametrize("seed", [1, 2, 3])
    def test_log_length_is_monotonic_per_node(self, topology, seed):
        config = {**BENIGN_CONFIG, "seed": seed}
        result = SimulationEngine(topology, 5, config).run()
        per_node_lengths = {}
        for snapshot in result["snapshots"]:
            for node in snapshot["nodes"]:
                history = per_node_lengths.setdefault(node["id"], [])
                history.append(node["log_length"])
        for node_id, history in per_node_lengths.items():
            for prev, curr in zip(history, history[1:]):
                assert curr >= prev, (
                    f"{topology}/seed={seed}: node {node_id} log_length decreased "
                    f"({prev} -> {curr})"
                )

    @pytest.mark.parametrize("topology", TOPOLOGIES)
    def test_full_packet_loss_prevents_leader_election(self, topology):
        config = {**BENIGN_CONFIG, "packet_loss": 1.0, "seed": 42}
        result = SimulationEngine(topology, 5, config).run()
        assert result["metrics"]["first_leader_election_time"] is None
        assert result["metrics"]["leader_elections"] == []
        assert result["metrics"]["convergence_time"] == config["max_ticks"]

    @pytest.mark.parametrize("topology", TOPOLOGIES)
    def test_message_accounting_is_consistent(self, topology):
        config = {**BENIGN_CONFIG, "seed": 42}
        result = SimulationEngine(topology, 5, config).run()
        metrics = result["metrics"]
        assert metrics["total_messages_sent"] >= metrics["total_messages_received"]
        assert metrics["total_messages_sent"] >= metrics["total_messages_dropped"]

    @pytest.mark.parametrize("topology", TOPOLOGIES)
    def test_single_node_cluster_elects_itself_immediately(self, topology):
        config = {**BENIGN_CONFIG, "max_ticks": 350, "seed": 42}
        result = SimulationEngine(topology, 1, config).run()
        assert result["metrics"]["election_count"] == 1
        assert result["metrics"]["leader_elections"][0]["leader"] == 0
