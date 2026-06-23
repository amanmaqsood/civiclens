import React from "react";
import { Sparkles } from "lucide-react";
import { AgentTraceEntry } from "../types";
import { motion } from "motion/react";

interface AgentTraceTimelineProps {
  trace?: AgentTraceEntry[];
}

export default function AgentTraceTimeline({ trace = [] }: AgentTraceTimelineProps) {
  const stepsList = [
    { step: "Perceive", label: "Perceive & Triage" },
    { step: "Locate", label: "Geolocational Check" },
    { step: "Deduplicate", label: "Deduplication Graph Search" },
    { step: "Find Authority", label: "Indian Grounded Authority Lookup" },
    { step: "Draft Action Packet", label: "Draft Resolution Case Packet" }
  ];

  // For issues genuinely missing a trace, show a clean single-line empty state
  if (!trace || trace.length === 0) {
    return (
      <div 
        id="agent-trace-section" 
        className="bg-white border border-hairline rounded-2xl p-5 flex flex-col gap-3.5 shadow-sm font-sans"
      >
        <div className="flex items-center gap-2 border-b border-hairline pb-3">
          <div className="w-5 h-5 rounded-full bg-ink/5 border border-hairline flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-marigold" />
          </div>
          <span className="font-display text-sm font-bold tracking-tight text-ink uppercase">
            Agent Trace
          </span>
        </div>
        <p className="text-[13px] text-slate leading-relaxed">
          Agent trace will appear after the live agent run.
        </p>
      </div>
    );
  }

  return (
    <div 
      id="agent-trace-section" 
      className="bg-white border border-hairline rounded-2xl p-5 flex flex-col gap-4 shadow-sm font-sans"
    >
      {/* Dossier Header */}
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-ink/5 border border-hairline flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-marigold" />
          </div>
          <span className="font-display text-sm font-bold tracking-tight text-ink uppercase">
            Agent Trace
          </span>
        </div>
      </div>

      {/* Case Dossier Timeline */}
      <div className="relative pl-6 flex flex-col gap-5">
        {/* Thin connecting vertical rule */}
        <div 
          className="absolute left-[9.5px] top-2 bottom-2 w-[1px] bg-hairline" 
          aria-hidden="true" 
        />

        {stepsList.map((st, idx) => {
          const entry = trace.find((t) => t.step === st.step);
          const isDone = !!entry && entry.status === "done";
          const isSkipped = !!entry && entry.status === "skipped";
          const isPending = !entry;

          const displayTimestamp = entry?.ts
            ? new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
            : null;

          return (
            <div 
              id={`trace-step-${st.step.toLowerCase().replace(/\s+/g, '-')}`} 
              key={idx} 
              className="relative flex flex-col gap-1"
            >
              {/* Concentric focus-ring icon that scales-in when complete */}
              <div className="absolute -left-[24.5px] top-0.5 z-10 flex items-center justify-center">
                {isDone ? (
                  <motion.div 
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-[19px] h-[19px] rounded-full bg-white border border-marigold flex items-center justify-center shadow-xs"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-marigold" />
                  </motion.div>
                ) : isSkipped ? (
                  <div className="w-[19px] h-[19px] rounded-full bg-paper border border-slate flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate" />
                  </div>
                ) : (
                  <div className="w-[19px] h-[19px] rounded-full bg-paper border border-hairline flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-slate/20" />
                  </div>
                )}
              </div>

              {/* Timestamp + Status Row */}
              <div className="flex items-center justify-between text-xs font-mono text-slate">
                <div className="flex items-center gap-1.5">
                  {displayTimestamp ? (
                    <span className="bg-paper border border-hairline px-1 rounded text-xs">
                      {displayTimestamp}
                    </span>
                  ) : (
                    <span className="text-xs text-slate/40">— : — : —</span>
                  )}

                  {!isPending && entry?.tool && (
                    <span className="text-xs uppercase tracking-tight bg-ink/5 text-ink/70 px-1 rounded border border-hairline font-mono truncate max-w-[150px]">
                      {entry.tool.split("(")[0].trim().replace("/api/", "")}
                    </span>
                  )}
                </div>

                {isDone && (
                  <span className="inline-flex items-center gap-1.5 font-sans font-medium text-xs text-slate">
                    <span className="w-1.5 h-1.5 rounded-full bg-verify font-bold" />
                    Done
                  </span>
                )}
                {isSkipped && (
                  <span className="inline-flex items-center gap-1.5 font-sans font-medium text-xs text-slate">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate font-bold" />
                    Skipped
                  </span>
                )}
                {isPending && (
                  <span className="inline-flex items-center gap-1.5 font-sans font-medium text-xs text-slate">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate/30 animate-pulse font-bold" />
                    Pending
                  </span>
                )}
              </div>

              {/* Step Title inside dossier context */}
              <div className="font-sans font-semibold text-ink text-sm mt-0.5">
                {st.label}
              </div>

              {/* Highlighted one-line rationale note */}
              {!isPending && entry && (
                <div className="text-[13px] text-slate leading-relaxed border-l border-hairline pl-2 mt-1 italic font-normal">
                  {entry.rationale}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
