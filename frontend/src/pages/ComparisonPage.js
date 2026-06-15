import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, BarChart3 } from "lucide-react";
import ComparisonCharts from "@/components/ComparisonCharts";
import { exportComparisonCSV, exportStatisticalCSV } from "@/utils/csvExport";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ComparisonPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState({
    num_nodes: 5,
    message_delay: 10,
    packet_loss: 0,
    node_failure_prob: 0,
    node_recovery_prob: 0,
    max_ticks: 1000,
    log_entries: 5,
    seed: 42,
    runs: 1,
  });
  const [results, setResults] = useState(null);
  const [statResults, setStatResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("single"); // "single" or "statistical"

  // Replay from history
  useEffect(() => {
    const replayId = searchParams.get("replay");
    if (replayId) {
      const loadReplay = async () => {
        setLoading(true);
        try {
          const res = await axios.get(`${API}/comparisons/${replayId}`);
          setResults(res.data.results);
          setMode("single");
          toast.success("Comparison loaded from history");
        } catch (e) {
          toast.error("Failed to load comparison");
        }
        setLoading(false);
        setSearchParams({}, { replace: true });
      };
      loadReplay();
    }
  }, []);

  const runComparison = async () => {
    setLoading(true);
    setResults(null);
    setStatResults(null);
    try {
      if (config.runs > 1) {
        setMode("statistical");
        const res = await axios.post(`${API}/simulations/statistical`, {
          num_nodes: config.num_nodes,
          message_delay: config.message_delay,
          packet_loss: config.packet_loss,
          node_failure_prob: config.node_failure_prob,
          node_recovery_prob: config.node_recovery_prob,
          max_ticks: config.max_ticks,
          log_entries: config.log_entries,
          base_seed: config.seed,
          runs: config.runs,
        });
        setStatResults(res.data);
        toast.success(`Statistical analysis complete (${config.runs} runs per topology)`);
      } else {
        setMode("single");
        const res = await axios.post(`${API}/simulations/compare`, {
          num_nodes: config.num_nodes,
          message_delay: config.message_delay,
          packet_loss: config.packet_loss,
          node_failure_prob: config.node_failure_prob,
          node_recovery_prob: config.node_recovery_prob,
          max_ticks: config.max_ticks,
          log_entries: config.log_entries,
          seed: config.seed,
        });
        setResults(res.data.results);
        toast.success("Comparison complete");
      }
    } catch (e) {
      toast.error("Analysis failed");
    }
    setLoading(false);
  };

  const handleExport = () => {
    if (mode === "statistical" && statResults) {
      exportStatisticalCSV(statResults.results, statResults.config);
    } else if (results) {
      exportComparisonCSV(results);
    }
  };

  const updateConfig = (key, value) => setConfig((prev) => ({ ...prev, [key]: value }));
  const hasResults = results || statResults;

  return (
    <div data-testid="comparison-page">
      {/* Config bar */}
      <div className="border-b border-zinc-900 px-6 py-4">
        <div className="flex items-end gap-6 flex-wrap">
          <div className="min-w-[200px]">
            <h2 className="font-chivo font-bold text-xl tracking-tight uppercase mb-1">
              Topology Comparison
            </h2>
            <p className="text-xs text-zinc-500">
              {config.runs > 1
                ? `Statistical analysis: ${config.runs} runs per topology`
                : "Single run across all 5 topologies"}
            </p>
          </div>

          <div className="flex items-center gap-5 flex-wrap flex-1">
            <div className="w-24">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
                Nodes: {config.num_nodes}
              </Label>
              <Slider
                value={[config.num_nodes]}
                onValueChange={([v]) => updateConfig("num_nodes", v)}
                min={3}
                max={15}
                step={1}
                data-testid="compare-nodes-slider"
              />
            </div>

            <div className="w-24">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
                Delay: {config.message_delay}
              </Label>
              <Slider
                value={[config.message_delay]}
                onValueChange={([v]) => updateConfig("message_delay", v)}
                min={1}
                max={50}
                step={1}
                data-testid="compare-delay-slider"
              />
            </div>

            <div className="w-24">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
                Loss: {(config.packet_loss * 100).toFixed(0)}%
              </Label>
              <Slider
                value={[config.packet_loss * 100]}
                onValueChange={([v]) => updateConfig("packet_loss", v / 100)}
                min={0}
                max={50}
                step={1}
                data-testid="compare-loss-slider"
              />
            </div>

            <div className="w-24">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
                Failure: {(config.node_failure_prob * 100).toFixed(0)}%
              </Label>
              <Slider
                value={[config.node_failure_prob * 100]}
                onValueChange={([v]) => updateConfig("node_failure_prob", v / 100)}
                min={0}
                max={100}
                step={5}
                data-testid="compare-failure-slider"
              />
            </div>

            <div className="w-24">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
                Recovery: {(config.node_recovery_prob * 100).toFixed(0)}%
              </Label>
              <Slider
                value={[config.node_recovery_prob * 100]}
                onValueChange={([v]) => updateConfig("node_recovery_prob", v / 100)}
                min={0}
                max={100}
                step={5}
                data-testid="compare-recovery-slider"
              />
            </div>

            <div className="w-24">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
                Duration: {config.max_ticks}
              </Label>
              <Slider
                value={[config.max_ticks]}
                onValueChange={([v]) => updateConfig("max_ticks", v)}
                min={100}
                max={5000}
                step={100}
                data-testid="compare-ticks-slider"
              />
            </div>

            <Separator orientation="vertical" className="h-8 bg-zinc-300" />

            <div className="w-24">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-500">
                Runs: {config.runs}
              </Label>
              <Slider
                value={[config.runs]}
                onValueChange={([v]) => updateConfig("runs", v)}
                min={1}
                max={20}
                step={1}
                data-testid="compare-runs-slider"
              />
            </div>

            {config.runs > 1 && (
              <Badge
                variant="outline"
                className="rounded-none text-[10px] border-blue-500 text-blue-600"
              >
                STATISTICAL MODE
              </Badge>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {hasResults && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none border-zinc-900 text-xs gap-1.5"
                  onClick={handleExport}
                  data-testid="export-comparison-csv-btn"
                >
                  <Download className="h-3 w-3" />
                  CSV
                </Button>
              )}

              <Button
                onClick={runComparison}
                disabled={loading}
                className="rounded-none bg-zinc-900 hover:bg-zinc-700 text-white px-5"
                data-testid="run-comparison-btn"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                {loading
                  ? config.runs > 1
                    ? `Running ${config.runs * 5} sims...`
                    : "Running 5 sims..."
                  : config.runs > 1
                  ? `Run Statistical (${config.runs}x5)`
                  : "Run Comparison"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {mode === "statistical" && statResults ? (
        <div className="animate-fade-in">
          <ComparisonCharts statResults={statResults.results} isStatistical={true} />
        </div>
      ) : results ? (
        <div className="animate-fade-in">
          <ComparisonCharts results={results} isStatistical={false} />
        </div>
      ) : (
        <div className="flex items-center justify-center py-32 text-zinc-400">
          <div className="text-center">
            <BarChart3 className="h-8 w-8 mx-auto mb-3 text-zinc-300" />
            <p className="font-mono text-sm">Configure parameters and run comparison</p>
            <p className="text-xs mt-1">Star / Ring / Mesh / Tree / Bus</p>
            <p className="text-xs mt-2 text-zinc-300">Set Runs &gt; 1 for statistical analysis with mean and std</p>
          </div>
        </div>
      )}
    </div>
  );
}
