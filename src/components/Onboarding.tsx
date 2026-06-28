import React, { useState } from "react";
import { Camera, Brain, ShieldCheck, X } from "lucide-react";

interface OnboardingProps {
  onDismiss: () => void;
}

export default function Onboarding({ onDismiss }: OnboardingProps) {
  const [step, setStep] = useState(0);

  const cards = [
    {
      title: "Snap a photo of a civic issue",
      desc: "Take a clear picture of potholes, streetlights, or waste. CivicLens saves a prototype report with your location when available.",
      icon: <Camera className="w-12 h-12 text-marigold animate-bounce" />,
    },
    {
      title: "AI drafts triage and authority suggestions",
      desc: "Gemini can summarize the issue, compare possible duplicates, and draft an authority recommendation for human review. Nothing is filed automatically.",
      icon: <Brain className="w-12 h-12 text-blue-400 animate-pulse" />,
    },
    {
      title: "Track review and closure evidence",
      desc: "Follow prototype status updates, compare before/after photos, and copy draft escalation or RTI text when a human decides to use it.",
      icon: <ShieldCheck className="w-12 h-12 text-verify" />,
    },
  ];

  const handleNext = () => {
    if (step < cards.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem("has_seen_onboarding", "true");
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/85 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl flex flex-col gap-6 relative overflow-hidden">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 flex">
          <div 
            className="bg-marigold h-full transition-all duration-300"
            style={{ width: `${((step + 1) / cards.length) * 100}%` }}
          />
        </div>

        {/* Skip/Close button */}
        <button
          type="button"
          onClick={handleComplete}
          className="absolute top-3 right-3 flex min-h-[44px] min-w-[44px] items-center justify-center text-slate hover:text-ink transition-colors rounded-full hover:bg-slate-50 cursor-pointer"
          aria-label="Skip onboarding"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Card Content */}
        <div className="flex flex-col items-center text-center gap-4 mt-4 py-4 min-h-[200px] justify-center">
          <div className="p-4 bg-slate-50 rounded-full border border-slate-100 mb-2">
            {cards[step].icon}
          </div>
          <h3 className="text-base font-display font-black text-ink px-2 leading-snug">
            {cards[step].title}
          </h3>
          <p className="text-base text-slate px-4 leading-relaxed">
            {cards[step].desc}
          </p>
        </div>

        <div className="bg-marigold/10 border border-marigold/25 rounded-xl px-3 py-2 text-sm text-ink font-semibold leading-relaxed">
          Prototype only: CivicLens is not affiliated with, connected to, or submitting records to any government system.
        </div>

        {/* Navigation & Dots */}
        <div className="flex items-center justify-between mt-2">
          {/* Dot Indicators */}
          <div className="flex gap-1.5">
            {cards.map((_, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => setStep(idx)}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full cursor-pointer transition-all ${
                  idx === step ? "bg-marigold/15" : "hover:bg-slate-50"
                }`}
                aria-label={`Go to onboarding step ${idx + 1}`}
                aria-current={idx === step ? "step" : undefined}
              >
                <span className={`h-2 rounded-full transition-all ${
                  idx === step ? "w-4 bg-marigold" : "w-2 bg-slate-200"
                }`} />
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="min-h-[44px] px-4 py-2 text-base font-bold text-slate hover:text-ink cursor-pointer"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="min-h-[44px] px-5 py-2.5 bg-slate-900 text-white hover:bg-slate-800 transition-colors rounded-xl font-bold text-base cursor-pointer shadow-sm"
            >
              {step === cards.length - 1 ? "Get Started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
