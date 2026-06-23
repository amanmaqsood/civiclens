import React, { useMemo } from "react";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { IssueReport } from "../types";
import { humanizeCategory } from "../utils/humanize";

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

// Custom low-saturation minimalist map styles
const mapStyles = [
  {
    featureType: "all",
    elementType: "geometry",
    stylers: [{ saturation: -85 }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#D9E2E8" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }]
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7c8c9c" }]
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "transit",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "all",
    elementType: "labels.text.stroke",
    stylers: [{ visibility: "off" }]
  }
];

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
    return { lat: 12.9716, lng: 77.5946 }; // Default center (Bengaluru)
  }, [validIssues]);

  // Exact severity color map matching Civic Dossier tokens
  const getSeverityColor = (severity?: number) => {
    const sev = severity || 3;
    if (sev <= 2) return "#0FB5A6"; // verify (#0FB5A6)
    if (sev === 3) return "#EE9B2D"; // marigold (#EE9B2D)
    if (sev === 4) return "#F2683B"; // orange (#F2683B)
    return "#E5484D"; // alert (#E5484D)
  };

  const getSvgPinUrl = (color: string) => {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="10" fill="none" stroke="${color}" stroke-width="2" opacity="0.4"/>
        <circle cx="14" cy="14" r="7" fill="white" stroke="${color}" stroke-width="2"/>
        <circle cx="14" cy="14" r="3.5" fill="${color}"/>
      </svg>
    `)}`;
  };

  if (!hasValidKey) {
    return (
      <div id="google-maps-setup-card" className="bg-white border border-hairline rounded-2xl p-5 flex flex-col gap-4 font-sans shadow-xs">
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-bold text-ink font-display uppercase tracking-wider">🌐 Interactive Map Inactive</h4>
          <p className="text-[11px] text-slate leading-relaxed">
            Google Maps JavaScript API key is required to render active hazard locations.
          </p>
        </div>
        <div className="bg-paper border border-hairline p-3 rounded-xl text-[10px] text-slate flex flex-col gap-2 font-mono">
          <p className="font-bold text-ink">To enable Google Maps integration:</p>
          <ol className="list-decimal pl-4 flex flex-col gap-1 leading-normal">
            <li>
              Generate an API Key on{" "}
              <a
                href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais"
                target="_blank"
                rel="noopener noreferrer"
                className="text-marigold underline font-bold"
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
    <div id="home-google-map-container" className="w-full h-[250px] rounded-2xl overflow-hidden border border-hairline shadow-sm relative">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={center}
          defaultZoom={validIssues.length > 0 ? 11 : 5}
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
          style={{ width: "100%", height: "100%" }}
          options={{
            styles: mapStyles,
            gestureHandling: "cooperative",
            disableDefaultUI: true,
            zoomControl: true,
          }}
        >
          {validIssues.map((issue) => {
            const color = getSeverityColor(issue.severity);
            return (
              <Marker
                key={issue.id}
                position={{ lat: issue.lat!, lng: issue.lng! }}
                onClick={() => onSelectIssue(issue.id)}
                icon={getSvgPinUrl(color)}
                title={issue.title || humanizeCategory(issue.category)}
              />
            );
          })}
        </Map>
      </APIProvider>
    </div>
  );
}
