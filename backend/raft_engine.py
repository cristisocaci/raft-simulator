import random
import math
from collections import defaultdict, deque


class NodeState:
    FOLLOWER = "follower"
    CANDIDATE = "candidate"
    LEADER = "leader"
    DEAD = "dead"


class MessageType:
    REQUEST_VOTE = "request_vote"
    VOTE_RESPONSE = "vote_response"
    APPEND_ENTRIES = "append_entries"
    APPEND_RESPONSE = "append_response"


class EventType:
    STATE_CHANGE = "state_change"
    MESSAGE_SENT = "message_sent"
    LEADER_ELECTED = "leader_elected"
    ELECTION_TIMEOUT = "election_timeout"
    NODE_FAILED = "node_failed"
    LOG_REPLICATED = "log_replicated"
    LOG_COMMITTED = "log_committed"


class RaftNode:
    def __init__(self, node_id, num_nodes, rng):
        self.id = node_id
        self.state = NodeState.FOLLOWER
        self.current_term = 0
        self.voted_for = None
        self.log = []
        self.commit_index = -1
        self.rng = rng

        self.election_timeout = self.rng.randint(150, 300)
        self.election_timer = 0
        self.heartbeat_interval = 50
        self.heartbeat_timer = 0

        self.votes_received = set()
        self.num_nodes = num_nodes
        self.next_index = {}
        self.match_index = {}

    def reset_election_timer(self):
        self.election_timer = 0
        self.election_timeout = self.rng.randint(150, 300)

    def become_follower(self, term):
        self.state = NodeState.FOLLOWER
        self.current_term = term
        self.voted_for = None
        self.votes_received = set()
        self.reset_election_timer()

    def become_candidate(self):
        self.state = NodeState.CANDIDATE
        self.current_term += 1
        self.voted_for = self.id
        self.votes_received = {self.id}
        self.reset_election_timer()

    def become_leader(self):
        self.state = NodeState.LEADER
        self.heartbeat_timer = 0
        for i in range(self.num_nodes):
            if i != self.id:
                self.next_index[i] = len(self.log)
                self.match_index[i] = -1


class TopologyManager:
    @staticmethod
    def create_adjacency(topology_type, num_nodes):
        fn = {
            "star": TopologyManager._star,
            "ring": TopologyManager._ring,
            "mesh": TopologyManager._mesh,
            "tree": TopologyManager._tree,
            "bus": TopologyManager._bus,
        }
        return fn[topology_type](num_nodes)

    @staticmethod
    def _star(n):
        adj = defaultdict(set)
        for i in range(1, n):
            adj[0].add(i)
            adj[i].add(0)
        if n >= 1:
            adj.setdefault(0, set())
        return dict(adj)

    @staticmethod
    def _ring(n):
        adj = defaultdict(set)
        for i in range(n):
            adj[i].add((i + 1) % n)
            adj[i].add((i - 1) % n)
        return dict(adj)

    @staticmethod
    def _mesh(n):
        adj = defaultdict(set)
        for i in range(n):
            for j in range(n):
                if i != j:
                    adj[i].add(j)
        return dict(adj)

    @staticmethod
    def _tree(n):
        adj = defaultdict(set)
        for i in range(n):
            left = 2 * i + 1
            right = 2 * i + 2
            if left < n:
                adj[i].add(left)
                adj[left].add(i)
            if right < n:
                adj[i].add(right)
                adj[right].add(i)
        if n >= 1:
            adj.setdefault(0, set())
        return dict(adj)

    @staticmethod
    def _bus(n):
        adj = defaultdict(set)
        for i in range(n - 1):
            adj[i].add(i + 1)
            adj[i + 1].add(i)
        if n >= 1:
            adj.setdefault(0, set())
        return dict(adj)

    @staticmethod
    def compute_shortest_paths(adjacency, num_nodes):
        distances = {}
        for src in range(num_nodes):
            dist = {src: 0}
            queue = deque([src])
            while queue:
                node = queue.popleft()
                for neighbor in adjacency.get(node, []):
                    if neighbor not in dist:
                        dist[neighbor] = dist[node] + 1
                        queue.append(neighbor)
            distances[src] = dist
        return distances

    @staticmethod
    def compute_positions(topology_type, num_nodes, width=600, height=400):
        cx, cy = width / 2, height / 2
        positions = []

        if topology_type == "star":
            positions.append({"x": round(cx, 1), "y": round(cy, 1)})
            for i in range(1, num_nodes):
                angle = 2 * math.pi * (i - 1) / max(num_nodes - 1, 1) - math.pi / 2
                r = min(width, height) * 0.35
                positions.append({
                    "x": round(cx + r * math.cos(angle), 1),
                    "y": round(cy + r * math.sin(angle), 1),
                })

        elif topology_type in ("ring", "mesh"):
            for i in range(num_nodes):
                angle = 2 * math.pi * i / num_nodes - math.pi / 2
                r = min(width, height) * 0.35
                positions.append({
                    "x": round(cx + r * math.cos(angle), 1),
                    "y": round(cy + r * math.sin(angle), 1),
                })

        elif topology_type == "tree":
            levels = {}
            queue = deque([(0, 0)])
            visited = {0}
            while queue:
                node, level = queue.popleft()
                if level not in levels:
                    levels[level] = []
                levels[level].append(node)
                for child in [2 * node + 1, 2 * node + 2]:
                    if child < num_nodes and child not in visited:
                        visited.add(child)
                        queue.append((child, level + 1))
            max_level = max(levels.keys()) if levels else 0
            pos_map = {}
            for level, nodes_in_level in levels.items():
                y = 50 + (height - 100) * level / max(max_level, 1)
                for idx, node in enumerate(nodes_in_level):
                    x = (width / (len(nodes_in_level) + 1)) * (idx + 1)
                    pos_map[node] = {"x": round(x, 1), "y": round(y, 1)}
            positions = [pos_map.get(i, {"x": round(cx, 1), "y": round(cy, 1)}) for i in range(num_nodes)]

        elif topology_type == "bus":
            for i in range(num_nodes):
                x = 60 + (width - 120) * i / max(num_nodes - 1, 1)
                positions.append({"x": round(x, 1), "y": round(cy, 1)})

        return positions


class SimulationEngine:
    def __init__(self, topology_type, num_nodes, config=None):
        self.topology_type = topology_type
        self.num_nodes = num_nodes
        self.config = config or {}

        self.message_delay = self.config.get("message_delay", 10)
        self.packet_loss = self.config.get("packet_loss", 0.0)
        self.node_failure_prob = self.config.get("node_failure_prob", 0.0)
        self.node_recovery_prob = self.config.get("node_recovery_prob", 0.0)
        self.max_ticks = self.config.get("max_ticks", 1000)
        self.log_entries_count = self.config.get("log_entries", 5)
        self.inject_leader_failure_at = self.config.get("inject_leader_failure_at", None)

        self.seed = self.config.get("seed", None)
        self.rng = random.Random(self.seed) if self.seed is not None else random.Random()

        self.adjacency = TopologyManager.create_adjacency(topology_type, num_nodes)
        self.positions = TopologyManager.compute_positions(topology_type, num_nodes)
        self.live_nodes = set(range(num_nodes))
        self._recompute_distances()

        self.nodes = [RaftNode(i, num_nodes, self.rng) for i in range(num_nodes)]
        self.message_queue = []
        self.events = []
        self.snapshots = []

        self.metrics = {
            "total_messages_sent": 0,
            "total_messages_received": 0,
            "total_messages_dropped": 0,
            "leader_elections": [],
            "first_leader_election_time": None,
            "election_count": 0,
            "convergence_time": None,
            "throughput": 0,
            "avg_latency_hops": 0,
            "avg_latency_ticks": 0,
            "message_breakdown": {},
            "entries_committed": 0,
        }

        self.current_tick = 0
        self.current_leader = None
        self.entries_committed = 0
        self.log_submit_count = 0
        self._total_hops = 0
        self._total_msg_count = 0

    def _recompute_distances(self):
        live_adj = defaultdict(set)
        for src in self.live_nodes:
            for dst in self.adjacency.get(src, []):
                if dst in self.live_nodes:
                    live_adj[src].add(dst)
        self.distances = TopologyManager.compute_shortest_paths(dict(live_adj), self.num_nodes)

    def run(self):
        for tick in range(self.max_ticks):
            self.current_tick = tick

            if self.inject_leader_failure_at and tick == self.inject_leader_failure_at:
                if self.current_leader is not None:
                    self._kill_node(self.current_leader)

            if (self.node_failure_prob > 0 and tick > 200
                    and tick % 200 == 0 and self.rng.random() < self.node_failure_prob):
                self._inject_random_fault()

            if (self.node_recovery_prob > 0 and tick > 300
                    and tick % 150 == 0):
                self._recover_nodes()

            self._step()

            if tick % 10 == 0:
                self._record_snapshot()

            if (self.current_leader is not None and tick > 0
                    and tick % 100 == 0 and self.log_submit_count < self.log_entries_count):
                self._submit_log_entry()

        self._record_snapshot()
        self._compute_final_metrics()
        return self._get_results()

    def _step(self):
        remaining = []
        for delivery_tick, msg_data in self.message_queue:
            if delivery_tick <= self.current_tick:
                receiver = self.nodes[msg_data["receiver"]]
                if receiver.state != NodeState.DEAD:
                    self._handle_message(receiver, msg_data)
                    self.metrics["total_messages_received"] += 1
            else:
                remaining.append((delivery_tick, msg_data))
        self.message_queue = remaining

        for node in self.nodes:
            if node.state == NodeState.DEAD:
                continue
            if node.state == NodeState.LEADER:
                self._process_leader(node)
            else:
                self._process_non_leader(node)

    def _send_message(self, msg_type, sender, receiver, term, data=None):
        if sender not in self.live_nodes or receiver not in self.live_nodes:
            return

        dist = self.distances.get(sender, {}).get(receiver)
        if dist is None:
            self.metrics["total_messages_dropped"] += 1
            return

        for _ in range(dist):
            if self.rng.random() < self.packet_loss:
                self.metrics["total_messages_dropped"] += 1
                return

        delivery_time = dist * self.message_delay + self.rng.randint(0, 3)
        msg_data = {
            "msg_type": msg_type,
            "sender": sender,
            "receiver": receiver,
            "term": term,
            "data": data or {},
            "hops": dist,
        }
        self.message_queue.append((self.current_tick + delivery_time, msg_data))

        self.metrics["total_messages_sent"] += 1
        self._total_hops += dist
        self._total_msg_count += 1
        self.metrics["message_breakdown"][msg_type] = self.metrics["message_breakdown"].get(msg_type, 0) + 1

        self.events.append({
            "tick": self.current_tick,
            "type": EventType.MESSAGE_SENT,
            "node": sender,
            "target": receiver,
            "msg_type": msg_type,
            "term": term,
            "hops": dist,
        })

    def _process_leader(self, node):
        node.heartbeat_timer += 1
        if node.heartbeat_timer >= node.heartbeat_interval:
            node.heartbeat_timer = 0
            for i in range(self.num_nodes):
                if i != node.id and i in self.live_nodes:
                    entries = node.log[node.next_index.get(i, 0):]
                    self._send_message(
                        MessageType.APPEND_ENTRIES, node.id, i, node.current_term,
                        {"entries": entries, "leader_commit": node.commit_index,
                         "prev_log_index": node.next_index.get(i, 0) - 1},
                    )

    def _process_non_leader(self, node):
        node.election_timer += 1
        if node.election_timer >= node.election_timeout:
            node.become_candidate()
            self.events.append({
                "tick": self.current_tick,
                "type": EventType.ELECTION_TIMEOUT,
                "node": node.id,
                "term": node.current_term,
            })
            self.events.append({
                "tick": self.current_tick,
                "type": EventType.STATE_CHANGE,
                "node": node.id,
                "new_state": NodeState.CANDIDATE,
                "term": node.current_term,
            })
            for i in range(self.num_nodes):
                if i != node.id and i in self.live_nodes:
                    last_idx = len(node.log) - 1
                    last_term = node.log[-1][0] if node.log else 0
                    self._send_message(
                        MessageType.REQUEST_VOTE, node.id, i, node.current_term,
                        {"last_log_index": last_idx, "last_log_term": last_term},
                    )

            # A lone node never receives a vote response from itself, so check
            # whether its own vote already constitutes a majority.
            self._try_become_leader(node)

    def _handle_message(self, node, msg):
        term = msg["term"]
        if term > node.current_term:
            node.become_follower(term)
            self.events.append({
                "tick": self.current_tick,
                "type": EventType.STATE_CHANGE,
                "node": node.id,
                "new_state": NodeState.FOLLOWER,
                "term": term,
            })

        handlers = {
            MessageType.REQUEST_VOTE: self._handle_request_vote,
            MessageType.VOTE_RESPONSE: self._handle_vote_response,
            MessageType.APPEND_ENTRIES: self._handle_append_entries,
            MessageType.APPEND_RESPONSE: self._handle_append_response,
        }
        handler = handlers.get(msg["msg_type"])
        if handler:
            handler(node, msg)

    def _handle_request_vote(self, node, msg):
        vote_granted = False
        if msg["term"] >= node.current_term:
            if node.voted_for is None or node.voted_for == msg["sender"]:
                my_last_idx = len(node.log) - 1
                my_last_term = node.log[-1][0] if node.log else 0
                cand_last_idx = msg["data"].get("last_log_index", -1)
                cand_last_term = msg["data"].get("last_log_term", 0)
                if (cand_last_term > my_last_term
                        or (cand_last_term == my_last_term and cand_last_idx >= my_last_idx)):
                    vote_granted = True
                    node.voted_for = msg["sender"]
                    node.reset_election_timer()

        self._send_message(
            MessageType.VOTE_RESPONSE, node.id, msg["sender"], node.current_term,
            {"vote_granted": vote_granted},
        )

    def _handle_vote_response(self, node, msg):
        if node.state != NodeState.CANDIDATE or msg["term"] != node.current_term:
            return
        if msg["data"].get("vote_granted"):
            node.votes_received.add(msg["sender"])
            self._try_become_leader(node)

    def _try_become_leader(self, node):
        if node.state != NodeState.CANDIDATE:
            return
        alive_count = len(self.live_nodes)
        if len(node.votes_received) > alive_count // 2:
            node.become_leader()
            self.current_leader = node.id
            self.metrics["election_count"] += 1
            self.metrics["leader_elections"].append({
                "tick": self.current_tick,
                "leader": node.id,
                "term": node.current_term,
                "votes": len(node.votes_received),
            })
            if self.metrics["first_leader_election_time"] is None:
                self.metrics["first_leader_election_time"] = self.current_tick

            self.events.append({
                "tick": self.current_tick,
                "type": EventType.LEADER_ELECTED,
                "node": node.id,
                "term": node.current_term,
                "votes": len(node.votes_received),
            })
            self.events.append({
                "tick": self.current_tick,
                "type": EventType.STATE_CHANGE,
                "node": node.id,
                "new_state": NodeState.LEADER,
                "term": node.current_term,
            })
            node.heartbeat_timer = node.heartbeat_interval

    def _handle_append_entries(self, node, msg):
        node.reset_election_timer()
        success = False
        if msg["term"] >= node.current_term:
            if node.state != NodeState.FOLLOWER:
                node.become_follower(msg["term"])
            node.current_term = msg["term"]

            entries = msg["data"].get("entries", [])
            prev_idx = msg["data"].get("prev_log_index", -1)
            if entries:
                start = prev_idx + 1
                for i, entry in enumerate(entries):
                    idx = start + i
                    if idx < len(node.log):
                        node.log[idx] = entry
                    else:
                        node.log.append(entry)
            success = True

            leader_commit = msg["data"].get("leader_commit", -1)
            if leader_commit > node.commit_index:
                node.commit_index = min(leader_commit, len(node.log) - 1)

        self._send_message(
            MessageType.APPEND_RESPONSE, node.id, msg["sender"], node.current_term,
            {"success": success, "match_index": len(node.log) - 1},
        )

    def _handle_append_response(self, node, msg):
        if node.state != NodeState.LEADER:
            return
        follower = msg["sender"]
        if msg["data"].get("success"):
            match_idx = msg["data"].get("match_index", -1)
            node.match_index[follower] = match_idx
            node.next_index[follower] = match_idx + 1
            for n in range(node.commit_index + 1, len(node.log)):
                replicated = sum(1 for mi in node.match_index.values() if mi >= n) + 1
                if replicated > len(self.live_nodes) // 2:
                    node.commit_index = n
                    self.entries_committed = n + 1
                    self.events.append({
                        "tick": self.current_tick,
                        "type": EventType.LOG_COMMITTED,
                        "node": node.id,
                        "commit_index": n,
                    })
        else:
            if follower in node.next_index and node.next_index[follower] > 0:
                node.next_index[follower] -= 1

    def _kill_node(self, node_id):
        self.nodes[node_id].state = NodeState.DEAD
        self.live_nodes.discard(node_id)
        if self.current_leader == node_id:
            self.current_leader = None
        self._recompute_distances()
        self.events.append({
            "tick": self.current_tick,
            "type": EventType.NODE_FAILED,
            "node": node_id,
        })

    def _inject_random_fault(self):
        candidates = [n for n in self.live_nodes if n != self.current_leader]
        if candidates:
            victim = self.rng.choice(list(candidates))
            self._kill_node(victim)

    def _recover_nodes(self):
        dead_nodes = [i for i in range(self.num_nodes) if i not in self.live_nodes]
        for node_id in dead_nodes:
            if self.rng.random() < self.node_recovery_prob:
                node = self.nodes[node_id]
                max_term = max(
                    (n.current_term for n in self.nodes if n.state != NodeState.DEAD),
                    default=0,
                )
                node.state = NodeState.FOLLOWER
                node.current_term = max_term
                node.voted_for = None
                node.votes_received = set()
                node.reset_election_timer()
                self.live_nodes.add(node_id)
                self._recompute_distances()
                self.events.append({
                    "tick": self.current_tick,
                    "type": "node_recovered",
                    "node": node_id,
                })

    def _submit_log_entry(self):
        if self.current_leader is not None:
            leader = self.nodes[self.current_leader]
            if leader.state == NodeState.LEADER:
                entry = (leader.current_term, f"cmd_{self.log_submit_count}")
                leader.log.append(entry)
                self.log_submit_count += 1
                self.events.append({
                    "tick": self.current_tick,
                    "type": EventType.LOG_REPLICATED,
                    "node": leader.id,
                    "entry_index": len(leader.log) - 1,
                })

    def _record_snapshot(self):
        self.snapshots.append({
            "tick": self.current_tick,
            "nodes": [{
                "id": n.id,
                "state": n.state,
                "term": n.current_term,
                "log_length": len(n.log),
                "commit_index": n.commit_index,
            } for n in self.nodes],
        })

    def _compute_final_metrics(self):
        if self._total_msg_count > 0:
            self.metrics["avg_latency_hops"] = round(self._total_hops / self._total_msg_count, 2)
            self.metrics["avg_latency_ticks"] = round(
                self._total_hops / self._total_msg_count * self.message_delay, 2
            )

        if self.entries_committed > 0 and self.max_ticks > 0:
            self.metrics["throughput"] = round(self.entries_committed / self.max_ticks * 1000, 4)

        self.metrics["entries_committed"] = self.entries_committed

        if self.metrics["first_leader_election_time"] is not None:
            self.metrics["convergence_time"] = self.metrics["first_leader_election_time"]
        else:
            self.metrics["convergence_time"] = self.max_ticks

    def _get_results(self):
        edges = []
        for src, neighbors in self.adjacency.items():
            for dst in neighbors:
                if src < dst:
                    edges.append({"source": src, "target": dst})

        limited_events = self.events[:1500]

        return {
            "topology": self.topology_type,
            "num_nodes": self.num_nodes,
            "config": {
                "message_delay": self.message_delay,
                "packet_loss": self.packet_loss,
                "node_failure_prob": self.node_failure_prob,
                "node_recovery_prob": self.node_recovery_prob,
                "max_ticks": self.max_ticks,
                "log_entries": self.log_entries_count,
                "seed": self.seed,
                "inject_leader_failure_at": self.inject_leader_failure_at,
            },
            "graph": {
                "nodes": [{"id": i, **self.positions[i]} for i in range(self.num_nodes)],
                "edges": edges,
            },
            "events": limited_events,
            "snapshots": self.snapshots,
            "metrics": self.metrics,
        }
