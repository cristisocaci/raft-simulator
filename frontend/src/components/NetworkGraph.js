const STATE_COLORS = {
  leader: "#0033CC",
  candidate: "#F59E0B",
  follower: "#71717A",
  dead: "#EF4444",
};

const MESSAGE_COLOR = "#10B981";

export default function NetworkGraph({ graph, snapshot, events, topology }) {
  if (!graph) {
    return (
      <div
        className="flex items-center justify-center h-full min-h-[350px] border border-zinc-200"
        data-testid="network-graph-placeholder"
      >
        <div className="text-center">
          <p className="font-mono text-sm text-zinc-400">No simulation data</p>
          <p className="text-xs text-zinc-300 mt-1">Configure and run a simulation</p>
        </div>
      </div>
    );
  }

  const nodeStates = {};
  snapshot?.nodes?.forEach((n) => {
    nodeStates[n.id] = n;
  });

  const recentMessages =
    events
      ?.filter((e) => e.type === "message_sent")
      .slice(-10) || [];

  const nodeMap = {};
  graph.nodes.forEach((n) => {
    nodeMap[n.id] = n;
  });

  return (
    <div data-testid="network-graph">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">
          Network Topology
        </h3>
        <span className="font-mono text-[10px] text-zinc-400 uppercase border border-zinc-300 px-2 py-0.5">
          {topology}
        </span>
      </div>
      <svg
        viewBox="0 0 600 400"
        className="w-full border border-zinc-200 bg-zinc-50"
        data-testid="network-svg"
      >
        {/* Edges */}
        {graph.edges.map((edge, i) => {
          const src = nodeMap[edge.source];
          const dst = nodeMap[edge.target];
          if (!src || !dst) return null;
          return (
            <line
              key={`edge-${i}`}
              x1={src.x}
              y1={src.y}
              x2={dst.x}
              y2={dst.y}
              stroke="#D4D4D8"
              strokeWidth={1}
            />
          );
        })}

        {/* Message flow lines */}
        {recentMessages.map((msg, i) => {
          const src = nodeMap[msg.node];
          const dst = nodeMap[msg.target];
          if (!src || !dst) return null;
          return (
            <line
              key={`msg-${i}`}
              x1={src.x}
              y1={src.y}
              x2={dst.x}
              y2={dst.y}
              stroke={MESSAGE_COLOR}
              strokeWidth={2}
              opacity={0.5}
              strokeDasharray="4 3"
              className="animate-dash"
            />
          );
        })}

        {/* Nodes */}
        {graph.nodes.map((node) => {
          const state = nodeStates[node.id]?.state || "follower";
          const color = STATE_COLORS[state];
          const isLeader = state === "leader";
          return (
            <g key={node.id} data-testid={`graph-node-${node.id}`}>
              {/* Outer ring for leader */}
              {isLeader && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={25}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.4}
                  className="leader-pulse"
                />
              )}
              <circle cx={node.x} cy={node.y} r={20} fill={color} />
              <text
                x={node.x}
                y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={13}
                fontWeight="600"
                fontFamily="IBM Plex Mono"
              >
                {node.id}
              </text>
              {/* State label below */}
              <text
                x={node.x}
                y={node.y + 36}
                textAnchor="middle"
                fill="#52525B"
                fontSize={9}
                fontFamily="IBM Plex Mono"
                textTransform="uppercase"
              >
                {state === "dead" ? "DEAD" : state.charAt(0).toUpperCase() + state.slice(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
