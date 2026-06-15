import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

const TYPE_STYLES = {
  leader_elected: "text-blue-700 bg-blue-50",
  state_change: "text-zinc-700 bg-zinc-50",
  election_timeout: "text-amber-700 bg-amber-50",
  node_failed: "text-red-700 bg-red-50",
  node_recovered: "text-emerald-700 bg-emerald-50",
  log_committed: "text-emerald-700 bg-emerald-50",
  log_replicated: "text-teal-700 bg-teal-50",
  message_sent: "text-zinc-500 bg-white",
};

function formatEvent(e) {
  switch (e.type) {
    case "leader_elected":
      return `Node ${e.node} elected leader (term ${e.term}, ${e.votes} votes)`;
    case "state_change":
      return `Node ${e.node} -> ${(e.new_state || "").toUpperCase()} (term ${e.term})`;
    case "election_timeout":
      return `Node ${e.node} election timeout (term ${e.term})`;
    case "node_failed":
      return `Node ${e.node} FAILED`;
    case "node_recovered":
      return `Node ${e.node} RECOVERED`;
    case "log_committed":
      return `Entry ${e.commit_index} committed by node ${e.node}`;
    case "log_replicated":
      return `Log entry submitted to leader node ${e.node}`;
    case "message_sent":
      return `N${e.node} -> N${e.target}: ${(e.msg_type || "").replace(/_/g, " ")} (${e.hops}h)`;
    default:
      return e.type;
  }
}

export default function EventLog({ events }) {
  const [showMessages, setShowMessages] = useState(false);

  const displayed = showMessages
    ? events?.slice(-100)?.reverse() || []
    : events?.filter((e) => e.type !== "message_sent").slice(-100)?.reverse() || [];

  return (
    <div className="flex flex-col h-full" data-testid="event-log">
      <div className="px-3 py-2 border-b border-zinc-300 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">
          Event Log
        </h3>
        <button
          onClick={() => setShowMessages(!showMessages)}
          className={`text-[10px] px-1.5 py-0.5 border transition-colors ${
            showMessages
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-500 border-zinc-300"
          }`}
          data-testid="toggle-messages-btn"
        >
          {showMessages ? "HIDE MSGS" : "SHOW MSGS"}
        </button>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="py-2 space-y-0.5">
          {displayed.length === 0 && (
            <p className="text-xs text-zinc-400 font-mono py-4 text-center">
              No events yet
            </p>
          )}
          {displayed.map((e, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-[11px] py-1 px-1.5 ${
                TYPE_STYLES[e.type] || "text-zinc-500"
              }`}
            >
              <span className="font-mono text-zinc-400 w-10 shrink-0 text-right">
                {e.tick}
              </span>
              <span className="leading-snug">{formatEvent(e)}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
