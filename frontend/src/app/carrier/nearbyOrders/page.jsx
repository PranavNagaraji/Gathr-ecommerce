'use client';
import { useEffect, useState, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const MAX_DISTANCE_KM = 20;

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  if ([lat1, lon1, lat2, lon2].some(v => v === undefined || v === null || Number.isNaN(Number(v)))) return null;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function NearbyOrders() {
  const { user } = useUser();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Geolocation API location states
  const [location, setLocation] = useState(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState(false);

  const getBrowserLocation = useCallback(() => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      setIsDetectingLocation(true);
      setLocationError(false);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
          setIsDetectingLocation(false);
        },
        (err) => {
          console.error("Geolocation failed:", err);
          setLocation(null);
          setLocationError(true);
          setIsDetectingLocation(false);
          toast.error("Please enable browser location access to view nearby orders");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocation(null);
      setLocationError(true);
      toast.error("Geolocation is not supported by your browser");
    }
  }, []);

  // Try fetching location on mount
  useEffect(() => {
    getBrowserLocation();
  }, [getBrowserLocation]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || !location) return;

    const fetchOrdersAndFilter = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        
        // 1. Fetch pending orders
        const ordersRes = await axios.post(
          `${API_URL}/api/delivery/getPendingDeliveries`,
          { clerkId: user.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const allOrders = ordersRes.data.orders || [];

        // 2. Filter by distance to order.Addresses.location and local rejections
        const carrierLat = location.latitude;
        const carrierLng = location.longitude;

        const rejectedKey = `rejected_orders_${user.id}`;
        const rejectedStr = localStorage.getItem(rejectedKey) || '[]';
        let rejectedList = [];
        try {
          rejectedList = JSON.parse(rejectedStr);
        } catch (_) {}

        const filtered = allOrders
          .map(order => {
            const orderAddr = order.Addresses || {};
            const addrLat = Number(orderAddr.location?.lat ?? orderAddr.location?.latitude);
            const addrLng = Number(orderAddr.location?.long ?? orderAddr.location?.longitude ?? orderAddr.location?.lng);
            const distance = haversineDistance(carrierLat, carrierLng, addrLat, addrLng);
            console.log(`[Order Proximity Debug] Order ID: ${order.id}, Status: ${order.status}, carrierLoc: (${carrierLat}, ${carrierLng}), orderAddrLoc: (${addrLat}, ${addrLng}), Distance: ${distance} km`);
            return { ...order, distance };
          })
          .filter(order => 
            order.distance !== null && 
            order.distance <= MAX_DISTANCE_KM && 
            !rejectedList.includes(order.id)
          );

        console.log(`[Order Proximity Debug] Total pending orders loaded from API: ${allOrders.length}, Orders after <= ${MAX_DISTANCE_KM}km proximity filtering: ${filtered.length}`);
        setOrders(filtered);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load nearby orders");
      } finally {
        setLoading(false);
      }
    };

    fetchOrdersAndFilter();
  }, [user, isLoaded, isSignedIn, location, API_URL, getToken]);

  const handleAcceptOrder = async (orderId) => {
    try {
      const token = await getToken();
      await axios.post(
        `${API_URL}/api/delivery/acceptDelivery`,
        { clerkId: user.id, orderId },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      toast.success('Order accepted');
      setOrders(prev => prev.filter(o => o.id !== orderId));
      router.push(`/carrier/assignedDeliveries/${orderId}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to accept order');
    }
  };

  const handleRejectOrder = (orderId) => {
    try {
      const rejectedKey = `rejected_orders_${user.id}`;
      const rejectedStr = localStorage.getItem(rejectedKey) || '[]';
      let rejectedList = [];
      try {
        rejectedList = JSON.parse(rejectedStr);
      } catch (_) {}
      
      if (!rejectedList.includes(orderId)) {
        rejectedList.push(orderId);
        localStorage.setItem(rejectedKey, JSON.stringify(rejectedList));
      }
      
      setOrders(prev => prev.filter(o => o.id !== orderId));
      toast.success('Order rejected');
    } catch (err) {
      console.error(err);
      toast.error('Failed to reject order');
    }
  };

  return (
    <div className="p-6 md:p-10 bg-[var(--background)] text-[var(--foreground)] min-h-screen">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Nearby Orders</h1>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-[var(--muted-foreground)]">
              Showing available orders within {MAX_DISTANCE_KM}km of your current location.
            </p>
          </div>
        </div>

        {!location ? (
          <div className="flex flex-col items-center justify-center text-center border border-dashed border-[var(--border)] rounded-3xl p-12 bg-[var(--card)]/40 min-h-[350px]">
            <div className="w-20 h-20 rounded-full bg-[var(--muted)] flex items-center justify-center mb-4 text-[var(--muted-foreground)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">Location Access Required</h2>
            <p className="mt-2 text-[var(--muted-foreground)] max-w-sm">
              We need your browser's current location to show nearby orders within {MAX_DISTANCE_KM}km.
            </p>
            <button
              onClick={getBrowserLocation}
              disabled={isDetectingLocation}
              className="mt-6 px-6 py-3 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold hover:opacity-90 transition disabled:opacity-70 flex items-center gap-2"
            >
              {isDetectingLocation ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--primary-foreground)]" />
                  Detecting location...
                </>
              ) : (
                "Turn On Location"
              )}
            </button>
          </div>
        ) : loading ? (
          <div className="grid gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-[var(--border)] rounded-2xl p-6 bg-[var(--card)] animate-pulse">
                <div className="h-5 w-48 bg-[var(--muted)] rounded mb-4" />
                <div className="h-4 w-32 bg-[var(--muted)] rounded mb-2" />
                <div className="h-4 w-64 bg-[var(--muted)] rounded mb-2" />
                <div className="h-4 w-52 bg-[var(--muted)] rounded" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center border border-dashed border-[var(--border)] rounded-3xl p-12 bg-[var(--card)]/40">
            <div className="w-20 h-20 rounded-full bg-[var(--muted)] flex items-center justify-center mb-4 text-[var(--muted-foreground)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">No nearby orders found</h2>
            <p className="mt-2 text-[var(--muted-foreground)] max-w-md">There are no pending orders within {MAX_DISTANCE_KM}km of your location right now.</p>
          </div>
        ) : (
          <motion.div className="grid gap-6" role="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AnimatePresence>
              {orders.map((order) => {
                const shortId = String(order.id || '').slice(-6).toUpperCase();
                const orderItems = order.Cart?.Cart_items?.filter(ci => String(ci.order_id) === String(order.id)) || [];
                const itemsSummary = orderItems.map(ci => `${ci.Items?.name || 'Item'} x ${ci.quantity || 1}`).join(", ") || "No items";

                return (
                  <motion.div
                    role="listitem"
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.25 }}
                    className="border border-[var(--border)] rounded-2xl p-6 bg-[var(--card)] text-[var(--card-foreground)] shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                  >
                    <div className="space-y-3 flex-1 w-full">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-xl font-bold">Order #{shortId}</h2>
                        {order.distance !== null && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--primary)]/10 text-[var(--primary)]">
                            {order.distance.toFixed(1)} km away
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-xs uppercase font-bold text-[var(--muted-foreground)] tracking-wider">Shop Address</h3>
                          <p className="text-sm font-semibold mt-0.5">{order.Shops?.shop_name}</p>
                          <p className="text-sm text-[var(--muted-foreground)]">{order.Shops?.address}</p>
                        </div>
                        <div>
                          <h3 className="text-xs uppercase font-bold text-[var(--muted-foreground)] tracking-wider">Delivery Address</h3>
                          <p className="text-sm font-semibold mt-0.5">{order.Addresses?.title || 'Customer Address'}</p>
                          <p className="text-sm text-[var(--muted-foreground)]">{order.Addresses?.address}</p>
                        </div>
                      </div>

                      <div className="border-t border-[var(--border)] pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <span className="text-xs uppercase font-bold text-[var(--muted-foreground)] tracking-wider block">Items Summary</span>
                          <span className="text-sm mt-0.5 text-[var(--foreground)]">{itemsSummary}</span>
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <span className="text-xs uppercase font-bold text-[var(--muted-foreground)] tracking-wider block">Order Total</span>
                          <span className="text-lg font-black text-[var(--foreground)]">₹{order.amount_paid}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                      <button
                        onClick={() => handleAcceptOrder(order.id)}
                        className="w-full sm:w-auto px-6 py-3 font-semibold rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity text-center"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectOrder(order.id)}
                        className="w-full sm:w-auto px-6 py-3 font-semibold rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/40 transition-colors text-center"
                      >
                        Reject
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
