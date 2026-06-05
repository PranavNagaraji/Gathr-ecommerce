'use client'
import { useAuth, useUser } from "@clerk/nextjs";
import axios from "axios";
import { useEffect, useState, useRef, useMemo } from "react";
import { io } from "socket.io-client";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import 'leaflet/dist/leaflet.css';
import Link from "next/link";

const CartItems = () => {
  const { user } = useUser();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
  const [items, setItems] = useState([]);
  const { order_id } = useParams();
  const [loading, setLoading] = useState(true);

  // Live tracking state
  const [order, setOrder] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null); // {lat,lng}
  const LRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const socketRef = useRef(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const routeLineRef = useRef(null);
  const [etaInfo, setEtaInfo] = useState(null);
  const getChatKey = (oid) => (oid ? `chat_${oid}` : null);

  const [reordering, setReordering] = useState(false);
  const [scheduleDays, setScheduleDays] = useState(7);
  const scheduleKey = (uid, cid) => (uid && cid ? `autoReorder:${uid}:${cid}` : null);
  const [scheduled, setScheduled] = useState(null);

  // Bill summary (must be declared before any early returns to keep hooks order stable)
  const bill = useMemo(() => {
    try {
      const subtotal = (items || []).reduce((s, it) => s + (Number(it?.Items?.price) || 0) * (Number(it?.quantity) || 0), 0);
      const itemCount = (items || []).reduce((s, it) => s + (Number(it?.quantity) || 0), 0);
      return { subtotal, itemCount, paid: Number(order?.amount_paid) || subtotal };
    } catch { return { subtotal: 0, itemCount: 0, paid: Number(order?.amount_paid) || 0 }; }
  }, [items, order?.amount_paid]);

  // Try to notify user by email (backend optional).
  const notifyAutoReorder = async (phase, payload = {}) => {
    if (!order?.cart_id) return;
    try {
      const token = await getToken();
      await axios.post(
        `${API_URL}/api/notify/autoReorder`,
        { clerkId: user?.id, cartId: order.cart_id, phase, ...payload },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {}
  };

  // Pre-notification one hour before due
  const preNotifyKey = (uid, cid, at) => (uid && cid && at ? `autoReorder:prenotify:${uid}:${cid}:${at}` : null);
  useEffect(() => {
    if (!scheduled || !order?.cart_id) return;
    const dueTs = new Date(scheduled.nextAt).getTime();
    if (!Number.isFinite(dueTs)) return;
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();

    // If within next hour and not yet notified, send pre-due email immediately
    if (dueTs > now && dueTs - now <= oneHour) {
      const key = preNotifyKey(user?.id, order.cart_id, scheduled.nextAt);
      try {
        const seen = key && localStorage.getItem(key);
        if (!seen) {
          notifyAutoReorder('pre_due', { nextAt: scheduled.nextAt, frequencyDays: scheduled.frequencyDays, preWindowMinutes: 60 });
          if (key) localStorage.setItem(key, '1');
        }
      } catch {}
    }

    // If more than 1 hour away, schedule a timeout to send at (due - 1h)
    let tId;
    if (dueTs - now > oneHour) {
      const fireIn = (dueTs - now) - oneHour;
      tId = setTimeout(() => {
        const key = preNotifyKey(user?.id, order.cart_id, scheduled.nextAt);
        try {
          const seen = key && localStorage.getItem(key);
          if (!seen) {
            notifyAutoReorder('pre_due', { nextAt: scheduled.nextAt, frequencyDays: scheduled.frequencyDays, preWindowMinutes: 60 });
            if (key) localStorage.setItem(key, '1');
          }
        } catch {}
      }, fireIn);
    }
    return () => { if (tId) clearTimeout(tId); };
  }, [scheduled?.nextAt, scheduled?.frequencyDays, user?.id, order?.cart_id]);

  // Dynamically load Leaflet once on client
  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined' || LRef.current) return;
      try {
        const Lmod = (await import('leaflet')).default;
        LRef.current = Lmod;
        // Set default icon from CDN to avoid bundling asset paths
        const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png';
        const defaultIcon = Lmod.icon({
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          shadowUrl,
          iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });
        Lmod.Marker.prototype.options.icon = defaultIcon;
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    const getOrders = async () => {
      if (!isLoaded || !isSignedIn || !user) return;
      try {
        const token = await getToken();
        const res = await axios.post(
          `${API_URL}/api/customer/getcartitems`,
          { orderId: order_id, clerkId: user.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setItems(res.data.items || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    getOrders();
  }, [user, isLoaded, isSignedIn, order_id]);

  useEffect(() => {
    if (!order?.cart_id) return;
    const key = scheduleKey(user?.id, order.cart_id);
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setScheduled(JSON.parse(raw));
    } catch {}
  }, [user?.id, order?.cart_id]);

  // Fetch order (for status + carrier info)
  useEffect(() => {
    const fetchOrder = async () => {
      if (!isLoaded || !isSignedIn || !user) return;
      try {
        const token = await getToken();
        const res = await axios.post(
          `${API_URL}/api/customer/orders/getByCart`,
          { orderId: order_id, clerkId: user.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const ord = res?.data?.order || null;
        setOrder(ord);
        // Load chat memory for this order once we know the ID
        const key = getChatKey(ord?.id);
        if (key && typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem(key);
            if (raw) setMessages(JSON.parse(raw));
          } catch (_) {}
        }
        const loc = ord?.Users?.delivery_details?.current_location;
        if (loc && (loc.lat != null) && (loc.long != null)) {
          setDriverLoc({ lat: Number(loc.lat), lng: Number(loc.long) });
        }
      } catch (_) {}
    };
    fetchOrder();
  }, [isLoaded, isSignedIn, user, order_id, getToken, API_URL]);

  // Realtime via Socket.IO when ontheway
  useEffect(() => {
    if (!order || !API_URL) return;
    const status = String(order.status || '').toLowerCase();
    if (status !== 'ontheway') return;
    if (socketRef.current) return;
    const s = io(API_URL, { withCredentials: true, transports: ["websocket","polling"] });
    socketRef.current = s;
    s.emit("room:join", { orderId: order.id, role: "customer", name: user?.fullName || user?.firstName || "" });
    s.on("location:update", ({ lat, long }) => {
      if (lat != null && long != null) setDriverLoc({ lat: Number(lat), lng: Number(long) });
    });
    s.on("chat:message", (msg) => {
      setMessages((prev) => [...prev.slice(-199), msg]);
    });
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [order?.id, order?.status, API_URL]);

  // Persist chat memory per order in localStorage
  useEffect(() => {
    const key = getChatKey(order?.id);
    if (!key || typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(messages.slice(-200)));
    } catch (_) {}
  }, [messages, order?.id]);

  // Clear chat memory when order is delivered
  useEffect(() => {
    const key = getChatKey(order?.id);
    if (!key || typeof window === 'undefined') return;
    if (String(order?.status || '').toLowerCase() === 'delivered') {
      try { localStorage.removeItem(key); } catch (_) {}
    }
  }, [order?.status, order?.id]);

  const sendMessage = () => {
    const text = chatInput.trim();
    if (!text || !socketRef.current || !order) return;
    const msg = { orderId: order.id, from: 'customer', text, name: user?.fullName || '' };
    socketRef.current.emit('chat:message', msg);
    setMessages((prev) => [...prev.slice(-199), { ...msg, ts: Date.now() }]);
    setChatInput('');
  };

  // Initialize and update Leaflet map for live driver location (customer view)
  useEffect(() => {
    const L = LRef.current;
    if (!L) return;
    if (!order) return;
    const dest = order?.Addresses?.location || {};
    const destLat = Number(dest.lat ?? dest.latitude);
    const destLng = Number(dest.long ?? dest.longitude);
    if (Number.isNaN(destLat) || Number.isNaN(destLng)) return;

    const center = driverLoc || { lat: destLat, lng: destLng };
    if (!mapInstanceRef.current && mapRef.current) {
      const map = L.map(mapRef.current, { center: [center.lat, center.lng], zoom: 13 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      mapInstanceRef.current = map;
    } else if (mapInstanceRef.current) {
      const z = mapInstanceRef.current.getZoom();
      mapInstanceRef.current.setView([center.lat, center.lng], z);
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // PNG marker icons
    const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png';
    const pngIcon = (path) => L.icon({ iconUrl: path, shadowUrl, iconSize: [32,32], iconAnchor: [16,32], popupAnchor: [0,-28], shadowSize: [41,41] });
    const destIcon = pngIcon('/destination.png');
    const driverIcon = pngIcon('/motorbike.png');

    // Destination marker
    if (!destMarkerRef.current) {
      destMarkerRef.current = L.marker([destLat, destLng], { icon: destIcon }).addTo(map).bindTooltip('Delivery address');
    } else {
      destMarkerRef.current.setLatLng([destLat, destLng]);
    }
    // Driver marker
    if (driverLoc) {
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker([driverLoc.lat, driverLoc.lng], { icon: driverIcon }).addTo(map).bindTooltip('Delivery partner');
      } else {
        driverMarkerRef.current.setLatLng([driverLoc.lat, driverLoc.lng]);
      }
    }
  }, [LRef.current, order?.Addresses?.location, driverLoc?.lat, driverLoc?.lng]);

  useEffect(() => {
    const L = LRef.current;
    if (!L) return;
    if (!order) return;
    const dest = order?.Addresses?.location || {};
    const destLat = Number(dest.lat ?? dest.latitude);
    const destLng = Number(dest.long ?? dest.longitude);
    if (!driverLoc || Number.isNaN(destLat) || Number.isNaN(destLng)) return;
    const url = `https://router.project-osrm.org/route/v1/driving/${driverLoc.lng},${driverLoc.lat};${destLng},${destLat}?overview=full&geometries=geojson`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const route = data?.routes?.[0];
        if (!route) return;
        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const map = mapInstanceRef.current;
        if (!map) return;
        if (routeLineRef.current) {
          routeLineRef.current.setLatLngs(coords);
        } else {
          routeLineRef.current = L.polyline(coords, { color: '#2563eb', weight: 4 }).addTo(map);
        }
        const km = (route.distance || 0) / 1000;
        const min = Math.ceil((route.duration || 0) / 60);
        setEtaInfo({ km: Number(km.toFixed(1)), min });
      })
      .catch(() => {});
  }, [driverLoc?.lat, driverLoc?.lng, order?.Addresses?.location]);

  const clearCurrentCart = async (token) => {
    const res = await axios.post(`${API_URL}/api/customer/getCart`, { clerkId: user.id }, { headers: { Authorization: `Bearer ${token}` } });
    const items = res?.data?.cartItems || [];
    for (const ci of items) {
      try {
        await axios.post(`${API_URL}/api/customer/deleteFromCart`, { clerkId: user.id, itemId: ci.item_id, quantity: ci.quantity }, { headers: { Authorization: `Bearer ${token}` } });
      } catch {}
    }
  };

  const addItemsToCart = async (items, token) => {
    for (const it of items) {
      try {
        await axios.post(`${API_URL}/api/customer/addToCart`, { clerkId: user.id, itemId: it.item_id, quantity: it.quantity }, { headers: { Authorization: `Bearer ${token}` } });
      } catch (e) {
        const msg = e?.response?.data?.message || '';
        if (msg.includes('Cannot add items from different shops')) return 'DIFF_SHOP';
        throw e;
      }
    }
    return 'OK';
  };

  const reorderNow = async () => {
    if (!isLoaded || !isSignedIn || !user || !order?.cart_id) return;
    setReordering(true);
    try {
      const token = await getToken();
      const itemsRes = await axios.post(`${API_URL}/api/customer/getcartitems`, { orderId: order_id, clerkId: user.id }, { headers: { Authorization: `Bearer ${token}` } });
      const prevItems = itemsRes?.data?.items || [];
      let status = await addItemsToCart(prevItems, token);
      if (status === 'DIFF_SHOP') {
        const yes = window.confirm('Your current cart has items from another shop. Replace cart with this order\'s items?');
        if (!yes) { setReordering(false); return; }
        await clearCurrentCart(token);
        status = await addItemsToCart(prevItems, token);
      }
      if (status === 'OK') alert('Items added to your cart');
    } catch {
      alert('Failed to reorder');
    } finally {
      setReordering(false);
    }
  };

  const saveSchedule = () => {
    if (!order?.cart_id) return;
    const key = scheduleKey(user?.id, order.cart_id);
    if (!key) return;
    const nextAt = new Date(Date.now() + scheduleDays * 24 * 60 * 60 * 1000).toISOString();
    const payload = { frequencyDays: scheduleDays, nextAt };
    try { localStorage.setItem(key, JSON.stringify(payload)); setScheduled(payload); alert('Auto-reorder scheduled'); } catch {}
    notifyAutoReorder('scheduled', payload);
  };
  const cancelSchedule = () => {
    if (!order?.cart_id) return;
    const key = scheduleKey(user?.id, order.cart_id);
    if (!key) return;
    try { localStorage.removeItem(key); setScheduled(null); alert('Auto-reorder cancelled'); } catch {}
  };

  // If a schedule is due, prompt to execute now and roll forward
  useEffect(() => {
    if (!scheduled || !order?.cart_id) return;
    try {
      const dueTs = new Date(scheduled.nextAt).getTime();
      if (!Number.isFinite(dueTs)) return;
      if (Date.now() >= dueTs) {
        // Send a heads-up email before prompting
        notifyAutoReorder('due', { nextAt: scheduled.nextAt, frequencyDays: scheduled.frequencyDays });
        const yes = window.confirm('Your scheduled auto-reorder is due. Reorder these items now?');
        if (yes) {
          (async () => {
            await reorderNow();
            const key = scheduleKey(user?.id, order.cart_id);
            const freq = Number(scheduled.frequencyDays) || scheduleDays || 7;
            const nextAt = new Date(Date.now() + freq * 24 * 60 * 60 * 1000).toISOString();
            const payload = { frequencyDays: freq, nextAt };
            try { localStorage.setItem(key, JSON.stringify(payload)); setScheduled(payload); } catch {}
          })();
        }
      }
    } catch {}
  }, [scheduled?.nextAt, scheduled?.frequencyDays, user?.id, order?.cart_id]);

  if (loading) return <div className="text-center mt-10 text-[var(--muted-foreground)]">Loading items...</div>;

  if (!items.length)
    return <div className="text-center mt-10 text-[var(--muted-foreground)]">No items in this cart.</div>;

  const statusLower = String(order?.status || '').toLowerCase().replace(/'/g, '');
  const isPreparing = !['ontheway', 'delivered', 'cancelled'].includes(statusLower);

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Order #{order ? String(order.id).slice(-6).toUpperCase() : ''}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Placed on {order ? new Date(order.created_at).toLocaleString() : 'Loading...'}
            </p>
          </div>
          {order && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 capitalize">
              {order.status?.replace(/'/g,'') || 'pending'}
            </span>
          )}
        </div>

        {order && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column (2/3 width): Live Tracking / Status, Map, Chat */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Delivery Partner Details & ETA if on the way */}
              {String(order.status || '').toLowerCase() === 'ontheway' && (
                <div className="border border-[var(--border)] rounded-3xl p-6 bg-[var(--card)] text-[var(--card-foreground)] shadow-sm space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={order.Users?.delivery_details?.profile?.url || '/avatar.svg'} 
                        alt="Delivery partner" 
                        className="w-12 h-12 rounded-full object-cover border border-[var(--border)]" 
                      />
                      <div>
                        <span className="text-xs text-[var(--muted-foreground)] block">Delivery Partner</span>
                        <span className="text-sm font-bold">
                          {[order.Users?.first_name, order.Users?.last_name].filter(Boolean).join(' ') || 'Delivery Partner'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--muted-foreground)] block">Contact Phone</span>
                      <a href={`tel:${order.Users?.delivery_details?.phone}`} className="text-sm font-semibold text-[var(--primary)] hover:underline">
                        {order.Users?.delivery_details?.phone || 'Phone N/A'}
                      </a>
                    </div>
                  </div>

                  {etaInfo && (
                    <div className="flex gap-4 pt-2 border-t border-[var(--border)]">
                      <div>
                        <span className="text-xs text-[var(--muted-foreground)] block">ETA</span>
                        <span className="text-sm font-bold">~ {etaInfo.min} min</span>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--muted-foreground)] block">Distance</span>
                        <span className="text-sm font-bold">{etaInfo.km} km</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Map View */}
              {String(order.status || '').toLowerCase() === 'ontheway' && (
                <div className="rounded-3xl overflow-hidden border border-[var(--border)] shadow-sm bg-[var(--card)] p-1">
                  <div ref={mapRef} className="w-full h-80 rounded-2xl" />
                </div>
              )}

              {/* Chat Console */}
              {String(order.status || '').toLowerCase() === 'ontheway' && (
                <div className="space-y-4">
                  <button 
                    onClick={() => setChatOpen((v) => !v)} 
                    className="w-full md:w-auto px-6 py-3 font-semibold rounded-xl bg-neutral-900 text-white dark:bg-[var(--muted)] dark:text-[var(--muted-foreground)] hover:opacity-90 transition"
                  >
                    {chatOpen ? 'Hide Chat' : 'Chat with Delivery Partner'}
                  </button>
                  {chatOpen && (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
                      <div className="max-h-64 overflow-y-auto p-4 flex flex-col gap-3">
                        {messages.length === 0 && (
                          <p className="text-sm text-[var(--muted-foreground)] text-center py-4">Say hi to your delivery partner.</p>
                        )}
                        {messages.map((m, i) => {
                          const me = m.from === 'customer';
                          return (
                            <div key={i} className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${me ? 'bg-[var(--primary)] text-[var(--primary-foreground)] rounded-br-none' : 'bg-[var(--muted)]/60 text-[var(--foreground)] rounded-bl-none'}`}>
                                {m.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2 p-3 border-t border-[var(--border)]">
                        <input 
                          value={chatInput} 
                          onChange={(e) => setChatInput(e.target.value)} 
                          onKeyDown={(e)=>{ if(e.key==='Enter') sendMessage(); }} 
                          placeholder="Type a message..." 
                          className="flex-1 bg-transparent px-4 py-2.5 rounded-xl border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30 text-sm" 
                        />
                        <button onClick={sendMessage} className="px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold hover:opacity-95 transition">Send</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Delivered driver details */}
              {String(order.status || '').toLowerCase() === 'delivered' && (
                <div className="border border-[var(--border)] rounded-3xl p-6 bg-[var(--card)] text-[var(--card-foreground)] shadow-sm space-y-4">
                  <div className="flex items-center gap-4">
                    <img 
                      src={order.Users?.delivery_details?.profile?.url || '/avatar.svg'} 
                      alt="Delivery partner" 
                      className="w-16 h-16 rounded-full object-cover border border-[var(--border)]" 
                    />
                    <div>
                      <h3 className="text-lg font-bold">Delivered Successfully!</h3>
                      <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                        Delivered by {[order.Users?.first_name, order.Users?.last_name].filter(Boolean).join(' ') || 'Delivery Partner'}
                      </p>
                      {order.Users?.delivery_details?.phone && (
                        <p className="text-sm text-[var(--muted-foreground)]">Phone: {order.Users.delivery_details.phone}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Pending / Accepted / Placed / Ordered message */}
              {isPreparing && (
                <div className="border border-[var(--border)] rounded-3xl p-10 bg-[var(--card)]/40 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-[var(--muted)] flex items-center justify-center mx-auto mb-2 text-xl">⏳</div>
                  <h3 className="text-lg font-semibold">Preparing Your Order</h3>
                  <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto">
                    The shop is preparing your items. A delivery partner will appear here with live route tracking as soon as they pick it up!
                  </p>
                </div>
              )}

              {/* Cancelled message */}
              {statusLower === 'cancelled' && (
                <div className="border border-[var(--border)] rounded-3xl p-10 bg-[var(--card)]/40 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-[var(--muted)] flex items-center justify-center mx-auto mb-2 text-xl">❌</div>
                  <h3 className="text-lg font-semibold">Order Cancelled</h3>
                  <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto">
                    This order was cancelled. Please check with support or place a new order.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column (1/3 width): Sidebar Info (Reorder, Address, Shop, Items, Bill) */}
            <div className="space-y-6">
              
              {/* Reorder and Scheduling Actions */}
              <div className="border border-[var(--border)] rounded-3xl p-6 bg-[var(--card)] text-[var(--card-foreground)] shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                  Order Actions
                </h3>
                <button 
                  disabled={reordering} 
                  onClick={reorderNow} 
                  className="w-full py-3 font-semibold rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-60 transition text-sm"
                >
                  {reordering ? 'Reordering…' : 'Reorder These Items'}
                </button>
                
                <div className="border-t border-[var(--border)] pt-4 space-y-3">
                  <span className="text-xs text-[var(--muted-foreground)] block font-semibold">Auto-Reorder Schedule</span>
                  <div className="flex gap-2">
                    <select 
                      value={scheduleDays} 
                      onChange={(e)=>setScheduleDays(Number(e.target.value)||7)} 
                      className="flex-1 border border-[var(--border)] rounded-xl px-3 py-2 bg-[var(--card)] text-sm focus:outline-none"
                    >
                      <option value={7}>Every 7 days</option>
                      <option value={14}>Every 14 days</option>
                      <option value={30}>Every 30 days</option>
                    </select>
                    {scheduled ? (
                      <button 
                        onClick={cancelSchedule} 
                        className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--muted)] transition"
                      >
                        Cancel
                      </button>
                    ) : (
                      <button 
                        onClick={saveSchedule} 
                        className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--muted)] transition"
                      >
                        Schedule
                      </button>
                    )}
                  </div>
                  {scheduled && (
                    <p className="text-[11px] text-[var(--muted-foreground)] bg-[var(--muted)]/40 p-2 rounded-lg">
                      Scheduled next: {new Date(scheduled.nextAt).toLocaleDateString()} (every {scheduled.frequencyDays} days)
                    </p>
                  )}
                </div>
              </div>

              {/* Details card */}
              <div className="border border-[var(--border)] rounded-3xl p-6 bg-[var(--card)] text-[var(--card-foreground)] shadow-sm space-y-6">
                
                {/* Customer Details */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                    Customer Details
                  </h3>
                  <div>
                    <span className="text-xs text-[var(--muted-foreground)] block">Name</span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {user?.fullName || 'Customer'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--muted-foreground)] block">Delivery Address</span>
                    <span className="text-sm font-bold text-[var(--foreground)] block">
                      {order.Addresses?.title || 'Address'}
                    </span>
                    <span className="text-sm text-[var(--muted-foreground)] block">
                      {order.Addresses?.address}
                    </span>
                  </div>
                </div>

                {/* Shop Details */}
                <div className="border-t border-[var(--border)] pt-5 space-y-3">
                  <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                    Shop Details
                  </h3>
                  <div>
                    <span className="text-xs text-[var(--muted-foreground)] block">Shop Name</span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {order.Shops?.shop_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--muted-foreground)] block">Address</span>
                    <span className="text-sm text-[var(--muted-foreground)]">
                      {order.Shops?.address}
                    </span>
                  </div>
                </div>

                {/* Order Items */}
                <div className="border-t border-[var(--border)] pt-5 space-y-3">
                  <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                    Order Items
                  </h3>
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {items.map((item) => (
                      <Link 
                        key={item.id} 
                        href={`/customer/getShops/${item.Items?.shop_id}/item/${item.Items?.id}`} 
                        className="flex items-center justify-between text-sm gap-4 group hover:no-underline"
                      >
                        <div className="truncate text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                          <span className="font-semibold text-xs bg-[var(--muted)] px-1.5 py-0.5 rounded mr-1.5">{item.quantity}x</span>
                          {item.Items?.name || 'Item'}
                        </div>
                        <div className="font-semibold shrink-0 text-[var(--muted-foreground)]">
                          ₹{(item.Items?.price || 0) * (item.quantity || 1)}
                        </div>
                      </Link>
                    ))}
                    {items.length === 0 && (
                      <p className="text-xs text-[var(--muted-foreground)]">No items loaded</p>
                    )}
                  </div>
                </div>

                {/* Bill Summary */}
                <div className="border-t border-[var(--border)] pt-5 space-y-2">
                  <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                    Bill Summary
                  </h3>
                  <div className="space-y-1 text-sm text-[var(--muted-foreground)]">
                    <div className="flex justify-between">
                      <span>Subtotal ({bill.itemCount} items)</span>
                      <span>₹{bill.subtotal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="border-t border-[var(--border)] pt-3 flex justify-between items-center">
                    <span className="text-sm font-bold text-[var(--foreground)]">Amount Paid</span>
                    <span className="text-xl font-black text-[var(--foreground)]">
                      ₹{bill.paid.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default CartItems;
