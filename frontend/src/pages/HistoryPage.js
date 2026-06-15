import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Play, Loader2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TOPO_COLORS = {
  star: "#0033CC",
  ring: "#F59E0B",
  mesh: "#09090B",
  tree: "#10B981",
  bus: "#EF4444",
};

function formatDate(iso) {
  if (!iso) return "---";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [simulations, setSimulations] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [simRes, compRes] = await Promise.all([
          axios.get(`${API}/simulations/history`),
          axios.get(`${API}/comparisons/history`),
        ]);
        setSimulations(simRes.data);
        setComparisons(compRes.data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8" data-testid="history-page">
      {/* Simulation History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-chivo font-bold text-lg uppercase tracking-tight">
            Simulation History
          </h2>
          <span className="font-mono text-xs text-zinc-400">
            {simulations.length} records
          </span>
        </div>

        {simulations.length === 0 ? (
          <div className="border border-zinc-200 p-8 text-center">
            <p className="text-sm text-zinc-400 font-mono">No simulations yet</p>
            <p className="text-xs text-zinc-300 mt-1">
              Run a simulation from the Dashboard to see it here
            </p>
          </div>
        ) : (
          <div className="border border-zinc-200" data-testid="simulations-table">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-200">
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                    Date
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                    Topology
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-center">
                    Nodes
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-center">
                    Election Time
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-center">
                    Messages
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-center">
                    Latency
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-center">
                    Elections
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-right">
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simulations.map((sim) => (
                  <TableRow
                    key={sim.id}
                    className="border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                    onClick={() => navigate(`/?replay=${sim.id}`)}
                    data-testid={`sim-row-${sim.id}`}
                  >
                    <TableCell className="text-xs text-zinc-500 font-mono">
                      {formatDate(sim.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="rounded-none text-[10px] font-mono uppercase border-current"
                        style={{ color: TOPO_COLORS[sim.topology] }}
                      >
                        {sim.topology}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-center">
                      {sim.num_nodes}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-center">
                      {sim.metrics?.first_leader_election_time ?? "---"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-center">
                      {sim.metrics?.total_messages_sent ?? "---"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-center">
                      {sim.metrics?.avg_latency_ticks ?? "---"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-center">
                      {sim.metrics?.election_count ?? "---"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-none border-zinc-900 text-[10px] gap-1 h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/?replay=${sim.id}`);
                        }}
                        data-testid={`replay-sim-${sim.id}`}
                      >
                        <Play className="h-3 w-3" />
                        Replay
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Separator className="bg-zinc-900" />

      {/* Comparison History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-chivo font-bold text-lg uppercase tracking-tight">
            Comparison History
          </h2>
          <span className="font-mono text-xs text-zinc-400">
            {comparisons.length} records
          </span>
        </div>

        {comparisons.length === 0 ? (
          <div className="border border-zinc-200 p-8 text-center">
            <p className="text-sm text-zinc-400 font-mono">No comparisons yet</p>
            <p className="text-xs text-zinc-300 mt-1">
              Run a comparison to see it here
            </p>
          </div>
        ) : (
          <div className="border border-zinc-200" data-testid="comparisons-table">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-200">
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                    Date
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-center">
                    Nodes
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-center">
                    Msg Delay
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-center">
                    Packet Loss
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-center">
                    Failure Prob
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-center">
                    Duration
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold">
                    Best Topology
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-right">
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisons.map((comp) => {
                  const bestTopo = comp.summary
                    ? Object.entries(comp.summary).reduce(
                        (best, [topo, metrics]) => {
                          const t = metrics?.first_leader_election_time;
                          if (t != null && (best.time === null || t < best.time)) {
                            return { topo, time: t };
                          }
                          return best;
                        },
                        { topo: "---", time: null }
                      ).topo
                    : "---";

                  return (
                    <TableRow
                      key={comp.id}
                      className="border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                      onClick={() => navigate(`/compare?replay=${comp.id}`)}
                      data-testid={`comp-row-${comp.id}`}
                    >
                      <TableCell className="text-xs text-zinc-500 font-mono">
                        {formatDate(comp.created_at)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-center">
                        {comp.config?.num_nodes ?? "---"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-center">
                        {comp.config?.message_delay ?? "---"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-center">
                        {comp.config?.packet_loss != null
                          ? `${(comp.config.packet_loss * 100).toFixed(0)}%`
                          : "---"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-center">
                        {comp.config?.node_failure_prob != null
                          ? `${(comp.config.node_failure_prob * 100).toFixed(0)}%`
                          : "---"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-center">
                        {comp.config?.max_ticks ?? "---"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="rounded-none text-[10px] font-mono uppercase border-current"
                          style={{ color: TOPO_COLORS[bestTopo] || "#71717A" }}
                        >
                          {bestTopo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-none border-zinc-900 text-[10px] gap-1 h-7 px-2"
                          data-testid={`replay-comp-${comp.id}`}
                        >
                          <Play className="h-3 w-3" />
                          Replay
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
