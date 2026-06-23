import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, 
  MapPin, 
  Trash2, 
  CheckCircle2, 
  ChevronRight, 
  Loader2, 
  Mic, 
  MicOff, 
  Sparkles, 
  ArrowLeft, 
  Plus, 
  AlertTriangle,
  Info,
  Sliders,
  Flag,
  CornerDownRight,
  RefreshCw,
  HelpCircle
} from "lucide-react";
import { ActiveView, IssueReport } from "../types";
import { getCurrentLocation, LocationData } from "../utils/location";
import { compressImage } from "../utils/compression";

interface ReportPageProps {
  onBack: () => void;
  onSubmit: (report: Partial<IssueReport>) => void;
}

// Map server categories to display categories
const categoryMap: Record<string, string> = {
  pothole: "Pothole & Roads",
  water_leak: "Water Supply & Leakage",
  streetlight: "Street Light Fault",
  waste: "Garbage & Sanitation",
  drainage: "Drainage & Sewerage",
  road_damage: "Road Damage",
  other: "Others"
};

const serverCategories = ["pothole", "water_leak", "streetlight", "waste", "drainage", "road_damage", "other"];

export default function ReportPage({ onBack, onSubmit }: ReportPageProps) {
  // --- Form Input States ---
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");

  // --- Voice Dictation States ---
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // --- Progress / Loader States ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);

  // --- AI Analysis Result States ---
  const [aiResult, setAiResult] = useState<any>(null);
  const [showClarification, setShowClarification] = useState(false);
  const [clarificationResponse, setClarificationResponse] = useState("");
  const [isEditableConfirmMode, setIsEditableConfirmMode] = useState(false);
  const [isFallbackManualMode, setIsFallbackManualMode] = useState(false);

  // --- Form References ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stages = [
    { label: "Evidence Optimization", detail: "Compressing proof photo client-side..." },
    { label: "Municipal Gateway Link", detail: "Routing evidence securely to Citizen Hub..." },
    { label: "Multimodal AI Diagnosis", detail: "Running visual diagnostic scans for hazard vectors..." },
    { label: "Structural Threat Calibration", detail: "Determining gravity risk indexes & urgency tags..." },
    { label: "Security Schema Lock", detail: "Enforcing digital signatures before council publication..." }
  ];

  // --- Auto-trigger Location Capture on Mount ---
  useEffect(() => {
    handleFetchLocation();

    // Check for speech recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-IN"; // Favorable to regional accents

      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setDescription((prev) => prev ? prev + " " + transcript : transcript);
      };
      recognitionRef.current = rec;
    }
  }, []);

  const handleFetchLocation = () => {
    setLocLoading(true);
    setLocError(null);
    getCurrentLocation(
      (data) => {
        setLocation(data);
        setLocLoading(false);
      },
      (err) => {
        setLocError(err);
        setLocLoading(false);
      }
    );
  };

  // --- Image Upload & Compression Handling ---
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setLocError(null);
        // Clean baseline client-side compression
        const compressedBase64 = await compressImage(file);
        setImage(compressedBase64);
      } catch (err: any) {
        setLocError("Failed to process image. Try another photo.");
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Voice Input Toggle ---
  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Speech recognition failed to start:", e);
      }
    }
  };

  // --- Staged Progress Trigger & Fake Timer ---
  const runProgressSimulation = () => {
    setCurrentStageIndex(0);
    const interval = setInterval(() => {
      setCurrentStageIndex((prev) => {
        if (prev < stages.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 1200);
    return interval;
  };

  // --- Submit to AI Analyzer Endpoint ---
  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) return;

    setApiError(null);
    setIsAnalyzing(true);
    const progressInterval = runProgressSimulation();

    try {
      const response = await fetch("/api/analyze-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, description }),
      });

      const result = await response.json();
      clearInterval(progressInterval);

      if (result.success && result.data) {
        const data = result.data;
        setAiResult(data);
        setIsAnalyzing(false);

        // Check confidence boundary constraint
        if (data.confidence < 0.6 && data.clarificationQuestion) {
          setShowClarification(true);
        } else {
          setIsEditableConfirmMode(true);
        }
      } else if (result.fallback) {
        // Soft fallback to standard form as per rules
        setIsAnalyzing(false);
        setIsFallbackManualMode(true);
        setApiError("AI diagnosis returned schema variance. Guided fallback active.");
      } else {
        throw new Error(result.error || "Failed secure inspection.");
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setIsAnalyzing(false);
      setIsFallbackManualMode(true);
      setApiError("Security pipeline error. Fallback manually.");
    }
  };

  // --- Confirmation & Sync to DB ---
  const handleConfirmPersist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !aiResult) return;

    const mappedCategory = categoryMap[aiResult.category] || "Others";

    onSubmit({
      image,
      lat: location?.lat,
      lng: location?.lng,
      locationName: manualAddress || location?.addressPlaceholder || "Current Location",
      category: mappedCategory,
      description: aiResult.summary || description || "No observations",
      title: aiResult.title,
      summary: aiResult.summary,
      severity: aiResult.severity,
      urgency: aiResult.urgency,
      visibleHazards: aiResult.visibleHazards,
      affectedArea: aiResult.affectedArea,
      privacyFlags: aiResult.privacyFlags,
      confidence: aiResult.confidence,
    });
  };

  // --- Fallback Manual Submission ---
  const handleFallbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) return;

    const manualCat = e.currentTarget.querySelector("select")?.value || "Others";
    const manualDesc = e.currentTarget.querySelector("textarea")?.value || "";
    const manualSev = Number((e.currentTarget.querySelector("input[type='range']") as any)?.value || 3);

    onSubmit({
      image,
      lat: location?.lat,
      lng: location?.lng,
      locationName: manualAddress || location?.addressPlaceholder || "Manual Entry",
      category: manualCat,
      description: manualDesc || "Citizen reported manually.",
      title: manualDesc.substring(0, 30) + (manualDesc.length > 30 ? "..." : ""),
      summary: manualDesc,
      severity: manualSev,
      urgency: manualSev >= 4 ? "urgent" : manualSev >= 3 ? "priority" : "routine",
      visibleHazards: [],
      affectedArea: "unknown",
      privacyFlags: [],
      confidence: 1.0,
    });
  };

  // --- Clarification Override ---
  const handleClarificationSubmit = (proceedAnyway: boolean) => {
    setShowClarification(false);
    if (proceedAnyway) {
      setIsEditableConfirmMode(true);
    } else {
      // Append clarification to summary or description and proceed
      setAiResult(prev => ({
        ...prev,
        summary: prev.summary + ` [Verify Answer: ${clarificationResponse}]`,
        confidence: 0.8 // Override confidence since citizen verified it
      }));
      setIsEditableConfirmMode(true);
    }
  };

  // ==================== RENDERS ====================

  // 1️⃣ VIEW: Staged Progress Loader Screen
  if (isAnalyzing) {
    return (
      <div className="flex flex-col gap-6 px-5 py-8 font-sans items-center justify-center min-h-[460px]">
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span className="absolute animate-ping inline-flex h-12 w-12 rounded-full bg-indigo-400 opacity-20"></span>
            <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5] relative shadow-md">
              <Sparkles className="w-8 h-8 animate-pulse text-[#4F46E5]" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-800 mt-2">AI Inspector Running</p>
          <p className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">Secure Telemetry scan</p>
        </div>

        {/* Progress Timeline Checklist */}
        <div className="w-full max-w-sm flex flex-col gap-4 mt-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
          {stages.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isActive = idx === currentStageIndex;
            return (
              <div 
                key={idx} 
                className={`flex gap-3 items-start transition-opacity duration-300 ${isCompleted || isActive ? "opacity-100" : "opacity-40"}`}
              >
                <div className="mt-0.5">
                  {isCompleted ? (
                    <div className="w-4.5 h-4.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </div>
                  ) : isActive ? (
                    <div className="w-4.5 h-4.5 rounded-full border-2 border-[#4F46E5] border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-4.5 h-4.5 rounded-full border border-slate-300 bg-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold leading-none ${isActive ? "text-[#4F46E5]" : "text-slate-700"}`}>
                    {stage.label}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 pr-2 leading-relaxed font-medium">
                    {stage.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-slate-400 italic text-center max-w-[250px]">
          "Processing with zero server-side logs to preserve official integrity."
        </p>
      </div>
    );
  }

  // 2️⃣ VIEW: Clarification Verification Screen
  if (showClarification) {
    return (
      <div className="flex flex-col gap-5 px-4 py-6 font-sans">
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">Verification Needed</p>
              <h3 className="text-sm font-bold text-slate-800 leading-tight">Camera scan requires confirmation</h3>
            </div>
          </div>
          
          <div className="p-3 bg-white border border-amber-100 rounded-xl mt-1">
            <p className="text-slate-400 font-bold uppercase text-[9px]">Inspection Ambiguity</p>
            <p className="text-xs font-bold text-slate-800 leading-normal mt-0.5">
              "{aiResult?.clarificationQuestion || "Could you provide additional verification for the photographed condition?"}"
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Add Your Verification Answers
          </label>
          <textarea
            value={clarificationResponse}
            onChange={(e) => setClarificationResponse(e.target.value)}
            placeholder="e.g., Yes, it is a broad pool of water leaking from the cracked pipe underneath."
            className="w-full text-xs border border-slate-200 bg-white p-3 rounded-lg focus:outline-hidden focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] min-h-[80px]"
          />
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <button
            type="button"
            disabled={!clarificationResponse.trim()}
            onClick={() => handleClarificationSubmit(false)}
            className={`w-full flex items-center justify-center gap-2 font-bold text-[#4f46e5] text-sm py-3 px-4 rounded-xl shadow-xs transition ${
              clarificationResponse.trim() ? "bg-indigo-50 border border-indigo-200 hover:bg-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
            style={{ minHeight: "44px" }}
          >
            Submit Answer & Continue
          </button>
          
          <button
            type="button"
            onClick={() => handleClarificationSubmit(true)}
            className="w-full text-xs font-bold text-slate-500 hover:text-[#4F46E5] text-center py-2"
          >
            No responses, continue with best AI guess
          </button>
        </div>
      </div>
    );
  }

  // 3️⃣ VIEW: AI Confirmation Card Form (Editable Preview)
  if (isEditableConfirmMode && aiResult) {
    return (
      <form onSubmit={handleConfirmPersist} className="flex flex-col gap-5 px-4 py-5 font-sans pb-12">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-1">
            <Sparkles className="w-5 h-5 text-[#4F36FA]" />
            Review Ticket
          </h2>
          <span className="text-[10px] bg-indigo-50 text-[#4F46E5] font-black px-2.5 py-1 rounded-full uppercase">
            Step 2 of 2
          </span>
        </div>

        <div className="bg-[#4F46E5]/10 border border-[#4F46E5]/15 p-3 rounded-xl flex items-center gap-2">
          <Info className="w-4 h-4 text-[#4F36FA] flex-shrink-0" />
          <p className="text-[11px] text-[#4F36FA] font-bold">
            Gemini calibrated results. Click fields to edit details if required.
          </p>
        </div>

        {/* Thumbnail Preview strip */}
        <div className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200">
            <img src={image!} alt="Hazard Preview" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">GPS Location</p>
            <p className="text-[12px] font-bold text-slate-700 truncate max-w-[210px] mt-1">
              {manualAddress || location?.addressPlaceholder || "Detected Live Capture"}
            </p>
          </div>
        </div>

        {/* Title input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Ticket Title
          </label>
          <input
            type="text"
            value={aiResult.title}
            onChange={(e) => setAiResult({ ...aiResult, title: e.target.value })}
            className="w-full text-xs font-semibold border border-slate-200 bg-white p-2.5 rounded-lg focus:outline-hidden focus:border-[#4F46E5] focus:ring-1"
            style={{ minHeight: "40px" }}
          />
        </div>

        {/* Summary Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            AI Diagnosis Summary
          </label>
          <textarea
            value={aiResult.summary}
            onChange={(e) => setAiResult({ ...aiResult, summary: e.target.value })}
            className="w-full text-xs border border-slate-200 bg-white p-2.5 rounded-lg focus:outline-hidden focus:border-[#4F46E5] min-h-[70px]"
          />
        </div>

        {/* Two-Column configuration selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Issue Category
            </label>
            <select
              value={aiResult.category}
              onChange={(e) => setAiResult({ ...aiResult, category: e.target.value })}
              className="w-full text-xs border border-slate-200 bg-white p-2 rounded-lg font-bold"
              style={{ minHeight: "40px" }}
            >
              {serverCategories.map((sc) => (
                <option key={sc} value={sc}>
                  {categoryMap[sc] || sc}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Urgency Level
            </label>
            <select
              value={aiResult.urgency}
              onChange={(e) => setAiResult({ ...aiResult, urgency: e.target.value })}
              className="w-full text-xs border border-slate-200 bg-white p-2 rounded-lg font-bold uppercase"
              style={{ minHeight: "40px" }}
            >
              <option value="routine">Routine (Low)</option>
              <option value="priority">Priority</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Severity Slider */}
        <div className="flex flex-col gap-2 bg-slate-50 border border-slate-100 p-3 rounded-xl">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-500 uppercase text-[10px] tracking-wider">Severity Scale</span>
            <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-md text-[10px] font-extrabold uppercase">
              Rating {aiResult.severity} / 5
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            value={aiResult.severity}
            onChange={(e) => setAiResult({ ...aiResult, severity: Number(e.target.value) })}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#4F46E5] mt-1"
          />
        </div>

        {/* Dynamic Hazards pill line */}
        {aiResult.visibleHazards && aiResult.visibleHazards.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Spotted Road Hazards
            </label>
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {aiResult.visibleHazards.map((hz: string, i: number) => (
                <span key={i} className="text-[10px] bg-amber-50 border border-amber-200 font-bold text-amber-800 px-2 py-0.5 rounded-md">
                  {hz}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Affected Area / Confidence Indicator */}
        <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-slate-400 font-extrabold pb-2">
          <span>Area: {aiResult.affectedArea?.toUpperCase() || "UNKNOWN"}</span>
          <span className="flex items-center gap-0.5 text-emerald-600">
            Confidence: {Math.round((aiResult.confidence || 0.88) * 100)}%
          </span>
        </div>

        {/* Submit to DB */}
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-[#4F46E5] hover:bg-slate-100 font-bold hover:text-[#4F46E5] hover:border hover:border-[#4F46E5] text-white text-base py-3.5 px-6 rounded-xl shadow-md transition duration-200 cursor-pointer"
          style={{ minHeight: "48px" }}
        >
          Confirm & File Complaint Ticket
          <ChevronRight className="w-5 h-5 flex-shrink-0" />
        </button>
      </form>
    );
  }

  // 4️⃣ VIEW: Guided Fallback Manual Form Screen
  if (isFallbackManualMode) {
    return (
      <form onSubmit={handleFallbackSubmit} className="flex flex-col gap-5 px-4 py-5 font-sans pb-12">
        <div className="flex flex-col gap-2 bg-amber-50 border border-amber-200 p-4 rounded-xl">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
            <p className="text-xs font-bold text-amber-900 leading-none">Manual Logging Form Active</p>
          </div>
          <p className="text-[11px] text-slate-600 font-medium leading-normal leading-relaxed mt-0.5">
            Secure analysis gateway is offline. Please enter category and severity details manually to sync this grievance directly.
          </p>
        </div>

        {/* Category select dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Select Grievance Category
          </label>
          <select
            className="w-full text-sm border border-slate-200 bg-white px-3 py-2.5 rounded-lg focus:outline-hidden focus:border-[#4F46E5] font-medium"
            style={{ minHeight: "44px" }}
          >
            {serverCategories.map((sc) => (
              <option key={sc} value={categoryMap[sc] || sc}>
                {categoryMap[sc] || sc}
              </option>
            ))}
          </select>
        </div>

        {/* Severity Slider */}
        <div className="flex flex-col gap-1.5 bg-slate-50 border border-slate-100 p-3 rounded-xl">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Vulnerability Severity Rating
          </label>
          <input
            type="range"
            min="1"
            max="5"
            defaultValue="3"
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#4F46E5] mt-1.5"
          />
          <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase mt-1">
            <span>Minor (1)</span>
            <span>Critical Emergency (5)</span>
          </div>
        </div>

        {/* Manual inputs fallback for location */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Captured Land / Zone <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 p-2 rounded-lg text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{manualAddress || location?.addressPlaceholder || "Manual GPS Telemetry active"}</span>
          </div>
        </div>

        {/* Description textarea */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Describe Municipal Problem
          </label>
          <textarea
            required
            defaultValue={description}
            placeholder="Ensure exact landmarks and references are outlined. e.g. Indiranagar water stagnation..."
            className="w-full text-sm border border-slate-200 bg-white p-3 rounded-lg focus:outline-hidden focus:border-[#4F46E5] min-h-[100px]"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-[#4F46E5] hover:bg-slate-100 font-bold hover:text-[#4F46E5] hover:border hover:border-[#4F46E5] text-white text-base py-3.5 px-6 rounded-xl shadow-md cursor-pointer mt-1"
          style={{ minHeight: "48px" }}
        >
          Confirm & Submit grievance
          <ChevronRight className="w-5 h-5 flex-shrink-0" />
        </button>
      </form>
    );
  }

  // 5️⃣ VIEW: Base Creation Initial Page (Capture / Select Photo)
  return (
    <form onSubmit={handleStartAnalysis} className="flex flex-col gap-5 px-4 py-5 font-sans pb-12">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h2 className="text-lg font-bold text-slate-900">New Civic Report</h2>
        <span className="text-[10px] bg-[#4F46E5] text-white font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider leading-none">
          Active Citizen
        </span>
      </div>

      {apiError && (
        <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
          {apiError}
        </div>
      )}

      {/* Proof Photo Upload */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          Upload Proof Photo <span className="text-rose-500">*</span>
        </label>
        
        {!image ? (
          <div
            onClick={triggerFileSelect}
            className="border-2 border-dashed border-slate-200 hover:border-[#4F46E5] rounded-2xl p-6 bg-slate-50 flex flex-col items-center justify-center gap-3 cursor-pointer group min-h-[160px] transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
              aria-label="Upload photo of civic issue"
            />
            <div className="w-12 h-12 rounded-full bg-indigo-50 group-hover:bg-[#4F46E5]/10 flex items-center justify-center transition-colors">
              <Camera className="w-6 h-6 text-[#4F46E5]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-800">Tap to take photo or upload</p>
              <p className="text-xs text-slate-400 mt-1">Real-time image required to verify (Max 5MB)</p>
            </div>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden shadow-xs border border-slate-100 bg-black min-h-[160px] max-h-[220px] flex items-center justify-center">
            <img src={image} alt="Civic preview" className="object-contain max-h-[220px] w-full" />
            <div className="absolute bottom-4 flex justify-center gap-2 w-full px-4">
              <button
                type="button"
                onClick={triggerFileSelect}
                className="flex-1 text-xs bg-slate-900/95 hover:bg-[#4F46E5] text-white border border-slate-700 px-3 py-2 rounded-lg font-bold transition-all cursor-pointer shadow-sm text-center"
                style={{ minHeight: "36px" }}
              >
                Replace Photo
              </button>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="p-2 bg-rose-600/95 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                style={{ width: "36px", height: "36px" }}
                aria-label="Remove uploaded photo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {/* Tiny hidden file input for replace flow */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Geolocation Live Capture Component */}
      <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col gap-3">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          Telemetry & Location Georef <span className="text-rose-500">*</span>
        </label>

        {location ? (
          <div className="flex items-start gap-2 bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-100 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs font-semibold">
              <p>GPS Geo-reference Bound!</p>
              <p className="font-mono text-[9px] text-slate-500 mt-0.5 leading-none">
                Lat: {location.lat}, Lng: {location.lng}
              </p>
            </div>
            <button
              type="button"
              onClick={handleFetchLocation}
              className="ml-auto text-[10px] text-slate-400 hover:text-[#4F46E5] font-bold uppercase transition"
            >
              Refresh
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleFetchLocation}
            className="w-full flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-indigo-50 hover:border-[#4F46E5] font-bold text-slate-700 hover:text-[#4F46E5] py-2.5 px-4 rounded-lg shadow-2xs transition-colors cursor-pointer"
            style={{ minHeight: "44px" }}
          >
            {locLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#4F46E5]" />
            ) : (
              <MapPin className="w-4 h-4 text-[#4F46E5]" />
            )}
            Detecting Live Location...
          </button>
        )}

        {locError && (
          <p className="text-[10px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100 font-semibold leading-normal">
            {locError}
          </p>
        )}

        {/* Manual Address Fallback */}
        <input
          type="text"
          value={manualAddress}
          onChange={(e) => setManualAddress(e.target.value)}
          placeholder="Access fallback: e.g. Brigade Road, Bengaluru"
          className="w-full text-xs border border-slate-200 bg-white p-2.5 rounded-lg focus:outline-hidden focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
          style={{ minHeight: "44px" }}
          aria-label="Manual address landmark fallback"
        />
      </div>

      {/* Voice or Text observations */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            What is the issue? (Optional text/voice)
          </label>
          
          {speechSupported ? (
            <button
              type="button"
              onClick={toggleListening}
              className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-full border transition-all cursor-pointer ${
                isListening 
                  ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse" 
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-[#4F46E5]"
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3 h-3" />
                  <span>Recording (en-IN)...</span>
                </>
              ) : (
                <>
                  <Mic className="w-3 h-3 text-[#4F36FA]" />
                  <span>Voice Describe</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-extrabold bg-slate-100 border border-slate-200 px-2 py-1 rounded-full cursor-not-allowed">
              <MicOff className="w-3 h-3 text-slate-400" />
              <span>Voice Unsupported</span>
            </div>
          )}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explain condition or record dictation here..."
          className="w-full text-sm border border-slate-200 bg-white p-3 rounded-lg focus:outline-hidden focus:border-[#4F46E5] min-h-[80px]"
          aria-label="Core Description details"
        />
      </div>

      {/* Process Button */}
      <button
        type="submit"
        disabled={!image}
        className={`w-full flex items-center justify-center gap-2 font-bold text-white text-base py-3.5 px-6 rounded-xl shadow-md transition duration-200 ${
          image
            ? "bg-[#4F46E5] hover:bg-slate-100 hover:text-[#4F46E5] hover:border hover:border-[#4F46E5] cursor-pointer"
            : "bg-slate-300 cursor-not-allowed"
        }`}
        style={{ minHeight: "48px" }}
        aria-label="Submit issue report to AI analyzer"
      >
        Submit to Council AI
        <ChevronRight className="w-5 h-5 flex-shrink-0" />
      </button>
    </form>
  );
}
