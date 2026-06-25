import React from "react";
import { Sparkles, Info, ChevronRight } from "lucide-react";

interface ReportAiEditFormProps {
  image: string;
  manualAddress: string;
  addressPlaceholder?: string;
  aiResult: any;
  setAiResult: (val: any) => void;
  serverCategories: string[];
  categoryMap: Record<string, string>;
  onConfirm: (e: React.FormEvent) => void;
}

export default function ReportAiEditForm({
  image,
  manualAddress,
  addressPlaceholder,
  aiResult,
  setAiResult,
  serverCategories,
  categoryMap,
  onConfirm,
}: ReportAiEditFormProps) {
  return (
    <form onSubmit={onConfirm} className="flex flex-col gap-4 px-4 py-4 font-sans pb-12 text-ink">
      <div className="flex items-center justify-between border-b border-hairline pb-2.5">
        <h2 className="text-xs font-display font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-marigold" />
          Review Calibration Ticket
        </h2>
        <span className="text-[9px] font-mono bg-paper border border-hairline text-slate font-bold px-2 py-0.5 rounded-full uppercase">
          Stage 2 of 2
        </span>
      </div>

      <div className="bg-marigold/10 border border-marigold/15 p-3 rounded-xl flex items-start gap-2.5">
        <Info className="w-4 h-4 text-marigold shrink-0 mt-0.5" />
        <p className="text-[10px] text-ink/90 font-medium font-sans leading-snug">
          Gemini has calibrated this draft ticket. You can fine-tune text details before filing to our portal.
        </p>
      </div>

      {/* GPS metadata card */}
      <div className="flex gap-3 items-center bg-paper p-3 rounded-xl border border-hairline">
        <div className="w-12 h-12 rounded-lg overflow-hidden border border-hairline shrink-0 select-none">
          <img src={image} alt="Hazard Preview" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-mono font-bold text-slate uppercase tracking-wider">Estimated Geo Zone</p>
          <p className="text-[11px] font-semibold text-ink truncate mt-0.5">
            {manualAddress || addressPlaceholder || "Geographic point secured"}
          </p>
        </div>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label htmlFor="ai-title" className="text-[9pt] font-mono uppercase text-slate tracking-wider block">Incident Heading</label>
        <input
          id="ai-title"
          type="text"
          value={aiResult.title || ""}
          onChange={(e) => setAiResult({ ...aiResult, title: e.target.value })}
          className="w-full text-xs font-semibold border border-hairline bg-white p-2.5 rounded-xl focus:outline-none focus:border-marigold focus:ring-1 focus:ring-marigold"
          style={{ minHeight: "38px" }}
        />
      </div>

      {/* Description Summary */}
      <div className="flex flex-col gap-1">
        <label htmlFor="ai-summary" className="text-[9pt] font-mono uppercase text-slate tracking-wider block">Diagnostic Summary</label>
        <textarea
          id="ai-summary"
          value={aiResult.summary || ""}
          onChange={(e) => setAiResult({ ...aiResult, summary: e.target.value })}
          className="w-full text-xs border border-hairline bg-white p-2.5 rounded-xl focus:outline-none focus:border-marigold min-h-[65px] font-sans leading-relaxed"
        />
      </div>

      {/* Category and Urgency dropdowns */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex flex-col gap-1">
          <label htmlFor="ai-category" className="text-[8.5pt] font-mono uppercase text-slate tracking-wider block">Category</label>
          <select
            id="ai-category"
            value={aiResult.category || "other"}
            onChange={(e) => setAiResult({ ...aiResult, category: e.target.value })}
            className="w-full text-xs border border-hairline bg-white py-2 px-2.5 rounded-xl font-semibold text-ink"
            style={{ minHeight: "36px" }}
          >
            {serverCategories.map((sc) => (
              <option key={sc} value={sc}>
                {categoryMap[sc] || sc}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ai-urgency" className="text-[8.5pt] font-mono uppercase text-slate tracking-wider block">Urgency</label>
          <select
            id="ai-urgency"
            value={aiResult.urgency || "routine"}
            onChange={(e) => setAiResult({ ...aiResult, urgency: e.target.value })}
            className="w-full text-xs border border-hairline bg-white py-2 px-2.5 rounded-xl font-semibold uppercase text-ink"
            style={{ minHeight: "36px" }}
          >
            <option value="routine">Routine</option>
            <option value="priority">Priority</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Severity slider */}
      <div className="flex flex-col gap-1.5 bg-paper border border-hairline p-3 rounded-xl">
        <div className="flex items-center justify-between text-[9px] font-mono">
          <label htmlFor="ai-severity" className="text-slate uppercase cursor-pointer">AI Severity Rating</label>
          <span className="px-2 py-0.5 bg-white border border-hairline text-ink rounded font-bold">
            {aiResult.severity} / 5
          </span>
        </div>
        <input
          id="ai-severity"
          type="range"
          min="1"
          max="5"
          value={aiResult.severity || 3}
          onChange={(e) => setAiResult({ ...aiResult, severity: Number(e.target.value) })}
          className="w-full h-1 bg-hairline rounded-lg appearance-none cursor-pointer accent-marigold mt-1"
          aria-label="Severity rating from 1 (minor) to 5 (extreme hazard)"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={aiResult.severity || 3}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 bg-marigold border border-hairline text-ink font-bold text-xs py-3 px-5 rounded-xl shadow-xs cursor-pointer hover:bg-marigold/90 active:scale-[0.99] transition-all"
        style={{ minHeight: "44px" }}
      >
        <span>Confirm & Publish Ticket</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    </form>
  );
}
