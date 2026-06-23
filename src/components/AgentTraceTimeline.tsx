import React from "react";
import { Cpu, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { AgentTraceEntry } from "../types";

interface AgentTraceTimelineProps {
  trace?: AgentTraceEntry[];
}

export default function AgentTraceTimeline({ trace = [] }: AgentTraceTimelineProps) {
  // If trace is empty, we will show standard placeholder steps that are pending, but
  // normally our submitIssueReport creates them immediately!
  const stepsList = [
    { step: "Perceive", label: "Perceive (multimodal triage)" },
    { step: "Locate", label: "Locate (spatial check)" },
    { step: "Deduplicate", label: "Deduplicate (proximity matching)" },
    { step: "Find Authority", label: "Find Authority (Indian legal routing)" },
    { step: "Draft Action Packet", label: "Draft Action Packet (complaint compilation)" }
  ];

  return (
    <div id="agent-trace-section" className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl p-4 flex flex-col gap-4 shadow-xl font-sans">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Active Multi-Agent Core Trace
          </span>
        </div>
        <span className="text-[9px] font-mono text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full border border-indigo-400/20">
          Autonomous pipeline running
        </span>
      </div>

      {/* Vertical Timeline */}
      <div className="flex flex-col gap-5 relative pl-4 border-l border-slate-800">
        {stepsList.map((st, idx) => {
          // Find if this step is already recorded in trace
          const entry = trace.find((t) => t.step === st.step);
          const isDone = !!entry && entry.status === "done";
          const isSkipped = !!entry && entry.status === "skipped";
          const isPending = !entry;

          return (
            <div id={`trace-step-${st.step.toLowerCase().replace(/\s+/g, '-')}`} key={idx} className="relative flex flex-col gap-1">
              {/* Timeline indicator node */}
              <div className="absolute -left-[24px] top-1 flex items-center justify-center">
                {isDone ? (
                  <div className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center border border-slate-900 shadow-inner">
                    <CheckCircle2 className="w-3.5 h-3.5 fill-indigo-500 text-slate-900" />
                  </div>
                ) : isSkipped ? (
                  <div className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-900">
                    <span className="text-[8px] font-bold">∅</span>
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full bg-slate-950 text-slate-700 flex items-center justify-center border border-slate-800">
                    <Circle className="w-2.5 h-2.5 stroke-[3px]" />
                  </div>
                )}
              </div>

              {/* Header: step name , status chip, tool */}
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <span className={`text-[11px] font-extrabold tracking-tight ${isPending ? "text-slate-500" : "text-slate-200"}`}>
                  {idx + 1}. {st.label}
                </span>

                {isDone && (
                  <span className="text-[8px] font-mono tracking-widest font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-sm">
                    done
                  </span>
                )}
                {isSkipped && (
                  <span className="text-[8px] font-mono tracking-widest font-extrabold uppercase bg-slate-800/80 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded-sm">
                    skipped
                  </span>
                )}
                {isPending && (
                  <span className="text-[8px] font-mono tracking-widest font-extrabold uppercase bg-slate-950 border border-slate-850 text-slate-600 px-1.5 py-0.5 rounded-sm animate-pulse">
                    pending
                  </span>
                )}
              </div>

              {/* Rationale and Tool */}
              {!isPending && entry && (
                <div className="flex flex-col gap-0.5 mt-0.5 text-[11px] bg-slate-950 p-2 rounded-xl border border-slate-850/80">
                  <p className="text-slate-300 leading-relaxed font-normal">
                    {entry.rationale}
                  </p>
                  <div className="flex items-center gap-1 mt-1 font-mono text-[9px] text-slate-500">
                    <ArrowRight className="w-2.5 h-2.5 text-indigo-500" />
                    <span>Tool:</span>
                    <span className="text-slate-400 underline decoration-indigo-500/30">
                      {entry.tool}
                    </span>
                  </div>
                  {entry.ts && (
                    <span className="text-[8px] font-mono text-slate-600 self-end mt-1">
                      {new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
