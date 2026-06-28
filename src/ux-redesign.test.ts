import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("UX redesign contract", () => {
  it("keeps the responsive shell and mobile actions wired", () => {
    const app = readProjectFile("src/App.tsx");
    const bottomNav = readProjectFile("src/components/AppBottomNav.tsx");
    const floatingAction = readProjectFile("src/components/FloatingReportAction.tsx");
    const header = readProjectFile("src/components/Header.tsx");

    expect(app).toContain("AppBottomNav");
    expect(app).toContain("FloatingReportAction");
    expect(app).toContain('id="operator-command-center"');
    expect(app).not.toContain("flex-1 overflow-y-auto pb-28");
    expect(bottomNav).toContain('id="mobile-bottom-nav"');
    expect(floatingAction).toContain('id="floating-report-cta"');
    expect(header).toContain("sticky top-0");
    expect(header).toContain("z-50");
    expect(header).toContain('id="header-account-button"');
    expect(header).toContain('id="account-menu"');
    expect(header).toContain('id="account-auth-error"');
    expect(header).toContain("Citizen session");
    expect(header).toContain("Operator access status");
    expect(header).toContain("Public access");
    expect(header).toContain("Anonymous reporting is active");
    expect(header).toContain("Google sign-in is hidden until Firebase Authorized Domains are verified");
    expect(header).toContain("flex flex-nowrap");
    expect(header).toContain("English active. Hindi coming soon.");
    expect(header).not.toContain('id="lang-hi-btn"');
    expect(header).not.toContain('setLanguage("hi")');
    expect(header).not.toContain("Google sign-in unavailable");
    expect(header).not.toContain("disabled={!signedInWithGoogle}");
    expect(header).not.toContain("<LogIn");
  });

  it("keeps the landing page map-first and truthful about synthetic demo data", () => {
    const landing = readProjectFile("src/components/LandingPage.tsx");

    expect(landing).toContain("CivicLens Field Command Center");
    expect(landing).toContain("Review case stories");
    expect(landing).toContain("Demo stories");
    expect(landing).toContain("Synthetic demo visible");
    expect(landing).toContain("slice(0, 3)");
    expect(landing).toContain("defaultStories");
    expect(landing).toContain("visibleIssues.length");
    expect(landing).toContain('id="show-all-demo-data"');
    expect(landing).toContain("isInternalSmokeTestIssue");
    expect(landing).toContain("They are not live civic complaints");
    expect(landing).toContain("Independent civic pilot. Drafts stay inside CivicLens until a human acts outside the app.");
  });

  it("records static-audit release fixes for orphaned actions and inconsistent controls", () => {
    const app = readProjectFile("src/App.tsx");
    const bottomNav = readProjectFile("src/components/AppBottomNav.tsx");
    const floatingAction = readProjectFile("src/components/FloatingReportAction.tsx");
    const operatorDetail = readProjectFile("src/components/OperatorDetailView.tsx");
    const operatorQueue = readProjectFile("src/components/OperatorQueue.tsx");
    const status = readProjectFile("src/constants/status.ts");
    const onboarding = readProjectFile("src/components/Onboarding.tsx");
    const audit = readProjectFile("audit.md");

    expect(audit).toContain("CivicLens UI");
    expect(app).toContain("AppBottomNav");
    expect(bottomNav).toContain("handleDeskToggle");
    expect(bottomNav).toContain('onNavigate("landing")');
    expect(floatingAction).toContain('"landing"');
    expect(operatorDetail).not.toContain("alert(");
    expect(operatorDetail).toContain('role="alert"');
    expect(operatorQueue).toContain('accessMode === "demo"');
    expect(status).toContain("issueStatusToneClass");
    expect(onboarding).toContain("Go to onboarding step");
    expect(onboarding).toContain("min-h-[44px]");
  });

  it("keeps the report flow stepper, location denial, and manual pin fallback", () => {
    const report = readProjectFile("src/components/ReportPage.tsx");
    const clarification = readProjectFile("src/components/ReportClarificationView.tsx");

    expect(report).toContain('id="report-stepper"');
    expect(report).toContain("Use my current location");
    expect(report).toContain('id="manual-pin-fallback"');
    expect(report).toContain("Drop pin manually");
    expect(report).toContain("Continue with approximate location");
    expect(report).toContain("Location permission is blocked or unavailable. Search for a location, drop a pin manually, or type a nearby landmark.");
    expect(report).toContain("MANUAL_LOCATION_SUGGESTIONS");
    expect(report).toContain("Indiranagar Metro Station");
    expect(report).toContain("manualLocationSuggestions");
    expect(report).toContain("matches.slice(0, query ? 5 : 3)");
    expect(report).toContain("handleSelectManualLocation");
    expect(report).toContain('id="manual-location-search"');
    expect(report).toContain('id="manual-location-suggestions"');
    expect(report).toContain("Search location manually");
    expect(report).toContain("setManualAddress(suggestion.address)");
    expect(report).toContain("lat: suggestion.lat");
    expect(report).toContain("lng: suggestion.lng");
    expect(report).toContain("Use a live photo on site, or upload an existing image from your gallery.");
    expect(report).toContain('id="report-live-photo-input"');
    expect(report).toContain('id="report-gallery-upload-input"');
    expect(report).toContain("Take live photo");
    expect(report).toContain("Upload from gallery");
    const reportLiveInput = report.slice(report.indexOf('id="report-live-photo-input"'), report.indexOf('id="report-gallery-upload-input"'));
    const reportGalleryInput = report.slice(report.indexOf('id="report-gallery-upload-input"'), report.indexOf("{!image ?"));
    expect(reportLiveInput).toContain('accept="image/*"');
    expect(reportLiveInput).toContain('capture="environment"');
    expect(reportGalleryInput).toContain('accept="image/*"');
    expect(reportGalleryInput).not.toContain("capture=");
    expect(clarification).toContain("Low-confidence Gemini triage");
  });

  it("keeps success copy, persisted agent trace, closure upload choices, and operator demo boundary visible", () => {
    const trace = readProjectFile("src/components/AgentTraceTimeline.tsx");
    const detail = readProjectFile("src/components/IssueDetailPage.tsx");
    const queue = readProjectFile("src/components/OperatorQueue.tsx");
    const closure = readProjectFile("src/components/ClosureVerificationPanel.tsx");
    const success = readProjectFile("src/components/SuccessPage.tsx");

    expect(trace).toContain("Agent tool timeline");
    expect(trace).toContain("Persisted server run");
    expect(trace).toContain("Local report progress");
    expect(trace).toContain("request_human_approval");
    expect(detail).toContain("fetchLatestAgentRun(issue.id)");
    expect(detail).toContain("This public detail page only displays persisted server-generated tool records");
    expect(detail).toContain("Persisted run");
    expect(detail).not.toContain("runAgentForIssue(issue.id)");
    expect(detail).not.toContain("ResolutionPlanWidget");
    expect(detail).not.toContain("AutoEscalationPanel");
    expect(detail).toContain("finiteNumber(issue.confidence)");
    expect(detail).toContain("hasCoordinates");
    const operatorDetail = readProjectFile("src/components/OperatorDetailView.tsx");
    expect(operatorDetail).toContain("runAgentForIssue(issue.id, { demoOperator })");
    expect(operatorDetail).toContain("Persisted agent workflow");
    expect(operatorDetail).toContain("Written rationale is required");
    expect(operatorDetail).toContain("approvalRationale.trim().length === 0");
    expect(queue).toContain("Demo actions are server-limited");
    expect(closure).toContain("recommendation");
    expect(closure).toContain('id="after-image-live-photo-input"');
    expect(closure).toContain('id="after-image-gallery-upload-input"');
    expect(closure).toContain('capture="environment"');
    const closureGalleryInput = closure.slice(closure.indexOf('id="after-image-gallery-upload-input"'), closure.indexOf("<div className=\"flex flex-col items-center"));
    expect(closureGalleryInput).toContain('accept="image/*"');
    expect(closureGalleryInput).not.toContain("capture=");
    expect(closure).not.toContain("auto-resolve");
    expect(success).toContain("CivicLens Ticket ID");
    expect(success).not.toContain("Ticket Registration Number");
    expect(success).toContain("Pilot record - not a government filing");
  });

  it("keeps incomplete Hindi localization honest instead of exposing a fake toggle", () => {
    const languageContext = readProjectFile("src/context/LanguageContext.tsx");
    const header = readProjectFile("src/components/Header.tsx");
    const detail = readProjectFile("src/components/IssueDetailPage.tsx");
    const report = readProjectFile("src/components/ReportPage.tsx");
    const i18n = readProjectFile("src/i18n.ts");

    expect(languageContext).toContain("HINDI_LOCALIZATION_AVAILABLE = false");
    expect(languageContext).toContain('return lang === "hi" && !HINDI_LOCALIZATION_AVAILABLE ? "en" : lang;');
    expect(header).toContain("Hindi coming soon");
    expect(detail).toContain("Hindi coming soon");
    expect(header).not.toContain('id="lang-hi-btn"');
    expect(detail).not.toContain('setLang("hi")');
    expect(report).toContain("English Active");
    expect(report).not.toContain("Hindi active");
    expect(i18n).toContain("English transcription is active in this build.");
  });

  it("keeps duplicate comparison readable and free of corrupted metadata glyphs", () => {
    const duplicate = readProjectFile("src/components/DuplicateCheckPage.tsx");

    expect(duplicate).toContain("Add my report as evidence to this case");
    expect(duplicate).toContain("Report as a new issue");
    expect(duplicate).toContain("Cancel and edit report");
    expect(duplicate).toContain("Ticket: {candidate.ticketId} - reported");
    expect(duplicate).toContain("text-base font-bold");
    expect(duplicate).not.toContain("text-[10px]");
    expect(duplicate).not.toContain("text-[11px]");
    expect(duplicate).not.toContain("text-[9px]");
    expect(duplicate).not.toContain("â");
  });

  it("waits for Firebase anonymous auth before protected API calls", () => {
    const api = readProjectFile("src/services/api.ts");
    const app = readProjectFile("src/App.tsx");
    const issues = readProjectFile("src/services/issues.ts");

    expect(api).toContain("authStateReady");
    expect(api).toContain("signInAnonymously(auth)");
    expect(api).toContain("getFirebaseIdTokenForApi");
    expect(app).toContain("fetchIssueById(selectedIssueId)");
    expect(app).toContain('mode="local-progress"');
    expect(issues).toContain("export async function fetchIssueById");
  });
});
