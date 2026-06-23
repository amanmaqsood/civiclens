import React, { useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";
import { IssueReport } from "../types";

interface HomeMapProps {
  issues: IssueReport[];
  onSelectIssue: (id: string) => void;
}

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  "";

const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY";

export default function HomeMap({ issues, onSelectIssue }: HomeMapProps) {
  const validIssues = useMemo(() => {
    return issues.filter(
      (issue) =>
        typeof issue.lat === "number" &&
        !isNaN(issue.lat) &&
        typeof issue.lng === "number" &&
        !isNaN(issue.lng)
    );
  }, [issues]);

  const center = useMemo(() => {
    if (validIssues.length > 0) {
      let totalLat = 0;
      let totalLng = 0;
      validIssues.forEach((issue) => {
        totalLat += issue.lat!;
        totalLng += issue.lng!;
      });
      return {
        lat: totalLat / validIssues.length,
        lng: totalLng / validIssues.length,
      };
    }
    return { lat: 28.6139, lng: 77.2090 }; // Default center (New Delhi)
  }, [validIssues]);

  const getSeverityColor = (severity?: number) => {
    const sev = severity || 3;
    if (sev <= 2) return "#10B981"; // Green (emerald-500)
    if (sev === 3) return "#F59E0B"; // Amber (amber-500)
    return "#EF4444"; // Red (red-500)
  };

  if (!hasValidKey) {
    return (
      <div id="google-maps-setup-card" className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 font-sans shadow-xs">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-bold text-slate-800">🌐 Interactive Map Inactive</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Google Maps JavaScript API key is required to render active hazard locations.
          </p>
        </div>
        <div className="bg-white border border-slate-100 p-3 rounded-xl text-[10px] text-slate-600 flex flex-col gap-2">
          <p><strong>To enable Google Maps integration:</strong></p>
          <ol className="list-decimal pl-4 flex flex-col gap-1 leading-normal">
            <li>
              Generate an API Key on{" "}
              <a
                href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4F46E5] underline font-bold"
              >
                Google Cloud Console
              </a>
            </li>
            <li>Press the Settings (⚙️) icon in top-right corner.</li>
            <li>Go to <strong>Secrets</strong>, add <code>GOOGLE_MAPS_PLATFORM_KEY</code>, and paste your API key.</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div id="home-google-map-container" className="w-full h-[250px] rounded-2xl overflow-hidden border border-slate-100 shadow-sm relative">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={center}
          defaultZoom={validIssues.length > 0 ? 11 : 5}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
          style={{ width: "100%", height: "100%" }}
          gestureHandling="cooperative"
          disableDefaultUI={true}
          zoomControl={true}
        >
          {validIssues.map((issue) => (
            <AdvancedMarker
              key={issue.id}
              position={{ lat: issue.lat!, lng: issue.lng! }}
              onClick={() => onSelectIssue(issue.id)}
              title={issue.title || issue.category}
            >
              <Pin
                background={getSeverityColor(issue.severity)}
                borderColor="#ffffff"
                glyphColor="#ffffff"
                scale={1.0}
              />
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}
