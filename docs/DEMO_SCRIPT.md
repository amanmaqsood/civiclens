# CivicLens Demo Video Teleprompter

Use this for the final hackathon demo recording. Keep the tone confident, clear, and truthful. CivicLens is an independent civic pilot, not a government portal.

Recommended length: 3 minutes. Record at 1280x720 or 1920x1080. Use the live app: https://civiclens-py7ixxgroq-as.a.run.app

## Recording Setup

Before recording:

1. Open the live app in a clean browser tab.
2. Keep the sample pothole image ready: `E:\Pro\Community hero\images (1).jpg`.
3. Keep this script visible on a second screen or phone.
4. Use zoom level 90-100 percent.
5. Record cursor movement slowly; pause 1-2 seconds after each important screen.
6. Do not show secrets, billing pages, private email inboxes, cloud console tokens, or private keys.
7. If a live Gemini step takes a moment, say: "Gemini is analyzing the field evidence and returning structured civic context."

## 3-Minute Core Script

### 0:00-0:15 - Opening

Show: homepage / citizen view.

Say:

"Assalamu alaikum. This is CivicLens, our Google Hackathon Community Hero project. It helps residents turn local civic issues into clear, evidence-led cases using Gemini, Firebase, Google Maps, and Cloud Run. It is an independent civic pilot, not a government portal, and it does not submit complaints externally."

### 0:15-0:35 - Problem

Show: map/feed/dashboard hints if visible.

Say:

"The problem is simple: local issues like potholes, water leaks, broken streetlights, and unsafe paths are often reported through scattered channels. Reports may miss location context, duplicate awareness, closure proof, or public status visibility. CivicLens organizes that journey from field evidence to review-ready action."

### 0:35-1:15 - Citizen Report Flow

Show:

1. Click report/new field report.
2. Upload the pothole image from gallery.
3. Use manual location or Google Places.
4. Type a short description.
5. Save/run Gemini triage.

Say:

"A citizen starts with a photo, a location, and a short description. If GPS is blocked, Google Places and manual pinning keep the report usable. Gemini then analyzes the image and text, classifies the issue, estimates severity and urgency, and creates a structured summary the citizen can review before saving."

If Gemini result appears:

"Here, Gemini has converted raw field evidence into a civic report: category, severity, urgency, summary, and rationale. The citizen remains in control before the report is stored."

### 1:15-1:45 - Duplicate and Public Case

Show:

1. Saved result or duplicate page.
2. CivicLens Ticket ID.
3. Evidence-linked or issue detail page.

Say:

"CivicLens also checks nearby reports so the same pothole does not become five disconnected tickets. Similar reports can be linked as supporting evidence, which increases community urgency without creating duplicate noise. The public case page shows the CivicLens Ticket ID, report evidence, status, and accountability history."

### 1:45-2:20 - Operator and Agent Evidence

Show:

1. Operator synthetic desk.
2. Select a synthetic case.
3. Show server agent trace / ledger / approvals.

Say:

"On the review side, operators get a dense workspace. The important part is that the workflow is server-owned and persisted. Agent runs and tool steps are stored in Firestore, so the trace survives refresh and can be audited later. Gemini helps draft and reason, but human approval is required for consequential actions like merge, routing, escalation, resolve, or reopen."

### 2:20-2:45 - Advanced Differentiators

Show:

1. Dashboard.
2. Leaderboard/Open311/predictive area.
3. If available, issue detail with ghost forensics or ledger.

Say:

"CivicLens goes beyond a form. It includes multilingual voice intake, ghost-closure forensics for suspicious repair claims, trust-weighted community verification, brigading protection, SLA and follow-up workers, Open311 export, predictive hotspots, and a weekly civic leaderboard. These features are verified on the live Cloud Run deployment."

### 2:45-3:00 - Close

Show: dashboard or homepage with CivicLens brand visible.

Say:

"The goal is not to replace public authorities. The goal is better civic evidence, fewer duplicate reports, transparent Gemini assistance, and human-governed review trails that communities can use responsibly. This is CivicLens: community reporting made clearer, verifiable, and action-ready with Google technologies."

## Optional 5-Minute Extended Beats

Use these only if the allowed demo length is longer.

### Multilingual Voice Intake

Show: report page voice input.

Say:

"For low-literacy or mobile-first users, CivicLens supports multilingual voice intake. Gemini transcribes, translates, extracts the issue category, and produces a readback so the citizen can confirm the report."

### Ghost Closure Forensics

Show: issue detail with ghost-closure forensics card.

Say:

"A common civic failure is false closure: a case is marked repaired, but the street is still unsafe. CivicLens compares original evidence, claimed repair evidence, and fresh audit evidence. If the fresh audit contradicts the closure claim, the system recommends reopening for human review."

### Trust Economy

Show: trust/verification UI if available.

Say:

"Community verification is not counted as one person, one identical vote. CivicLens weights confirmations by trust signals and collapses suspicious low-trust clusters. That helps prevent brigading while still giving residents a voice."

### SLA, Follow-Up, and RTI-Style Draft

Show: SLA/follow-up/RTI ledger.

Say:

"For unresolved cases, background workers can advance an escalation ladder, recommend follow-up, and generate an RTI-style draft. It remains review material; the app does not claim legal filing or government submission."

### Open311 and Dispatch

Show: dashboard Open311 export and dispatch ledger.

Say:

"CivicLens can export Open311 GeoReport-compatible data and can dispatch a human-approved escalation to a configured webhook. This makes the prototype feel connected to real civic interoperability rather than just a static demo."

## Screen Recording Checklist

- Show live URL in the address bar once.
- Show the CivicLens name in the first 10 seconds.
- Show at least one Gemini output.
- Show at least one Google Maps or Places location interaction.
- Show a persisted case or ticket ID.
- Show operator review or stored agent trace.
- Show dashboard/Open311/predictive/leaderboard.
- Say clearly that humans approve consequential decisions.
- Avoid showing private cloud console billing, secrets, or private account screens.

## Submission Links

- Public app URL: https://civiclens-py7ixxgroq-as.a.run.app
- GitHub repository: https://github.com/amanmaqsood/civiclens
- Google Doc: https://docs.google.com/document/d/19nFBVMLHUOqlKipMi7tsML25BW2h_Q2s82cQukuzlMk/edit?usp=sharing
- Demo video: add the final published video link.
