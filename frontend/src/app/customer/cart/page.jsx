"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import axios from "axios";
import { useEffect, useState, useCallback, useRef } from "react";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

// Dispatch cart:changed so Navbar badge updates instantly
function notifyCartChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cart:changed"));
  }
}

const Cart = () => {
  const { user } = useUser();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMixedShops, setIsMixedShops] = useState(false);
  // Track which item IDs are currently being saved (optimistic UI)
  const [savingItems, setSavingItems] = useState(new Set());
  const debounceTimers = useRef({});

  const router = useRouter();

  // Recompute mixed-shop warning
  const recomputeMixed = (list) => {
    const shopIds = list.map((it) => it.Items?.shop_id);
    const unique = [...new Set(shopIds.filter(Boolean))];
    setIsMixedShops(unique.length > 1);
  };

  const getItems = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !user) return;
    const token = await getToken();
    try {
      setLoading(true);
      const res = await axios.post(
        `${API_URL}/api/customer/getCart`,
        { clerkId: user.id },
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );
      const fetched = (res.data.cartItems || []).map((it) => ({
        ...it,
        savedQuantity: it.quantity, // last synced quantity
      }));
      setItems(fetched);
      recomputeMixed(fetched);
    } catch (err) {
      console.error("Error fetching cart:", err);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, user, getToken, API_URL]);

  useEffect(() => {
    getItems();
  }, [getItems]);

  // Persist a quantity change to the backend
  const persistQuantityChange = useCallback(
    async (itemId, newQty, oldQty) => {
      if (!user) return;
      const token = await getToken();
      const delta = newQty - oldQty;
      if (delta === 0) return;

      setSavingItems((prev) => new Set(prev).add(itemId));
      try {
        const endpoint =
          delta > 0
            ? `${API_URL}/api/customer/addToCart`
            : `${API_URL}/api/customer/deleteFromCart`;

        const body =
          delta > 0
            ? { clerkId: user.id, itemId, quantity: delta }
            : { clerkId: user.id, itemId, quantity: -delta };

        const result = await axios.post(endpoint, body, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });

        if (result.status !== 200) throw new Error(result.data?.message);

        // Mark new savedQuantity
        setItems((prev) =>
          prev.map((it) =>
            it.item_id === itemId ? { ...it, savedQuantity: newQty } : it
          )
        );
        notifyCartChange();
      } catch (err) {
        console.error("Error updating quantity:", err);
        toast.error("Failed to update quantity");
        // Revert optimistic update
        setItems((prev) =>
          prev.map((it) =>
            it.item_id === itemId ? { ...it, quantity: oldQty } : it
          )
        );
      } finally {
        setSavingItems((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    },
    [user, getToken, API_URL]
  );

  // Adjust quantity: instantly update UI then debounce-save
  const handleQuantityChange = useCallback(
    (itemId, delta) => {
      setItems((prev) => {
        const item = prev.find((it) => it.item_id === itemId);
        if (!item) return prev;

        const newQty = item.quantity + delta;

        // Clicking − on qty=1 → remove item
        if (newQty < 1) {
          // Schedule delete after a tick so animation can run
          setTimeout(() => handleDeleteItem(itemId), 0);
          return prev;
        }

        const updated = prev.map((it) =>
          it.item_id === itemId ? { ...it, quantity: newQty } : it
        );

        // Debounce the API call: reset timer on rapid clicks
        if (debounceTimers.current[itemId]) {
          clearTimeout(debounceTimers.current[itemId]);
        }
        const savedQty = item.savedQuantity ?? item.quantity;
        debounceTimers.current[itemId] = setTimeout(() => {
          persistQuantityChange(itemId, newQty, savedQty);
        }, 500);

        return updated;
      });
    },
    [persistQuantityChange]
  );

  const handleDeleteItem = useCallback(
    async (itemId) => {
      if (!user) return;
      const token = await getToken();

      // Optimistic remove from UI immediately
      setItems((prev) => {
        const updated = prev.filter((it) => it.item_id !== itemId);
        recomputeMixed(updated);
        return updated;
      });

      try {
        const item = items.find((it) => it.item_id === itemId);
        const quantity = item?.savedQuantity ?? item?.quantity ?? 1;

        const result = await axios.post(
          `${API_URL}/api/customer/deleteFromCart`,
          { clerkId: user.id, itemId, quantity },
          { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
        );

        if (result.status !== 200) throw new Error(result.data?.message);

        notifyCartChange();
        toast.success("Item removed");
      } catch (err) {
        console.error("Error deleting item:", err);
        toast.error("Failed to remove item");
        // Re-fetch to restore state
        getItems();
      }
    },
    [user, getToken, API_URL, items, getItems]
  );

  const totalPrice = items.reduce(
    (acc, item) => acc + (item.Items?.price ?? 0) * item.quantity,
    0
  );

  return (
    <div className="px-4 sm:px-6 md:px-10 lg:px-12 py-10 max-w-6xl mx-auto bg-[var(--background)] text-[var(--foreground)] min-h-screen">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Your Cart
        </h1>
        {!loading && (
          <span className="text-sm text-[var(--muted-foreground)]">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      {loading ? (
        // Skeleton
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-pulse">
          <div className="lg:col-span-2 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-[var(--muted)] rounded-lg" />
                  <div className="space-y-2">
                    <div className="h-4 w-40 bg-[var(--muted)] rounded" />
                    <div className="h-3 w-24 bg-[var(--muted)] rounded" />
                  </div>
                </div>
                <div className="h-9 w-32 bg-[var(--muted)] rounded-lg" />
              </div>
            ))}
          </div>
          <aside className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
            <div className="h-5 w-32 bg-[var(--muted)] rounded" />
            <div className="mt-4 space-y-3">
              <div className="h-4 w-full bg-[var(--muted)] rounded" />
              <div className="h-4 w-5/6 bg-[var(--muted)] rounded" />
            </div>
            <div className="mt-5 h-10 w-full bg-[var(--muted)] rounded" />
          </aside>
        </div>
      ) : items.length === 0 ? (
        // Empty state
        <div className="mt-10 flex flex-col items-center justify-center text-center border border-dashed border-[var(--border)] rounded-2xl p-10 bg-[var(--card)]/40">
          <div className="w-24 h-24 rounded-full bg-[var(--muted)] flex items-center justify-center mb-4">
            <ShoppingBag className="w-10 h-10 text-[var(--muted-foreground)]" />
          </div>
          <h2 className="text-2xl font-semibold">Your cart is empty</h2>
          <p className="mt-2 text-[var(--muted-foreground)] max-w-md">
            Looks like you haven't added anything yet. Explore nearby shops and find something you'll love.
          </p>
          <a
            href="/customer/getShops"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold hover:opacity-90 transition-opacity"
          >
            Browse Shops <ArrowRight size={16} />
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Items list */}
          <div className="lg:col-span-2">
            {isMixedShops && (
              <div className="bg-[color-mix(in_oklab,var(--destructive),white_85%)] text-[var(--destructive)] font-semibold p-4 rounded-lg mb-6 border border-[var(--destructive)]/30">
                ⚠️ Items must be from the same shop. Remove items from other shops to proceed.
              </div>
            )}

            <ul className="space-y-3" role="list" aria-label="Cart items">
              <AnimatePresence initial={false}>
                {items.map((item) => {
                  const isSaving = savingItems.has(item.item_id);
                  return (
                    <motion.li
                      key={item.item_id}
                      layout
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0, x: -20 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      role="listitem"
                      className="overflow-hidden"
                    >
                      <div className={`flex flex-col sm:flex-row justify-between items-center bg-[var(--card)] rounded-xl p-4 shadow-sm border transition-all duration-200 ${isSaving ? "border-[var(--primary)]/40 shadow-[var(--primary)]/10 shadow-md" : "border-[var(--border)] hover:shadow-md"}`}>
                        {/* Left: Image + Info */}
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="relative flex-shrink-0">
                            <img
                              src={item.Items?.images?.[0]?.url || "/placeholder.png"}
                              alt={item.Items?.name}
                              className="w-20 h-20 object-cover rounded-lg border border-[var(--border)]"
                            />
                            {isSaving && (
                              <div className="absolute inset-0 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-base truncate">
                                {item.Items?.name || "Unknown Item"}
                              </h3>
                              {item.Items?.description && (
                                <div className="relative group inline-block flex-shrink-0">
                                  <span className="text-[var(--muted-foreground)] text-sm cursor-pointer select-none">ℹ️</span>
                                  <div className="absolute left-0 top-6 w-max max-w-[200px] bg-[var(--popover)] text-[var(--popover-foreground)] text-xs rounded-md px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 border border-[var(--border)] shadow-lg pointer-events-none">
                                    {item.Items.description.slice(0, 120)}
                                    {item.Items.description.length > 120 ? "…" : ""}
                                  </div>
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                              {item.Items?.priceType === "monthly"
                                ? `₹${item.Items?.price}/mo`
                                : `₹${item.Items?.price?.toLocaleString()}`}
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                              Subtotal:{" "}
                              <span className="font-semibold text-[var(--foreground)]">
                                ₹{((item.Items?.price ?? 0) * item.quantity).toLocaleString()}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Right: Quantity stepper + Delete */}
                        <div className="flex items-center gap-3 mt-4 sm:mt-0 flex-shrink-0">
                          {/* Stepper */}
                          <div className="flex items-center rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--muted)]/20">
                            <button
                              onClick={() => handleQuantityChange(item.item_id, -1)}
                              disabled={isSaving}
                              className="px-3 py-2 hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                              aria-label={item.quantity === 1 ? "Remove item" : "Decrease quantity"}
                              title={item.quantity === 1 ? "Remove item" : "Decrease quantity"}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="px-4 py-2 font-semibold text-sm min-w-[2.5rem] text-center tabular-nums select-none">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(item.item_id, 1)}
                              disabled={isSaving}
                              className="px-3 py-2 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                              aria-label="Increase quantity"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          {/* Delete button */}
                          <button
                            onClick={() => handleDeleteItem(item.item_id)}
                            disabled={isSaving}
                            className="p-2 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-all disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                            aria-label={`Remove ${item.Items?.name || "item"} from cart`}
                            title="Remove from cart"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>

          {/* Order Summary sidebar */}
          <aside className="lg:sticky lg:top-20 lg:h-fit bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Order Summary</h2>
            <ul className="mt-4 space-y-2">
              {items.map((item) => (
                <li key={item.item_id} className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
                  <span className="truncate max-w-[60%]">{item.Items?.name}</span>
                  <span className="font-medium text-[var(--foreground)] ml-2 flex-shrink-0">
                    {item.quantity} × ₹{item.Items?.price?.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)] font-medium">Total</span>
              <span className="text-xl font-bold">₹{totalPrice.toLocaleString()}</span>
            </div>
            <button
              onClick={() => router.push("/customer/checkout")}
              disabled={isMixedShops}
              className="w-full mt-4 px-6 py-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-semibold hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              aria-label="Proceed to checkout"
            >
              Proceed to Checkout <ArrowRight size={16} />
            </button>
            {isMixedShops && (
              <p className="mt-2 text-xs text-center text-[var(--destructive)]">
                Remove items from multiple shops to proceed
              </p>
            )}
          </aside>
        </div>
      )}

      {/* Mobile bottom bar */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="fixed inset-x-0 bottom-0 lg:hidden bg-[var(--card)]/95 backdrop-blur border-t border-[var(--border)] p-4 flex items-center justify-between z-40"
          >
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Total</p>
              <p className="text-lg font-bold">₹{totalPrice.toLocaleString()}</p>
            </div>
            <button
              onClick={() => router.push("/customer/checkout")}
              disabled={isMixedShops}
              className="px-5 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
            >
              Checkout <ArrowRight size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Cart;
