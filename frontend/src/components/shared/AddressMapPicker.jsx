'use client';
import { useState, useEffect, useRef } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import 'leaflet/dist/leaflet.css';

// Module-level constant so useJsApiLoader sees a stable reference
const LIBRARIES = ['places'];

// Reverse-geocode a lat/lng → human-readable address
function reverseGeocode(lat, lng, cb) {
  if (typeof window === 'undefined' || !window.google?.maps?.Geocoder) return;
  new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
    if (status === 'OK' && results?.[0]) cb(results[0].formatted_address);
  });
}

/**
 * AddressMapPicker
 *
 * Props:
 *   value           : { lat: number, lng: number, address: string }
 *   onChange        : (val: { lat: number, lng: number, address: string }) => void
 *   label?          : string   (default "ADDRESS")
 *   className?      : string
 *   markerPopupText?: string   (default "Your Location")
 *   mapHeight?      : string   (CSS height, default "420px")
 */
export default function AddressMapPicker({
  value,
  onChange,
  label = 'ADDRESS',
  className = '',
  markerPopupText = 'Your Location',
  mapHeight = '420px',
}) {
  // ── Autocomplete state ────────────────────────────────────────────────────
  const [predictions, setPredictions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const debounceRef = useRef(null);
  const sessionTokenRef = useRef(null);

  // ── Leaflet state ─────────────────────────────────────────────────────────
  const [L, setL] = useState(null);
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  // Tracks the last lat/lng we applied to the map so we can avoid
  // redundant flyTo calls triggered by our own onChange callbacks
  const lastAppliedRef = useRef(null);

  // ── Google Maps JS API ────────────────────────────────────────────────────
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });
  const placesReady =
    mapsLoaded && typeof window !== 'undefined' && !!window.google?.maps?.places;

  // ── Load Leaflet on client only ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Leaflet = (await import('leaflet')).default;
      try {
        delete Leaflet.Icon.Default.prototype._getIconUrl;
        const mi = (await import('leaflet/dist/images/marker-icon.png')).default;
        const mi2 = (await import('leaflet/dist/images/marker-icon-2x.png')).default;
        const ms = (await import('leaflet/dist/images/marker-shadow.png')).default;
        Leaflet.Icon.Default.mergeOptions({
          iconUrl: mi?.src ?? mi,
          iconRetinaUrl: mi2?.src ?? mi2,
          shadowUrl: ms?.src ?? ms,
        });
      } catch {}
      if (!cancelled) setL(Leaflet);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Initialise Leaflet map once L is available ────────────────────────────
  useEffect(() => {
    if (!L || !mapDivRef.current || mapRef.current) return;

    const initLat = value?.lat ?? 17.385044;
    const initLng = value?.lng ?? 78.486671;

    const map = L.map(mapDivRef.current, {
      center: [initLat, initLng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const shopIcon = L.icon({
      iconUrl: '/store.png',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -36],
    });

    const marker = L.marker([initLat, initLng], { draggable: true, icon: shopIcon })
      .addTo(map)
      .bindPopup(`<b>${markerPopupText}</b><br>Drag to fine-tune`)
      .openPopup();

    // Marker dragged → reverse geocode → call onChange
    marker.on('dragend', (e) => {
      const { lat: newLat, lng: newLng } = e.target.getLatLng();
      lastAppliedRef.current = { lat: newLat, lng: newLng };
      setIsGeocoding(true);
      reverseGeocode(newLat, newLng, (addr) => {
        onChange({ lat: newLat, lng: newLng, address: addr });
        setIsGeocoding(false);
      });
    });

    // Map click → move marker + reverse geocode → call onChange
    map.on('click', (e) => {
      const { lat: newLat, lng: newLng } = e.latlng;
      marker.setLatLng([newLat, newLng]);
      lastAppliedRef.current = { lat: newLat, lng: newLng };
      setIsGeocoding(true);
      reverseGeocode(newLat, newLng, (addr) => {
        onChange({ lat: newLat, lng: newLng, address: addr });
        setIsGeocoding(false);
      });
    });

    mapRef.current = map;
    markerRef.current = marker;
    lastAppliedRef.current = { lat: initLat, lng: initLng };
  }, [L]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync map when value.lat/lng changes from outside ─────────────────────
  // (e.g., parent loads saved shop data after mount)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const newLat = value?.lat;
    const newLng = value?.lng;
    if (!newLat || !newLng) return;

    const prev = lastAppliedRef.current;
    // Skip if this update originated from within our own drag/click/pick
    if (
      prev &&
      Math.abs(prev.lat - newLat) < 0.00005 &&
      Math.abs(prev.lng - newLng) < 0.00005
    ) return;

    lastAppliedRef.current = { lat: newLat, lng: newLng };
    mapRef.current.flyTo([newLat, newLng], 15, { animate: true, duration: 0.8 });
    markerRef.current.setLatLng([newLat, newLng]);
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Address box typing → autocomplete predictions ─────────────────────────
  const handleAddressChange = (e) => {
    const addr = e.target.value;
    onChange({ ...(value ?? {}), address: addr });

    if (!placesReady || addr.trim().length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current =
          new window.google.maps.places.AutocompleteSessionToken();
      }
      new window.google.maps.places.AutocompleteService().getPlacePredictions(
        {
          input: addr,
          sessionToken: sessionTokenRef.current,
          componentRestrictions: { country: 'in' },
          types: ['geocode', 'establishment'],
        },
        (results, status) => {
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            results?.length
          ) {
            setPredictions(results);
            setShowDropdown(true);
          } else {
            setPredictions([]);
            setShowDropdown(false);
          }
        }
      );
    }, 300);
  };

  // ── Prediction selected → getDetails → fly map ────────────────────────────
  const pickPrediction = (prediction) => {
    setShowDropdown(false);
    setPredictions([]);
    onChange({ ...(value ?? {}), address: prediction.description });

    if (!placesReady) return;

    new window.google.maps.places.PlacesService(
      document.createElement('div')
    ).getDetails(
      {
        placeId: prediction.place_id,
        fields: ['formatted_address', 'geometry'],
        sessionToken: sessionTokenRef.current,
      },
      (place, status) => {
        sessionTokenRef.current = null; // consume token
        if (
          status !== window.google.maps.places.PlacesServiceStatus.OK ||
          !place?.geometry
        ) return;

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        lastAppliedRef.current = { lat, lng };

        onChange({
          lat,
          lng,
          address: place.formatted_address || prediction.description,
        });

        // Fly map + move marker directly (don't wait for parent re-render)
        if (mapRef.current && markerRef.current) {
          mapRef.current.flyTo([lat, lng], 16, { animate: true, duration: 1.0 });
          markerRef.current.setLatLng([lat, lng]);
        }
      }
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* ── Address search box ─────────────────────────────────────────────── */}
      <div className="relative">
        <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wide">
          {label}
        </label>

        <div className="relative">
          <input
            type="text"
            value={value?.address ?? ''}
            onChange={handleAddressChange}
            onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
            onFocus={() => predictions.length > 0 && setShowDropdown(true)}
            autoComplete="off"
            placeholder="Search for your address…"
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-sm px-3 py-2.5 pr-9 focus:outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)] transition-colors"
          />
          {isGeocoding && (
            <svg
              className="absolute right-2.5 top-3 w-4 h-4 animate-spin text-[var(--muted-foreground)]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>

        <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
          Search above — or click / drag the pin on the map.
        </p>

        {/* Predictions dropdown */}
        {showDropdown && predictions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-[99999] bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
            {predictions.map((p, idx) => (
              <button
                key={p.place_id}
                type="button"
                onMouseDown={() => pickPrediction(p)}
                className={`w-full text-left px-4 py-3 hover:bg-[var(--muted)] flex items-start gap-3 transition-colors ${
                  idx < predictions.length - 1 ? 'border-b border-[var(--border)]' : ''
                }`}
              >
                <svg
                  className="w-4 h-4 mt-0.5 shrink-0 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm text-[var(--foreground)] leading-snug">
                  {p.description}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Map ───────────────────────────────────────────────────────────── */}
      <div
        className="relative rounded-xl overflow-hidden border border-[var(--border)]"
        style={{ height: mapHeight }}
      >
        {L ? (
          <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />
        ) : (
          <div className="w-full h-full bg-[var(--muted)] animate-pulse" />
        )}
        {L && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap backdrop-blur-sm">
           Click map or drag pin to set location
          </div>
        )}
      </div>

      {/* ── Coords ──────────────────────────────────────────────────────────── */}
      {value?.lat != null && value?.lng != null && (
        <p className="text-[10px] text-center text-[var(--muted-foreground)]">
          {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)}
        </p>
      )}
    </div>
  );
}
