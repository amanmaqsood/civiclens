import React from "react";
import { BarChart3, ClipboardList, Home, MapPinned, ShieldCheck } from "lucide-react";
import { ActiveView } from "../types";
import { useLanguage } from "../context/LanguageContext";

interface AppBottomNavProps {
  currentView: ActiveView;
  persona: "citizen" | "operator";
  operatorAccess: "none" | "demo" | "real";
  onNavigate: (view: ActiveView) => void;
  onTogglePersona: (persona: "citizen" | "operator") => void;
}

export default function AppBottomNav({
  currentView,
  persona,
  operatorAccess,
  onNavigate,
  onTogglePersona,
}: AppBottomNavProps) {
  const { t } = useLanguage();
  const canUseDesk = operatorAccess !== "none";
  const handleDeskToggle = () => {
    if (persona === "operator") {
      onTogglePersona("citizen");
      onNavigate("landing");
      return;
    }
    onNavigate("landing");
    onTogglePersona("operator");
  };

  const itemClass = (active: boolean) =>
    `min-h-[52px] flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-sm font-semibold transition-colors ${
      active ? "bg-ink text-paper shadow-sm" : "text-[#334155] hover:bg-paper hover:text-ink"
    }`;

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-white/95 px-3 py-2 shadow-[0_-10px_30px_-24px_rgba(14,26,43,0.55)] backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
    >
      <div className="mx-auto flex max-w-md gap-1">
        <button
          type="button"
          onClick={() => {
            onTogglePersona("citizen");
            onNavigate("landing");
          }}
          aria-current={persona === "citizen" && currentView === "landing" ? "page" : undefined}
          className={itemClass(persona === "citizen" && currentView === "landing")}
        >
          <MapPinned className="h-5 w-5" />
          <span>{t("nav.map")}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onTogglePersona("citizen");
            onNavigate("report");
          }}
          aria-current={persona === "citizen" && currentView === "report" ? "page" : undefined}
          className={itemClass(persona === "citizen" && currentView === "report")}
        >
          <ClipboardList className="h-5 w-5" />
          <span>{t("nav.report")}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onTogglePersona("citizen");
            onNavigate("dashboard");
          }}
          aria-current={persona === "citizen" && currentView === "dashboard" ? "page" : undefined}
          className={itemClass(persona === "citizen" && currentView === "dashboard")}
        >
          <BarChart3 className="h-5 w-5" />
          <span>{t("nav.metrics")}</span>
        </button>
        {canUseDesk && (
          <button
            type="button"
            id="mobile-operator-nav"
            onClick={handleDeskToggle}
            aria-current={persona === "operator" ? "page" : undefined}
            className={itemClass(persona === "operator")}
          >
            {persona === "operator" ? <Home className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            <span>{operatorAccess === "real" ? t("nav.desk") : t("nav.demo")}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
