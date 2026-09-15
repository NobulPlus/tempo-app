"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PinIcon, SearchIcon } from "@/components/icons";
import { LAGOS_BOUNDS, isCoordinateInLagos } from "@/lib/lagos";

const LAGOS_CENTER = { lat: 6.5244, lng: 3.3792 };

interface AddressSuggestion {
  placeId: number;
  label: string;
  lat: number;
  lng: number;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export function VenueAddressLocationField({
  defaultAddress = "",
  defaultLat,
  defaultLng,
}: {
  defaultAddress?: string;
  defaultLat?: number;
  defaultLng?: number;
}) {
  const [address, setAddress] = useState(defaultAddress);
  const [lat, setLat] = useState(defaultLat?.toString() ?? "");
  const [lng, setLng] = useState(defaultLng?.toString() ?? "");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const numeric = useMemo(() => {
    const nextLat = Number(lat);
    const nextLng = Number(lng);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return null;
    return { lat: nextLat, lng: nextLng, inLagos: isCoordinateInLagos(nextLat, nextLng) };
  }, [lat, lng]);

  const mapLat = numeric?.lat ?? LAGOS_CENTER.lat;
  const mapLng = numeric?.lng ?? LAGOS_CENTER.lng;
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - 0.012},${mapLat - 0.009},${mapLng + 0.012},${mapLat + 0.009}&layer=mapnik&marker=${mapLat},${mapLng}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapLat},${mapLng}`;

  useEffect(() => {
    if (address.trim().length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const query = address.toLowerCase().includes("lagos") ? address : `${address}, Lagos, Nigeria`;
        const params = new URLSearchParams({
          format: "jsonv2",
          addressdetails: "1",
          limit: "6",
          countrycodes: "ng",
          bounded: "1",
          viewbox: `${LAGOS_BOUNDS.minLng},${LAGOS_BOUNDS.maxLat},${LAGOS_BOUNDS.maxLng},${LAGOS_BOUNDS.minLat}`,
          q: query,
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Address lookup failed");
        const rows = (await response.json()) as NominatimResult[];
        setSuggestions(
          rows
            .map((row) => ({
              placeId: row.place_id,
              label: row.display_name,
              lat: Number(row.lat),
              lng: Number(row.lon),
            }))
            .filter((row) => isCoordinateInLagos(row.lat, row.lng)),
        );
        setOpen(true);
        setMessage(null);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessage("Address lookup is unavailable right now. You can still enter the address and coordinates manually.");
        }
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [address]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pickSuggestion = (suggestion: AddressSuggestion) => {
    setAddress(suggestion.label);
    setLat(suggestion.lat.toFixed(6));
    setLng(suggestion.lng.toFixed(6));
    setSuggestions([]);
    setOpen(false);
    setMessage("Address selected. Check the map preview before saving.");
  };

  const useCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setMessage("This browser cannot read your location. Enter the coordinates manually.");
      return;
    }

    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = Number(position.coords.latitude.toFixed(6));
        const nextLng = Number(position.coords.longitude.toFixed(6));
        setLat(String(nextLat));
        setLng(String(nextLng));
        setLocating(false);
        setMessage(
          isCoordinateInLagos(nextLat, nextLng)
            ? "Location captured. Add the street address and check the map preview before saving."
            : "That location looks outside Lagos. Please check the venue position.",
        );
      },
      (error) => {
        setLocating(false);
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was blocked. You can still search or paste coordinates."
            : "Could not read your location. Try again or enter it manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="rounded-xl border border-glass-border bg-bg-primary/30 p-4" ref={rootRef}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
            <PinIcon size={15} />
            Address and exact location
          </div>
          <p className="mt-1 max-w-2xl text-[12px] text-ink-muted">
            Search for the venue address in Lagos. Selecting a suggestion fills the exact map coordinates.
          </p>
        </div>
        <button type="button" onClick={useCurrentLocation} disabled={locating} className="btn-t btn-ghost-t !px-3.5 !py-2 !text-[12.5px]">
          <PinIcon size={14} />
          {locating ? "Locating..." : "Use current location"}
        </button>
      </div>

      <div className="relative mt-4">
        <label className="field-t block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Street address</span>
          <span className="field-icon">
            <SearchIcon size={17} />
          </span>
          <input
            name="address"
            required
            value={address}
            onChange={(event) => {
              const nextAddress = event.target.value;
              setAddress(nextAddress);
              setOpen(true);
              if (nextAddress.trim().length < 3) {
                setSuggestions([]);
                setSearching(false);
              }
            }}
            onFocus={() => setOpen(true)}
            placeholder="Start typing the venue address"
            className="pl-11"
            autoComplete="street-address"
          />
        </label>

        {open && (searching || suggestions.length > 0) && (
          <div className="absolute z-40 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-glass-border bg-bg-elevated p-1.5 shadow-xl">
            {searching && <div className="px-3 py-2.5 text-[13px] text-ink-muted">Searching Lagos addresses...</div>}
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                type="button"
                onClick={() => pickSuggestion(suggestion)}
                className="flex w-full gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] text-ink-soft transition hover:bg-white/6 hover:text-ink"
              >
                <PinIcon size={14} className="mt-0.5 shrink-0 text-green" />
                <span>{suggestion.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="field-t block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Latitude</span>
          <input name="lat" type="number" step="any" required value={lat} onChange={(event) => setLat(event.target.value)} placeholder="6.524400" />
        </label>
        <label className="field-t block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Longitude</span>
          <input name="lng" type="number" step="any" required value={lng} onChange={(event) => setLng(event.target.value)} placeholder="3.379200" />
        </label>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-glass-border bg-glass">
        <iframe title="Venue map preview" src={mapSrc} className="h-[220px] w-full border-0" loading="lazy" />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <span className={numeric && !numeric.inLagos ? "text-orange" : "text-ink-muted"}>
          Suggestions and saved coordinates are limited to Lagos.
        </span>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="font-semibold text-green transition hover:text-green-strong">
          Open in Google Maps
        </a>
      </div>

      {message && <p className="mt-2 text-[12.5px] text-ink-soft">{message}</p>}
    </div>
  );
}
