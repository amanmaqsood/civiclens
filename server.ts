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

  function isUnavailableError(err: any): boolean {
    if (!err) return false;
    const errMsg = String(err.message || err.statusText || "").toUpperCase();
    const status = err.status || err.statusCode || err.code;
    return status === 503 || status === "UNAVAILABLE" || errMsg.includes("503") || errMsg.includes("UNAVAILABLE");
  }

  async function generateContentWithRetry(aiClient: any, args: any): Promise<any> {
    try {
      return await aiClient.models.generateContent(args);
    } catch (error: any) {
      if (isUnavailableError(error)) {
        console.warn("Gemini 503/UNAVAILABLE encountered. Waiting 1.5s to retry once...");
        await sleep(1500);
        return await aiClient.models.generateContent(args);
      }
      throw error;
    }
  }

  // Health check endpoint (both /health and /api/health to be robust)
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

      // Main Gemini Content Generation
      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
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

          const repairResponse = await generateContentWithRetry(ai, {
            model: "gemini-2.5-flash",
            contents: repairPrompt,
            config: {
              responseMimeType: "application/json",
            },
          });

          parsedData = JSON.parse((repairResponse.text || "").trim());
          if (validateSchema(parsedData)) {
            parseSuccess = true;
          }
        } catch (repairError) {
          console.error("Gemini JSON Repair attempt failed too:", repairError);
        }
      }

      if (parseSuccess) {
        return res.json({ success: true, fallback: false, data: parsedData });
      } else {
        // Fall back cleanly to manual form
        return res.json({
          success: false,
          fallback: true,
          error: "Schema validation failed, falling back to manual entry mode.",
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

      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
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

      const responseText = (response.text || "").trim();
      let parsedData = JSON.parse(responseText);
      
      // Map bestCandidateId from empty string/empty check to null if create_new
      if (parsedData.recommendation === "create_new" || !parsedData.bestCandidateId || parsedData.bestCandidateId === "") {
        parsedData.bestCandidateId = null;
      }

      return res.json({ success: true, data: parsedData });
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
    const { category, title, summary, locationName, lat, lng } = req.body;

    if (!category || !title || !summary) {
      return res.status(400).json({ success: false, error: "Missing required category, title, or summary parameters." });
    }

    try {
      const promptText = `Determine the responsible Indian municipal authority or department and draft a formal compliance complaint (an action packet) for this reported civic issue.
Use Google Search grounding to lookup the real-world departments, municipal corporations, or utility boards that govern this category of issues in this specific Indian city or state (based on the location/address description: "${locationName || "India"}", and coordinates if provided: lat: ${lat || "unknown"}, lng: ${lng || "unknown"}).

Issue details:
- Category: ${category}
- Title: ${title}
- Summary: ${summary}

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

      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: promptText,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

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

      return res.json({ success: true, data: parsedData });
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

      // 1. Process beforeImageUrl
      if (beforeImageUrl && beforeImageUrl.startsWith("http")) {
        try {
          const fetchRes = await fetch(beforeImageUrl);
          if (fetchRes.ok) {
            const buffer = await fetchRes.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            const contentType = fetchRes.headers.get("content-type") || "image/jpeg";
            contentsList.push({
              inlineData: {
                mimeType: contentType,
                data: base64,
              },
            });
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

      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
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

      const responseText = (response.text || "").trim();
      let cleanText = responseText;
      // Strip markdown code fences if present
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

      const parsedResult = JSON.parse(cleanText);
      return res.json({ success: true, data: parsedResult });
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
    const { title, summary, locationName, category, recommendedAuthority } = req.body;

    try {
      const promptText = `Under the provisions of Indian municipal governance and the Right to Information (RTI) Act 2005, draft a formal public grievance escalation letter and a formal RTI request for this unresolved civic complaint.
      
Complaint Title: ${title || "Civic Grievance"}
Category: ${category || "General"}
Context Summary: ${summary || "Unresolved infrastructure/civic problem"}
Location description: ${locationName || "India"}
Recommended Initial Department: ${recommendedAuthority || "Municipal Corporation"}

Draft two separate documents:
1. escalationLetter: A professional, strongly-worded formal grievance escalation letter directed to the next-higher administrative authority (such as the Municipal Commissioner, District Magistrate, or Department Secretary). It should cite the initial delay, impact on public safety/sanity, and demand urgent intervention.
2. rtiRequest: An official RTI request formulated precisely under Section 6(1) of the RTI Act 2005 to the Public Information Officer (PIO) of the municipal corporation/department. It must request details regarding:
   - The current daily tracking status of the complaint.
   - The names, designations, and contact numbers of the officers responsible for addressing this grievance.
   - Any comments, reports, or file notes recorded in the official grievance register by the inspecting authorities.
   - The official timeframe/SLA allotted for this category of work and explanation for the delay.

Return a STRICT JSON response adhering precisely to this schema:
{
  "escalationLetter": "string",
  "rtiRequest": "string"
}`;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
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

      const responseText = (response.text || "").trim();
      let cleanText = responseText;
      // Strip markdown code fences if present
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

      const parsedResult = JSON.parse(cleanText);
      return res.json({ success: true, data: parsedResult });
    } catch (error: any) {
      console.error("escalation generation error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "An error occurred during Gemini escalation generation.",
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
