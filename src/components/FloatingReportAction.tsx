import React from "react";
import { Camera } from "lucide-react";
import { ActiveView } from "../types";

interface FloatingReportActionProps {
  currentView: ActiveView;
  persona: "citizen" | "operator";
  onNavigate: (view: ActiveView) => void;
}

export default function FloatingReportAction({
  currentView,
  persona,
  onNavigate,
}: FloatingReportActionProps) {
  const hiddenForViews: ActiveView[] = ["landing", "report", "submitting", "duplicate", "success", "dashboard"];
  if (persona !== "citizen" || hiddenForViews.includes(currentView)) return null;

  return (
    <button
      id="floating-report-cta"
      type="button"
      onClick={() => onNavigate("report")}
      className="fixed bottom-24 right-4 z-40 inline-flex min-h-[52px] items-center gap-2 rounded-2xl border border-ink/10 bg-marigold px-4 text-base font-bold text-ink shadow-[0_16px_36px_-18px_rgba(14,26,43,0.7)] transition-transform active:scale-[0.98] md:hidden"
      aria-label="Start a new civic report"
    >
      <Camera className="h-5 w-5" />
      <span>Report</span>
    </button>
  );
}
