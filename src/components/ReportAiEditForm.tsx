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
  t: (key: string) => string;
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
  t,
  onConfirm,
}: ReportAiEditFormProps) {
  return (
    <form onSubmit={onConfirm} className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 font-sans pb-28 text-ink sm:px-6 lg:py-8">
      <div className="flex items-center justify-between border-b border-hairline pb-2.5">
        <h2 className="text-2xl font-display font-black text-ink flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-marigold" />
          {t("report.confirmDraft")}
        </h2>
        <span className="text-sm font-mono bg-paper border border-hairline text-slate font-bold px-3 py-1 rounded-lg">
          {t("report.stepFive")}
        </span>
      </div>

      <div className="bg-marigold/10 border border-marigold/15 p-3 rounded-xl flex items-start gap-2.5">
        <Info className="w-4 h-4 text-marigold shrink-0 mt-0.5" />
        <p className="text-base text-ink/90 font-medium font-sans leading-relaxed">
          {t("report.confirmHelp")}
        </p>
      </div>

      {/* GPS metadata card */}
      <div className="flex gap-3 items-center bg-paper p-3 rounded-xl border border-hairline">
        <div className="w-12 h-12 rounded-lg overflow-hidden border border-hairline shrink-0 select-none">
          <img src={image} alt="Hazard Preview" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-mono font-bold text-slate">{t("report.estimatedLocation")}</p>
          <p className="text-base font-semibold text-ink truncate mt-0.5">
            {manualAddress || addressPlaceholder || t("report.locationSecured")}
          </p>
        </div>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label htmlFor="ai-title" className="text-sm font-mono text-slate block">{t("report.incidentHeading")}</label>
        <input
          id="ai-title"
          type="text"
          value={aiResult.title || ""}
          onChange={(e) => setAiResult({ ...aiResult, title: e.target.value })}
          className="min-h-[44px] w-full text-base font-semibold border border-hairline bg-white p-3 rounded-xl focus:outline-none focus:border-marigold focus:ring-1 focus:ring-marigold"
        />
      </div>

      {/* Description Summary */}
      <div className="flex flex-col gap-1">
        <label htmlFor="ai-summary" className="text-sm font-mono text-slate block">{t("report.diagnosticSummary")}</label>
        <textarea
          id="ai-summary"
          value={aiResult.summary || ""}
          onChange={(e) => setAiResult({ ...aiResult, summary: e.target.value })}
          className="w-full text-base border border-hairline bg-white p-3 rounded-xl focus:outline-none focus:border-marigold focus:ring-1 focus:ring-marigold min-h-[110px] font-sans leading-relaxed"
        />
      </div>

      {/* Category and Urgency dropdowns */}
      <div className="grid grid-cols-1 gap-3 text-base sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="ai-category" className="text-sm font-mono text-slate block">{t("report.category")}</label>
          <select
            id="ai-category"
            value={aiResult.category || "other"}
            onChange={(e) => setAiResult({ ...aiResult, category: e.target.value })}
            className="min-h-[44px] w-full text-base border border-hairline bg-white py-2 px-3 rounded-xl font-semibold text-ink"
          >
            {serverCategories.map((sc) => (
              <option key={sc} value={sc}>
                {categoryMap[sc] || sc}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ai-urgency" className="text-sm font-mono text-slate block">{t("report.urgency")}</label>
          <select
            id="ai-urgency"
            value={aiResult.urgency || "routine"}
            onChange={(e) => setAiResult({ ...aiResult, urgency: e.target.value })}
            className="min-h-[44px] w-full text-base border border-hairline bg-white py-2 px-3 rounded-xl font-semibold text-ink"
          >
            <option value="routine">{t("urgency.routine")}</option>
            <option value="priority">{t("urgency.priority")}</option>
            <option value="urgent">{t("urgency.urgent")}</option>
          </select>
        </div>
      </div>

      {/* Severity slider */}
      <div className="flex flex-col gap-1.5 bg-paper border border-hairline p-3 rounded-xl">
        <div className="flex items-center justify-between text-sm font-mono">
          <label htmlFor="ai-severity" className="text-slate cursor-pointer">{t("report.severity")}</label>
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
        className="w-full flex min-h-[52px] items-center justify-center gap-2 bg-marigold border border-hairline text-ink font-bold text-base py-3 px-5 rounded-xl shadow-xs cursor-pointer hover:bg-marigold/90 active:scale-[0.99] transition-all"
      >
        <span>{t("report.confirmSave")}</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    </form>
  );
}
