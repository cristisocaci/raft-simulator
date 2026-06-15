import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Download } from "lucide-react";
import SimulationPanel from "@/components/SimulationPanel";
import NetworkGraph from "@/components/NetworkGraph";
import EventLog from "@/components/EventLog";
import MetricsPanel from "@/components/MetricsPanel";
import { exportSimulationCSV } from "@/utils/csvExport";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATE_COLORS = {
  leader: "#0033CC",
  candidate: "#F59E0B",
  follower: "#71717A",
  dead: "#EF4444",
};

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState({
    topology: "mesh",
    num_nodes: 5,
    message_delay: 10,
    packet_loss: 0,
    node_failure_prob: 0,
    node_recovery_prob: 0,
    max_ticks: 1000,
    log_entries: 5,
    seed: 42,
    inject_leader_failure_at: null,
  });
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snapshotIdx, setSnapshotIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);

  const runSimulation = useCallback(async () => {
    setLoading(true);
    setSimulation(null);
    setSnapshotIdx(0);
    setPlaying(false);
    try {
      const res = await axios.post(`${API}/simulations`, config);
      setSimulation(res.data);
      toast.success("Simulation complete");
    } catch (e) {
      toast.error("Simulation failed");
    }
    setLoading(false);
  }, [config]);

  useEffect(() => {
    if (!playing || !simulation) return;
    const interval = setInterval(() => {
      setSnapshotIdx((prev) => {
        if (prev >= simulation.snapshots.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / speed);
    return () => clearInterval(interval);
  }, [playing, speed, simulation]);

  // Replay from history
  useEffect(() => {
    const replayId = searchParams.get("replay");
    if (replayId) {
      const loadReplay = async () => {
        setLoading(true);
        try {
          const res = await axios.get(`${API}/simulations/${replayId}`);
          setSimulation(res.data);
          setSnapshotIdx(0);
          setPlaying(false);
          toast.success("Simulation loaded from history");
        } catch (e) {
          toast.error("Failed to load simulation");
        }
        setLoading(false);
        setSearchParams({}, { replace: true });
      };
      loadReplay();
    }
  }, []); 

  const snapshot = simulation?.snapshots?.[snapshotIdx];
  const currentTick = snapshot?.tick ?? 0;
  const filteredEvents = simulation?.events?.filter((e) => e.tick <= currentTick) ?? [];

  return (
    <div data-testid="dashboard-page">
      {/* Top: 3-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12" style={{ minHeight: "520px" }}>
        {/* Left: Config */}
        <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-zinc-900 overflow-y-auto">
          <SimulationPanel
            config={config}
            setConfig={setConfig}
            onRun={runSimulation}
            loading={loading}
          />
        </div>

        {/* Center: Graph + Playback */}
        <div className="lg:col-span-6 border-b lg:border-b-0 lg:border-r border-zinc-900 flex flex-col">
          <div className="flex-1 p-4">
            <NetworkGraph
              graph={simulation?.graph}
              snapshot={snapshot}
              events={filteredEvents}
              topology={simulation?.topology || config.topology}
            />
          </div>

          {simulation && (
            <div className="border-t border-zinc-300 px-4 py-3 space-y-2" data-testid="playback-controls">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-none border-zinc-900"
                  onClick={() => { setSnapshotIdx(0); setPlaying(false); }}
                  data-testid="playback-reset"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-none border-zinc-900"
                  onClick={() => setSnapshotIdx((p) => Math.max(0, p - 1))}
                  data-testid="playback-back"
                >
                  <SkipBack className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  className="h-7 w-7 p-0 rounded-none bg-zinc-900"
                  onClick={() => setPlaying(!playing)}
                  data-testid="playback-toggle"
                >
                  {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-none border-zinc-900"
                  onClick={() =>
                    setSnapshotIdx((p) => Math.min((simulation?.snapshots?.length || 1) - 1, p + 1))
                  }
                  data-testid="playback-forward"
                >
                  <SkipForward className="h-3 w-3" />
                </Button>

                <span className="font-mono text-xs text-zinc-500 ml-2">
                  T={currentTick}
                </span>
                <span className="font-mono text-xs text-zinc-400">
                  [{snapshotIdx + 1}/{simulation?.snapshots?.length || 0}]
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-zinc-500 uppercase tracking-wider">Speed</span>
                  {[1, 5, 10, 25].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`text-xs font-mono px-1.5 py-0.5 border transition-colors ${
                        speed === s
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "border-zinc-300 text-zinc-500 hover:border-zinc-900"
                      }`}
                      data-testid={`speed-${s}x`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
              <Slider
                value={[snapshotIdx]}
                onValueChange={([v]) => { setSnapshotIdx(v); setPlaying(false); }}
                min={0}
                max={Math.max((simulation?.snapshots?.length || 1) - 1, 0)}
                step={1}
                className="w-full"
                data-testid="playback-slider"
              />
            </div>
          )}
        </div>

        {/* Right: Node States + Event Log */}
        <div className="lg:col-span-3 flex flex-col overflow-hidden" style={{ maxHeight: "520px" }}>
          {/* Node states */}
          {snapshot && (
            <div className="p-3 border-b border-zinc-300" data-testid="node-states-panel">
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500 mb-2">
                Node States
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.nodes.map((n) => (
                  <Badge
                    key={n.id}
                    variant="outline"
                    className="rounded-none text-[10px] font-mono border-current gap-1 px-1.5"
                    style={{ color: STATE_COLORS[n.state], borderColor: STATE_COLORS[n.state] }}
                    data-testid={`node-state-${n.id}`}
                  >
                    <span
                      className="inline-block w-2 h-2"
                      style={{ backgroundColor: STATE_COLORS[n.state] }}
                    />
                    N{n.id} T{n.term}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {/* Legend */}
          <div className="px-3 py-2 border-b border-zinc-300 flex flex-wrap gap-3">
            {Object.entries(STATE_COLORS).map(([state, color]) => (
              <div key={state} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: color }} />
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">{state}</span>
              </div>
            ))}
          </div>
          {/* Event log */}
          <div className="flex-1 overflow-hidden">
            <EventLog events={filteredEvents} />
          </div>
        </div>
      </div>

      {/* Bottom: Metrics */}
      {simulation && (
        <div className="border-t border-zinc-900 animate-fade-in" data-testid="metrics-section">
          <div className="flex items-center justify-between px-4 pt-4">
            <h2 className="font-chivo font-bold text-sm uppercase tracking-[0.1em]">
              Simulation Metrics
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="rounded-none border-zinc-900 text-xs gap-1.5"
              onClick={() => exportSimulationCSV(simulation)}
              data-testid="export-csv-btn"
            >
              <Download className="h-3 w-3" />
              Export CSV
            </Button>
          </div>
          <MetricsPanel metrics={simulation.metrics} events={simulation.events} />
        </div>
      )}
    </div>
  );
}
