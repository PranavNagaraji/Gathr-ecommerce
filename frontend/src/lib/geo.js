/**
 * geo.js — Free open-source geolocation utilities
 *
 * Replaces all Google Maps Platform API calls:
 *   - google.maps.Geocoder          → reverseGeocode()
 *   - google.maps.places.*          → searchAddress()
 *   - google.maps.DirectionsService → getDrivingRoute()
 *
 * Primary:  Nominatim (OpenStreetMap) — no key required
 * Fallback: LocationIQ               — set NEXT_PUBLIC_LOCATIONIQ_API_KEY in .env
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const LOCATIONIQ_BASE = 'https://us1.locationiq.com/v1';
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

const NOMINATIM_HEADERS = {
  'Accept-Language': 'en',
  'User-Agent': 'Gathr-App/1.0 (pranavnagaraji22@gmail.com)',
};

// ─────────────────────────────────────────────────────────────────────────────
// Address Search (forward geocoding / autocomplete)
// Returns: Array of { place_id, description, lat, lng }
// ─────────────────────────────────────────────────────────────────────────────
export async function searchAddress(query) {
  if (!query || query.trim().length < 3) return [];

  const locationIqKey = process.env.NEXT_PUBLIC_LOCATIONIQ_API_KEY;

  // ── LocationIQ autocomplete (if key is present) ──────────────────────────
  if (locationIqKey) {
    try {
      const url = new URL(`${LOCATIONIQ_BASE}/autocomplete.php`);
      url.searchParams.set('key', locationIqKey);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('countrycodes', 'in');
      url.searchParams.set('limit', '5');
      url.searchParams.set('dedupe', '1');

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`LocationIQ ${res.status}`);
      const data = await res.json();

      return (data || []).map((item) => ({
        place_id: item.place_id,
        description: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));
    } catch (err) {
      console.warn('[geo] LocationIQ autocomplete failed, falling back to Nominatim:', err.message);
    }
  }

  // ── Nominatim search (primary / fallback) ────────────────────────────────
  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('q', query);
  url.searchParams.set('countrycodes', 'in');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error(`Nominatim search error: ${res.status}`);
  const data = await res.json();

  return (data || []).map((item) => ({
    place_id: item.place_id,
    description: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Reverse Geocoding
// Returns: string (formatted_address) or null
// ─────────────────────────────────────────────────────────────────────────────
export async function reverseGeocode(lat, lng) {
  const locationIqKey = process.env.NEXT_PUBLIC_LOCATIONIQ_API_KEY;

  // ── LocationIQ reverse (if key present) ──────────────────────────────────
  if (locationIqKey) {
    try {
      const url = new URL(`${LOCATIONIQ_BASE}/reverse.php`);
      url.searchParams.set('key', locationIqKey);
      url.searchParams.set('lat', lat);
      url.searchParams.set('lon', lng);
      url.searchParams.set('format', 'json');

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`LocationIQ reverse ${res.status}`);
      const data = await res.json();
      return data?.display_name || null;
    } catch (err) {
      console.warn('[geo] LocationIQ reverse failed, falling back to Nominatim:', err.message);
    }
  }

  // ── Nominatim reverse (primary / fallback) ───────────────────────────────
  const url = new URL(`${NOMINATIM_BASE}/reverse`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', lat);
  url.searchParams.set('lon', lng);

  const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error(`Nominatim reverse error: ${res.status}`);
  const data = await res.json();
  return data?.display_name || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Driving Route (replaces google.maps.DirectionsService)
// start / end: { lat, lng }
// Returns: { coords: [[lat, lng], ...] } or null on failure
// ─────────────────────────────────────────────────────────────────────────────
export async function getDrivingRoute(start, end) {
  if (!start?.lat || !start?.lng || !end?.lat || !end?.lng) return null;

  const url = `${OSRM_BASE}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
  const data = await res.json();

  if (data.code !== 'Ok' || !data.routes?.[0]) return null;

  // GeoJSON coordinates are [lng, lat] — Leaflet expects [lat, lng]
  const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  return { coords };
}
