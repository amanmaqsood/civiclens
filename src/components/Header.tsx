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
    <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-2">
        {currentView !== "landing" && persona === "citizen" && (
          <button
            id="back-button"
            onClick={() => onNavigate("landing")}
            className="flex items-center justify-center p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer mr-1"
            style={{ minWidth: "44px", minHeight: "44px" }}
            aria-label="Go back to landing page"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
            <span className="sr-only">Back</span>
          </button>
        )}
        
        <div className="flex items-center gap-2">
          {/* Subtle civic symbol: Tricolor pillar in vertical slice */}
          <div className="flex flex-col w-1.5 h-7 rounded-full overflow-hidden" aria-hidden="true">
            <div className="bg-[#F59E0B] flex-1" /> {/* Saffron */}
            <div className="bg-white flex-1" />
            <div className="bg-emerald-600 flex-1" /> {/* Green */}
          </div>
          
          <div>
            <h1 className="text-lg font-sans font-bold tracking-tight text-slate-900 flex items-center gap-0.5">
              Civic<span className="text-[#4F46E5]">Lens</span>
            </h1>
            <p className="text-[9px] font-sans font-medium text-slate-500 uppercase tracking-wider leading-none">
              India • {persona === "citizen" ? "Citizen Hub" : "Simulated Agency View"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Switch segmented pill */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-sans font-bold select-none">
          <button
            id="persona-citizen-pill"
            onClick={() => onTogglePersona("citizen")}
            className={`px-2 py-1 rounded-md cursor-pointer transition-all ${persona === "citizen" ? "bg-white text-indigo-600 shadow-3xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            Citizen
          </button>
          <button
            id="persona-operator-pill"
            onClick={() => onTogglePersona("operator")}
            className={`px-2 py-1 rounded-md cursor-pointer transition-all ${persona === "operator" ? "bg-white text-indigo-600 shadow-3xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            Operator
          </button>
        </div>

        {persona === "citizen" && (
          <button
            id="header-dashboard-button"
            onClick={() => onNavigate("dashboard")}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 my-0.5 transition-all cursor-pointer ${
              currentView === "dashboard"
                ? "bg-indigo-50 text-[#4F46E5] border-indigo-100/80"
                : "text-slate-600 border-transparent hover:bg-slate-100"
            }`}
            title="City Impact Dashboard"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="text-[10px] font-sans font-bold">Dashboard</span>
          </button>
        )}

        {loading ? (
          <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
        ) : (
          <div className="flex items-center">
            <UserCircle className="w-7 h-7 text-[#4F46E5]" />
          </div>
        )}
      </div>
    </header>
  );
}
