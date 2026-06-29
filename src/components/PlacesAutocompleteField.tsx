import React, { useEffect, useMemo, useRef, useState } from "react";

export interface SelectedPlace {
  label: string;
  address: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

interface FallbackSuggestion {
  label: string;
  address: string;
  lat: number;
  lng: number;
}

interface PlacesAutocompleteFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  onPlaceSelected: (place: SelectedPlace) => void;
  fallbackSuggestions: FallbackSuggestion[];
  label: string;
  placeholder: string;
  helperText: string;
  loadingText: string;
  noKeyText: string;
  failedText: string;
  fallbackTitle: string;
  noFallbackText: string;
  useLabel: string;
  language: "en" | "hi";
}

declare global {
  interface Window {
    google?: any;
    __civiclensPlacesPromise?: Promise<any>;
  }
}

const API_KEY =
  (typeof process !== "undefined" ? process.env?.GOOGLE_MAPS_PLATFORM_KEY : undefined) ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  "";

const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY";

function loadPlacesLibrary(language: "en" | "hi"): Promise<any> {
  if (window.google?.maps?.places?.PlaceAutocompleteElement) {
    return Promise.resolve(window.google.maps.places);
  }

  if (window.google?.maps?.importLibrary) {
    return window.google.maps.importLibrary("places");
  }

  if (!hasValidKey) {
    return Promise.reject(new Error("Missing Google Maps browser key."));
  }

  if (!window.__civiclensPlacesPromise) {
    window.__civiclensPlacesPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-civiclens-google-places="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.google?.maps?.places), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google Places script failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&libraries=places&v=weekly&language=${language}`;
      script.async = true;
      script.defer = true;
      script.dataset.civiclensGooglePlaces = "true";
      script.onload = () => {
        if (window.google?.maps?.places) resolve(window.google.maps.places);
        else reject(new Error("Google Places library unavailable after load."));
      };
      script.onerror = () => reject(new Error("Google Places script failed to load."));
      document.head.appendChild(script);
    });
  }

  return window.__civiclensPlacesPromise;
}

function readPlaceText(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.text === "string") return value.text;
  if (typeof value.toString === "function") return value.toString();
  return "";
}

function readLatLng(location: any): { lat?: number; lng?: number } {
  if (!location) return {};
  if (typeof location.toJSON === "function") {
    const json = location.toJSON();
    return { lat: Number(json.lat), lng: Number(json.lng) };
  }
  const lat = typeof location.lat === "function" ? location.lat() : location.lat;
  const lng = typeof location.lng === "function" ? location.lng() : location.lng;
  return { lat: Number(lat), lng: Number(lng) };
}

export default function PlacesAutocompleteField({
  value,
  onValueChange,
  onPlaceSelected,
  fallbackSuggestions,
  label,
  placeholder,
  helperText,
  loadingText,
  noKeyText,
  failedText,
  fallbackTitle,
  noFallbackText,
  useLabel,
  language,
}: PlacesAutocompleteFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<any>(null);
  const onValueChangeRef = useRef(onValueChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const [status, setStatus] = useState<"loading" | "ready" | "no-key" | "failed">(() => (hasValidKey || !!window.google?.maps ? "loading" : "no-key"));

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
    onPlaceSelectedRef.current = onPlaceSelected;
  }, [onPlaceSelected, onValueChange]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    if (!hasValidKey && !window.google?.maps?.importLibrary && !window.google?.maps?.places) {
      setStatus("no-key");
      return;
    }

    setStatus("loading");
    loadPlacesLibrary(language)
      .then((places) => {
        if (cancelled || !containerRef.current) return;
        const PlaceAutocompleteElement = places?.PlaceAutocompleteElement || window.google?.maps?.places?.PlaceAutocompleteElement;
        if (!PlaceAutocompleteElement) {
          setStatus("failed");
          return;
        }

        containerRef.current.replaceChildren();
        const autocomplete = new PlaceAutocompleteElement({
          includedRegionCodes: ["in"],
          requestedLanguage: language,
          requestedRegion: "in",
        });
        autocomplete.id = "google-places-autocomplete";
        autocomplete.setAttribute("aria-label", label);
        autocomplete.setAttribute("data-testid", "google-places-autocomplete");
        autocomplete.placeholder = placeholder;
        autocomplete.value = value;
        autocomplete.className = "civiclens-places-autocomplete";

        const handleSelection = async (event: any) => {
          const prediction = event.placePrediction || event.detail?.placePrediction || event.detail?.prediction;
          const place = typeof prediction?.toPlace === "function" ? prediction.toPlace() : event.place || event.detail?.place;
          if (!place) return;
          try {
            if (typeof place.fetchFields === "function") {
              await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "id"] });
            }
          } catch {
            // A selected prediction is still useful even if field hydration fails.
          }

          const labelText = readPlaceText(place.displayName) || readPlaceText(prediction?.mainText) || readPlaceText(prediction?.text) || value;
          const address = place.formattedAddress || readPlaceText(prediction?.secondaryText) || labelText;
          const { lat, lng } = readLatLng(place.location);
          onValueChangeRef.current(address);
          onPlaceSelectedRef.current({
            label: labelText,
            address,
            lat: Number.isFinite(lat) ? lat : undefined,
            lng: Number.isFinite(lng) ? lng : undefined,
            placeId: place.id || prediction?.placeId,
          });
        };

        const handleInput = (event: Event) => {
          const target = event.target as HTMLInputElement | null;
          if (target && typeof target.value === "string") onValueChangeRef.current(target.value);
        };

        autocomplete.addEventListener("gmp-select", handleSelection);
        autocomplete.addEventListener("gmp-placeselect", handleSelection);
        autocomplete.addEventListener("input", handleInput);
        containerRef.current.appendChild(autocomplete);
        elementRef.current = autocomplete;
        setStatus("ready");
        cleanup = () => {
          autocomplete.removeEventListener("gmp-select", handleSelection);
          autocomplete.removeEventListener("gmp-placeselect", handleSelection);
          autocomplete.removeEventListener("input", handleInput);
          autocomplete.remove();
        };
      })
      .catch(() => {
        if (!cancelled) setStatus(hasValidKey ? "failed" : "no-key");
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [label, language, placeholder]);

  useEffect(() => {
    if (elementRef.current && elementRef.current.value !== value) {
      elementRef.current.value = value;
    }
  }, [value]);

  const fallbackMatches = useMemo(() => {
    const query = value.trim().toLowerCase();
    const matches = query
      ? fallbackSuggestions.filter((suggestion) =>
          `${suggestion.label} ${suggestion.address}`.toLowerCase().includes(query)
        )
      : fallbackSuggestions;
    return matches.slice(0, query ? 5 : 3);
  }, [fallbackSuggestions, value]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="google-places-autocomplete" className="text-base font-bold text-ink">
        {label}
      </label>
      <div className="min-h-[52px] rounded-xl border border-hairline bg-white p-1 text-base text-ink focus-within:border-marigold focus-within:ring-1 focus-within:ring-marigold">
        <div ref={containerRef} className={status === "ready" ? "block" : "hidden"} />
        {(status === "loading" || status === "no-key" || status === "failed") && (
          <input
            id="google-places-autocomplete"
            type="text"
            role="combobox"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            className="min-h-[44px] w-full rounded-lg border-0 bg-transparent px-3 text-base text-ink outline-none"
            aria-autocomplete="list"
            aria-controls="manual-location-suggestions"
            aria-expanded={status !== "loading" && fallbackMatches.length > 0}
          />
        )}
      </div>
      <p className="text-sm font-medium leading-relaxed text-ink-2">
        {status === "ready" ? helperText : status === "loading" ? loadingText : status === "no-key" ? noKeyText : failedText}
      </p>

      {(status === "no-key" || status === "failed") && (
        <div className="grid gap-2" id="manual-location-suggestions" role="listbox" aria-label={fallbackTitle}>
          <p className="text-sm font-bold text-ink-2">{fallbackTitle}</p>
          {fallbackMatches.length > 0 ? (
            fallbackMatches.map((suggestion) => (
              <button
                key={suggestion.address}
                type="button"
                role="option"
                aria-selected={value === suggestion.address}
                onClick={() => {
                  onValueChange(suggestion.address);
                  onPlaceSelected(suggestion);
                }}
                className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-hairline bg-white p-3 text-left text-ink shadow-2xs transition hover:border-marigold/50 hover:bg-marigold/5"
              >
                <span className="min-w-0">
                  <span className="block text-base font-bold">{suggestion.label}</span>
                  <span className="block truncate text-sm font-medium text-ink-2">{suggestion.address}</span>
                </span>
                <span className="shrink-0 rounded-lg bg-paper px-2 py-1 text-sm font-bold text-ink-2">
                  {useLabel}
                </span>
              </button>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-hairline bg-white p-3 text-sm leading-relaxed text-ink-2">
              {noFallbackText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
