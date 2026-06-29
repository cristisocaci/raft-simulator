import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp } from "lucide-react";
import SweepCharts from "@/components/SweepCharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SWEEP_PARAMS = [
  { value: "packet_loss",       label: "Packet Loss",    unit: "%",     scale: 100, defaultMin: 0,  defaultMax: 40,  defaultStep: 5,  uiMin: 0,  uiMax: 50,  stepMin: 1, stepMax: 20 },
  { value: "message_delay",     label: "Message Delay",  unit: "ticks", scale: 1,   defaultMin: 2,  defaultMax: 50,  defaultStep: 10, uiMin: 1,  uiMax: 50,  stepMin: 1, stepMax: 25 },
  { value: "num_nodes",         label: "Cluster Size",   unit: "nodes", scale: 1,   defaultMin: 3,  defaultMax: 13,  defaultStep: 2,  uiMin: 3,  uiMax: 15,  stepMin: 1, stepMax: 4  },
  { value: "node_failure_prob", label: "Node Failure",   unit: "%",     scale: 100, defaultMin: 0,  defaultMax: 50,  defaultStep: 10, uiMin: 0,  uiMax: 100, stepMin: 1, stepMax: 25 },
  { value: "node_recovery_prob",label: "Node Recovery",  unit: "%",     scale: 100, defaultMin: 0,  defaultMax: 100, defaultStep: 20, uiMin: 0,  uiMax: 100, stepMin: 1, stepMax: 25 },
];

function generateValues(min, max, step) {
  const values = [];
  for (let v = min; v <= max + 0.001; v = Math.round((v + step) * 1000) / 1000) {
    values.push(v);
  }
  return values;
}

export default function SweepPage() {
  const [sweepParamKey, setSweepParamKey] = useState("packet_loss");
  const [range, setRange] = useState({ min: 0, max: 40, step: 5 });
  const [baseConfig, setBaseConfig] = useState({
    num_nodes: 5,
    message_delay: 10,
    packet_loss: 0,
    node_failure_prob: 0,
    node_recovery_prob: 0,
    max_ticks: 1000,
    log_entries: 5,
    runs: 5,
    seed: 42,
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const paramDef = SWEEP_PARAMS.find(p => p.value === sweepParamKey);
  const sweepValues = generateValues(range.min, range.max, range.step);
  const totalSims = sweepValues.length * 5 * baseConfig.runs;

  const handleParamChange = (key) => {
    const def = SWEEP_PARAMS.find(p => p.value === key);
    setSweepParamKey(key);
    setRange({ min: def.defaultMin, max: def.defaultMax, step: def.defaultStep });
  };

  const updateBase = (key, value) => setBaseConfig(prev => ({ ...prev, [key]: value }));

  const runSweep = async () => {
    setLoading(true);
    setResults(null);
    try {
      const apiValues = sweepValues.map(v => v / paramDef.scale);
      const res = await axios.post(`${API}/simulations/sweep`, {
        sweep_param: sweepParamKey,
        sweep_values: apiValues,
        num_nodes: baseConfig.num_nodes,
        message_delay: baseConfig.message_delay,
        packet_loss: baseConfig.packet_loss,
        node_failure_prob: baseConfig.node_failure_prob,
        node_recovery_prob: baseConfig.node_recovery_prob,
        max_ticks: baseConfig.max_ticks,
        log_entries: baseConfig.log_entries,
        base_seed: baseConfig.seed,
        runs: baseConfig.runs,
      });
      setResults(res.data);
      toast.success(`Sweep complete (${totalSims} simulations)`);
    } catch (e) {
      toast.error("Sweep failed");
    }
    setLoading(false);
  };

  const BASE_SLIDERS = [
    { key: "num_nodes",          label: `Nodes: ${baseConfig.num_nodes}`,                            min: 3,   max: 15,   step: 1,   uiVal: baseConfig.num_nodes,                           fromUi: v => v },
    { key: "message_delay",      label: `Delay: ${baseConfig.message_delay}`,                        min: 1,   max: 50,   step: 1,   uiVal: baseConfig.message_delay,                       fromUi: v => v },
    { key: "packet_loss",        label: `Loss: ${Math.round(baseConfig.packet_loss * 100)}%`,        min: 0,   max: 50,   step: 1,   uiVal: Math.round(baseConfig.packet_loss * 100),        fromUi: v => v / 100 },
    { key: "node_failure_prob",  label: `Failure: ${Math.round(baseConfig.node_failure_prob * 100)}%`,  min: 0, max: 100, step: 5, uiVal: Math.round(baseConfig.node_failure_prob * 100),  fromUi: v => v / 100 },
    { key: "node_recovery_prob", label: `Recovery: ${Math.round(baseConfig.node_recovery_prob * 100)}%`, min: 0, max: 100, step: 5, uiVal: Math.round(baseConfig.node_recovery_prob * 100), fromUi: v => v / 100 },
    { key: "max_ticks",          label: `Duration: ${baseConfig.max_ticks}`,                         min: 100, max: 5000, step: 100, uiVal: baseConfig.max_ticks,                           fromUi: v => v },
  ];

  return (
    <div data-testid="sweep-page">
      <div className="border-b border-zinc-900 px-6 py-4">
        <div className="flex items-end gap-6 flex-wrap">

          <div className="min-w-[160px]">
            <h2 className="font-chivo font-bold text-xl tracking-tight uppercase mb-1">
              Parameter Sweep
            </h2>
            <p className="text-xs text-zinc-500">
              {sweepValues.length} values × 5 topologies × {baseConfig.runs} runs = {totalSims} sims
            </p>
          </div>

          {/* Sweep param selector */}
          <div className="w-36">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1.5">
              Sweep
            </Label>
            <Select value={sweepParamKey} onValueChange={handleParamChange}>
              <SelectTrigger className="rounded-none border-zinc-300 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {SWEEP_PARAMS.map(p => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Range controls */}
          <div className="w-24">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
              From: {range.min}{paramDef.unit}
            </Label>
            <Slider
              value={[range.min]}
              onValueChange={([v]) => setRange(r => ({ ...r, min: Math.min(v, r.max - r.step) }))}
              min={paramDef.uiMin}
              max={paramDef.uiMax}
              step={paramDef.stepMin}
            />
          </div>

          <div className="w-24">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
              To: {range.max}{paramDef.unit}
            </Label>
            <Slider
              value={[range.max]}
              onValueChange={([v]) => setRange(r => ({ ...r, max: Math.max(v, r.min + r.step) }))}
              min={paramDef.uiMin}
              max={paramDef.uiMax}
              step={paramDef.stepMin}
            />
          </div>

          <div className="w-24">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
              Step: {range.step}{paramDef.unit}
            </Label>
            <Slider
              value={[range.step]}
              onValueChange={([v]) => setRange(r => ({ ...r, step: v }))}
              min={paramDef.stepMin}
              max={paramDef.stepMax}
              step={paramDef.stepMin}
            />
          </div>

          <Separator orientation="vertical" className="h-8 bg-zinc-300" />

          {/* Base config sliders (excluding swept param) */}
          {BASE_SLIDERS.filter(s => s.key !== sweepParamKey).map(s => (
            <div key={s.key} className="w-24">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
                {s.label}
              </Label>
              <Slider
                value={[s.uiVal]}
                onValueChange={([v]) => updateBase(s.key, s.fromUi(v))}
                min={s.min}
                max={s.max}
                step={s.step}
              />
            </div>
          ))}

          <Separator orientation="vertical" className="h-8 bg-zinc-300" />

          <div className="w-20">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
              Runs: {baseConfig.runs}
            </Label>
            <Slider
              value={[baseConfig.runs]}
              onValueChange={([v]) => updateBase("runs", v)}
              min={1}
              max={10}
              step={1}
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Seed</Label>
            <input
              type="number"
              value={baseConfig.seed}
              onChange={e => updateBase("seed", parseInt(e.target.value, 10) || 0)}
              className="rounded-none border border-zinc-300 w-20 h-7 text-xs font-mono px-2 focus:outline-none focus:border-zinc-900"
              data-testid="sweep-seed-input"
            />
          </div>

          <Button
            onClick={runSweep}
            disabled={loading || sweepValues.length === 0}
            className="rounded-none bg-zinc-900 hover:bg-zinc-700 text-white px-5 ml-auto"
            data-testid="run-sweep-btn"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            {loading ? `Running ${totalSims} sims...` : "Run Sweep"}
          </Button>
        </div>
      </div>

      {results ? (
        <div className="animate-fade-in">
          <SweepCharts results={results} />
        </div>
      ) : (
        <div className="flex items-center justify-center py-32 text-zinc-400">
          <div className="text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-3 text-zinc-300" />
            <p className="font-mono text-sm">Select a parameter and run the sweep</p>
            <p className="text-xs mt-1">One line per topology across the swept range</p>
          </div>
        </div>
      )}
    </div>
  );
}
