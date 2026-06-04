"use client";

import { useEffect, useRef, useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import axios from "axios";
import { Trash2 } from "lucide-react";
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useJsApiLoader, StandaloneSearchBox } from "@react-google-maps/api";
import { showToast } from "@/components/ui/Notification";

export default function AddressManager() {
  const { user } = useUser();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [addresses, setAddresses] = useState([]);
  const [addressToggle, setAddressToggle] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [addAddress, setAddAddress] = useState({
    title: "",
    address: "",
    location: { latitude: "", longitude: "" },
  });
  const leafletMapRef = useRef(null);
  const [searchBox, setSearchBox] = useState(null);
  const Libraries = ["places"];
  
  const { isLoaded: mapLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: Libraries,
  });

  useEffect(() => {
    let isMounted = true;
    if (typeof window === 'undefined') return;
    (async () => {
      try {
        const L = (await import('leaflet')).default;
        const defaultIcon = L.icon({
          iconUrl: markerIcon.src || markerIcon,
          iconRetinaUrl: markerIcon2x.src || markerIcon2x,
          shadowUrl: markerShadow.src || markerShadow,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });
        if (isMounted) {
          L.Marker.prototype.options.icon = defaultIcon;
        }
      } catch {}
    })();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    const getAddresses = async () => {
      try {
        const token = await getToken();
        const res = await axios.get(`${API_URL}/api/customer/getAddressesByUser/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAddresses(res.data.addresses || []);
      } catch (e) {
        console.error("Error fetching addresses:", e);
      }
    };
    getAddresses();
  }, [isLoaded, isSignedIn, user, getToken, API_URL]);

  const updateAddressFromCoords = (lat, lng) => {
    setAddAddress((prev) => ({
      ...prev,
      location: { latitude: lat, longitude: lng },
    }));

    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results[0]) {
          setAddAddress((prev) => ({
            ...prev,
            address: results[0].formatted_address,
            location: { latitude: lat, longitude: lng },
          }));
        }
      });
    }
  };

  const handleFetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast.error("Geolocation is not supported by your browser.");
      return;
    }
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        if (window.google && window.google.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            setFetchingLocation(false);
            if (status === "OK" && results[0]) {
              setAddAddress((prev) => ({
                ...prev,
                address: results[0].formatted_address,
                location: { latitude: lat, longitude: lng },
              }));
              if (leafletMapRef.current) {
                leafletMapRef.current.setView([lat, lng], 15);
              }
            } else {
              setAddAddress((prev) => ({
                ...prev,
                address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                location: { latitude: lat, longitude: lng },
              }));
              if (leafletMapRef.current) {
                leafletMapRef.current.setView([lat, lng], 15);
              }
            }
          });
        } else {
          setFetchingLocation(false);
          setAddAddress((prev) => ({
            ...prev,
            address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            location: { latitude: lat, longitude: lng },
          }));
          if (leafletMapRef.current) {
            leafletMapRef.current.setView([lat, lng], 15);
          }
        }
      },
      (error) => {
        setFetchingLocation(false);
        showToast.error("Failed to retrieve your location: " + error.message);
      },
      { timeout: 8000 }
    );
  };

  const handleAddAddress = async () => {
    const titleVal = addAddress.title.trim();
    const addressVal = addAddress.address.trim();
    const latVal = addAddress.location.latitude;
    const lngVal = addAddress.location.longitude;

    if (!titleVal) {
      showToast.error("Title field is missing.");
      return;
    }
    if (!addressVal) {
      showToast.error("Address field is missing.");
      return;
    }
    if (latVal === "" || lngVal === "" || latVal == null || lngVal == null) {
      showToast.error("Location coordinates are missing. Please select a point on the map or search for an address.");
      return;
    }

    const duplicate = addresses.find(
      (addr) => addr.address.toLowerCase().trim() === addressVal.toLowerCase().trim()
    );
    if (duplicate) {
      showToast.warning(`The address already exists under the title "${duplicate.title}".`);
      return;
    }

    const duplicateTitle = addresses.find(
      (addr) => addr.title.toLowerCase().trim() === titleVal.toLowerCase().trim()
    );
    if (duplicateTitle) {
      showToast.warning(`An address with the title "${duplicateTitle.title}" already exists.`);
      return;
    }

    try {
      const token = await getToken();
      const result = await axios.post(
        `${API_URL}/api/customer/addAddress`,
        {
          title: titleVal,
          address: addressVal,
          location: {
            lat: Number(latVal),
            long: Number(lngVal),
          },
          desc: "",
          mobile: "",
          clerkId: user.id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = result.data.address;
      setAddresses((prev) => [...prev, data]);
      setAddressToggle(false);
      setAddAddress({ title: "", address: "", location: { latitude: "", longitude: "" } });
      showToast.success("Address added successfully!");
    } catch (e) {
      console.error("Error adding address:", e);
    }
  };

  const handleDeleteAddress = async (id) => {
    try {
      const token = await getToken();
      await axios.post(
        `${API_URL}/api/customer/deleteAddress`,
        { clerkId: user.id, addressId: id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error("Error deleting address:", e);
    }
  };

  return (
    <div className="bg-[var(--card)] text-[var(--card-foreground)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Your Addresses</h2>
        <button
          onClick={() => setAddressToggle(true)}
          className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
        >
          Add Address
        </button>
      </div>
      {addresses.length === 0 ? (
        <div className="text-sm text-[var(--muted-foreground)]">No addresses added yet.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {addresses.map((address, idx) => (
            <div key={idx} className="relative border border-[var(--border)] rounded-xl p-4 bg-[var(--card)]">
              <button
                onClick={() => handleDeleteAddress(address.id)}
                className="absolute top-3 right-3 text-[var(--destructive)] hover:opacity-80"
                aria-label="Delete address"
                title="Delete address"
              >
                <Trash2 size={18} />
              </button>
              <div className="font-semibold mb-1 pr-6">{address.title}</div>
              <div className="text-sm text-[var(--muted-foreground)]">{address.address}</div>
            </div>
          ))}
        </div>
      )}

      {addressToggle && (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[var(--popover)] text-[var(--popover-foreground)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-xl relative space-y-4 shadow-xl">
            <button
              onClick={() => setAddressToggle(false)}
              className="absolute top-3 right-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl font-bold"
              aria-label="Close"
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold">Add New Address</h3>
            
            <div className="space-y-1">
              <label className="text-sm font-medium">Title</label>
              <input
                type="text"
                placeholder="e.g. Home, Work"
                value={addAddress.title}
                onChange={(e) => setAddAddress((p) => ({ ...p, title: e.target.value }))}
                className="border border-[var(--border)] p-2 rounded-md w-full bg-[var(--card)] text-[var(--card-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Address</label>
                <button
                  type="button"
                  onClick={handleFetchCurrentLocation}
                  disabled={fetchingLocation}
                  className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1 font-semibold disabled:opacity-50"
                >
                  {fetchingLocation ? "⏳ Locating..." : "📍 Use Current Location"}
                </button>
              </div>
              {mapLoaded ? (
                <StandaloneSearchBox
                  onLoad={(ref) => setSearchBox(ref)}
                  onPlacesChanged={() => {
                    if (!searchBox) return;
                    const places = searchBox.getPlaces();
                    if (!places || places.length === 0) return;
                    const place = places[0];
                    setAddAddress((prev) => ({
                      ...prev,
                      address: place.formatted_address || prev.address,
                      location: {
                        latitude: place.geometry.location.lat(),
                        longitude: place.geometry.location.lng(),
                      },
                    }));
                    if (leafletMapRef.current) {
                      leafletMapRef.current.setView([place.geometry.location.lat(), place.geometry.location.lng()], 15);
                    }
                  }}
                >
                  <input
                    type="text"
                    placeholder="Search Address"
                    value={addAddress.address}
                    onChange={(e) => setAddAddress((p) => ({ ...p, address: e.target.value }))}
                    className="border border-[var(--border)] p-2 rounded-md w-full bg-[var(--card)] text-[var(--card-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </StandaloneSearchBox>
              ) : (
                <input
                  type="text"
                  placeholder="Address"
                  value={addAddress.address}
                  onChange={(e) => setAddAddress((p) => ({ ...p, address: e.target.value }))}
                  className="border border-[var(--border)] p-2 rounded-md w-full bg-[var(--card)] text-[var(--card-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              )}
            </div>

            <div className="rounded-lg overflow-hidden border border-[var(--border)]">
              <MiniLeafletMap
                style={{ width: "100%", height: "240px" }}
                center={
                  addAddress.location?.latitude && addAddress.location?.longitude
                    ? [Number(addAddress.location.latitude), Number(addAddress.location.longitude)]
                    : [20, 77]
                }
                zoom={addAddress.location?.latitude ? 15 : 4}
                marker={
                  addAddress.location?.latitude && addAddress.location?.longitude ? {
                    position: [Number(addAddress.location.latitude), Number(addAddress.location.longitude)],
                    draggable: true,
                    onDragEnd: (ll) => updateAddressFromCoords(ll.lat, ll.lng),
                  } : null
                }
                onMapClick={(ll) => updateAddressFromCoords(ll.lat, ll.lng)}
                mapRefOut={leafletMapRef}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setAddressToggle(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAddress}
                className="px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniLeafletMap({ style, center, zoom = 13, marker, onMapClick, mapRefOut }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!divRef.current) return;

    let leaflet;
    (async () => {
      try {
        leaflet = (await import('leaflet')).default;

        if (!mapRef.current) {
          const map = leaflet.map(divRef.current, {
            center,
            zoom,
            zoomControl: false,
          });
          leaflet
            .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors',
            })
            .addTo(map);
          if (onMapClick) {
            map.on('click', (e) => onMapClick(e.latlng));
          }
          mapRef.current = map;
          if (mapRefOut) mapRefOut.current = map;
        } else {
          mapRef.current.setView(center, zoom);
        }

        if (marker) {
          const { position, draggable = false, onDragEnd } = marker;
          if (!markerRef.current) {
            const icon = leaflet.icon({ iconUrl: '/destination.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -28] });
            const m = leaflet.marker(position, { draggable, icon }).addTo(mapRef.current);
            if (draggable && onDragEnd) {
              m.on('dragend', (e) => onMapEnd(e, onDragEnd));
            }
            markerRef.current = m;
          } else {
            markerRef.current.setLatLng(position);
            markerRef.current.dragging && markerRef.current.dragging[draggable ? 'enable' : 'disable']?.();
          }
        } else if (markerRef.current) {
          mapRef.current.removeLayer(markerRef.current);
          markerRef.current = null;
        }
      } catch {}
    })();

    function onMapEnd(e, cb) {
      const ll = e.target.getLatLng();
      cb && cb(ll);
    }
  }, [center?.[0], center?.[1], zoom, marker?.position?.[0], marker?.position?.[1], marker?.draggable]);

  return <div style={style} ref={divRef} />;
}
