import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set payload size limit for base64 image uploads
  app.use(express.json({ limit: "15mb" }));

  // Initialize Gemini client on the server
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  function isRetryableError(err: any): boolean {
    if (!err) return false;
    const errMsg = String(err.message || err.statusText || "").toUpperCase();
    const status = err.status || err.statusCode || err.code;
    return (
      status === 503 ||
      status === 429 ||
      status === "UNAVAILABLE" ||
      status === "RESOURCE_EXHAUSTED" ||
      errMsg.includes("503") ||
      errMsg.includes("429") ||
      errMsg.includes("UNAVAILABLE") ||
      errMsg.includes("RESOURCE_EXHAUSTED") ||
      errMsg.includes("RATE_LIMIT") ||
      errMsg.includes("QUOTA")
    );
  }

  async function generateContentWithRetry(aiClient: any, args: any): Promise<{ response: any; retried: boolean }> {
    const delays = [1500, 3000, 6000];
    let attempt = 0;
    while (true) {
      try {
        const response = await aiClient.models.generateContent(args);
        return { response, retried: attempt > 0 };
      } catch (error: any) {
        if (attempt < delays.length && isRetryableError(error)) {
          const delayTime = delays[attempt];
          console.warn(`Gemini API error (retryable): ${error.message || error}. Waiting ${delayTime}ms to retry (attempt ${attempt + 1}/3)...`);
          await sleep(delayTime);
          attempt++;
        } else {
          throw error;
        }
      }
    }
  }

  // Health check endpoint (both /health and /api/health to be robust)
  // 1. In-memory per-IP rate limiter
  const ipLimits = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
  const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute

  app.use("/api/*", (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const ipStr = Array.isArray(ip) ? ip[0] : String(ip);
    const now = Date.now();

    let limit = ipLimits.get(ipStr);
    if (!limit || now > limit.resetTime) {
      limit = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
      ipLimits.set(ipStr, limit);
    } else {
      limit.count++;
    }

    if (limit.count > RATE_LIMIT_MAX_REQUESTS) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please try again later.",
      });
    }
    next();
  });

  // 2. Security headers for all API routes
  app.use("/api/*", (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  // 3. Request size/oversized fields validation for all API routes
  app.use("/api/*", (req, res, next) => {
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      const body = req.body;
      if (body && typeof body === "object") {
        for (const key of Object.keys(body)) {
          const val = body[key];
          if (typeof val === "string") {
            const isImage = key === "image" || key === "afterImage";
            const maxLen = isImage ? 15 * 1024 * 1024 : 15000; // 15k characters limit for text fields
            if (val.length > maxLen) {
              return res.status(400).json({
                success: false,
                error: `Request field '${key}' exceeds the maximum allowed size.`,
              });
            }
          }
        }
      }
    }
    next();
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const categoriesList = ["pothole", "water_leak", "streetlight", "waste", "drainage", "road_damage", "other"];
  const urgenciesList = ["routine", "priority", "urgent"];
  const areasList = ["single_property", "street", "neighborhood", "unknown"];

  function validateSchema(data: any): boolean {
    if (!data || typeof data !== "object") return false;
    if (!categoriesList.includes(data.category)) return false;
    if (typeof data.title !== "string" || !data.title) return false;
    if (typeof data.summary !== "string" || !data.summary) return false;
    if (typeof data.severity !== "number" || data.severity < 1 || data.severity > 5) return false;
    if (!urgenciesList.includes(data.urgency)) return false;
    if (!Array.isArray(data.visibleHazards)) return false;
    if (!areasList.includes(data.affectedArea)) return false;
    if (!Array.isArray(data.privacyFlags)) return false;
    if (typeof data.confidence !== "number") return false;
    return true;
  }

  // Server-side Gemini Multimodal Report Analysis Endpoint
  app.post("/api/analyze-report", async (req, res) => {
    const { image, description } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, error: "Image payload is required." });
    }

    try {
      // Clean base64 image by removing MIME prefix if present
      const base64Data = image.split(",")[1] || image;
      const mimeType = image.match(/data:([^;]+);/)?.[1] || "image/jpeg";

      const imagePart = {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      };

      const promptText = `Analyze this civic issue photo. Additional citizen context: "${description || "None provided"}".
Output a structured description including hazards, severity, scale, and urgency. 
If confidence is low (under 0.6) or ambiguity exists, ask a targeted clarificationQuestion to verify if this is the citizen's intended issue to report.`;

      const startTime = Date.now();
      // Main Gemini Content Generation
      const mainResult = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: [imagePart, { text: promptText }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                enum: categoriesList,
                description: "The primary category of the civic issue.",
              },
              title: {
                type: Type.STRING,
                description: "A very brief, descriptive, title for the report.",
              },
              summary: {
                type: Type.STRING,
                description: "1-2 sentence concise summary of the issue.",
              },
              severity: {
                type: Type.INTEGER,
                description: "Severity rating from 1 (minor) to 5 (extreme hazard).",
              },
              urgency: {
                type: Type.STRING,
                enum: urgenciesList,
                description: "Calculated response urgency.",
              },
              visibleHazards: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of hazards, debris, or damage visible in the shot.",
              },
              affectedArea: {
                type: Type.STRING,
                enum: areasList,
                description: "Relative scale of impact.",
              },
              privacyFlags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Privacy risks identified (like license plates, readable faces).",
              },
              confidence: {
                type: Type.NUMBER,
                description: "Confidence rating of detection between 0 and 1.",
              },
              clarificationQuestion: {
                type: Type.STRING,
                description: "A targeted question to clear up ambiguities if confidence is under 0.6 (optional).",
              },
            },
            required: [
              "category",
              "title",
              "summary",
              "severity",
              "urgency",
              "visibleHazards",
              "affectedArea",
              "privacyFlags",
              "confidence",
            ],
          },
        },
      });

      const durationMs = Date.now() - startTime;
      const response = mainResult.response;
      let finalRetried = mainResult.retried;
      let fallbackUsed = false;

      const responseText = response.text || "";
      let parsedData: any;
      let parseSuccess = false;

      try {
        parsedData = JSON.parse(responseText.trim());
        if (validateSchema(parsedData)) {
          parseSuccess = true;
        }
      } catch (e) {
        console.warn("First-attempt JSON parse/validation failed. Attempting repair...");
      }

      // Repair Once Mechanism
      if (!parseSuccess) {
        fallbackUsed = true;
        try {
          const repairPrompt = `The previous attempt to generate structured JSON failed schema validation or was malformed.
Please repair the JSON and output STRICT, VALID JSON conforming exactly to the requested schema.

The schema requires:
- category: one of ${JSON.stringify(categoriesList)}
- title: string
- summary: string
- severity: integer 1-5
- urgency: one of ${JSON.stringify(urgenciesList)}
- visibleHazards: string[]
- affectedArea: one of ${JSON.stringify(areasList)}
- privacyFlags: string[]
- confidence: number (0 to 1)
- clarificationQuestion?: optional string

Malformed Response output:
${responseText}

Respond ONLY with the corrected, valid JSON object.`;

          const repairResult = await generateContentWithRetry(ai, {
            model: "gemini-3.5-flash",
            contents: repairPrompt,
            config: {
              responseMimeType: "application/json",
            },
          });

          if (repairResult.retried) {
            finalRetried = true;
          }

          parsedData = JSON.parse((repairResult.response.text || "").trim());
          if (validateSchema(parsedData)) {
            parseSuccess = true;
          }
        } catch (repairError) {
          console.error("Gemini JSON Repair attempt failed too:", repairError);
        }
      }

      const truncatedDesc = description ? (description.length > 30 ? description.slice(0, 30) + "..." : description) : "None";
      const inputDigest = `photo (${mimeType}) + description: "${truncatedDesc}"`;
      const outputSummary = parseSuccess
        ? `${parsedData.category || "issue"} · severity ${parsedData.severity || 1}/5 · ${parsedData.visibleHazards?.length || 0} hazards · ${(parsedData.confidence || 0).toFixed(2)} conf`
        : "Fallback to manual form";

      if (parseSuccess) {
        return res.json({
          success: true,
          fallback: false,
          data: parsedData,
          durationMs,
          confidence: parsedData.confidence,
          inputDigest,
          outputSummary,
          retried: finalRetried,
          fallbackUsed,
        });
      } else {
        // Fall back cleanly to manual form
        return res.json({
          success: false,
          fallback: true,
          error: "Schema validation failed, falling back to manual entry mode.",
          durationMs,
          confidence: 0,
          inputDigest,
          outputSummary,
          retried: finalRetried,
          fallbackUsed,
        });
      }
    } catch (error: any) {
      console.error("Gemini analysis error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "An error occurred during Gemini multimodal analysis.",
      });
    }
  });

  // Server-side Gemini Duplicate Checking Endpoint
  app.post("/api/check-duplicate", async (req, res) => {
    const { newReport, candidates } = req.body;

    if (!newReport || !candidates || !Array.isArray(candidates)) {
      return res.status(400).json({ success: false, error: "Missing newReport or candidates array." });
    }

    try {
      const promptText = `Compare this newly submitted civic issue report with these potential candidate duplicate issues located in close proximity.
New Report details:
- Category: ${newReport.category}
- AI Title: ${newReport.title}
- AI Summary: ${newReport.summary}

Candidate reports currently active:
${candidates.map((c: any, index: number) => `${index + 1}. Candidate ID: ${c.id}\n - Category: ${c.category}\n - Title: ${c.title || "Untitled"}\n - Summary: ${c.summary || c.description}`).join("\n\n")}

Your goal is to recommend whether the new report is a duplicate of one of the existing candidates and should be merged, or if it is a separate distinct issue that warrants a brand new incident report, or if there is some ambiguity so we should ask the user to decide.

Guidelines:
- "merge": Recommend this if the new report is clearly describing the exact same physical issue (e.g. the exact same pothole, street light, or flood) as one of the candidates.
- "ask_user": Recommend this if there is a strong possibility of it being a duplicate but some details match and others differ, so we want the user to clarify. There is minor ambiguity.
- "create_new": Recommend this if the issue is a separate, distinct occurrence (e.g. a different pothole downstream, a different broken light nearby, or a different category of issue entirely).

Output STRICT, VALID JSON conforming exactly to the response schema.`;

      const startTime = Date.now();
      const result = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendation: {
                type: Type.STRING,
                enum: ["merge", "create_new", "ask_user"],
                description: "Recommendation: merge, create_new, or ask_user.",
              },
              bestCandidateId: {
                type: Type.STRING,
                description: "The ID of the best matching candidate from the list, or empty string if recommendation is create_new.",
              },
              similarity: {
                type: Type.NUMBER,
                description: "Similarity score between 0.0 and 1.0.",
              },
              reasons: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "A few clear reasons detailing why you recommend this path.",
              },
            },
            required: ["recommendation", "bestCandidateId", "similarity", "reasons"],
          },
        },
      });

      const durationMs = Date.now() - startTime;
      const response = result.response;
      const retried = result.retried;

      const responseText = (response.text || "").trim();
      let parsedData = JSON.parse(responseText);
      
      // Map bestCandidateId from empty string/empty check to null if create_new
      if (parsedData.recommendation === "create_new" || !parsedData.bestCandidateId || parsedData.bestCandidateId === "") {
        parsedData.bestCandidateId = null;
      }

      const inputDigest = `Compare: ${newReport.category} vs ${candidates.length} candidates`;
      const outputSummary = `Rec: ${parsedData.recommendation} · similarity: ${(parsedData.similarity || 0).toFixed(2)}`;

      return res.json({ 
        success: true, 
        data: parsedData,
        durationMs,
        confidence: parsedData.similarity,
        inputDigest,
        outputSummary,
        retried
      });
    } catch (error: any) {
      console.error("Duplicate detection error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "An error occurred during Gemini duplicate analysis.",
      });
    }
  });

  // Server-side Gemini Resolution Plan Generator (with Google Search Grounding)
  app.post("/api/resolution-plan", async (req, res) => {
    const { category, title, summary, locationName, lat, lng, ticketId } = req.body;

    if (!category || !title || !summary) {
      return res.status(400).json({ success: false, error: "Missing required category, title, or summary parameters." });
    }

    try {
      const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const promptText = `Determine the responsible Indian municipal authority or department and draft a formal compliance complaint (an action packet) for this reported civic issue.
Use Google Search grounding to lookup the real-world departments, municipal corporations, or utility boards that govern this category of issues in this specific Indian city or state (based on the location/address description: "${locationName || "India"}", and coordinates if provided: lat: ${lat || "unknown"}, lng: ${lng || "unknown"}).

Issue details:
- Category: ${category}
- Title: ${title}
- Summary: ${summary}
- Official Ticket ID / Reference ID: ${ticketId || "N/A"}
- Reporting Date (Today): ${todayStr}

Perform a ground-truth lookup for this Indian location. If the city or municipality is identified (e.g. Bangalore/Bengaluru -> BBMP/BWSSB, Mumbai -> BMC, Delhi -> MCD/DJB, Pune -> PMC, Chennai -> GCC, etc.), determine:
1. The actual municipal corporation or government board responsible (recommendedAuthority).
2. The exact citizen grievance portal, email, app name, or citizen helpline toll-free number (contactChannel).
3. The official or typical citizen SLA (Service Level Agreement) in days for resolving such issue in that region (slaDays, integer).
4. A drafted formal complaint email or letter:
   - subject: A concise professional subject line
   - body: The full body of the formal letter, starting with a polite salutation (e.g., "To the Public Grievance Officer / Commissioner..."), laying out the ticket summary, citing safety concerns, precise location, and concluding with a call-to-action to resolve within the SLA.
   - bodyHindi: A translated version of the complaint body in fluent official Hindi (हिन्दी), starting with official greetings, outlining the grievance clearly, and appealing for swift remedial action.
   - summaryHindi: A brief 1-2 sentence Hindi (हिन्दी) summary of the problem, suitable for the complainant to read.
   - nextActions: 3 actionable steps for the citizen (e.g., "Post on Twitter tagging Commissioner", "Initiate phone escalation at civic helpline", "Follow up via Ward Committee").

CRITICAL COMPLIANCE DIRECTIVE:
You MUST use ONLY the actual ticketId ('${ticketId || "N/A"}') and the actual current date ('${todayStr}') for any reference numbers, complaint IDs, or reporting dates in the drafted emails/documents.
NEVER invent, simulate, or hallucinate different reference numbers, other case tracking IDs, dates, or fake past event histories/follow-ups.

Output STRICT, VALID JSON conforming exactly to this schema:
{
  "recommendedAuthority": "string",
  "contactChannel": "string",
  "slaDays": 10,
  "actionPacket": {
    "subject": "string",
    "body": "string",
    "bodyHindi": "string",
    "summaryHindi": "string",
    "nextActions": ["string", "string", "string"]
  }
}

Output ONLY valid JSON and nothing else.`;

      const startTime = Date.now();
      const result = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const durationMs = Date.now() - startTime;
      const response = result.response;
      const retried = result.retried;

      const responseText = (response.text || "").trim();
      let cleanText = responseText;
      // Strip markdown code fences if present
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

      let parsedData: any;
      try {
        parsedData = JSON.parse(cleanText);
      } catch (e) {
        // Fallback: try regex-extract JSON
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Unable to parse Gemini resolution plan result as JSON.");
        }
      }

      // Extract search grounding metadata sources
      const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const groundingSources: string[] = searchChunks
        .map((chunk: any) => chunk.web?.uri)
        .filter(Boolean);

      const uniqueSources = Array.from(new Set(groundingSources));

      // Append sources to parsed data
      parsedData.groundingSources = uniqueSources;

      const inputDigest = `${category}: "${title}"`;
      const outputSummary = `Auth: ${parsedData.recommendedAuthority} · SLA: ${parsedData.slaDays} days`;

      return res.json({ 
        success: true, 
        data: parsedData,
        durationMs,
        confidence: 0.95,
        inputDigest,
        outputSummary,
        retried
      });
    } catch (error: any) {
      console.error("Resolution plan generation error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "An error occurred during Gemini resolution plan generation.",
      });
    }
  });

  // Multimodal before/after resolution verification analyzer
  app.post("/api/verify-resolution", async (req, res) => {
    const { beforeImageUrl, afterImage, summary } = req.body;

    if (!afterImage) {
      return res.status(400).json({ success: false, error: "Missing afterImage payload." });
    }

    try {
      const contentsList: any[] = [];

      // 1. Process beforeImageUrl (with SSRF protection checking host safety)
      if (beforeImageUrl && /^https:\/\/firebasestorage\.googleapis\.com\//.test(beforeImageUrl)) {
        try {
          const fetchRes = await fetch(beforeImageUrl, {
            signal: AbortSignal.timeout(8000),
          });
          if (fetchRes.ok) {
            const contentType = fetchRes.headers.get("content-type") || "";
            if (contentType.startsWith("image/")) {
              const buffer = await fetchRes.arrayBuffer();
              const base64 = Buffer.from(buffer).toString("base64");
              contentsList.push({
                inlineData: {
                  mimeType: contentType,
                  data: base64,
                },
              });
            } else {
              console.warn("SSRF protection: ignored non-image content type:", contentType);
            }
          }
        } catch (fetchErr) {
          console.warn("Failed to fetch beforeImageUrl to base64, proceeding without it:", fetchErr);
        }
      }

      // 2. Process afterImage (base64)
      const afterMime = afterImage.match(/data:([^;]+);/)?.[1] || "image/jpeg";
      const afterBase64 = afterImage.split(",")[1] || afterImage;
      contentsList.push({
        inlineData: {
          mimeType: afterMime,
          data: afterBase64,
        },
      });

      // 3. Prompt and analyze
      const promptText = `Compare these visual states of a reported civic issue in India.
Original report context/summary: "${summary || "Check for resolved hazard"}"

The first image (if provided) is the 'before' state.
The latest image is the 'after' state.

Inspect and evaluate the repair/clearance work. Determine:
1. Is the issue completely resolved (resolved = true/false)?
2. Confidence score (number from 0.0 to 1.0).
3. Detailed observedChanges (array of strings, e.g. ["Pothole filled with fresh asphalt", "Worker tools removed"]).
4. Official recommendation. Must be exactly one of: "resolve" (fully completed), "request_more_evidence" (need clearer zoom/angle), or "reopen" (incomplete or failed repair).
5. Comprehensive structural explanation of your findings in a friendly/professional engineering tone.

Return a STRICT JSON response adhering precisely to this schema. Do not include markdown wraps or code fences in the JSON structure.`;

      contentsList.push({ text: promptText });

      const startTime = Date.now();
      const result = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: contentsList,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              resolved: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER },
              observedChanges: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendation: {
                type: Type.STRING,
                enum: ["resolve", "request_more_evidence", "reopen"],
              },
              explanation: { type: Type.STRING },
            },
            required: ["resolved", "confidence", "observedChanges", "recommendation", "explanation"],
          },
        },
      });

      const durationMs = Date.now() - startTime;
      const response = result.response;
      const retried = result.retried;

      const responseText = (response.text || "").trim();
      let cleanText = responseText;
      // Strip markdown code fences if present
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

      const parsedResult = JSON.parse(cleanText);

      const inputDigest = `Compare original vs afterImage`;
      const outputSummary = `Resolved: ${parsedResult.resolved} · Rec: ${parsedResult.recommendation} · conf: ${(parsedResult.confidence || 0).toFixed(2)}`;

      return res.json({ 
        success: true, 
        data: parsedResult,
        durationMs,
        confidence: parsedResult.confidence,
        inputDigest,
        outputSummary,
        retried
      });
    } catch (error: any) {
      console.error("verify-resolution error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "An error occurred during Gemini multimodal verification.",
      });
    }
  });

  // Auto-Escalation + RTI generator endpoint
  app.post("/api/escalation", async (req, res) => {
    const { title, summary, locationName, category, recommendedAuthority, ticketId } = req.body;

    try {
      const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const promptText = `Under the provisions of Indian municipal governance and the Right to Information (RTI) Act 2005, draft a formal public grievance escalation letter and a formal RTI request for this unresolved civic complaint.
      
Complaint Title: ${title || "Civic Grievance"}
Category: ${category || "General"}
Context Summary: ${summary || "Unresolved infrastructure/civic problem"}
Location description: ${locationName || "India"}
Recommended Initial Department: ${recommendedAuthority || "Municipal Corporation"}
Official Ticket ID / Reference ID: ${ticketId || "N/A"}
Reporting Reference Date (Today): ${todayStr}

Draft two separate documents:
1. escalationLetter: A professional, strongly-worded formal grievance escalation letter directed to the next-higher administrative authority (such as the Municipal Commissioner, District Magistrate, or Department Secretary). It should cite the initial delay, impact on public safety/sanity, and demand urgent intervention.
2. rtiRequest: An official RTI request formulated precisely under Section 6(1) of the RTI Act 2005 to the Public Information Officer (PIO) of the municipal corporation/department. It must request details regarding:
   - The current daily tracking status of the complaint.
   - The names, designations, and contact numbers of the officers responsible for addressing this grievance.
   - Any comments, reports, or file notes recorded in the official grievance register by the inspecting authorities.
   - The official timeframe/SLA allotted for this category of work and explanation for the delay.

CRITICAL COMPLIANCE DIRECTIVE:
You MUST use ONLY the actual ticketId ('${ticketId || "N/A"}') and the actual current date ('${todayStr}') for any reference numbers, complaint IDs, or reporting dates in the letters/petitions. 
NEVER invent, simulate, or generate outer reference numbers, other case tracking IDs, dates, or fake past event histories/follow-ups that do not exist.

Return a STRICT JSON response adhering precisely to this schema:
{
  "escalationLetter": "string",
  "rtiRequest": "string"
}`;

      const startTime = Date.now();
      const result = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              escalationLetter: { type: Type.STRING },
              rtiRequest: { type: Type.STRING },
            },
            required: ["escalationLetter", "rtiRequest"],
          },
        },
      });

      const durationMs = Date.now() - startTime;
      const response = result.response;
      const retried = result.retried;

      const responseText = (response.text || "").trim();
      let cleanText = responseText;
      // Strip markdown code fences if present
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

      const parsedResult = JSON.parse(cleanText);

      const inputDigest = `Escalate ticket ${ticketId || "N/A"}`;
      const outputSummary = `Drafted Escalation Letter + RTI Request`;

      return res.json({ 
        success: true, 
        data: parsedResult,
        durationMs,
        confidence: 0.90,
        inputDigest,
        outputSummary,
        retried
      });
    } catch (error: any) {
      console.error("escalation generation error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "An error occurred during Gemini escalation generation.",
      });
    }
  });

  // Server-side Gemini Translation Endpoint
  app.post("/api/translate", async (req, res) => {
    const { title, summary } = req.body;
    if (!title || !summary) {
      return res.status(400).json({ success: false, error: "Missing title or summary to translate." });
    }
    try {
      const promptText = `Translate the following civic issue title and summary from English to Hindi (हिन्दी).
Title: "${title}"
Summary: "${summary}"

Ensure the translation is natural, official, and easy for Indian citizens to understand.
Output STRICT, VALID JSON conforming exactly to this schema:
{
  "titleHi": "string",
  "summaryHi": "string"
}
Output ONLY valid JSON and nothing else.`;

      const result = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titleHi: { type: Type.STRING, description: "The Hindi translation of the title." },
              summaryHi: { type: Type.STRING, description: "The Hindi translation of the summary." },
            },
            required: ["titleHi", "summaryHi"],
          },
        },
      });

      const responseText = (result.response.text || "").trim();
      let cleanText = responseText;
      // Strip markdown code fences if present
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

      const parsedData = JSON.parse(cleanText);
      return res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("Translation error:", error);
      // Fallback: return the original English strings
      return res.json({
        success: false,
        error: error.message || "Translation failed",
        data: { titleHi: title, summaryHi: summary }
      });
    }
  });

  // Helper to generate the structured action packet & native Hindi translations
  async function generateActionPacket(aiClient: any, issue: any, authority: string, channel: string, slaDays: number): Promise<any> {
    const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const promptText = `Draft a formal compliance complaint (an action packet) for this reported civic issue in India.
Responsible Authority: ${authority}
Contact Channel: ${channel}
Official SLA: ${slaDays} days
Issue details:
- Category: ${issue.category}
- Title: ${issue.title}
- Summary: ${issue.summary}
- Reference Date (Today): ${todayStr}

Output a drafted formal complaint email/letter:
- subject: A concise professional subject line
- body: The full body of the formal letter, starting with a polite salutation (e.g., "To the Public Grievance Officer / Commissioner..."), laying out the ticket summary, citing safety concerns, precise location, and concluding with a call-to-action to resolve within the SLA.
- bodyHindi: A translated version of the complaint body in fluent official Hindi (हिन्दी).
- summaryHindi: A brief 1-2 sentence Hindi (हिन्दी) summary of the problem, suitable for the complainant to read.
- nextActions: 3 actionable steps for the citizen.

Output STRICT, VALID JSON conforming exactly to this schema:
{
  "subject": "string",
  "body": "string",
  "bodyHindi": "string",
  "summaryHindi": "string",
  "nextActions": ["string", "string", "string"]
}
Output ONLY valid JSON and nothing else.`;

    const result = await generateContentWithRetry(aiClient, {
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            body: { type: Type.STRING },
            bodyHindi: { type: Type.STRING },
            summaryHindi: { type: Type.STRING },
            nextActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["subject", "body", "bodyHindi", "summaryHindi", "nextActions"],
        },
      },
    });

    const text = (result.response.text || "").trim();
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(clean);
  }

  // Real Gemini Function-Calling Agentic Triage Loop
  app.post("/api/agent/run", async (req, res) => {
    const { issue, candidates } = req.body;

    if (!issue || typeof issue !== "object") {
      return res.status(400).json({ success: false, error: "Missing or invalid issue." });
    }

    const safeCandidates = Array.isArray(candidates) ? candidates : [];

    try {
      const agentTools = [{
        functionDeclarations: [
          {
            name: "calculate_priority",
            description: "Compute the deterministic 0-100 civic priority score for this issue.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                severity: { type: Type.NUMBER },
                urgency: { type: Type.STRING },
                confirmCount: { type: Type.NUMBER },
                reportCount: { type: Type.NUMBER }
              },
              required: ["severity", "urgency"]
            }
          },
          {
            name: "assess_duplicate",
            description: "Decide whether this issue duplicates one of the provided nearby candidates. Return the candidate id to merge into, or 'none'.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                candidateId: { type: Type.STRING },
                similarity: { type: Type.NUMBER },
                reasoning: { type: Type.STRING }
              },
              required: ["candidateId", "reasoning"]
            }
          },
          {
            name: "find_authority",
            description: "Find the responsible municipal authority and typical SLA for this category and location (uses live web knowledge).",
            parameters: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                locationName: { type: Type.STRING }
              },
              required: ["category", "locationName"]
            }
          },
          {
            name: "finalize",
            description: "Finalize the triage with the routing decision and a one-line rationale.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                routeTo: { type: Type.STRING },
                priorityScore: { type: Type.NUMBER },
                rationale: { type: Type.STRING }
              },
              required: ["routeTo", "rationale"]
            }
          }
        ]
      }];

      // Server-side tool implementations
      async function execTool(name: string, args: any) {
        if (name === "calculate_priority") {
          const severity = args.severity || 1;
          const urgency = args.urgency || "routine";
          const confirmCount = args.confirmCount || 0;
          const reportCount = args.reportCount || 1;
          let urgencyBonus = 0;
          if (urgency === "urgent") urgencyBonus = 10;
          else if (urgency === "priority") urgencyBonus = 5;
          const score = severity * 12 + urgencyBonus + Math.min(confirmCount * 3, 15) + Math.min(reportCount * 4, 15);
          const clampedScore = Math.max(0, Math.min(100, score));
          const roundedScore = Math.round(clampedScore * 10) / 10;
          return { score: roundedScore };
        }
        if (name === "assess_duplicate") {
          return { candidateId: args.candidateId || "none", similarity: args.similarity ?? null };
        }
        if (name === "find_authority") {
          try {
            const searchPrompt = `Determine the responsible Indian municipal authority/department, a contact channel (helpline/portal/email), and the official SLA in days for category: "${args.category || "general"}" in location: "${args.locationName || "India"}".
            
            You must output a strict JSON object conforming exactly to this schema:
            {
              "authority": "string (e.g. BBMP, BMC, MCD, etc.)",
              "sla": number (SLA in days, e.g. 7),
              "channel": "string (contact portal/helpline/email)"
            }
            
            Return ONLY the raw JSON block inside markdown code fences:
            \`\`\`json
            { ... }
            \`\`\``;

            const searchRes = await generateContentWithRetry(ai, {
              model: "gemini-2.5-flash",
              contents: searchPrompt,
              config: {
                tools: [{ googleSearch: {} }]
              }
            });

            const responseText = (searchRes.response.text || "").trim();
            let cleanText = responseText;
            cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
            
            const jsonStart = cleanText.indexOf("{");
            const jsonEnd = cleanText.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1) {
              cleanText = cleanText.slice(jsonStart, jsonEnd + 1);
            }
            
            const parsed = JSON.parse(cleanText);
            const authVal = parsed.authority || "Municipal Corporation";
            const slaVal = typeof parsed.sla === "number" ? parsed.sla : parseInt(parsed.sla) || 7;
            const chanVal = parsed.channel || "State Grievance Portal";
            
            return { authority: authVal, sla: slaVal, channel: chanVal };
          } catch (searchErr: any) {
            console.warn("find_authority grounded search failed, returning fallback:", searchErr);
            return { authority: "Municipal Corporation", sla: 7, channel: "State Grievance Portal" };
          }
        }
        if (name === "finalize") {
          return { done: true };
        }
        return { error: `Unknown tool: ${name}` };
      }

      let contents: any[] = [{ role: "user", parts: [{ text:
        `You are CivicLens's triage agent. Issue: ${JSON.stringify(issue)}. Nearby candidates: ${JSON.stringify(safeCandidates)}.
         Steps: 1) call assess_duplicate, 2) call calculate_priority, 3) call find_authority, 4) call finalize. Call exactly one tool per turn.` }]}];

      const steps: any[] = [];
      let final: any = null;
      let guard = 0;

      let authority = "Municipal Corporation";
      let channel = "State Grievance Portal";
      let slaDays = 7;

      let duplicateCandidateId: string | null = null;
      let duplicateSimilarity: number | null = null;
      let duplicateReasoning: string | null = null;

      while (guard++ < 8) {
        const t0 = Date.now();
        const { response } = await generateContentWithRetry(ai, {
          model: "gemini-2.5-flash",
          contents,
          config: { tools: agentTools }
        });
        const calls = response.functionCalls || [];
        if (!calls.length) break;
        const fc = calls[0];
        const result = await execTool(fc.name, fc.args || {});

        // Save tool execution findings
        if (fc.name === "find_authority" && result) {
          authority = result.authority || authority;
          channel = result.channel || channel;
          slaDays = typeof result.sla === "number" ? result.sla : slaDays;
        }

        if (fc.name === "assess_duplicate") {
          const cid = fc.args?.candidateId;
          if (cid && cid !== "none" && cid !== "") {
            duplicateCandidateId = cid;
            duplicateSimilarity = fc.args?.similarity || null;
            duplicateReasoning = fc.args?.reasoning || null;
          }
        }

        steps.push({
          step: fc.name,
          tool: `agent.${fc.name}`,
          status: "done",
          inputDigest: JSON.stringify(fc.args).slice(0, 160),
          outputSummary: JSON.stringify(result).slice(0, 160),
          durationMs: Date.now() - t0,
          ts: new Date().toISOString(),
          rationale: fc.args?.reasoning || fc.args?.rationale || `Called ${fc.name}`
        });

        contents.push({ role: "model", parts: [{ functionCall: fc } as any] });
        contents.push({ role: "user", parts: [{ functionResponse: { name: fc.name, response: { result } } } as any] });

        if (fc.name === "finalize") {
          final = fc.args;
          break;
        }
      }

      // Generate the final rich resolution plan
      let resolutionPlan = null;
      try {
        const actionPacket = await generateActionPacket(ai, issue, authority, channel, slaDays);
        resolutionPlan = {
          recommendedAuthority: authority,
          contactChannel: channel,
          slaDays,
          actionPacket,
          groundingSources: []
        };
      } catch (planErr: any) {
        console.error("Failed to generate action packet in agent run, using fallback:", planErr);
        resolutionPlan = {
          recommendedAuthority: authority,
          contactChannel: channel,
          slaDays,
          actionPacket: {
            subject: `Formal Grievance: ${issue.title || "Civic Incident"}`,
            body: `To the Commissioner / Officer,\n\nWe would like to formally report a civic grievance regarding ${issue.category} at ${issue.locationName || "the location"}.\nSummary: ${issue.summary || "No details provided."}\n\nPlease resolve this issue within the typical SLA of ${slaDays} days.\n\nSincerely,\nCivicLens Agent`,
            bodyHindi: `आयुक्त / अधिकारी के लिए,\n\nहम औपचारिक रूप से ${issue.locationName || "स्थान"} पर ${issue.category} के संबंध में एक नागरिक शिकायत दर्ज करना चाहते हैं।\nसारांश: ${issue.summary || "कोई विवरण प्रदान नहीं किया गया।"}\n\nकृपया इस मुद्दे को ${slaDays} दिनों के सामान्य एसएलए के भीतर हल करें।\n\nसादर,\nसिविक लेंस एजेंट`,
            summaryHindi: `${issue.category} की शिकायत दर्ज की गई है।`,
            nextActions: [
              "Post on social media / X tagging the authorities.",
              "File a grievance via the local department portal.",
              "Follow up with local ward committee."
            ]
          },
          groundingSources: []
        };
      }

      return res.json({
        success: true,
        steps,
        final,
        duplicateCandidateId,
        duplicateSimilarity,
        duplicateReasoning,
        resolutionPlan
      });
    } catch (error: any) {
      console.error("Agent run error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "An unexpected error occurred during the agent triage run."
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
