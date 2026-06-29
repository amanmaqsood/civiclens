import React from "react";
import { AlertTriangle, Bot, CheckCircle2, Clock, Cog, Lock, ShieldCheck, User, XCircle } from "lucide-react";
import type { CivicEvent } from "../types";

interface AccountabilityLedgerProps {
  events: CivicEvent[];
  loading: boolean;
  error?: string | null;
}

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLedgerDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not recorded";
  return date.toLocaleString();
}

function actorMeta(actorType: CivicEvent["actorType"]) {
  if (actorType === "citizen") return { label: "Citizen", icon: User, className: "text-verify bg-verify/10 border-verify/20" };
  if (actorType === "operator") return { label: "Operator", icon: ShieldCheck, className: "text-marigold bg-marigold/10 border-marigold/20" };
  if (actorType === "ai") return { label: "Gemini", icon: Bot, className: "text-blue-700 bg-blue-50 border-blue-100" };
  if (actorType === "worker") return { label: "Worker", icon: Cog, className: "text-slate bg-slate/10 border-slate/20" };
  return { label: "System", icon: Lock, className: "text-ink bg-paper border-hairline" };
}

function statusMeta(event: CivicEvent) {
  if (event.status === "failed" || event.severity === "error") {
    return { label: "Failed", icon: XCircle, className: "text-alert bg-alert/10 border-alert/20" };
  }
  if (event.status === "attempted" || event.severity === "warn") {
    return { label: "Watch", icon: AlertTriangle, className: "text-marigold bg-marigold/10 border-marigold/20" };
  }
  return { label: "Recorded", icon: CheckCircle2, className: "text-verify bg-verify/10 border-verify/20" };
}

export default function AccountabilityLedger({ events, loading, error = null }: AccountabilityLedgerProps) {
  const visibleEvents = events.slice().sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  return (
    <section
      id="case-accountability-ledger"
      aria-labelledby="case-accountability-ledger-title"
      className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]"
    >
      <div className="flex flex-col gap-2 border-b border-hairline pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="case-accountability-ledger-title" className="text-lg font-display font-black text-ink flex items-center gap-2">
            <Lock className="h-4 w-4 text-verify" />
            Accountability ledger
          </h3>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-slate">
            Server-owned append-only events for this case.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-hairline bg-paper px-2.5 py-1.5 text-sm font-mono font-semibold text-slate">
          <Clock className="h-3.5 w-3.5" />
          {visibleEvents.length} records
        </span>
      </div>

      {loading ? (
        <div className="grid gap-2" aria-label="Loading accountability ledger">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-xl border border-hairline bg-paper" />
          ))}
        </div>
      ) : error ? (
        <p role="alert" className="rounded-xl border border-alert/20 bg-alert/10 p-3 text-sm font-semibold text-alert">
          {error}
        </p>
      ) : visibleEvents.length === 0 ? (
        <p className="rounded-xl border border-hairline bg-paper p-3 text-sm font-semibold text-slate">
          No ledger records have been published for this case yet.
        </p>
      ) : (
        <>
          <ol className="flex flex-col gap-3">
            {visibleEvents.map((event) => {
              const actor = actorMeta(event.actorType);
              const status = statusMeta(event);
              const ActorIcon = actor.icon;
              const StatusIcon = status.icon;
              return (
                <li key={event.id} className="rounded-xl border border-hairline bg-paper p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-sm font-mono font-semibold ${actor.className}`}>
                          <ActorIcon className="h-3.5 w-3.5" />
                          {actor.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-sm font-mono font-semibold ${status.className}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-2 text-base font-black leading-tight text-ink">
                        {formatEventType(event.eventType)}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-slate">
                        {event.message}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 text-left text-sm font-mono text-slate sm:text-right">
                      <span>{formatLedgerDate(event.timestamp)}</span>
                      <span className="select-all">ID {event.id.slice(0, 12)}</span>
                      <span>{event.source}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="overflow-x-auto rounded-xl border border-hairline bg-white">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Accountability ledger table fallback</caption>
              <thead className="bg-paper text-xs font-mono uppercase text-slate">
                <tr>
                  <th scope="col" className="px-3 py-2">Time</th>
                  <th scope="col" className="px-3 py-2">Actor</th>
                  <th scope="col" className="px-3 py-2">Event</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {visibleEvents.map((event) => (
                  <tr key={`${event.id}-row`}>
                    <td className="px-3 py-2 font-mono text-slate">{formatLedgerDate(event.timestamp)}</td>
                    <td className="px-3 py-2 font-semibold text-ink">{actorMeta(event.actorType).label}</td>
                    <td className="px-3 py-2 font-semibold text-ink">{formatEventType(event.eventType)}</td>
                    <td className="px-3 py-2 font-mono text-slate">{event.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
