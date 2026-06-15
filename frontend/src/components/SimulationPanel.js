import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Loader2, Play } from "lucide-react";
import { useState } from "react";

const TOPOLOGIES = [
  { value: "star", label: "Star", desc: "Central hub, radial connections" },
  { value: "ring", label: "Ring", desc: "Circular, bidirectional" },
  { value: "mesh", label: "Mesh", desc: "Full connectivity" },
  { value: "tree", label: "Tree", desc: "Binary tree hierarchy" },
  { value: "bus", label: "Bus", desc: "Linear chain" },
];

export default function SimulationPanel({ config, setConfig, onRun, loading }) {
  const [leaderFailure, setLeaderFailure] = useState(false);

  const update = (key, value) => setConfig((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="p-4 space-y-4" data-testid="simulation-panel">
      <h2 className="font-chivo font-bold text-sm uppercase tracking-[0.1em]">
        Configuration
      </h2>
      <Separator className="bg-zinc-900" />

      {/* Topology */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
          Topology
        </Label>
        <Select
          value={config.topology}
          onValueChange={(v) => update("topology", v)}
        >
          <SelectTrigger
            className="rounded-none border-zinc-300 focus:border-zinc-900"
            data-testid="topology-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none">
            {TOPOLOGIES.map((t) => (
              <SelectItem key={t.value} value={t.value} data-testid={`topology-${t.value}`}>
                <div>
                  <span className="font-medium">{t.label}</span>
                  <span className="text-zinc-400 ml-1 text-xs">- {t.desc}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Nodes */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
            Nodes
          </Label>
          <span className="font-mono text-xs text-zinc-900">{config.num_nodes}</span>
        </div>
        <Slider
          value={[config.num_nodes]}
          onValueChange={([v]) => update("num_nodes", v)}
          min={3}
          max={15}
          step={1}
          data-testid="nodes-slider"
        />
      </div>

      {/* Message Delay */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
            Message Delay (ticks/hop)
          </Label>
          <span className="font-mono text-xs text-zinc-900">{config.message_delay}</span>
        </div>
        <Slider
          value={[config.message_delay]}
          onValueChange={([v]) => update("message_delay", v)}
          min={1}
          max={50}
          step={1}
          data-testid="delay-slider"
        />
      </div>

      {/* Packet Loss */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
            Packet Loss
          </Label>
          <span className="font-mono text-xs text-zinc-900">
            {(config.packet_loss * 100).toFixed(0)}%
          </span>
        </div>
        <Slider
          value={[config.packet_loss * 100]}
          onValueChange={([v]) => update("packet_loss", v / 100)}
          min={0}
          max={50}
          step={1}
          data-testid="loss-slider"
        />
      </div>

      {/* Node Failure Probability */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
            Node Failure Prob
          </Label>
          <span className="font-mono text-xs text-zinc-900">
            {(config.node_failure_prob * 100).toFixed(0)}%
          </span>
        </div>
        <Slider
          value={[config.node_failure_prob * 100]}
          onValueChange={([v]) => update("node_failure_prob", v / 100)}
          min={0}
          max={100}
          step={5}
          data-testid="failure-slider"
        />
      </div>

      {/* Node Recovery Probability */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
            Node Recovery Prob
          </Label>
          <span className="font-mono text-xs text-zinc-900">
            {(config.node_recovery_prob * 100).toFixed(0)}%
          </span>
        </div>
        <Slider
          value={[config.node_recovery_prob * 100]}
          onValueChange={([v]) => update("node_recovery_prob", v / 100)}
          min={0}
          max={100}
          step={5}
          data-testid="recovery-slider"
        />
      </div>

      {/* Max Ticks */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
            Duration (ticks)
          </Label>
          <span className="font-mono text-xs text-zinc-900">{config.max_ticks}</span>
        </div>
        <Slider
          value={[config.max_ticks]}
          onValueChange={([v]) => update("max_ticks", v)}
          min={100}
          max={5000}
          step={100}
          data-testid="ticks-slider"
        />
      </div>

      {/* Log Entries */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
            Log Entries
          </Label>
          <span className="font-mono text-xs text-zinc-900">{config.log_entries}</span>
        </div>
        <Slider
          value={[config.log_entries]}
          onValueChange={([v]) => update("log_entries", v)}
          min={1}
          max={20}
          step={1}
          data-testid="entries-slider"
        />
      </div>

      <Separator className="bg-zinc-300" />

      {/* Leader failure injection */}
      <div className="flex items-center justify-between">
        <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
          Inject Leader Failure
        </Label>
        <Switch
          checked={leaderFailure}
          onCheckedChange={(checked) => {
            setLeaderFailure(checked);
            update("inject_leader_failure_at", checked ? 500 : null);
          }}
          data-testid="leader-failure-switch"
        />
      </div>
      {leaderFailure && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
              Failure at Tick
            </Label>
            <span className="font-mono text-xs text-zinc-900">
              {config.inject_leader_failure_at}
            </span>
          </div>
          <Slider
            value={[config.inject_leader_failure_at || 500]}
            onValueChange={([v]) => update("inject_leader_failure_at", v)}
            min={100}
            max={config.max_ticks - 100}
            step={50}
            data-testid="leader-failure-tick-slider"
          />
        </div>
      )}

      <Separator className="bg-zinc-300" />

      <Button
        onClick={onRun}
        disabled={loading}
        className="w-full rounded-none bg-zinc-900 hover:bg-zinc-700 text-white h-10"
        data-testid="run-simulation-btn"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        {loading ? "Simulating..." : "Run Simulation"}
      </Button>
    </div>
  );
}
