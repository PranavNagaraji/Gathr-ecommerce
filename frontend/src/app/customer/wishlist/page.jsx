"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import axios from "axios";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ShoppingCart, ArrowLeft } from "lucide-react";
import { toast } from "react-hot-toast";

export default function WishlistPage() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [shopConflictModal, setShopConflictModal] = useState(false);
  const [conflictItem, setConflictItem] = useState(null);
  const [clearCartBusy, setClearCartBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Load wishlist and hydrate with item details
  useEffect(() => {
    const loadWishlist = async () => {
      if (!isSignedIn || !user?.id) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const token = await getToken();
        const res = await axios.post(
          `${API_URL}/api/customer/wishlist/list`,
          { clerkId: user.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setItems((res?.data?.items || []).filter(Boolean));
      } catch (e) {
        console.error("Failed to load wishlist", e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadWishlist();
  }, [isSignedIn, user?.id, API_URL, getToken]);

  const removeFromWishlist = async (itemId) => {
    if (!user?.id) return;
    try {
      const token = await getToken();
      await axios.post(
        `${API_URL}/api/customer/wishlist/remove`,
        { clerkId: user.id, itemId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      window.dispatchEvent(new CustomEvent("wishlist:changed", { detail: { delta: -1 } }));
      toast.success("Removed from wishlist");
    } catch (e) {
      console.error("Failed to remove from wishlist", e);
      toast.error("Failed to remove");
    }
  };

  const addToCart = async (itemId) => {
    if (!user) {
      toast.error("Please sign in to add items to cart");
      return;
    }
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_URL}/api/customer/addToCart`,
        { itemId, quantity: 1, clerkId: user.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res?.data?.message === "Not enough stock available") {
        toast.error("Not enough stock available");
      } else {
        toast.success("Added to cart");
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart:changed'));
      }
    } catch (e) {
      const msg = e?.response?.data?.message || "Failed to add to cart";
      if (msg.includes("Cannot add items from different shops")) {
        setConflictItem({ itemId, quantity: 1 });
        setShopConflictModal(true);
        return;
      }
      toast.error(msg);
    }
  };

  const handleClearCartAndAdd = async () => {
    if (!user || clearCartBusy || !conflictItem) return;
    setClearCartBusy(true);
    try {
      const token = await getToken();
      await axios.post(
        `${API_URL}/api/customer/clearCart`,
        { clerkId: user.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart:changed'));
      const res = await axios.post(
        `${API_URL}/api/customer/addToCart`,
        { itemId: conflictItem.itemId, quantity: conflictItem.quantity, clerkId: user.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShopConflictModal(false);
      if (res?.data?.message === "Not enough stock available") {
        toast.error("Not enough stock available");
      } else {
        toast.success("Cart cleared, item added");
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart:changed'));
      }
    } catch (err) {
      console.error("Failed to clear cart and add item:", err);
      setShopConflictModal(false);
      toast.error("Failed to clear cart and add item. Please try again.");
    } finally {
      setClearCartBusy(false);
      setConflictItem(null);
    }
  };

  const gridVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const cardVariants = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] px-6 sm:px-10 lg:px-20 py-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/customer/getShops">
              <button className="p-2 rounded-full hover:bg-[var(--muted)] transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="font-extrabold text-4xl sm:text-5xl tracking-tight">Your Wishlist</h1>
              <p className="mt-2 text-[var(--muted-foreground)]">Save items you love and add them to cart anytime.</p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="h-48 bg-[var(--muted)]" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-2/3 bg-[var(--muted)] rounded" />
                  <div className="h-4 w-1/2 bg-[var(--muted)] rounded" />
                  <div className="h-8 w-full bg-[var(--muted)] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="mx-auto h-16 w-16 text-[var(--muted-foreground)] mb-4" />
            <h3 className="text-2xl font-semibold mb-2">Your wishlist is empty</h3>
            <p className="text-[var(--muted-foreground)] mb-8">Browse shops and add items to your wishlist by clicking the heart icon.</p>
            <Link href="/customer/getShops">
              <button className="px-6 py-3 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity font-semibold">
                Explore Shops
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="text-[var(--muted-foreground)]">
                {items.length} {items.length === 1 ? 'item' : 'items'} in your wishlist
              </p>
            </div>
            
            <motion.div initial="hidden" animate="show" variants={gridVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence>
                {items.map((item) => (
                  <motion.div 
                    key={item.id} 
                    variants={cardVariants}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <Link href={`/customer/getShops/${item.shop_id}/item/${item.id}`}>
                      <div className="h-48 bg-[var(--muted)] overflow-hidden">
                        <img 
                          src={item.images?.[0]?.url || "/placeholder.png"} 
                          alt={item.name} 
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" 
                        />
                      </div>
                    </Link>
                    
                    <div className="p-4">
                      <div className="mb-3">
                        <Link href={`/customer/getShops/${item.shop_id}/item/${item.id}`}>
                          <h3 className="text-lg font-semibold hover:text-[var(--primary)] transition-colors line-clamp-1">
                            {item.name}
                          </h3>
                        </Link>
                        <p className="text-sm text-[var(--muted-foreground)] mt-1 line-clamp-2">
                          {item.description}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xl font-bold text-[var(--primary)]">
                            ₹{item.price}
                          </span>
                          {item.category && item.category.length > 0 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                              {item.category[0]}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => addToCart(item.id)} 
                          className="flex-1 px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 font-medium"
                        >
                          <ShoppingCart size={16} /> 
                          Add to Cart
                        </button>
                        <button 
                          onClick={() => removeFromWishlist(item.id)} 
                          className="px-3 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]/60 transition-colors flex items-center gap-1 text-red-500"
                          title="Remove from wishlist"
                        >
                          <Heart size={16} fill="currentColor" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>

      {/* Shop Conflict Modal — rendered via portal so it sits at document root */}
      {mounted && shopConflictModal && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShopConflictModal(false); }}
        >
          <div style={{
            background: 'var(--card)', color: 'var(--card-foreground)',
            border: '1px solid var(--border)', borderRadius: '1rem',
            padding: '2rem', maxWidth: '420px', width: '90vw',
            boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column', gap: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '2.75rem', height: '2.75rem', borderRadius: '50%',
                background: 'color-mix(in oklab, #ef4444 20%, var(--card))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="22" height="22" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Different Shop Detected</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', margin: '0.25rem 0 0' }}>Your cart has items from another shop.</p>
              </div>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)', lineHeight: 1.6, margin: 0 }}>
              You can only order from one shop at a time. Clear your cart and add this item, or keep your current cart.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <button
                disabled={clearCartBusy}
                onClick={handleClearCartAndAdd}
                style={{
                  padding: '0.75rem 1rem', borderRadius: '0.625rem', border: 'none',
                  cursor: clearCartBusy ? 'not-allowed' : 'pointer',
                  background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                  opacity: clearCartBusy ? 0.7 : 1, transition: 'opacity 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
              >
                {clearCartBusy ? 'Clearing…' : '🗑️  Clear Cart & Add'}
              </button>
              <button
                disabled={clearCartBusy}
                onClick={() => setShopConflictModal(false)}
                style={{
                  padding: '0.75rem 1rem', borderRadius: '0.625rem',
                  border: '1px solid var(--border)', cursor: 'pointer',
                  background: 'var(--muted)', color: 'var(--muted-foreground)',
                  fontWeight: 600, fontSize: '0.95rem',
                }}
              >
                Keep Cart
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}