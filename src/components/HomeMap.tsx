import React, { useEffect, useMemo, useState } from "react";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { Navigation } from "lucide-react";
import { IssueReport } from "../types";
import { humanizeCategory } from "../utils/humanize";

interface HomeMapProps {
  issues: IssueReport[];
  onSelectIssue: (id: string) => void;
  userLocation?: { lat: number; lng: number } | null;
  onUserLocationChange?: (loc: { lat: number; lng: number } | null) => void;
}

const API_KEY =
  (typeof process !== "undefined" ? process.env?.GOOGLE_MAPS_PLATFORM_KEY : undefined) ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  "";

const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY";

const mapStyles = [
  {
    featureType: "all",
    elementType: "geometry",
    stylers: [{ saturation: -85 }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#D9E2E8" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7c8c9c" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "all",
    elementType: "labels.text.stroke",
    stylers: [{ visibility: "off" }],
  },
];

export default function HomeMap({
  issues,
  onSelectIssue,
  userLocation: propUserLocation,
  onUserLocationChange,
}: HomeMapProps) {
  const [localUserLocation, setLocalUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"granted" | "denied" | "unavailable" | "loading" | null>(null);
  const userLocation = propUserLocation !== undefined ? propUserLocation : localUserLocation;
  const setUserLocation = (loc: { lat: number; lng: number } | null) => {
    if (onUserLocationChange) {
      onUserLocationChange(loc);
    } else {
      setLocalUserLocation(loc);
    }
  };

  const validIssues = useMemo(() => {
    return issues.filter(
      (issue) =>
        typeof issue.lat === "number" &&
        !isNaN(issue.lat) &&
        typeof issue.lng === "number" &&
        !isNaN(issue.lng)
    );
  }, [issues]);

  const centroidCenter = useMemo(() => {
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
    return { lat: 12.9716, lng: 77.5946 };
  }, [validIssues]);

  const defaultMapCenter = useMemo(() => {
    if (userLocation) return userLocation;
    return centroidCenter;
  }, [userLocation, centroidCenter]);

  const defaultMapZoom = useMemo(() => {
    if (userLocation) return 14;
    return validIssues.length > 0 ? 11 : 12;
  }, [userLocation, validIssues]);

  const [activeCenter, setActiveCenter] = useState<{ lat: number; lng: number }>(defaultMapCenter);
  const [activeZoom, setActiveZoom] = useState<number>(defaultMapZoom);

  useEffect(() => {
    setActiveCenter(defaultMapCenter);
    setActiveZoom(defaultMapZoom);
  }, [defaultMapCenter, defaultMapZoom]);

  const requestLocation = (isManual = false) => {
    if (!navigator.geolocation) {
      setGeoStatus("unavailable");
      return;
    }
    if (isManual) {
      setGeoStatus("loading");
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(loc);
        setGeoStatus("granted");
        setActiveCenter(loc);
        setActiveZoom(14);
      },
      (error) => {
        console.warn("Geolocation failed:", error);
        if (error.code === error.PERMISSION_DENIED) {
          setGeoStatus("denied");
        } else {
          setGeoStatus("unavailable");
        }
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
    );
  };

  useEffect(() => {
    requestLocation(false);
  }, []);

  const getSeverityColor = (severity?: number) => {
    const sev = severity || 3;
    if (sev <= 2) return "#0FB5A6";
    if (sev === 3) return "#EE9B2D";
    if (sev === 4) return "#F2683B";
    return "#B91C1C";
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
      <div id="google-maps-setup-card" className="flex flex-col gap-4 rounded-2xl border border-hairline bg-white p-5 font-sans shadow-xs">
        <div className="flex flex-col gap-1.5">
          <h4 className="text-lg font-bold text-ink">Interactive map inactive</h4>
          <p className="text-base leading-relaxed text-ink-2">
            Google Maps JavaScript API key is required to render active hazard locations.
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-paper p-3 font-mono text-sm text-ink-2">
          <p className="font-bold text-ink">To enable Google Maps integration:</p>
          <ol className="flex list-decimal flex-col gap-1 pl-4 leading-normal">
            <li>
              Generate an API key in{" "}
              <a
                href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-marigold-ink underline"
              >
                Google Cloud Console
              </a>
            </li>
            <li>Open the deployment configuration or secret settings.</li>
            <li>
              Add <code>GOOGLE_MAPS_PLATFORM_KEY</code> with a browser-restricted Maps key.
            </li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div
      id="home-google-map-container"
      className="relative h-[300px] w-full overflow-hidden rounded-2xl border border-hairline shadow-sm sm:h-[360px] lg:h-[430px]"
    >
      {(geoStatus === "denied" || geoStatus === "unavailable" || !userLocation) && (
        <div className="pointer-events-none absolute left-3 right-16 top-3 z-10 max-w-sm rounded-xl border border-white/10 bg-ink/90 px-3 py-2 text-sm leading-relaxed text-white shadow-md backdrop-blur-xs">
          Showing Bengaluru. Use the target button to center on your current position.
        </div>
      )}

      <button
        id="use-my-location-btn"
        onClick={() => requestLocation(true)}
        className="absolute bottom-3 right-3 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-hairline bg-white/95 p-2 text-ink shadow-md transition-all hover:bg-white"
        title="Use my location"
        aria-label="Use my location on map"
      >
        <Navigation className={`h-5 w-5 ${geoStatus === "loading" ? "animate-pulse text-marigold" : "text-ink"}`} />
      </button>

      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          center={activeCenter}
          zoom={activeZoom}
          onCameraChanged={(ev) => {
            if (ev.detail.center) {
              setActiveCenter(ev.detail.center);
            }
            if (typeof ev.detail.zoom === "number") {
              setActiveZoom(ev.detail.zoom);
            }
          }}
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
          style={{ width: "100%", height: "100%" }}
          {...{
            options: {
              styles: mapStyles,
              gestureHandling: "cooperative",
              disableDefaultUI: true,
              zoomControl: true,
            },
          } as any}
        >
          {validIssues.map((issue) => {
            const color = getSeverityColor(issue.severity);
            const titleText = `${issue.title || humanizeCategory(issue.category)}${issue.isDemoData ? " (Demo)" : ""}`;
            return (
              <Marker
                key={issue.id}
                position={{ lat: issue.lat!, lng: issue.lng! }}
                onClick={() => onSelectIssue(issue.id)}
                icon={getSvgPinUrl(color)}
                title={titleText}
              />
            );
          })}
        </Map>
      </APIProvider>
    </div>
  );
}
