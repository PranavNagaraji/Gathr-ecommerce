'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import axios from 'axios';
import { useRouter, useParams } from 'next/navigation';
import DeliveryRouteMap from '../../../../components/DeliveryRouteMap';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';

export default function AssignedDeliveryDetail() {
  const { user } = useUser();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const params = useParams();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  const [order, setOrder] = useState(null);
  const [carrierLocation, setCarrierLocation] = useState(null);
  const socketRef = useRef(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const getChatKey = (oid) => (oid ? `chat_${oid}` : null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const fetchOrders = async () => {
      try {
        const token = await getToken();
        const res = await axios.post(
          `${API_URL}/api/delivery/getOntheWay`,
          { clerkId: user.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const list = res.data.ShopsAndAddresses || [];
        const found = list.find((o) => String(o.id) === String(params.order_id));
        if (found) {
          setOrder(found);
          // Load chat memory
          const key = getChatKey(found.id);
          if (key && typeof window !== 'undefined') {
            try {
              const raw = localStorage.getItem(key);
              if (raw) setMessages(JSON.parse(raw));
            } catch (_) {}
          }
        }
        else toast.error('Order not found');
      } catch (err) {
        console.error(err);
      }
    };

    const getCarrierLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setCarrierLocation({ lat: latitude, lng: longitude });
          },
          () => {
            setCarrierLocation({ lat: 15.750366871923427, lng: 78.03934675615315 });
          }
        );
      } else {
        setCarrierLocation({ lat: 15.750366871923427, lng: 78.03934675615315 });
      }
    };

    fetchOrders();
    getCarrierLocation();
  }, [user, isLoaded, isSignedIn, params.order_id, API_URL, getToken]);

  // Init socket once order is known
  useEffect(() => {
    if (!order || !API_URL) return;
    if (socketRef.current) return;
    const s = io(API_URL, { withCredentials: true, transports: ['websocket','polling'] });
    socketRef.current = s;
    s.emit('room:join', { orderId: order.id, role: 'carrier', name: user?.fullName || '' });
    s.on('chat:message', (msg) => {
      setMessages((prev) => [...prev.slice(-199), msg]);
      if (!chatOpen) {
        toast.success('New message from customer');
        setChatOpen(true);
      }
    });
    return () => { s.disconnect(); socketRef.current = null; };
  }, [order?.id, API_URL, user?.fullName, chatOpen]);

  // Persist chat memory per order in localStorage
  useEffect(() => {
    const key = getChatKey(order?.id);
    if (!key || typeof window === 'undefined') return;
    try { localStorage.setItem(key, JSON.stringify(messages.slice(-200))); } catch (_) {}
  }, [messages, order?.id]);

  // Periodically publish carrier live location while on this page
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    let timerId;
    const pushLocation = async (lat, long) => {
      try {
        const token = await getToken();
        await axios.post(
          `${API_URL}/api/delivery/updateLocation`,
          { clerkId: user.id, lat, long },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (_) {}
      // Also emit via socket if available
      if (socketRef.current && order?.id) {
        socketRef.current.emit('location:update', { orderId: order.id, lat, long });
      }
    };
    const tick = () => {
      if (!('geolocation' in navigator)) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setCarrierLocation({ lat: latitude, lng: longitude });
          pushLocation(latitude, longitude);
        },
        () => {
          // ignore
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 8000 }
      );
    };
    // fire immediately and then every 5s
    tick();
    timerId = window.setInterval(tick, 5000);
    return () => { if (timerId) window.clearInterval(timerId); };
  }, [isLoaded, isSignedIn, user, getToken, API_URL, order?.id]);

  const sendMessage = () => {
    const text = chatInput.trim();
    if (!text || !socketRef.current || !order) return;
    const msg = { orderId: order.id, from: 'carrier', text, name: user?.fullName || '' };
    socketRef.current.emit('chat:message', msg);
    setMessages((prev) => [...prev.slice(-199), { ...msg, ts: Date.now() }]);
    setChatInput('');
  };

  const handleComplete = async () => {
    if (!order) return;
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_URL}/api/delivery/completeDelivery`,
        { orderId: order.id, clerkId: user.id },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      toast.success(res.data.message || 'Delivery completed');
      // Clear chat memory for this order
      try { const key = getChatKey(order.id); if (key) localStorage.removeItem(key); } catch (_) {}
      router.push('/carrier/assignedDeliveries');
    } catch (error) {
      console.error('Error completing delivery:', error);
      toast.error('Failed to complete delivery');
    }
  };

  const shortId = order ? String(order.id || '').slice(-6).toUpperCase() : '';

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {order ? `Order #${shortId}` : 'Loading...'}
          </h1>
          {order && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
              {order.status}
            </span>
          )}
        </div>

        {!order && <p className="text-[var(--muted-foreground)]">Loading order details...</p>}

        {order && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Map & Chat section (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              {carrierLocation && (
                <div className="rounded-3xl overflow-hidden border border-[var(--border)] shadow-sm bg-[var(--card)] p-1">
                  <DeliveryRouteMap
                    carrierLocation={carrierLocation}
                    shopLocation={order.Shops?.Location}
                    deliveryLocation={order.Addresses?.location}
                    selectedOrder={order}
                    onDeliveryComplete={handleComplete}
                  />
                </div>
              )}

              <div className="space-y-4">
                <button
                  onClick={() => setChatOpen((v) => !v)}
                  className="w-full md:w-auto px-6 py-3 font-semibold rounded-xl bg-neutral-900 text-white dark:bg-[var(--muted)] dark:text-[var(--muted-foreground)] hover:opacity-90 transition"
                >
                  {chatOpen ? 'Hide Chat' : 'Chat with Customer'}
                </button>

                {chatOpen && (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
                    <div className="max-h-64 overflow-y-auto p-4 flex flex-col gap-3">
                      {messages.length === 0 && (
                        <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
                          Send a message to update the customer.
                        </p>
                      )}
                      {messages.map((m, i) => {
                        const me = m.from === 'carrier';
                        return (
                          <div key={i} className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                                me
                                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)] rounded-br-none'
                                  : 'bg-[var(--muted)]/60 text-[var(--foreground)] rounded-bl-none'
                              }`}
                            >
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') sendMessage();
                        }}
                        placeholder="Type a message..."
                        className="flex-1 bg-transparent px-4 py-2.5 rounded-xl border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30 text-sm"
                      />
                      <button
                        onClick={sendMessage}
                        className="px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold hover:opacity-95 transition"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info details panel (1/3 width) */}
            <div className="space-y-6">
              <div className="border border-[var(--border)] rounded-3xl p-6 bg-[var(--card)] text-[var(--card-foreground)] shadow-sm space-y-6">
                {/* Customer Details */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                    Customer Details
                  </h3>
                  <div>
                    <span className="text-xs text-[var(--muted-foreground)] block">Name</span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {order.Users?.fullName ||
                        order.Users?.firstName ||
                        order.Users?.username ||
                        'Customer'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--muted-foreground)] block">Contact Phone</span>
                    <a
                      href={`tel:${order.Addresses?.mobile_no}`}
                      className="text-sm font-semibold text-[var(--primary)] hover:underline block"
                    >
                      {order.Addresses?.mobile_no || 'Not provided'}
                    </a>
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
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {order.Cart?.Cart_items?.filter(item => String(item.order_id) === String(order.id)).map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-sm gap-4">
                        <div className="truncate text-[var(--foreground)]">
                          <span className="font-semibold">{item.quantity}x</span> {item.Items?.name || 'Item'}
                        </div>
                        <div className="font-semibold shrink-0 text-[var(--muted-foreground)]">
                          ₹{(item.Items?.price || 0) * (item.quantity || 1)}
                        </div>
                      </div>
                    ))}
                    {(!order.Cart?.Cart_items || order.Cart.Cart_items.filter(item => String(item.order_id) === String(order.id)).length === 0) && (
                      <p className="text-xs text-[var(--muted-foreground)]">No items loaded</p>
                    )}
                  </div>
                  <div className="border-t border-[var(--border)] pt-4 flex justify-between items-center">
                    <span className="text-sm font-bold text-[var(--foreground)]">Order Total</span>
                    <span className="text-xl font-black text-[var(--foreground)]">
                      ₹{order.amount_paid}
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
