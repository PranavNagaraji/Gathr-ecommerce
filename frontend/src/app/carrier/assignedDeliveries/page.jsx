'use client';
import { useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function AssignedDeliveriesList() {
  const { user } = useUser();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const fetchAssignedOrders = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        
        const res = await axios.post(
          `${API_URL}/api/delivery/getOntheWay`,
          { clerkId: user.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const list = res.data.ShopsAndAddresses || [];
        setOrders(list);
      } catch (err) {
        console.error("Failed to load assigned deliveries:", err);
        toast.error("Failed to load assigned deliveries");
      } finally {
        setLoading(false);
      }
    };

    fetchAssignedOrders();
  }, [user, isLoaded, isSignedIn, API_URL, getToken]);

  return (
    <div className="p-6 md:p-10 bg-[var(--background)] text-[var(--foreground)] min-h-screen">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Assigned Deliveries</h1>
        <p className="text-[var(--muted-foreground)] mb-6">
          Track and manage your active deliveries.
        </p>

        {loading ? (
          <div className="grid gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">No active deliveries</h2>
            <p className="mt-2 text-[var(--muted-foreground)] max-w-md">You do not have any accepted deliveries in progress right now.</p>
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
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                          {order.status}
                        </span>
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

                    <button
                      onClick={() => router.push(`/carrier/assignedDeliveries/${order.id}`)}
                      className="w-full md:w-auto px-6 py-3 font-semibold rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity shrink-0 text-center"
                    >
                      View Route
                    </button>
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
