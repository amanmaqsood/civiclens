import React from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";

interface ReportFallbackFormProps {
  manualAddress: string;
  addressPlaceholder?: string;
  serverCategories: string[];
  categoryMap: Record<string, string>;
  description: string;
  t: (key: string) => string;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ReportFallbackForm({
  manualAddress,
  addressPlaceholder,
  serverCategories,
  categoryMap,
  description,
  t,
  onSubmit,
}: ReportFallbackFormProps) {
  const [severity, setSeverity] = React.useState(3);

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 font-sans pb-28 text-ink sm:px-6 lg:py-8">
      <div className="bg-alert/5 border border-alert/20 p-4 rounded-xl flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-alert" />
          <p className="text-xl font-display font-bold text-alert">{t("report.manualModeTitle")}</p>
        </div>
        <p className="text-base text-slate font-medium leading-relaxed mt-0.5">
          {t("report.manualModeHelp")}
        </p>
      </div>

      {/* Categories */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fallback-category" className="text-sm font-mono text-slate block">{t("report.reportCategory")}</label>
        <select
          id="fallback-category"
          name="category"
          className="min-h-[44px] w-full text-base border border-hairline bg-white px-3 py-2.5 rounded-xl font-semibold text-ink"
        >
          {serverCategories.map((sc) => (
            <option key={sc} value={sc}>
              {categoryMap[sc] || sc}
            </option>
          ))}
        </select>
      </div>

      {/* Severity Rating scale */}
      <div className="flex flex-col gap-1.5 bg-paper border border-hairline p-3 rounded-xl">
        <div className="flex items-center justify-between text-sm font-mono">
          <label htmlFor="fallback-severity" className="text-slate block cursor-pointer">{t("report.severityScale")}</label>
          <span className="px-2 py-0.5 bg-white border border-hairline text-ink rounded font-bold">
            {severity} / 5
          </span>
        </div>
        <input
          id="fallback-severity"
          type="range"
          name="severity"
          min="1"
          max="5"
          value={severity}
          onChange={(e) => setSeverity(Number(e.target.value))}
          className="w-full h-1 bg-hairline rounded-lg appearance-none cursor-pointer accent-marigold mt-1.5 animate-none"
          aria-label="Severity rating from 1 (minor) to 5 (emergency)"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={severity}
        />
        <div className="flex justify-between text-sm font-mono text-slate mt-1">
          <span>{t("report.minor")} (1)</span>
          <span>{t("report.emergency")} (5)</span>
        </div>
      </div>

      {/* Address */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-mono text-slate block">{t("report.locationReference")}</span>
        <div className="bg-paper border border-hairline p-3 rounded-xl text-base font-medium leading-normal text-ink select-all">
          {manualAddress || addressPlaceholder || t("report.locationSecured")}
        </div>
      </div>

      {/* Descriptions */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fallback-description" className="text-sm font-mono text-slate block">{t("report.reportDescription")}</label>
        <textarea
          id="fallback-description"
          name="description"
          required
          defaultValue={description}
          placeholder={t("report.descriptionFallback")}
          className="w-full text-base border border-hairline bg-white p-3 rounded-xl focus:outline-none focus:border-marigold focus:ring-1 focus:ring-marigold min-h-[110px] font-sans leading-relaxed text-ink"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full flex min-h-[52px] items-center justify-center gap-2 bg-marigold border border-hairline text-ink font-bold text-base py-3 px-5 rounded-xl shadow-xs cursor-pointer hover:bg-marigold/90 transition-all mt-1"
      >
        <span>{t("report.confirmSave")}</span>
        <ChevronRight className="w-4 h-4 shrink-0" />
      </button>
    </form>
  );
}
