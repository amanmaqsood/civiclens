import React from "react";
import { CheckCircle2, Clock3, Database, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { AgentTraceEntry } from "../types";

interface AgentTraceTimelineProps {
  trace?: AgentTraceEntry[];
  run?: {
    id?: string;
    status?: string;
    model?: string;
    startedAt?: string;
    completedAt?: string;
    stepCount?: number;
  } | null;
  mode?: "persisted" | "local-progress";
}

const expectedOrder = [
  "search_nearby_cases",
  "compare_candidate_evidence",
  "calculate_priority",
  "find_responsible_authority",
  "draft_action_packet",
  "request_human_approval",
  "verify_closure",
  "record_event",
];

const labelMap: Record<string, string> = {
  Perceive: "Perceive and triage",
  Locate: "Location check",
  Deduplicate: "Duplicate search",
  Prioritize: "Priority scoring",
  Decide: "Review gate",
  "Find Authority": "Suggested authority lookup",
  "Draft Action Packet": "Draft action packet",
  search_nearby_cases: "Nearby case search",
  compare_candidate_evidence: "Duplicate evidence comparison",
  calculate_priority: "Priority calculation",
  find_responsible_authority: "Suggested authority lookup",
  draft_action_packet: "Draft action packet",
  request_human_approval: "Human approval gate",
  verify_closure: "Closure evidence check",
  record_event: "Event record",
};

function formatStepName(step: string) {
  return labelMap[step] || step.replace(/_/g, " ");
}

function formatTime(value?: string) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function StatusIcon({ status }: { status?: string }) {
  if (status === "failed") return <XCircle className="h-5 w-5 text-alert" />;
  if (status === "skipped") return <Clock3 className="h-5 w-5 text-slate" />;
  return <CheckCircle2 className="h-5 w-5 text-verify" />;
}

export default function AgentTraceTimeline({ trace = [], run = null, mode = "persisted" }: AgentTraceTimelineProps) {
  const hasTrace = trace.length > 0;
  const isLocalProgress = mode === "local-progress";
  const completedSteps = trace.length;
  const expectedStepCount = Math.max(8, run?.stepCount || expectedOrder.length);
  const startedAt = run?.startedAt || trace[0]?.ts;
  const completedAt = run?.completedAt || trace[trace.length - 1]?.ts;
  const ariaLabel = isLocalProgress ? "Local report preparation progress" : "Server agent trace";

  if (!hasTrace) {
    return (
      <section
        id="agent-trace-section"
        className="rounded-3xl border border-hairline bg-white p-5 shadow-sm"
        aria-label={ariaLabel}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-marigold">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-mono text-ink-2">
              {isLocalProgress ? "Local report progress" : "Server-generated agent trace"}
            </p>
            <h3 className="mt-1 text-xl font-black text-ink">
              {isLocalProgress ? "Preparing report" : "No persisted run yet"}
            </h3>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-2">
              {isLocalProgress
                ? "Progress appears here while the browser prepares the draft report. Persisted server agent evidence appears only after a saved case has stored tool steps."
                : "Persisted server tool records appear here after the server-side agent has run for this case."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="agent-trace-section"
      className="rounded-3xl border border-hairline bg-white p-5 shadow-sm"
      aria-label={ariaLabel}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 border-b border-hairline pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-marigold">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-mono text-ink-2">
                {isLocalProgress ? "Local report progress" : "Persisted server run"}
              </p>
              <h3 className="mt-1 text-xl font-black text-ink">
                {isLocalProgress ? "Draft preparation timeline" : "Agent tool timeline"}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
                {isLocalProgress
                  ? "These steps show in-browser report preparation and nearby-case checks before the draft is saved. They are not presented as persisted agent evidence."
                  : "Gemini selected tools, CivicLens executed them on the server, and these steps were loaded from persisted run data."}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="min-w-0 rounded-2xl border border-hairline bg-paper p-3">
              <p className="text-sm font-bold text-ink-2">Status</p>
              <p className="mt-1 text-sm font-black text-ink capitalize">{run?.status || "completed"}</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-hairline bg-paper p-3">
              <p className="text-sm font-bold text-ink-2">Model</p>
              <p className="mt-1 break-words text-sm font-black text-ink">{run?.model || "Gemini"}</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-hairline bg-paper p-3">
              <p className="text-sm font-bold text-ink-2">Steps</p>
              <p className="mt-1 text-sm font-black text-ink">{completedSteps}/{expectedStepCount}</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-hairline bg-paper p-3">
              <p className="text-sm font-bold text-ink-2">Loaded</p>
              <p className="mt-1 break-words text-sm font-black text-ink">{formatTime(completedAt || startedAt)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {trace.map((entry, index) => (
            <article
              id={`trace-step-${entry.step.toLowerCase().replace(/\s+/g, "-")}`}
              key={`${entry.step}-${entry.ts}-${index}`}
              className="grid gap-3 rounded-2xl border border-hairline bg-paper p-4 2xl:grid-cols-[48px_minmax(0,1fr)_minmax(200px,0.34fr)] 2xl:items-start"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-3xs">
                <span className="text-base font-black text-ink">{index + 1}</span>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusIcon status={entry.status} />
                  <h4 className="text-lg font-black text-ink">{formatStepName(entry.step)}</h4>
                  <span className="rounded-lg border border-hairline bg-white px-2 py-1 text-sm font-mono text-ink-2">
                    {entry.tool?.replace("agent.", "") || "server tool"}
                  </span>
                </div>

                <p className="mt-2 text-base leading-relaxed text-ink-2">{entry.rationale || "Tool completed without a model rationale."}</p>

                {(entry.inputDigest || entry.outputSummary) && (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {entry.inputDigest && (
                      <div className="rounded-xl border border-hairline bg-white p-3">
                        <p className="flex items-center gap-2 text-sm font-bold text-ink-2">
                          <Database className="h-4 w-4 text-marigold" />
                          Safe input summary
                        </p>
                        <p className="mt-1 break-words text-sm leading-relaxed text-ink">{entry.inputDigest}</p>
                      </div>
                    )}
                    {entry.outputSummary && (
                      <div className="rounded-xl border border-hairline bg-white p-3">
                        <p className="flex items-center gap-2 text-sm font-bold text-ink-2">
                          <CheckCircle2 className="h-4 w-4 text-verify" />
                          Output summary
                        </p>
                        <p className="mt-1 break-words text-sm leading-relaxed text-ink">{entry.outputSummary}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <aside className="rounded-2xl border border-hairline bg-white p-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="font-bold text-ink-2">Time</p>
                    <p className="mt-1 font-mono text-ink">{formatTime(entry.ts)}</p>
                  </div>
                  <div>
                    <p className="font-bold text-ink-2">Latency</p>
                    <p className="mt-1 font-mono text-ink">{entry.durationMs ? `${(entry.durationMs / 1000).toFixed(1)}s` : "n/a"}</p>
                  </div>
                  <div>
                    <p className="font-bold text-ink-2">Confidence</p>
                    <p className="mt-1 font-mono text-ink">{entry.confidence !== undefined ? `${Math.round(entry.confidence * 100)}%` : "n/a"}</p>
                  </div>
                  <div>
                    <p className="font-bold text-ink-2">Status</p>
                    <p className="mt-1 font-mono text-ink capitalize">{entry.status}</p>
                  </div>
                </div>
                {(entry.retried || entry.fallbackUsed) && (
                  <p className="mt-3 rounded-lg border border-marigold/25 bg-marigold/10 px-3 py-2 text-sm font-bold text-marigold-ink">
                    Recovered through retry or fallback.
                  </p>
                )}
                {entry.step === "request_human_approval" && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-verify/25 bg-verify/10 px-3 py-2 text-sm font-bold text-verify">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    Consequential action waits for a human decision.
                  </p>
                )}
                {entry.status === "failed" && entry.errorMsg && (
                  <p className="mt-3 rounded-lg border border-alert/20 bg-alert/5 px-3 py-2 text-sm font-bold text-alert">
                    {entry.errorMsg}
                  </p>
                )}
              </aside>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
