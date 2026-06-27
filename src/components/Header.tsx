import React from "react";
import { ArrowLeft, BarChart3, LogIn, LogOut, UserCircle } from "lucide-react";
import { ActiveView } from "../types";
import { useFirebase } from "../context/FirebaseContext";
import { useLanguage } from "../context/LanguageContext";

interface HeaderProps {
  currentView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  persona: "citizen" | "operator";
  onTogglePersona: (persona: "citizen" | "operator") => void;
  operatorAccess: "none" | "demo" | "real";
}

export default function Header({ currentView, onNavigate, persona, onTogglePersona, operatorAccess }: HeaderProps) {
  const { user, signInWithGoogle, signOutUser, loading } = useFirebase();
  const { language, setLanguage } = useLanguage();
  const signedInWithGoogle = !!user && !user.isAnonymous;
  const canShowOperatorDesk = operatorAccess !== "none";

  return (
    <header
      className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-ink px-3 pb-3 font-sans shadow-[0_2px_15px_-3px_rgba(0,0,0,0.5)] sm:px-5"
      style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {currentView !== "landing" && persona === "citizen" && (
          <button
            id="back-button"
            onClick={() => onNavigate("landing")}
            className="mr-0.5 flex items-center justify-center rounded-full p-2 transition-colors hover:bg-white/10"
            style={{ minWidth: "44px", minHeight: "44px" }}
            aria-label="Go back to landing page"
          >
            <ArrowLeft className="h-4 w-4 text-paper" />
            <span className="sr-only">Back</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="flex h-6 w-1 flex-col overflow-hidden rounded-full" aria-hidden="true">
            <div className="flex-1 bg-[#EE9B2D]" />
            <div className="flex-1 bg-white" />
            <div className="flex-1 bg-[#0FB5A6]" />
          </div>

          <div>
            <h1 className="flex items-center gap-0.5 text-xl font-black tracking-normal text-white">
              Civic<span className="text-marigold">Lens</span>
            </h1>
            <p className="text-sm font-medium leading-tight text-[#94a3b8]">
              {persona === "citizen"
                ? "India prototype reports"
                : operatorAccess === "real"
                  ? "Server-authorized operator"
                  : "Synthetic demo desk"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex select-none rounded-lg border border-white/10 bg-white/5 p-0.5 text-sm font-bold">
          <button
            id="lang-en-btn"
            onClick={() => setLanguage("en")}
            className={`min-h-[44px] min-w-[44px] rounded-md px-2 py-1 transition-all ${
              language === "en" ? "bg-marigold text-ink shadow-sm" : "text-[#94a3b8] hover:text-white"
            }`}
            aria-label="Switch language to English"
            aria-pressed={language === "en"}
          >
            EN
          </button>
          <button
            id="lang-hi-btn"
            onClick={() => setLanguage("hi")}
            className={`min-h-[44px] min-w-[44px] rounded-md px-2 py-1 transition-all ${
              language === "hi" ? "bg-marigold text-ink shadow-sm" : "text-[#94a3b8] hover:text-white"
            }`}
            aria-label="Switch language to Hindi"
            aria-pressed={language === "hi"}
          >
            HI
          </button>
        </div>

        <div className="hidden select-none rounded-lg border border-white/10 bg-white/5 p-0.5 text-sm font-bold sm:flex">
          <button
            id="persona-citizen-pill"
            onClick={() => onTogglePersona("citizen")}
            className={`min-h-[44px] rounded-md px-3 py-1 transition-all ${
              persona === "citizen" ? "bg-marigold text-ink shadow-sm" : "text-[#94a3b8] hover:text-white"
            }`}
            aria-label="Switch to citizen report view"
            aria-pressed={persona === "citizen"}
          >
            Citizen
          </button>
          {canShowOperatorDesk && (
            <button
              id="persona-operator-pill"
              onClick={() => onTogglePersona("operator")}
              className={`min-h-[44px] rounded-md px-3 py-1 transition-all ${
                persona === "operator" ? "bg-marigold text-ink shadow-sm" : "text-[#94a3b8] hover:text-white"
              }`}
              aria-label={operatorAccess === "real" ? "Switch to server-authorized operator desk" : "Switch to synthetic demo desk"}
              aria-pressed={persona === "operator"}
            >
              {operatorAccess === "real" ? "Operator" : "Demo"}
            </button>
          )}
        </div>

        {persona === "citizen" && (
          <button
            id="header-dashboard-button"
            onClick={() => onNavigate("dashboard")}
            className={`flex min-h-[44px] items-center gap-1 rounded-lg border px-3 py-1 transition-all ${
              currentView === "dashboard"
                ? "border-marigold/40 bg-marigold/10 text-marigold"
                : "border-transparent text-paper hover:bg-white/10"
            }`}
            title="City Impact Dashboard"
            aria-label="Open impact dashboard"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="text-sm font-bold">Stats</span>
          </button>
        )}

        {loading ? (
          <div className="h-6 w-6 rounded-full bg-white/10 animate-pulse" />
        ) : (
          <button
            type="button"
            onClick={() => signedInWithGoogle ? signOutUser() : signInWithGoogle()}
            className="flex min-h-[44px] items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-paper transition-colors hover:bg-white/10 hover:text-white"
            title={signedInWithGoogle ? "Sign out" : "Sign in with Google"}
            aria-label={signedInWithGoogle ? "Sign out" : "Sign in with Google"}
          >
            {signedInWithGoogle ? <LogOut className="h-3.5 w-3.5 text-marigold" /> : <LogIn className="h-3.5 w-3.5 text-marigold" />}
            <UserCircle className="h-5 w-5 text-marigold" />
          </button>
        )}
      </div>
    </header>
  );
}
