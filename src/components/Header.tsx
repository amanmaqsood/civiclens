import React from "react";
import { ArrowLeft, UserCircle, BarChart3 } from "lucide-react";
import { ActiveView } from "../types";
import { useFirebase } from "../context/FirebaseContext";

interface HeaderProps {
  currentView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  persona: "citizen" | "operator";
  onTogglePersona: (persona: "citizen" | "operator") => void;
}

export default function Header({ currentView, onNavigate, persona, onTogglePersona }: HeaderProps) {
  const { user, signInWithGoogle, signOutUser, loading } = useFirebase();

  return (
    <header 
      className="sticky top-0 z-40 bg-ink border-b border-white/10 px-4 pb-3 flex items-center justify-between shadow-[0_2px_15px_-3px_rgba(0,0,0,0.5)] font-sans"
      style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
    >
      <div className="flex items-center gap-2">
        {currentView !== "landing" && persona === "citizen" && (
          <button
            id="back-button"
            onClick={() => onNavigate("landing")}
            className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer mr-0.5"
            style={{ minWidth: "36px", minHeight: "36px" }}
            aria-label="Go back to landing page"
          >
            <ArrowLeft className="w-4 h-4 text-paper" />
            <span className="sr-only">Back</span>
          </button>
        )}
        
        <div className="flex items-center gap-2">
          {/* Subtle elegant civic indicator */}
          <div className="flex flex-col w-1 h-6 rounded-full overflow-hidden" aria-hidden="true">
            <div className="bg-[#EE9B2D] flex-1" />
            <div className="bg-white flex-1" />
            <div className="bg-[#0FB5A6] flex-1" />
          </div>
          
          <div>
            <h1 className="text-base font-display font-black tracking-tight text-white flex items-center gap-0.5">
              Civic<span className="text-marigold">Lens</span>
            </h1>
            <p className="text-[10px] font-mono font-medium text-slate/80 uppercase tracking-widest leading-none">
              {persona === "citizen" ? "India · Citizen Reports" : "India · Operator Portal"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Switch segmented pill */}
        <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10 text-[9.5px] font-sans font-bold select-none">
          <button
            id="persona-citizen-pill"
            onClick={() => onTogglePersona("citizen")}
            className={`px-2 py-1 rounded-md cursor-pointer transition-all ${
              persona === "citizen" 
                ? "bg-marigold text-ink shadow-sm" 
                : "text-slate hover:text-white"
            }`}
          >
            Citizen
          </button>
          <button
            id="persona-operator-pill"
            onClick={() => onTogglePersona("operator")}
            className={`px-2 py-1 rounded-md cursor-pointer transition-all ${
              persona === "operator" 
                ? "bg-marigold text-ink shadow-sm" 
                : "text-slate hover:text-white"
            }`}
          >
            Operator
          </button>
        </div>

        {persona === "citizen" && (
          <button
            id="header-dashboard-button"
            onClick={() => onNavigate("dashboard")}
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
              currentView === "dashboard"
                ? "bg-marigold/10 text-marigold border-marigold/40"
                : "text-paper border-transparent hover:bg-white/10"
            }`}
            title="City Impact Dashboard"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="text-[10px] font-sans font-bold">Stats</span>
          </button>
        )}

        {loading ? (
          <div className="w-6 h-6 rounded-full bg-white/10 animate-pulse" />
        ) : (
          <div className="flex items-center">
            <UserCircle className="w-6 h-6 text-marigold" />
          </div>
        )}
      </div>
    </header>
  );
}
