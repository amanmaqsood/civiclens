import React from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";

interface ReportFallbackFormProps {
  manualAddress: string;
  addressPlaceholder?: string;
  serverCategories: string[];
  categoryMap: Record<string, string>;
  description: string;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ReportFallbackForm({
  manualAddress,
  addressPlaceholder,
  serverCategories,
  categoryMap,
  description,
  onSubmit,
}: ReportFallbackFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 px-4 py-4 font-sans pb-12 text-ink">
      <div className="bg-alert/5 border border-alert/20 p-4 rounded-xl flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-alert" />
          <p className="text-[10pt] font-display font-medium text-alert">Manual Logging Mode Active</p>
        </div>
        <p className="text-[10px] text-slate font-medium leading-relaxed mt-0.5">
          The automatic AI service is offline. Please key-in categories and brief descriptions to record this report.
        </p>
      </div>

      {/* Categories */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9pt] font-mono uppercase text-slate tracking-wider block">Grievance category</label>
        <select
          name="category"
          className="w-full text-xs border border-hairline bg-white px-2.5 py-2.5 rounded-xl font-semibold text-ink"
          style={{ minHeight: "40px" }}
        >
          {serverCategories.map((sc) => (
            <option key={sc} value={categoryMap[sc] || sc}>
              {categoryMap[sc] || sc}
            </option>
          ))}
        </select>
      </div>

      {/* Severity Rating scale */}
      <div className="flex flex-col gap-1.5 bg-paper border border-hairline p-3 rounded-xl">
        <label className="text-[9pt] font-mono uppercase text-slate tracking-wider block">Severity Rating scale</label>
        <input
          type="range"
          name="severity"
          min="1"
          max="5"
          defaultValue="3"
          className="w-full h-1 bg-hairline rounded-lg appearance-none cursor-pointer accent-marigold mt-1.5 animate-none"
        />
        <div className="flex justify-between text-[8px] font-mono text-slate uppercase mt-1">
          <span>Minor (1)</span>
          <span>Emergency (5)</span>
        </div>
      </div>

      {/* Address */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9pt] font-mono uppercase text-slate tracking-wider block">Identified location reference</label>
        <div className="bg-paper border border-hairline p-2 rounded-xl text-[10.5px] font-medium leading-normal text-ink select-all">
          {manualAddress || addressPlaceholder || "Georeferenced Point Secured"}
        </div>
      </div>

      {/* Descriptions */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9pt] font-mono uppercase text-slate tracking-wider block">Municipal complaint description</label>
        <textarea
          name="description"
          required
          defaultValue={description}
          placeholder="Record exact spots or problem markers..."
          className="w-full text-xs border border-hairline bg-white p-3 rounded-xl focus:outline-none focus:border-marigold min-h-[90px] font-sans leading-relaxed text-ink"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 bg-marigold border border-hairline text-ink font-bold text-xs py-3 px-5 rounded-xl shadow-xs cursor-pointer hover:bg-marigold/90 transition-all mt-1"
        style={{ minHeight: "44px" }}
      >
        <span>Confirm & Submit grienvance</span>
        <ChevronRight className="w-4 h-4 shrink-0" />
      </button>
    </form>
  );
}
