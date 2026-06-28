import React from "react";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface ReportClarificationViewProps {
  clarificationQuestion: string;
  clarificationResponse: string;
  setClarificationResponse: (val: string) => void;
  onSubmitClarification: (proceedAnyway: boolean) => void;
}

export default function ReportClarificationView({
  clarificationQuestion,
  clarificationResponse,
  setClarificationResponse,
  onSubmitClarification,
}: ReportClarificationViewProps) {
  const { t } = useLanguage();
  const isResponseEmpty = !clarificationResponse.trim();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-5 font-sans text-ink">
      <div className="bg-alert/5 border border-alert/20 p-4 rounded-2xl flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-alert/10 text-alert rounded-xl">
            <AlertTriangle className="w-4.5 h-4.5 text-alert" />
          </div>
          <div>
            <p className="text-sm font-mono text-alert">{t("report.lowConfidence")}</p>
            <h3 className="text-xl font-bold text-ink leading-tight">{t("report.clarifyTitle")}</h3>
          </div>
        </div>
        
        <div className="p-3 bg-white border border-hairline rounded-xl mt-0.5">
          <p className="text-sm text-slate font-mono">{t("report.clarificationQuestion")}</p>
          <p className="text-base font-semibold text-ink leading-relaxed mt-1 font-sans">
            "{clarificationQuestion || "Verify additional attributes of the documented photograph."}"
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-mono text-slate">
          {t("report.verifyAnswers")}
        </label>
        <textarea
          value={clarificationResponse}
          onChange={(e) => setClarificationResponse(e.target.value)}
          placeholder={t("report.verifyPlaceholder")}
          className="w-full text-base border border-hairline bg-white p-3 rounded-xl focus:outline-none focus:border-marigold focus:ring-1 focus:ring-marigold min-h-[110px] text-ink font-sans leading-relaxed"
        />
      </div>

      <div className="flex flex-col gap-2.5 mt-1">
        <button
          type="button"
          disabled={isResponseEmpty}
          onClick={() => onSubmitClarification(false)}
          className={`w-full flex min-h-[52px] items-center justify-center gap-2 font-bold text-base py-2.5 px-4 rounded-xl shadow-2xs transition-all border ${
            !isResponseEmpty 
              ? "bg-marigold text-ink border-hairline hover:bg-marigold/90 cursor-pointer" 
              : "bg-paper border-hairline text-slate cursor-not-allowed"
          }`}
        >
          {t("report.confirmAnswers")}
        </button>
        
        <button
          type="button"
          onClick={() => onSubmitClarification(true)}
          className="w-full min-h-[44px] text-base font-sans font-semibold text-slate hover:text-ink text-center py-2 cursor-pointer"
        >
          {t("report.proceedEstimate")}
        </button>
      </div>
    </div>
  );
}
