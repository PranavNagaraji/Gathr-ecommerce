'use client'
import { useState, useEffect, useRef } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Button, Typography } from "@mui/material";
import { Select, ConfigProvider } from 'antd';
import { useUser, useAuth } from "@clerk/nextjs";
import { useTheme } from '@/components/theme/ThemeProvider';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const CATEGORIES = [
  "Grocery", "Electronics", "Clothing", "Food", "Books",
  "Pharmacy", "Home & Kitchen", "Beauty", "Stationery", "Toys", "Other",
];

// Reverse-geocode a lat/lng into a human-readable address using Google Geocoder
function reverseGeocode(lat, lng, cb) {
  if (typeof window === 'undefined' || !window.google?.maps?.Geocoder) return;
  new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
    if (status === 'OK' && results?.[0]) cb(results[0].formatted_address);
  });
}

export default function CreateShop() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
  const router = useRouter();

  const [formData, setFormData] = useState({
    shop_name: "", address: "", contact: "",
    account_no: "", mobile_no: "",
    category: [], image: null,
    location: { latitude: 17.385044, longitude: 78.486671 }, // Hyderabad default
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [otherCategory, setOtherCategory] = useState("");

  // ── Address autocomplete state ──────────────────────────────────────────────
  const [predictions, setPredictions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const debounceRef = useRef(null);
  const sessionTokenRef = useRef(null);

  // ── Leaflet ─────────────────────────────────────────────────────────────────
  const [L, setL] = useState(null);
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // ── Google Maps JS API ──────────────────────────────────────────────────────
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });
  const placesReady = mapsLoaded && typeof window !== 'undefined' && !!window.google?.maps?.places;

  // ── Load Leaflet on client only ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const Leaflet = (await import('leaflet')).default;
      try {
        delete Leaflet.Icon.Default.prototype._getIconUrl;
        Leaflet.Icon.Default.mergeOptions({
          iconUrl: markerIcon.src ?? markerIcon,
          iconRetinaUrl: markerIcon2x.src ?? markerIcon2x,
          shadowUrl: markerShadow.src ?? markerShadow,
        });
      } catch {}
      setL(Leaflet);
    })();
  }, []);

  // ── Initialize Leaflet map once L is available ──────────────────────────────
  useEffect(() => {
    if (!L || !mapDivRef.current || mapRef.current) return;

    const { latitude: lat, longitude: lng } = formData.location;

    const map = L.map(mapDivRef.current, {
      center: [lat, lng],
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
      shadowUrl: markerShadow.src ?? markerShadow,
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
    });

    const marker = L.marker([lat, lng], { draggable: true, icon: shopIcon })
      .addTo(map)
      .bindPopup('<b>Your Shop Location</b><br>Drag to fine-tune')
      .openPopup();

    // Marker dragged → reverse geocode → update address box
    marker.on('dragend', (e) => {
      const { lat: newLat, lng: newLng } = e.target.getLatLng();
      setFormData(prev => ({ ...prev, location: { latitude: newLat, longitude: newLng } }));
      setIsGeocoding(true);
      reverseGeocode(newLat, newLng, (addr) => {
        setFormData(prev => ({ ...prev, address: addr }));
        setIsGeocoding(false);
      });
    });

    // Map click → move marker + reverse geocode
    map.on('click', (e) => {
      const { lat: newLat, lng: newLng } = e.latlng;
      marker.setLatLng([newLat, newLng]);
      setFormData(prev => ({ ...prev, location: { latitude: newLat, longitude: newLng } }));
      setIsGeocoding(true);
      reverseGeocode(newLat, newLng, (addr) => {
        setFormData(prev => ({ ...prev, address: addr }));
        setIsGeocoding(false);
      });
    });

    mapRef.current = map;
    markerRef.current = marker;
  }, [L]); // eslint-disable-line

  // ── Address typing → AutocompleteService predictions ───────────────────────
  const handleAddressChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, address: value }));

    if (!placesReady || value.trim().length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }
      new window.google.maps.places.AutocompleteService().getPlacePredictions(
        {
          input: value,
          sessionToken: sessionTokenRef.current,
          componentRestrictions: { country: 'in' },
          types: ['geocode', 'establishment'],
        },
        (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.length) {
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

  // ── Prediction selected → PlacesService.getDetails → fly map ───────────────
  const pickPrediction = (prediction) => {
    setShowDropdown(false);
    setPredictions([]);
    setFormData(prev => ({ ...prev, address: prediction.description }));

    if (!placesReady) return;

    new window.google.maps.places.PlacesService(document.createElement('div')).getDetails(
      {
        placeId: prediction.place_id,
        fields: ['formatted_address', 'geometry'],
        sessionToken: sessionTokenRef.current,
      },
      (place, status) => {
        sessionTokenRef.current = null; // consume token
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place?.geometry) return;

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        setFormData(prev => ({
          ...prev,
          address: place.formatted_address || prediction.description,
          location: { latitude: lat, longitude: lng },
        }));

        // Fly map smoothly and move marker
        if (mapRef.current && markerRef.current) {
          mapRef.current.flyTo([lat, lng], 16, { animate: true, duration: 1.0 });
          markerRef.current.setLatLng([lat, lng]);
        }
      }
    );
  };

  // ── Other handlers ──────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFormData(prev => ({ ...prev, image: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    const errors = {};
    if (!/^\d{9,18}$/.test(formData.account_no.trim())) {
      errors.account_no = "Account number must be 9–18 digits.";
    }
    if (!/^[6-9]\d{9}$/.test(formData.mobile_no.trim())) {
      errors.mobile_no = "Enter a valid 10-digit Indian mobile number (starting with 6–9).";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const token = await getToken();
    const body = { ...formData, owner_id: user.id, Location: formData.location };
    const res = await fetch(`${API_URL}/api/merchant/add_shop`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) router.push('/merchant/dashboard');
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (!L) {
    return (
      <div className="min-h-screen p-4 md:p-8 bg-[var(--background)]">
        <div className="max-w-7xl mx-auto animate-pulse space-y-6">
          <div className="h-10 w-64 bg-[var(--muted)] rounded" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
            <div className="md:col-span-3 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-[var(--muted)] rounded" />)}
              </div>
              <div className="h-12 bg-[var(--muted)] rounded" />
              <div className="h-10 w-40 bg-[var(--muted)] rounded" />
            </div>
            <div className="md:col-span-2 h-96 bg-[var(--muted)] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorBgContainer: 'var(--card)',
          colorText: 'var(--foreground)',
          colorTextPlaceholder: 'var(--muted-foreground)',
          colorBorder: 'var(--border)',
          optionSelectedBg: 'var(--accent)',
          optionSelectedColor: 'var(--accent-foreground)',
          optionActiveBg: 'var(--muted)',
          controlItemBgHover: 'var(--muted)',
          colorBgElevated: 'var(--popover)',
        }
      }}
    >
      <div className="min-h-screen p-4 md:p-8 bg-[var(--background)] text-[var(--foreground)]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Shop Registration</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
            {/* ── Left: Form ── */}
            <form onSubmit={handleSubmit} className="md:col-span-3 flex flex-col gap-6">

              {/* Basic fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['shop_name', 'contact', 'account_no', 'mobile_no'].map((field) => {
                  const isRequired = ['shop_name', 'account_no', 'mobile_no'].includes(field);
                  const label = field === 'account_no'
                    ? 'ACCOUNT NUMBER *'
                    : field === 'mobile_no'
                    ? 'MOBILE NUMBER *'
                    : field === 'shop_name'
                    ? 'SHOP NAME *'
                    : field.replace(/_/g, ' ').toUpperCase();
                  return (
                    <div key={field}>
                      <Typography variant="subtitle2" sx={{ color: 'var(--muted-foreground)', fontWeight: 600, mb: 0.5 }}>
                        {label}
                      </Typography>
                      <input
                        type="text"
                        name={field}
                        value={formData[field] || ''}
                        onChange={(e) => {
                          handleChange(e);
                          if (fieldErrors[field]) setFieldErrors(prev => ({ ...prev, [field]: '' }));
                        }}
                        required={isRequired}
                        inputMode={['account_no', 'mobile_no'].includes(field) ? 'numeric' : 'text'}
                        className={`w-full bg-transparent border-b-2 text-[var(--foreground)] text-base p-2 focus:outline-none transition-colors ${
                          fieldErrors[field] ? 'border-red-500 focus:border-red-500' : 'border-[var(--border)] focus:border-[var(--ring)]'
                        }`}
                      />
                      {fieldErrors[field] && (
                        <p className="text-red-500 text-xs mt-1">{fieldErrors[field]}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Address with smart predictions */}
              <div className="relative">
                <Typography variant="subtitle2" sx={{ color: 'var(--muted-foreground)', fontWeight: 600, mb: 0.5 }}>
                  ADDRESS
                </Typography>
                <div className="relative">
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleAddressChange}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
                    onFocus={() => predictions.length > 0 && setShowDropdown(true)}
                    autoComplete="off"
                    placeholder="Search for your shop address…"
                    className="w-full bg-transparent border-b-2 border-[var(--border)] text-[var(--foreground)] text-base p-2 pr-8 focus:outline-none focus:border-[var(--ring)] transition-colors"
                  />
                  {isGeocoding && (
                    <svg className="absolute right-2 top-3 w-4 h-4 animate-spin text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                </div>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                  Search an address above — or click / drag the pin on the map.
                </p>

                {/* Predictions dropdown */}
                {showDropdown && predictions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-[99999] bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
                    {predictions.map((p, idx) => (
                      <button
                        key={p.place_id}
                        type="button"
                        onMouseDown={() => pickPrediction(p)}
                        className={`w-full text-left px-4 py-3 hover:bg-[var(--muted)] flex items-start gap-3 transition-colors ${idx < predictions.length - 1 ? 'border-b border-[var(--border)]' : ''}`}
                      >
                        {/* Pin icon */}
                        <svg className="w-4 h-4 mt-0.5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm text-[var(--foreground)] leading-snug">{p.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Categories */}
              <div>
                <Typography variant="subtitle2" sx={{ color: 'var(--muted-foreground)', fontWeight: 600, mb: 0.5 }}>
                  CATEGORIES
                </Typography>
                <Select
                  mode="multiple"
                  value={formData.category}
                  onChange={(values) => setFormData(p => ({ ...p, category: values }))}
                  style={{ width: '100%' }}
                  placeholder="Select categories"
                  maxTagCount="responsive"
                  size="large"
                  styles={{ popup: { root: { background: 'var(--popover)', color: 'var(--popover-foreground)' } } }}
                  options={CATEGORIES.map(v => ({ value: v, label: v }))}
                />
                {formData.category?.includes('Other') && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={otherCategory}
                      onChange={(e) => setOtherCategory(e.target.value)}
                      onBlur={() => {
                        if (otherCategory.trim()) {
                          setFormData(p => ({
                            ...p,
                            category: p.category.filter(c => c !== 'Other').concat(otherCategory.trim()),
                          }));
                          setOtherCategory('');
                        }
                      }}
                      placeholder="Type custom category and press Tab"
                      className="w-full bg-transparent border-b-2 border-[var(--border)] text-[var(--foreground)] text-base p-2 focus:outline-none focus:border-[var(--ring)]"
                    />
                  </div>
                )}
              </div>

              {/* Image upload */}
              <div>
                <label className="text-sm font-medium mb-2 block text-[var(--muted-foreground)]">Shop Image</label>
                <div className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                  <div className="relative aspect-video w-full">
                    {formData.image
                      ? <img src={formData.image} alt="Shop" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-sm text-[var(--muted-foreground)]">No image selected</div>
                    }
                    {formData.image && (
                      <button type="button" onClick={() => setFormData(p => ({ ...p, image: null }))} className="absolute top-2 right-2 h-8 px-3 rounded-full bg-red-600 text-white text-sm">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <label htmlFor="shop-image-upload" className="mt-3 inline-flex items-center gap-2 py-2 px-4 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] font-medium cursor-pointer transition-colors">
                  Upload Image
                </label>
                <input id="shop-image-upload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </div>

              <Button
                type="submit"
                variant="contained"
                sx={{ mt: 1, width: 'fit-content', px: 5, py: 1.5, bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
              >
                Save Shop
              </Button>
            </form>

            {/* ── Right: Map ── */}
            <div className="md:col-span-2 md:sticky md:top-8 h-[420px] md:h-[calc(100vh-10rem)]">
              <div className="w-full h-full rounded-xl overflow-hidden border border-[var(--border)] relative">
                <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />
                {/* Hint pill */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap backdrop-blur-sm">
                  📍 Click map or drag pin to set location
                </div>
              </div>
              {/* Coords display */}
              <p className="mt-2 text-[10px] text-center text-[var(--muted-foreground)]">
                {formData.location.latitude.toFixed(5)}, {formData.location.longitude.toFixed(5)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}