import React, { useState, useEffect, useRef } from "react";
import { Camera, MapPin, Trash2, CheckCircle2, ChevronRight, Loader2, Mic, MicOff, Sparkles, ArrowLeft } from "lucide-react";
import { IssueReport } from "../types";
import { getCurrentLocation, LocationData } from "../utils/location";
import { useLanguage } from "../context/LanguageContext";
import { compressImage } from "../utils/compression";

// Import modular layouts
import ReportProgressView from "./ReportProgressView";
import ReportClarificationView from "./ReportClarificationView";
import ReportAiEditForm from "./ReportAiEditForm";
import ReportFallbackForm from "./ReportFallbackForm";

interface ReportPageProps {
  onBack: () => void;
  onSubmit: (report: Partial<IssueReport>) => void;
  prefilledLocation?: { lat: number; lng: number } | null;
  prefilledData?: Partial<IssueReport> | null;
}

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

export default function ReportPage({ onBack, onSubmit, prefilledLocation, prefilledData }: ReportPageProps) {
  const { language, t } = useLanguage();
  const [image, setImage] = useState<string | null>(prefilledData?.image || null);
  const [description, setDescription] = useState(prefilledData?.description || prefilledData?.summary || "");
  const [location, setLocation] = useState<LocationData | null>(
    prefilledData?.lat !== undefined && prefilledData?.lng !== undefined
      ? {
          lat: prefilledData.lat,
          lng: prefilledData.lng,
          addressPlaceholder: `Latitude: ${prefilledData.lat.toFixed(4)}, Longitude: ${prefilledData.lng.toFixed(4)}`,
        }
      : prefilledLocation
      ? {
          lat: prefilledLocation.lat,
          lng: prefilledLocation.lng,
          addressPlaceholder: `Latitude: ${prefilledLocation.lat.toFixed(4)}, Longitude: ${prefilledLocation.lng.toFixed(4)}`,
        }
      : null
  );
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState(prefilledData?.locationName || "");

  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);

  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [showClarification, setShowClarification] = useState(false);
  const [clarificationResponse, setClarificationResponse] = useState("");
  const [isEditableConfirmMode, setIsEditableConfirmMode] = useState(false);
  const [isFallbackManualMode, setIsFallbackManualMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const stages = [
    { label: "Evidence Optimization", detail: "Compressing proof photo client-side..." },
    { label: "Uploading evidence", detail: "Uploading evidence to Citizen Hub..." },
    { label: "Multimodal AI Diagnosis", detail: "Running visual diagnostic scans..." },
    { label: "Assessing severity", detail: "Assessing issue severity..." },
    { label: "Validating AI response", detail: "Validating AI response..." }
  ];

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language === "hi" ? "hi-IN" : "en-IN";
    }
  }, [language]);

  useEffect(() => {
    if (!prefilledLocation) {
      handleFetchLocation();
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      setSpeechSupported(true);
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = language === "hi" ? "hi-IN" : "en-IN";
      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setLocError("Unsupported format. Please upload JPEG, PNG, or WebP proof files.");
        return;
      }
      try {
        setLocError(null);
        const compressedBase64 = await compressImage(file);
        setImage(compressedBase64);
      } catch (err: any) {
        setLocError("Failed to process image. Try another photo.");
      }
    }
  };

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

  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) return;
    setApiError(null);
    setIsAnalyzing(true);
    setCurrentStageIndex(0);
    const interval = setInterval(() => {
      setCurrentStageIndex((prev) => (prev < stages.length - 1 ? prev + 1 : prev));
    }, 1100);

    try {
      const response = await fetch("/api/analyze-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, description }),
      });
      const result = await response.json();
      clearInterval(interval);

      if (result.success && result.data) {
        setAnalysisResult(result);
        setAiResult(result.data);
        setIsAnalyzing(false);
        if (result.data.confidence < 0.6 && result.data.clarificationQuestion) {
          setShowClarification(true);
        } else {
          setIsEditableConfirmMode(true);
        }
      } else {
        setIsAnalyzing(false);
        setIsFallbackManualMode(true);
      }
    } catch (err) {
      clearInterval(interval);
      setIsAnalyzing(false);
      setIsFallbackManualMode(true);
    }
  };

  const handleConfirmPersist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !aiResult) return;
    onSubmit({
      image,
      lat: location?.lat,
      lng: location?.lng,
      locationName: manualAddress || location?.addressPlaceholder || "Current Location",
      category: serverCategories.includes(aiResult.category?.toLowerCase() || "") ? aiResult.category?.toLowerCase() : "other",
      description: aiResult.summary || description || "No description provided",
      title: aiResult.title,
      summary: aiResult.summary,
      severity: aiResult.severity,
      urgency: aiResult.urgency,
      visibleHazards: aiResult.visibleHazards,
      affectedArea: aiResult.affectedArea,
      privacyFlags: aiResult.privacyFlags,
      confidence: aiResult.confidence,
      // Pass the perceive tracing metadata
      perceiveMeta: analysisResult ? {
        durationMs: analysisResult.durationMs,
        confidence: analysisResult.confidence,
        inputDigest: analysisResult.inputDigest,
        outputSummary: analysisResult.outputSummary,
        retried: analysisResult.retried,
        fallbackUsed: analysisResult.fallbackUsed,
      } : undefined
    });
  };

  const handleFallbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) return;
    const rawManualCat = (e.currentTarget.querySelector("select") as HTMLSelectElement)?.value || "other";
    const manualCat = serverCategories.includes(rawManualCat) ? rawManualCat : "other";
    const manualDesc = (e.currentTarget.querySelector("textarea") as HTMLTextAreaElement)?.value || "";
    const manualSev = Number((e.currentTarget.querySelector("input[type='range']") as any)?.value || 3);

    onSubmit({
      image,
      lat: location?.lat,
      lng: location?.lng,
      locationName: manualAddress || location?.addressPlaceholder || "Manual Entry",
      category: manualCat,
      description: manualDesc || "Reported manually by citizen.",
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

  if (isAnalyzing) return <ReportProgressView stages={stages} currentStageIndex={currentStageIndex} />;

  if (showClarification) {
    return (
      <ReportClarificationView
        clarificationQuestion={aiResult?.clarificationQuestion}
        clarificationResponse={clarificationResponse}
        setClarificationResponse={setClarificationResponse}
        onSubmitClarification={(proceed) => {
          setShowClarification(false);
          if (!proceed) {
            setAiResult((p: any) => ({ ...p, summary: p.summary + ` [Verified: ${clarificationResponse}]`, confidence: 0.8 }));
          }
          setIsEditableConfirmMode(true);
        }}
      />
    );
  }

  if (isEditableConfirmMode && aiResult) {
    return (
      <ReportAiEditForm
        image={image!}
        manualAddress={manualAddress}
        addressPlaceholder={location?.addressPlaceholder}
        aiResult={aiResult}
        setAiResult={setAiResult}
        serverCategories={serverCategories}
        categoryMap={categoryMap}
        onConfirm={handleConfirmPersist}
      />
    );
  }

  if (isFallbackManualMode) {
    return (
      <ReportFallbackForm
        manualAddress={manualAddress}
        addressPlaceholder={location?.addressPlaceholder}
        serverCategories={serverCategories}
        categoryMap={categoryMap}
        description={description}
        onSubmit={handleFallbackSubmit}
      />
    );
  }

  return (
    <form onSubmit={handleStartAnalysis} className="flex flex-col gap-4 px-4 py-4 font-sans pb-12 text-ink">
      {/* Back button header */}
      <div className="flex items-center justify-between border-b border-hairline pb-2.5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate hover:text-ink cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
        <span className="text-[9px] font-mono bg-marigold text-ink font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
          New Incident
        </span>
      </div>

      {apiError && (
        <div className="text-[10px] font-mono text-alert bg-alert/5 p-2 rounded-lg border border-alert/20">
          {apiError}
        </div>
      )}

      {/* Upload proof */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9pt] font-mono uppercase text-slate tracking-wider block">Proof photograph</label>
        {!image ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-hairline hover:border-marigold rounded-2xl p-6 bg-paper flex flex-col items-center justify-center gap-3 cursor-pointer group min-h-[140px] transition-all"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-hairline group-hover:text-marigold transition-all select-none">
              <Camera className="w-5 h-5 text-slate group-hover:text-marigold" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-ink">Attach photo proof</p>
              <p className="text-[10px] text-slate mt-0.5">JPEG, PNG up to 5MB, geo reference automatic</p>
            </div>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden border border-hairline bg-ink min-h-[140px] max-h-[200px] flex items-center justify-center select-none">
            <img src={image} alt="Civic preview" className="object-contain max-h-[200px] w-full" />
            <div className="absolute bottom-3 flex justify-center gap-2 w-full px-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 text-[10px] bg-ink/90 hover:bg-marigold text-white hover:text-ink border border-white/15 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-xs text-center"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => { setImage(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="p-1.5 bg-alert/90 hover:bg-alert text-white rounded-lg transition-colors cursor-pointer"
                style={{ width: "30px", height: "30px" }}
              >
                <Trash2 className="w-4 h-4 mx-auto" />
              </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
          </div>
        )}
      </div>

      {/* Geolocation Live Capture Component */}
      <div className="bg-paper border border-hairline p-4 rounded-xl flex flex-col gap-2.5">
        <label className="text-[9pt] font-mono uppercase text-slate tracking-wider block">Location</label>
        
        {/* Non-blocking Permission / Geolocation Status Indicator */}
        <div className="text-[10px] font-semibold leading-normal py-0.5">
          {locLoading && (
            <span className="text-marigold flex items-center gap-1 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> 📍 Acquiring coordinates...
            </span>
          )}
          {!locLoading && location && (
            <span className="text-verify flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-verify" /> 📍 Coordinates locked!
            </span>
          )}
          {!locLoading && locError && (
            <span className="text-alert flex items-center gap-1">
              ⚠️ Location access denied. Manual input required.
            </span>
          )}
          {!locLoading && !location && !locError && (
            <span className="text-slate flex items-center gap-1">
              📍 Coordinates missing. Tap below to acquire.
            </span>
          )}
        </div>

        {location ? (
          <div className="flex items-start gap-2 bg-verify/5 text-verify p-2 rounded-lg border border-verify/20 select-none">
            <CheckCircle2 className="w-3.5 h-3.5 text-verify mt-0.5 flex-shrink-0" />
            <div className="text-[10.5px] font-semibold">
              <p>GPS Geo-reference locked</p>
              <p className="font-mono text-[9px] text-slate mt-0.5">
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleFetchLocation}
              className="ml-auto text-[9px] font-mono text-slate hover:text-ink tracking-tight uppercase"
            >
              Refresh
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleFetchLocation}
            className="w-full flex items-center justify-center gap-1.5 border border-hairline bg-white hover:bg-paper text-slate hover:text-ink py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
            style={{ minHeight: "36px" }}
          >
            {locLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-marigold" /> : <MapPin className="w-3.5 h-3.5 text-marigold" />}
            <span>Detect Coordinates</span>
          </button>
        )}
        <input
          type="text"
          value={manualAddress}
          onChange={(e) => setManualAddress(e.target.value)}
          placeholder="Or type descriptive location e.g. Indiranagar, Metro Station"
          className="w-full text-xs border border-hairline bg-white p-2 rounded-xl focus:outline-none"
          style={{ minHeight: "36px" }}
        />
      </div>

      {/* Voice Input Block */}
      {speechSupported && (
        <div className="bg-paper border border-hairline p-4 rounded-xl flex flex-col gap-2 shadow-3xs animate-fade-in select-none">
          <div className="flex items-center justify-between">
            <span className="text-[9pt] font-mono uppercase text-slate tracking-wider block">
              {t("report.voiceInput")}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-marigold animate-ping" />
              <span className="text-[9px] font-mono text-slate uppercase font-bold">
                {language === "hi" ? "हिन्दी एक्टिव" : "English Active"}
              </span>
            </div>
          </div>
          
          <p className="text-[10px] text-slate font-medium leading-normal">
            {t("report.voiceHint")}
          </p>

          <button
            type="button"
            onClick={toggleListening}
            className={`w-full flex items-center justify-center gap-2 border py-2.5 px-4 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              isListening
                ? "bg-alert text-white border-alert/20 animate-pulse"
                : "bg-white text-ink border-hairline hover:bg-slate-50 shadow-2xs"
            }`}
            style={{ minHeight: "40px" }}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4 text-white animate-spin" />
                <span>{language === "hi" ? "रिकॉर्डिंग बंद करें..." : "Stop Recording..."}</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-marigold" />
                <span>{language === "hi" ? "बोलकर दर्ज करें" : "Start Voice Dictation"}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Description / Dictation */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9pt] font-mono uppercase text-slate block">
          {t("report.descLabel")}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("report.descPlaceholder")}
          className="w-full text-xs border border-hairline bg-white p-2.5 rounded-xl min-h-[80px] leading-relaxed text-ink font-sans"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!image}
        className={`w-full flex items-center justify-center gap-1.5 font-bold text-xs py-3 px-5 rounded-xl shadow-xs transition ${
          image ? "bg-marigold text-ink hover:bg-marigold/90 cursor-pointer" : "bg-paper text-slate cursor-not-allowed border border-hairline"
        }`}
        style={{ minHeight: "44px" }}
      >
        <span>{t("report.submit")}</span>
        <ChevronRight className="w-4 h-4 shrink-0" />
      </button>
    </form>
  );
}
