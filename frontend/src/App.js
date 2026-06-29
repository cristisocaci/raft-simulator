import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import ComparisonPage from "@/pages/ComparisonPage";
import SweepPage from "@/pages/SweepPage";
import HistoryPage from "@/pages/HistoryPage";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="min-h-screen bg-white">
      <BrowserRouter>
        <nav className="border-b border-zinc-900 px-6 py-3 flex items-center gap-8" data-testid="main-nav">
          <h1 className="font-chivo font-black text-lg tracking-tight text-zinc-900 uppercase">
            Raft Topology Sim
          </h1>
          <div className="flex items-center gap-1">
            {[
              { to: "/", label: "Simulation", id: "nav-simulation", end: true },
              { to: "/compare", label: "Comparison", id: "nav-comparison" },
              { to: "/sweep", label: "Sweep", id: "nav-sweep" },
              { to: "/history", label: "History", id: "nav-history" },
            ].map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] border transition-colors ${
                    isActive
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-900 hover:text-zinc-900"
                  }`
                }
                data-testid={link.id}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/compare" element={<ComparisonPage />} />
          <Route path="/sweep" element={<SweepPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
