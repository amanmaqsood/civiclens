import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, BarChart3, ChevronDown, Languages, LogIn, LogOut, Moon, ShieldCheck, Sun, UserCircle } from "lucide-react";
import { ActiveView } from "../types";
import { useFirebase } from "../context/FirebaseContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

interface HeaderProps {
  currentView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  persona: "citizen" | "operator";
  onTogglePersona: (persona: "citizen" | "operator") => void;
  operatorAccess: "none" | "demo" | "real";
}

export default function Header({ currentView, onNavigate, persona, onTogglePersona, operatorAccess }: HeaderProps) {
  const { user, signInWithGoogle, signOutUser, loading } = useFirebase();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [authActionPending, setAuthActionPending] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const signedInWithGoogle = !!user && !user.isAnonymous;
  const canShowOperatorDesk = operatorAccess !== "none";
  const citizenSessionLabel = signedInWithGoogle ? t("account.googleSignedIn") : user ? t("account.anonymousActive") : t("account.starting");
  const operatorAccessLabel = operatorAccess === "real" ? "real" : operatorAccess === "demo" ? "demo" : "none";

  useEffect(() => {
    if (!accountOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountOpen]);

  const handleAuthAction = async () => {
    setAccountError(null);
    setAuthActionPending(true);
    try {
      if (signedInWithGoogle) {
        await signOutUser();
        setAccountOpen(false);
      } else {
        await signInWithGoogle();
      }
    } catch (error) {
      setAccountOpen(true);
      setAccountError(signedInWithGoogle ? t("account.signOutError") : t("account.signInError"));
    } finally {
      setAuthActionPending(false);
    }
  };

  return (
    <header
      className="sticky top-0 z-50 flex flex-nowrap items-center justify-between gap-2 border-b border-white/10 bg-ink px-3 pb-2 font-sans shadow-[0_2px_15px_-3px_rgba(0,0,0,0.5)] sm:gap-3 sm:px-5 sm:pb-3"
      style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
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

          <div className="min-w-0">
            <h1 className="flex truncate text-lg font-black tracking-normal text-white sm:text-xl">
              Civic<span className="text-marigold">Lens</span>
            </h1>
            <p className="block max-w-[12.5rem] truncate text-xs font-medium leading-tight text-[#CBD5E1] sm:max-w-[18rem] sm:text-sm lg:max-w-[28rem]">
              {persona === "citizen" ? t("app.subtitle") : operatorAccess === "real" ? "Server-authorized operator" : "Synthetic demo desk"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
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
            <span className="hidden text-sm font-bold sm:inline">{t("nav.stats")}</span>
          </button>
        )}

        <button
          id="header-theme-toggle"
          type="button"
          onClick={toggleTheme}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/10 bg-white/5 text-paper transition-colors hover:bg-white/10 hover:text-white"
          title={theme === "dark" ? "Use light theme" : "Use dark theme"}
          aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
          aria-pressed={theme === "dark"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4 text-marigold" /> : <Moon className="h-4 w-4 text-marigold" />}
        </button>

        {loading ? (
          <div className="h-6 w-6 rounded-full bg-white/10 animate-pulse" />
        ) : (
          <div ref={accountMenuRef} className="relative">
            <button
              id="header-account-button"
              type="button"
              onClick={() => {
                if (!accountOpen) setAccountError(null);
                setAccountOpen((open) => !open);
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-paper transition-colors hover:bg-white/10 hover:text-white"
              title={t("account.open")}
              aria-label={t("account.open")}
              aria-haspopup="dialog"
              aria-expanded={accountOpen}
              aria-controls="account-menu"
            >
              <UserCircle className="h-5 w-5 text-marigold" />
              <span className="hidden text-sm font-bold sm:inline">Session</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${accountOpen ? "rotate-180" : ""}`} />
            </button>

            {accountOpen && (
              <div
                id="account-menu"
                role="dialog"
                aria-label="Account menu"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-hairline bg-white p-3 text-ink shadow-xl"
              >
                <div className="flex items-start gap-2 rounded-xl bg-paper p-3">
                  <UserCircle className="mt-0.5 h-5 w-5 shrink-0 text-marigold" />
                  <div>
                    <p className="text-sm font-black text-ink">{t("account.title")}</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink-2">{citizenSessionLabel}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-start gap-2 rounded-xl border border-hairline p-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0F766E]" />
                  <div>
                    <p className="text-sm font-black text-ink">{t("account.operatorStatus")}: {operatorAccessLabel}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-2">
                      {t("account.operatorHelp")}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex items-start gap-2 rounded-xl border border-hairline p-3">
                  <Languages className="mt-0.5 h-5 w-5 shrink-0 text-[#0F766E]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-ink">{t("account.language")}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Language">
                      <button
                        id="lang-en-btn"
                        type="button"
                        onClick={() => setLanguage("en")}
                        aria-pressed={language === "en"}
                        className={`min-h-[44px] rounded-xl px-3 text-sm font-bold ${
                          language === "en" ? "bg-ink text-white" : "border border-hairline bg-white text-ink"
                        }`}
                      >
                        {t("account.english")}
                      </button>
                      <button
                        id="lang-hi-btn"
                        type="button"
                        onClick={() => setLanguage("hi")}
                        aria-pressed={language === "hi"}
                        className={`min-h-[44px] rounded-xl px-3 text-sm font-bold ${
                          language === "hi" ? "bg-ink text-white" : "border border-hairline bg-white text-ink"
                        }`}
                      >
                        {t("account.hindi")}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-2 rounded-xl border border-hairline p-3">
                  <p className="text-sm font-black text-ink">{signedInWithGoogle ? t("account.googleSession") : t("account.publicAccess")}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-2">
                    {signedInWithGoogle ? t("account.googleActiveHelp") : t("account.googleHelp")}
                  </p>
                  {accountError && (
                    <p
                      id="account-auth-error"
                      role="alert"
                      className="mt-2 rounded-lg border border-alert/20 bg-alert/10 p-2 text-sm font-semibold leading-relaxed text-alert"
                    >
                      {accountError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleAuthAction}
                    disabled={authActionPending}
                    className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-base font-bold text-white hover:bg-[#1f314d] disabled:cursor-wait disabled:opacity-70"
                  >
                    {signedInWithGoogle ? <LogOut className="h-4 w-4 text-marigold" /> : <LogIn className="h-4 w-4 text-marigold" />}
                    {authActionPending ? t("account.signingIn") : signedInWithGoogle ? t("account.signOut") : t("account.signIn")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
