import React, { useState } from "react";
import { IssueReport, ClosureAssessment } from "../types";
import { submitClosureAssessment } from "../services/issues";
import { Check, Upload, Sparkles, RefreshCw, AlertCircle } from "lucide-react";

interface ClosureVerificationPanelProps {
  issue: IssueReport;
  onVerified: (assessment: ClosureAssessment) => void;
}

export default function ClosureVerificationPanel({ issue, onVerified }: ClosureVerificationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAfterPreview(reader.result as string);
      setError(null);
    };
    reader.onerror = () => {
      setError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleStartVerification = async () => {
    if (!afterPreview) {
      setError("Please select or upload an 'after' repair photo first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await submitClosureAssessment(
        issue.id,
        issue.image,
        afterPreview,
        issue.summary || issue.description
      );
      onVerified(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze before/after repair images.");
    } finally {
      setLoading(false);
    }
  };

  const assessment = issue.closureAssessment;

  return (
    <div id="closure-verification-panel" className="bg-white border rounded-2xl p-4 shadow-3xs flex flex-col gap-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          AI Repair Resolution Verification
        </h3>
        {assessment && (
          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
            Verified State
          </span>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-800 p-2.5 rounded-xl text-[10px] font-semibold flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Render slider or side-by-side comparison if closure assessment OR local draft preview exists */}
      {(assessment || afterPreview) && (
        <div className="flex flex-col gap-2">
          <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Before & After Side-By-Side</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative group">
              <img
                src={issue.image}
                alt="Before"
                referrerPolicy="no-referrer"
                className="w-full aspect-video object-cover rounded-xl border border-slate-200"
              />
              <span className="absolute bottom-1 bg-black/60 text-white font-sans text-[8px] font-bold px-1.5 py-0.5 rounded-md left-1">
                Before State
              </span>
            </div>
            <div className="relative group">
              <img
                src={assessment?.afterImage || afterPreview || ""}
                alt="After"
                referrerPolicy="no-referrer"
                className="w-full aspect-video object-cover rounded-xl border border-slate-200"
              />
              <span className="absolute bottom-1 bg-indigo-600/80 text-white font-sans text-[8px] font-bold px-1.5 py-0.5 rounded-md left-1">
                {assessment ? "After: Persisted" : "After: Preview"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* AI verdict display if exists */}
      {assessment && (
        <div className="bg-slate-50 border border-slate-200/50 p-3 rounded-xl flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-700">Gemini Vision Verdict:</span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
              assessment.resolved ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}>
              {assessment.resolved ? "RESOLVED" : "ACTION REQUIRED"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] pb-1.5 border-b border-slate-200/40">
            <div>
              <span className="text-slate-400 block font-bold">Confidence Rating</span>
              <span className="font-extrabold text-[#4F46E5]">{(assessment.confidence * 100).toFixed(0)}% Match</span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold">Recommendation</span>
              <span className="font-extrabold uppercase text-indigo-700">{assessment.recommendation.replace("_", " ")}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block font-bold mb-1">Observed Structural Changes</span>
            <ul className="list-disc pl-4 flex flex-col gap-0.5 text-[10px] text-slate-600">
              {assessment.observedChanges.map((change, idx) => (
                <li key={idx} className="font-semibold">{change}</li>
              ))}
            </ul>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block font-bold mb-0.5">Explanation</span>
            <p className="text-[10.5px] leading-relaxed text-slate-600 font-semibold italic">{assessment.explanation}</p>
          </div>
        </div>
      )}

      {/* File Upload Trigger if In Progress and not yet verified */}
      {issue.status === "In Progress" && (
        <div className="flex flex-col gap-2.5">
          {!assessment && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 hover:bg-slate-100/50 relative cursor-pointer">
              <input
                id="after-image-verification-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-5 h-5 text-slate-400 mb-1" />
              <span className="text-[10.5px] font-bold text-slate-600">Upload repair "after" image</span>
              <span className="text-[9px] text-slate-400 mt-0.5">Camera snap or file select</span>
            </div>
          )}

          {afterPreview && !assessment && (
            <button
              onClick={handleStartVerification}
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Analyzing visual delta...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Evaluate repair with Gemini Vision
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
