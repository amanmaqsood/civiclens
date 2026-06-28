import React, { useState, useEffect, useMemo, useRef } from "react";
import { Camera, ImagePlus, MapPin, MapPinned, Trash2, CheckCircle2, ChevronRight, Loader2, Mic, MicOff, ArrowLeft } from "lucide-react";
import { IssueReport } from "../types";
import { getCurrentLocation, LocationData } from "../utils/location";
import { useLanguage } from "../context/LanguageContext";
import { compressImage } from "../utils/compression";

// Import modular layouts
import ReportProgressView from "./ReportProgressView";
import ReportClarificationView from "./ReportClarificationView";
import ReportAiEditForm from "./ReportAiEditForm";
import ReportFallbackForm from "./ReportFallbackForm";
import PlacesAutocompleteField, { SelectedPlace } from "./PlacesAutocompleteField";
import { apiFetch } from "../services/api";

interface ReportPageProps {
  onBack: () => void;
  onSubmit: (report: Partial<IssueReport>) => void;
  prefilledLocation?: { lat: number; lng: number } | null;
  prefilledData?: Partial<IssueReport> | null;
}

const serverCategories = ["pothole", "water_leak", "streetlight", "waste", "drainage", "road_damage", "other"];

type ManualLocationSuggestion = {
  label: string;
  address: string;
  lat: number;
  lng: number;
};

const MANUAL_LOCATION_SUGGESTIONS: ManualLocationSuggestion[] = [
  {
    label: "Indiranagar Metro Station",
    address: "Indiranagar Metro Station, CMH Road, Bengaluru",
    lat: 12.97837,
    lng: 77.64084,
  },
  {
    label: "Koramangala BDA Complex",
    address: "Koramangala BDA Complex, 3rd Block, Bengaluru",
    lat: 12.93462,
    lng: 77.62212,
  },
  {
    label: "Jayanagar 4th Block",
    address: "Jayanagar 4th Block, Bengaluru",
    lat: 12.92501,
    lng: 77.5938,
  },
  {
    label: "MG Road Metro Station",
    address: "MG Road Metro Station, Bengaluru",
    lat: 12.97557,
    lng: 77.60684,
  },
  {
    label: "Hebbal Flyover",
    address: "Hebbal Flyover, Outer Ring Road, Bengaluru",
    lat: 13.03576,
    lng: 77.59702,
  },
  {
    label: "Whitefield Main Road",
    address: "Whitefield Main Road, Bengaluru",
    lat: 12.9698,
    lng: 77.75,
  },
  {
    label: "Yeshwanthpur Railway Station",
    address: "Yeshwanthpur Railway Station, Bengaluru",
    lat: 13.02383,
    lng: 77.55092,
  },
  {
    label: "Banashankari Bus Station",
    address: "Banashankari TTMC Bus Station, Bengaluru",
    lat: 12.91766,
    lng: 77.57357,
  },
];

export default function ReportPage({ onBack, onSubmit, prefilledLocation, prefilledData }: ReportPageProps) {
  const { language, t } = useLanguage();
  const categoryMap = useMemo<Record<string, string>>(() => ({
    pothole: t("category.pothole"),
    water_leak: t("category.water_leak"),
    streetlight: t("category.streetlight"),
    waste: t("category.waste"),
    drainage: t("category.drainage"),
    road_damage: t("category.road_damage"),
    other: t("category.other"),
  }), [t]);
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
  const [imageError, setImageError] = useState<string | null>(null);
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

  const liveFileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  const stages = [
    { label: "Evidence Optimization", detail: "Compressing proof photo client-side..." },
    { label: "Preparing evidence", detail: "Preparing evidence for the prototype report..." },
    { label: "Multimodal AI Draft", detail: "Drafting visual summary..." },
    { label: "Assessing severity", detail: "Assessing issue severity..." },
    { label: "Validating AI response", detail: "Validating AI response..." }
  ];

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = "en-IN";
    }
  }, []);

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
      rec.lang = "en-IN";
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

  const handleUseManualPin = () => {
    const pin = prefilledLocation || { lat: 12.9716, lng: 77.5946 };
    setLocation({
      lat: pin.lat,
      lng: pin.lng,
      addressPlaceholder: "Approximate manual map pin near Bengaluru center",
    });
    setManualAddress((current) => current || "Approximate manual map pin near Bengaluru center");
    setLocError(null);
  };

  const handleSelectPlace = (place: SelectedPlace) => {
    setManualAddress(place.address || place.label);
    if (typeof place.lat === "number" && typeof place.lng === "number") {
      setLocation({
        lat: place.lat,
        lng: place.lng,
        addressPlaceholder: place.address || place.label,
      });
    } else if (!location) {
      setLocation({
        lat: 12.9716,
        lng: 77.5946,
        addressPlaceholder: place.address || place.label,
      });
    }
    setLocError(null);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        input.value = "";
        setImageError(t("report.unsupportedImage"));
        return;
      }
      try {
        setImageError(null);
        const compressedBase64 = await compressImage(file);
        setImage(compressedBase64);
      } catch (err: any) {
        setImageError(t("report.imageProcessError"));
      } finally {
        input.value = "";
      }
    }
  };

  const clearImage = () => {
    setImage(null);
    setImageError(null);
    if (liveFileInputRef.current) liveFileInputRef.current.value = "";
    if (galleryFileInputRef.current) galleryFileInputRef.current.value = "";
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
      const response = await apiFetch("/api/analyze-report", {
        method: "POST",
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
        t={t}
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
        t={t}
        onSubmit={handleFallbackSubmit}
      />
    );
  }

  const stepperItems = [
    { label: t("report.step.photo"), done: !!image },
    { label: t("report.step.location"), done: !!location || !!manualAddress },
    { label: t("report.step.description"), done: description.trim().length > 0 },
    { label: t("report.step.gemini"), done: !!aiResult },
    { label: t("report.step.confirm"), done: false },
  ];

  return (
    <form onSubmit={handleStartAnalysis} className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 font-sans pb-28 text-ink sm:px-6 lg:py-8">
      {/* Back button header */}
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <button
          type="button"
          onClick={onBack}
            className="flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-base font-semibold text-ink hover:bg-white cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t("report.exit")}</span>
        </button>
        <span className="rounded-lg bg-marigold px-3 py-1 text-sm font-bold text-ink">
          {t("report.badge")}
        </span>
      </div>

      <div id="report-stepper" className="grid grid-cols-5 gap-2 rounded-2xl border border-hairline bg-white p-2 shadow-3xs" aria-label="Report flow steps">
        {stepperItems.map((step, index) => (
          <div
            key={step.label}
            className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl px-2 text-center ${
              step.done ? "bg-verify/10 text-ink" : index === 0 || stepperItems[index - 1]?.done ? "bg-marigold/10 text-ink" : "bg-paper text-[#334155]"
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black shadow-3xs">
              {step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </span>
            <span className="text-sm font-bold leading-tight">{step.label}</span>
          </div>
        ))}
      </div>

      {apiError && (
        <div className="text-sm font-mono text-alert bg-alert/5 p-3 rounded-lg border border-alert/20">
          {apiError}
        </div>
      )}

      {/* Upload proof */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-mono text-[#334155] block">{t("report.imageLabel")}</label>
        <input
          id="report-live-photo-input"
          type="file"
          ref={liveFileInputRef}
          onChange={handleImageChange}
          accept="image/*"
          capture="environment"
          className="hidden"
        />
        <input
          id="report-gallery-upload-input"
          type="file"
          ref={galleryFileInputRef}
          onChange={handleImageChange}
          accept="image/*"
          className="hidden"
        />
        {imageError && (
        <p role="alert" className="rounded-lg border border-alert/20 bg-alert/10 p-2 text-sm font-semibold text-alert">
            {imageError}
          </p>
        )}
        {!image ? (
          <div className="rounded-2xl border-2 border-dashed border-hairline bg-paper p-5 transition-all">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-hairline select-none">
                <Camera className="w-5 h-5 text-slate" />
              </div>
              <div>
                <p className="text-base font-semibold text-ink">{t("report.addPhoto")}</p>
                <p className="text-sm text-[#334155] mt-0.5">
                  {t("report.imageHint")}
                </p>
                <p className="text-sm text-[#334155] mt-0.5">{t("report.imageHint2")}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => liveFileInputRef.current?.click()}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-ink px-4 text-base font-bold text-paper hover:bg-ink/90"
              >
                <Camera className="h-4 w-4 text-marigold" />
                {t("report.takeLivePhoto")}
              </button>
              <button
                type="button"
                onClick={() => galleryFileInputRef.current?.click()}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-hairline bg-white px-4 text-base font-bold text-ink hover:bg-paper"
              >
                <ImagePlus className="h-4 w-4 text-marigold" />
                {t("report.uploadGallery")}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden border border-hairline bg-ink min-h-[140px] max-h-[200px] flex items-center justify-center select-none">
            <img src={image} alt="Civic preview" className="object-contain max-h-[200px] w-full" />
            <div className="absolute bottom-3 grid w-full grid-cols-[1fr_1fr_auto] gap-2 px-4">
              <button
                type="button"
                onClick={() => liveFileInputRef.current?.click()}
                className="min-h-[44px] bg-ink/90 hover:bg-marigold text-white hover:text-ink border border-white/15 px-3 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer shadow-xs text-center"
              >
                {t("report.retake")}
              </button>
              <button
                type="button"
                onClick={() => galleryFileInputRef.current?.click()}
                className="min-h-[44px] bg-ink/90 hover:bg-marigold text-white hover:text-ink border border-white/15 px-3 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer shadow-xs text-center"
              >
                {t("report.gallery")}
              </button>
              <button
                type="button"
                onClick={clearImage}
                aria-label={t("report.removePhoto")}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center bg-alert/90 hover:bg-alert text-white rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mx-auto" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Geolocation Live Capture Component */}
      <div className="bg-paper border border-hairline p-4 rounded-xl flex flex-col gap-2.5">
        <label className="text-sm font-mono text-[#334155] block">{t("report.locationLabel")}</label>
        
        <div className="text-sm font-semibold leading-normal py-0.5">
          {locLoading && (
            <span className="text-marigold flex items-center gap-1 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("report.locationLoading")}
            </span>
          )}
          {!locLoading && location && (
            <span className="text-ink flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-verify" /> {t("report.locationLocked")}
            </span>
          )}
          {!locLoading && locError && (
            <span className="text-alert flex items-center gap-1">
              {t("report.locationFallback")}
            </span>
          )}
          {!locLoading && !location && !locError && (
            <span className="text-slate flex items-center gap-1">
              {t("report.locationMissing")}
            </span>
          )}
        </div>

        {location ? (
          <div className="flex items-start gap-2 bg-verify/5 text-ink p-2 rounded-lg border border-verify/20 select-none">
            <CheckCircle2 className="w-3.5 h-3.5 text-verify mt-0.5 flex-shrink-0" />
            <div className="text-sm font-semibold">
              <p>{t("report.gpsLocked")}</p>
              <p className="font-mono text-sm text-[#334155] mt-0.5">
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleFetchLocation}
              className="ml-auto min-h-[44px] rounded-lg px-2 text-sm font-mono text-ink hover:bg-white"
            >
              {t("report.refreshLocation")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleFetchLocation}
            className="w-full flex min-h-[44px] items-center justify-center gap-2 border border-hairline bg-white hover:bg-paper text-slate hover:text-ink py-2 px-3 rounded-lg text-base font-semibold cursor-pointer shadow-2xs"
          >
            {locLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-marigold" /> : <MapPin className="w-3.5 h-3.5 text-marigold" />}
            <span>{t("report.useCurrentLocation")}</span>
          </button>
        )}
        {(locError || !location) && (
          <div id="manual-pin-fallback" className="rounded-xl border border-dashed border-marigold/45 bg-white p-3">
            <div className="flex items-start gap-3">
              <MapPinned className="mt-0.5 h-5 w-5 shrink-0 text-marigold" />
              <div className="flex-1">
                <p className="text-base font-bold text-ink">{t("report.manualPinTitle")}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#334155]">
                  {t("report.manualPinHelp")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUseManualPin}
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-base font-bold text-paper hover:bg-ink/90"
            >
              <MapPinned className="h-4 w-4 text-marigold" />
              <span className="flex flex-col leading-tight">
                <span>{t("report.manualPinCta")}</span>
                <span className="text-sm font-semibold text-paper/80">{t("report.manualPinSub")}</span>
              </span>
            </button>
          </div>
        )}
        <PlacesAutocompleteField
          value={manualAddress}
          onValueChange={setManualAddress}
          onPlaceSelected={handleSelectPlace}
          fallbackSuggestions={MANUAL_LOCATION_SUGGESTIONS}
          label={t("report.searchLocation")}
          placeholder={t("report.searchLocationPlaceholder")}
          helperText={t("report.placesHelper")}
          loadingText={t("report.placesLoading")}
          noKeyText={t("report.placesNoKey")}
          failedText={t("report.placesFailed")}
          fallbackTitle={t("report.fallbackSuggestions")}
          noFallbackText={t("report.noFallback")}
          useLabel={t("report.usePlace")}
          language={language}
        />
      </div>

      {/* Voice Input Block */}
      {speechSupported && (
        <div className="bg-paper border border-hairline p-4 rounded-xl flex flex-col gap-2 shadow-3xs animate-fade-in select-none">
          <div className="flex items-center justify-between">
          <span className="text-sm font-mono text-[#334155] block">
              {t("report.voiceInput")}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-marigold animate-ping" />
              <span className="text-sm font-mono text-[#334155] font-bold">{t("report.englishActive")}</span>
            </div>
          </div>
          
          <p className="text-sm text-[#334155] font-medium leading-normal">
            {t("report.voiceHint")}
          </p>

          <button
            type="button"
            onClick={toggleListening}
            className={`w-full flex min-h-[44px] items-center justify-center gap-2 border py-2.5 px-4 rounded-xl text-base font-semibold cursor-pointer transition-all ${
              isListening
                ? "bg-alert text-white border-alert/20 animate-pulse"
                : "bg-white text-ink border-hairline hover:bg-slate-50 shadow-2xs"
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4 text-white animate-spin" />
                <span>{t("report.stopRecording")}</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-marigold" />
                <span>{t("report.startVoice")}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Description / Dictation */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-mono text-[#334155] block">
          {t("report.descLabel")}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("report.descPlaceholder")}
          className="w-full text-base border border-hairline bg-white p-3 rounded-xl min-h-[110px] leading-relaxed text-ink font-sans focus:outline-none focus:border-marigold focus:ring-1 focus:ring-marigold"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!image}
        className={`w-full flex min-h-[52px] items-center justify-center gap-2 font-bold text-base py-3 px-5 rounded-xl shadow-xs transition ${
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
