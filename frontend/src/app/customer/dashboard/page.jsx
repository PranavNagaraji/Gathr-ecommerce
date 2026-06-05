"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import axios from "axios";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { toast } from "react-hot-toast";

export default function CustomerDashboard() {
  const { user } = useUser();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  const [location, setLocation] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);

  const [recs, setRecs] = useState([]);
  const [recLoading, setRecLoading] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [isWlLoading, setIsWlLoading] = useState(false);

  const handleGeolocation = () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      setIsDetectingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          localStorage.setItem("userLocation", JSON.stringify(loc));
          setLocation(loc);
          setShowLocationPrompt(false);
          setIsDetectingLocation(false);
        },
        (err) => {
          console.warn("Geolocation permission denied or failed:", err);
          setShowLocationPrompt(true);
          setIsDetectingLocation(false);
        },
        { timeout: 5000 }
      );
    } else {
      setShowLocationPrompt(true);
    }
  };

  // Get geolocation (and cache in localStorage for continuity)
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    const cached = localStorage.getItem("userLocation");
    if (cached) {
      try {
        setLocation(JSON.parse(cached));
        return;
      } catch (_) {}
    }
    setShowLocationPrompt(true);
    handleGeolocation();
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (user) {
      (async () => {
        try {
          const token = await getToken();
          const res = await axios.get(`${API_URL}/api/customer/getAddressesByUser/${user.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setSavedAddresses(res.data.addresses || []);
        } catch (e) {
          console.error("Error fetching saved addresses:", e);
        }
      })();
    }
  }, [user]);

  const locationLabel = useMemo(() => {
    if (!location) return "";
    const lat = location.latitude;
    const lng = location.longitude;
    if (Math.abs(lat - 19.0760) < 0.01 && Math.abs(lng - 72.8777) < 0.01) return "Mumbai, IN";
    if (Math.abs(lat - 28.6139) < 0.01 && Math.abs(lng - 77.2090) < 0.01) return "Delhi, IN";
    if (Math.abs(lat - 12.9716) < 0.01 && Math.abs(lng - 77.5946) < 0.01) return "Bengaluru, IN";
    if (Math.abs(lat - 17.3850) < 0.01 && Math.abs(lng - 78.4867) < 0.01) return "Hyderabad, IN";
    if (Math.abs(lat - 13.0827) < 0.01 && Math.abs(lng - 80.2707) < 0.01) return "Chennai, IN";
    if (Math.abs(lat - 22.5726) < 0.01 && Math.abs(lng - 88.3639) < 0.01) return "Kolkata, IN";
    if (Math.abs(lat - 18.5204) < 0.01 && Math.abs(lng - 73.8567) < 0.01) return "Pune, IN";
    if (Math.abs(lat - 23.0225) < 0.01 && Math.abs(lng - 72.5714) < 0.01) return "Ahmedabad, IN";
    
    const matched = savedAddresses.find((addr) => {
      const aLat = Number(addr.location?.lat ?? addr.location?.latitude);
      const aLng = Number(addr.location?.long ?? addr.location?.longitude ?? addr.location?.lng);
      return Math.abs(aLat - lat) < 0.001 && Math.abs(aLng - lng) < 0.001;
    });
    if (matched) return matched.title;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }, [location, savedAddresses]);

  // Fetch nearby shops (limited)
  useEffect(() => {
    if (!location) return;
    let ignore = false;
    (async () => {
      try {
        setShopsLoading(true);
        const token = await getToken();
        const result = await axios.post(
          `${API_URL}/api/customer/getShops`,
          { lat: location.latitude, long: location.longitude },
          { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
        );
        if (!ignore) setShops(result.data.shops || []);
      } catch {
        if (!ignore) setShops([]);
      } finally {
        if (!ignore) setShopsLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [location, API_URL, getToken]);

  // Fetch personalized recommendations (hot items)
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;
    let ignore = false;
    (async () => {
      try {
        setRecLoading(true);
        const token = await getToken();
        const loc = location || (() => {
          try { return JSON.parse(localStorage.getItem("userLocation") || "null"); } catch { return null; }
        })();
        const qs = new URLSearchParams({ limit: "12" });
        if (loc?.latitude && loc?.longitude) {
          qs.set("lat", String(loc.latitude));
          qs.set("long", String(loc.longitude));
        }
        const res = await axios.get(`${API_URL}/api/customer/recommendations/${user.id}?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!ignore) setRecs(res?.data?.recommendations || []);
      } catch {
        if (!ignore) setRecs([]);
      } finally {
        if (!ignore) setRecLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [isLoaded, isSignedIn, user?.id, API_URL, getToken, location]);

  // Fetch recent orders (small snapshot)
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    let ignore = false;
    (async () => {
      try {
        setOrdersLoading(true);
        const token = await getToken();
        const res = await axios.get(`${API_URL}/api/customer/getcarthistory/${user.id}?page=1&limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!ignore) setOrders(res.data.carts || []);
      } catch {
        if (!ignore) setOrders([]);
      } finally {
        if (!ignore) setOrdersLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [isLoaded, isSignedIn, user, API_URL, getToken]);

  // Fetch counts for quick actions
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    let ignore = false;
    (async () => {
      try {
        const token = await getToken();
        const API = API_URL;
        const [cartRes, wishRes] = await Promise.all([
          axios.post(`${API}/api/customer/getCart`, { clerkId: user.id }, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }),
          axios.post(`${API}/api/customer/wishlist/count`, { clerkId: user.id }, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!ignore) setCartCount(cartRes?.data?.cartItems?.length || 0);
        if (!ignore) setWishlistCount(wishRes?.data?.count || 0);
      } catch {
        if (!ignore) { setCartCount(0); setWishlistCount(0); }
      }
    })();
    return () => { ignore = true; };
  }, [isLoaded, isSignedIn, user, getToken, API_URL]);

  const fetchWishlist = useCallback(async () => {
    if (!isSignedIn || !user?.id) return;
    setIsWlLoading(true);
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_URL}/api/customer/wishlist/list`,
        { clerkId: user.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const ids = new Set((res?.data?.items || []).map((it) => it.id));
      setWishlistIds(ids);
    } catch (_) {
      setWishlistIds(new Set());
    } finally {
      setIsWlLoading(false);
    }
  }, [isSignedIn, user?.id, getToken, API_URL]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  useEffect(() => {
    const handler = () => {
      fetchWishlist();
    };
    window.addEventListener('wishlist:changed', handler);
    return () => window.removeEventListener('wishlist:changed', handler);
  }, [fetchWishlist]);

  const toggleWishlist = async (itemId) => {
    if (!user?.id) return;
    const inWl = wishlistIds.has(itemId);
    try {
      const token = await getToken();
      if (inWl) {
        await axios.post(
          `${API_URL}/api/customer/wishlist/remove`,
          { clerkId: user.id, itemId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const next = new Set(wishlistIds);
        next.delete(itemId);
        setWishlistIds(next);
        setWishlistCount(prev => Math.max(0, prev - 1));
        window.dispatchEvent(new CustomEvent('wishlist:changed', { detail: { delta: -1 } }));
        toast.success("Removed from wishlist");
      } else {
        await axios.post(
          `${API_URL}/api/customer/wishlist/add`,
          { clerkId: user.id, itemId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const next = new Set(wishlistIds);
        next.add(itemId);
        setWishlistIds(next);
        setWishlistCount(prev => prev + 1);
        window.dispatchEvent(new CustomEvent('wishlist:changed', { detail: { delta: 1 } }));
        toast.success("Added to wishlist");
      }
    } catch (err) {
      console.error('Wishlist toggle failed', err);
      toast.error('Failed to update wishlist');
    }
  };

  const name = useMemo(() => user?.firstName || user?.fullName || user?.username || "There", [user]);

  const gridVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
    hover: { y: -2, transition: { duration: 0.15 } },
  };

  const formatOrderId = (id) => {
    const s = String(id || "");
    return s.length > 6 ? s.slice(-6).toUpperCase() : s.toUpperCase();
  };

  // Auto-scroll utilities for horizontal carousels
  const recsTrackRef = useRef(null);
  const shopsTrackRef = useRef(null);
  const catTrackRefs = useRef([]);

  function attachAutoScroll(el, speed = 0.8) {
    if (!el) return () => {};
    let raf;
    let running = true;
    let last;
    const step = (t) => {
      if (!running) return;
      if (last != null) {
        const dt = (t - last) / 16.6667; // ~frames
        el.scrollLeft += speed * dt * 2; // tune speed
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) {
          el.scrollLeft = 0; // loop
        }
      }
      last = t;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const pause = () => { running = false; if (raf) cancelAnimationFrame(raf); };
    const resume = () => { if (!running) { running = true; last = undefined; raf = requestAnimationFrame(step); } };
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('touchend', resume, { passive: true });
    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('touchend', resume);
    };
  }


  const stats = useMemo(() => {
    const totalSpent = (orders || []).reduce((sum, o) => sum + (Number(o.amount_paid) || 0), 0);
    const lastOrderAt = (orders || []).reduce((acc, o) => {
      const t = new Date(o.created_at).getTime();
      return isNaN(t) ? acc : Math.max(acc, t);
    }, 0);
    return {
      totalSpent,
      lastOrderAt,
    };
  }, [orders]);

  const categories = useMemo(() => {
    const set = new Set();
    (recs || []).forEach((it) => {
      if (Array.isArray(it.category)) it.category.forEach((c) => set.add(String(c)));
    });
    (shops || []).forEach((s) => {
      if (Array.isArray(s.category)) s.category.forEach((c) => set.add(String(c)));
    });
    return Array.from(set).slice(0, 10);
  }, [recs, shops]);

  const recsByCategory = useMemo(() => {
    const map = new Map();
    (recs || []).forEach((it) => {
      const key = Array.isArray(it.category) && it.category.length ? String(it.category[0]) : "Popular";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });
    return Array.from(map.entries())
      .sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0))
      .slice(0, 3);
  }, [recs]);

  // Attach auto-scroll after dependent data is declared
  useEffect(() => {
    const cleaners = [];
    if (recsTrackRef.current) cleaners.push(attachAutoScroll(recsTrackRef.current, 0.8));
    if (shopsTrackRef.current) cleaners.push(attachAutoScroll(shopsTrackRef.current, 0.8));
    catTrackRefs.current.forEach((el) => { if (el) cleaners.push(attachAutoScroll(el, 0.8)); });
    return () => cleaners.forEach((fn) => { try { fn && fn(); } catch {} });
  }, [recsByCategory, recs.length, shops.length]);
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="min-h-screen bg-[var(--background)] text-[var(--foreground)] px-6 sm:px-10 lg:px-20">
      {/* Header */}
      <div className="max-w-7xl mx-auto pt-6 pb-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col items-start">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Hi {name},</h1>
            <p className="text-[var(--muted-foreground)] mt-1">Here’s what’s happening nearby</p>
            {location && (
              <button
                onClick={() => setShowLocationPrompt(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--muted)]/50 hover:bg-[var(--muted)] text-xs font-semibold border border-[var(--border)] rounded-full transition mt-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <span>{locationLabel}</span>
                <span className="text-[var(--muted-foreground)] ml-0.5 font-normal">(Change)</span>
              </button>
            )}
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }} className="flex gap-2">
            <Link href="/customer/getShops" className="px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold hover:opacity-90">Browse Shops</Link>
            <Link href="/customer/cart" className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] font-semibold hover:bg-[var(--muted)]/40">View Cart</Link>
          </motion.div>
        </div>

        {/* Animated Hero Banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="mt-6 relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--primary)]/15 via-[var(--card)] to-[var(--primary)]/5">
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            <motion.div
              initial={{ x: -30 }}
              animate={{ x: 30 }}
              transition={{ repeat: Infinity, repeatType: 'mirror', duration: 8, ease: 'easeInOut' }}
              className="absolute -top-10 -left-10 h-48 w-48 rounded-full bg-[var(--primary)]/20 blur-2xl"
            />
            <motion.div
              initial={{ x: 30 }}
              animate={{ x: -30 }}
              transition={{ repeat: Infinity, repeatType: 'mirror', duration: 10, ease: 'easeInOut' }}
              className="absolute -bottom-10 -right-10 h-60 w-60 rounded-full bg-[var(--primary)]/10 blur-3xl"
            />
          </div>
          <div className="relative p-6 sm:p-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="md:col-span-2">
              <h2 className="text-2xl sm:text-3xl font-black leading-tight">Discover best sellers, trending deals, and picks just for you</h2>
              <p className="mt-2 text-sm sm:text-base text-[var(--muted-foreground)]">Curated from shops near you based on your cart history and favorites.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/customer/getShops" className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-semibold hover:opacity-90">Shop now</Link>
                <Link href="/customer/wishlist" className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] font-semibold hover:bg-[var(--muted)]/40">View wishlist</Link>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--muted)]">
                <img src="/HeroPic.jpeg" alt="Featured" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </motion.div>

        

      

      {/* Popular carousels by category */}
      <div className="max-w-7xl mx-auto mt-10">
        {recsByCategory.map(([cat, items], i) => (
          <div key={cat} className="mt-8 first:mt-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Popular in {cat}</h2>
              <Link href="/customer/getShops" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">See more</Link>
            </div>
            <div ref={(el) => (catTrackRefs.current[i] = el)} className="-mx-4 px-4 overflow-x-auto md:hidden">
              <div className="flex gap-4 snap-x snap-mandatory pb-2">
                {items.slice(0, 8).map((it) => (
                  <Link key={it.id} href={`/customer/getShops/${it.shop_id}/item/${it.id}`} className="min-w-[70%] sm:min-w-[260px] snap-start">
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg">
                      <div className="aspect-[4/3] bg-[var(--muted)] relative">
                        <img src={it.images?.[0]?.url || "/placeholder.png"} alt={it.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(it.id); }}
                          className="absolute top-2 right-2 p-2 rounded-full bg-[var(--card)]/90 border border-[var(--border)] shadow-sm hover:bg-[var(--muted)]/80 z-10"
                          aria-pressed={wishlistIds.has(it.id)}
                        >
                          <Heart className={wishlistIds.has(it.id) ? "text-red-500" : "text-[var(--foreground)]"} fill={wishlistIds.has(it.id) ? "currentColor" : "none"} size={16} />
                        </button>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-lg mt-1 truncate">{it.name}</h3>
                        <p className="text-2xl font-bold text-[var(--primary)] mt-1">₹{it.price}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            <motion.div initial="hidden" animate="show" variants={gridVariants} className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence>
                {items.slice(0, 8).map((it) => (
                  <motion.div key={it.id} variants={cardVariants} whileHover="hover" className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                    <Link href={`/customer/getShops/${it.shop_id}/item/${it.id}`} className="block">
                      <div className="aspect-[4/3] bg-[var(--muted)] relative">
                        <img src={it.images?.[0]?.url || "/placeholder.png"} alt={it.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(it.id); }}
                          className="absolute top-2 right-2 p-2 rounded-full bg-[var(--card)]/90 border border-[var(--border)] shadow-sm hover:bg-[var(--muted)]/80 z-10"
                          aria-pressed={wishlistIds.has(it.id)}
                        >
                          <Heart className={wishlistIds.has(it.id) ? "text-red-500" : "text-[var(--foreground)]"} fill={wishlistIds.has(it.id) ? "currentColor" : "none"} size={16} />
                        </button>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-lg mt-1 truncate">{it.name}</h3>
                        <p className="text-2xl font-bold text-[var(--primary)] mt-1">₹{it.price}</p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        ))}
      </div>
      </div>

      {/* Quick Actions */}
      <motion.div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
        <motion.a href="/customer/orders" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--muted)]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted-foreground)]">Orders</span>
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">Recent</span>
          </div>
          <div className="mt-2 text-2xl font-bold">{orders.length || 0}</div>
        </motion.a>
        <motion.a href="/customer/wishlist" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--muted)]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted-foreground)]">Wishlist</span>
          </div>
          <div className="mt-2 text-2xl font-bold">{wishlistCount}</div>
        </motion.a>
        <motion.a href="/customer/cart" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--muted)]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted-foreground)]">Cart</span>
          </div>
          <div className="mt-2 text-2xl font-bold">{cartCount}</div>
        </motion.a>
        <motion.a href="/customer/profile" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--muted)]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted-foreground)]">Profile</span>
          </div>
          <div className="mt-2 text-2xl font-bold">→</div>
        </motion.a>
      </motion.div>

      {/* My statistics */}
      <div className="max-w-7xl mx-auto mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-sm text-[var(--muted-foreground)]">Total spent</div>
          <div className="mt-1 text-2xl font-extrabold">₹{Math.round(stats.totalSpent)}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-sm text-[var(--muted-foreground)]">Last order</div>
          <div className="mt-1 text-base font-semibold">{stats.lastOrderAt ? new Date(stats.lastOrderAt).toLocaleString() : "—"}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-sm text-[var(--muted-foreground)]">Wishlist items</div>
          <div className="mt-1 text-2xl font-extrabold">{wishlistCount}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-sm text-[var(--muted-foreground)]">Cart items</div>
          <div className="mt-1 text-2xl font-extrabold">{cartCount}</div>
        </div>
      </div>

      {/* Hot Items (Recommendations) */}
      <div className="max-w-7xl mx-auto mt-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Hot items near you</h2>
          <Link href="/customer/getShops" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">View all</Link>
        </div>
        {recLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-[var(--muted)]" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-2/3 bg-[var(--muted)] rounded" />
                  <div className="h-4 w-1/2 bg-[var(--muted)] rounded" />
                  <div className="h-7 w-1/3 bg-[var(--muted)] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : recs.length === 0 ? (
          <p className="text-[var(--muted-foreground)]">No hot items yet. Start exploring nearby shops.</p>
        ) : (
          <>
            {/* Mobile carousel */}
            <div ref={recsTrackRef} className="md:hidden -mx-4 px-4 overflow-x-auto">
              <div className="flex gap-4 snap-x snap-mandatory pb-2">
                {recs.slice(0, 8).map((it) => (
                  <Link key={it.id} href={`/customer/getShops/${it.shop_id}/item/${it.id}`} className="min-w-[70%] sm:min-w-[260px] snap-start">
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg">
                      <div className="aspect-[4/3] bg-[var(--muted)] relative">
                        <img src={it.images?.[0]?.url || "/placeholder.png"} alt={it.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(it.id); }}
                          className="absolute top-2 right-2 p-2 rounded-full bg-[var(--card)]/90 border border-[var(--border)] shadow-sm hover:bg-[var(--muted)]/80 z-10"
                          aria-pressed={wishlistIds.has(it.id)}
                        >
                          <Heart className={wishlistIds.has(it.id) ? "text-red-500" : "text-[var(--foreground)]"} fill={wishlistIds.has(it.id) ? "currentColor" : "none"} size={16} />
                        </button>
                      </div>
                      <div className="p-4">
                        <div className="mt-1 flex flex-wrap gap-2 min-h-[28px]">
                          {Array.isArray(it.category) && it.category.slice(0, 2).map((cat, i) => (
                            <span key={i} className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">{cat}</span>
                          ))}
                        </div>
                        <h3 className="font-bold text-lg mt-2 truncate">{it.name}</h3>
                        <p className="text-2xl font-bold text-[var(--primary)] mt-1">₹{it.price}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Desktop grid */}
            <motion.div initial="hidden" animate="show" variants={gridVariants} className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence>
                {recs.slice(0, 8).map((it) => (
                  <motion.div key={it.id} variants={cardVariants} whileHover="hover" className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden hover:shadow-lg">
                    <Link href={`/customer/getShops/${it.shop_id}/item/${it.id}`} className="block">
                      <div className="aspect-[4/3] bg-[var(--muted)] relative">
                        <img src={it.images?.[0]?.url || "/placeholder.png"} alt={it.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(it.id); }}
                          className="absolute top-2 right-2 p-2 rounded-full bg-[var(--card)]/90 border border-[var(--border)] shadow-sm hover:bg-[var(--muted)]/80 z-10"
                          aria-pressed={wishlistIds.has(it.id)}
                        >
                          <Heart className={wishlistIds.has(it.id) ? "text-red-500" : "text-[var(--foreground)]"} fill={wishlistIds.has(it.id) ? "currentColor" : "none"} size={16} />
                        </button>
                      </div>
                      <div className="p-4">
                        <div className="mt-1 flex flex-wrap gap-2 min-h-[28px]">
                          {Array.isArray(it.category) && it.category.slice(0, 2).map((cat, i) => (
                            <span key={i} className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">{cat}</span>
                          ))}
                        </div>
                        <h3 className="font-bold text-lg mt-2 truncate">{it.name}</h3>
                        <p className="text-2xl font-bold text-[var(--primary)] mt-1">₹{it.price}</p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>

      {/* Nearby Shops */}
      <div className="max-w-7xl mx-auto mt-12">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Nearby shops</h2>
          <Link href="/customer/getShops" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">See more</Link>
        </div>
        {shopsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="relative bg-[var(--card)] text-[var(--card-foreground)] rounded-2xl shadow-md overflow-hidden border border-[var(--border)] animate-pulse">
                <div className="h-44 md:h-48 bg-[var(--muted)]" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-2/3 bg-[var(--muted)] rounded" />
                  <div className="h-4 w-1/2 bg-[var(--muted)] rounded" />
                  <div className="h-6 w-1/3 bg-[var(--muted)] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : shops.length === 0 ? (
          <div className="mt-4 text-[var(--muted-foreground)]">No shops found near your location.</div>
        ) : (
          <>
            {/* Mobile carousel */}
            <div ref={shopsTrackRef} className="md:hidden -mx-4 px-4 overflow-x-auto">
              <div className="flex gap-4 snap-x snap-mandatory pb-2">
                {shops.slice(0, 6).map((shop) => (
                  <Link key={shop.id} href={`/customer/getShops/${shop.id}`} className="min-w-[80%] sm:min-w-[300px] snap-start">
                    <div className="relative bg-[var(--card)] text-[var(--card-foreground)] rounded-2xl shadow-md overflow-hidden border border-[var(--border)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg">
                      <div className="h-44 bg-gradient-to-b from-[var(--muted)] to-[var(--card)] overflow-hidden">
                        <img src={shop.image?.url || "/placeholder.png"} alt={shop.shop_name} className="w-full h-full object-cover object-center" />
                      </div>
                      <div className="bg-[var(--card)] p-4">
                        <h3 className="text-lg font-semibold truncate">{shop.shop_name}</h3>
                        <p className="text-sm text-[var(--muted-foreground)] mt-1 truncate">{shop.address}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {shop.category?.slice(0, 3).map((cat, i) => (
                            <span key={i} className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">{cat}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Desktop grid */}
            <motion.div initial="hidden" animate="show" variants={gridVariants} className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {shops.slice(0, 6).map((shop) => (
                  <motion.div key={shop.id} variants={cardVariants} whileHover="hover" className="relative bg-[var(--card)] text-[var(--card-foreground)] rounded-2xl shadow-md overflow-hidden border border-[var(--border)] hover:bg-[var(--muted)]/40 transition-colors duration-200">
                    <Link href={`/customer/getShops/${shop.id}`} className="block">
                      <div className="h-44 md:h-48 bg-gradient-to-b from-[var(--muted)] to-[var(--card)] overflow-hidden">
                        <img src={shop.image?.url || "/placeholder.png"} alt={shop.shop_name} className="w-full h-full object-cover object-center" />
                      </div>
                      <div className="bg-[var(--card)] p-4">
                        <h3 className="text-lg font-semibold truncate">{shop.shop_name}</h3>
                        <p className="text-sm text-[var(--muted-foreground)] mt-1 truncate">{shop.address}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {shop.category?.slice(0, 3).map((cat, i) => (
                            <span key={i} className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">{cat}</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>

      {/* Recent Orders */}
      <div className="max-w-7xl mx-auto mt-12 mb-16">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Recent orders</h2>
          <Link href="/customer/orders" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">View orders</Link>
        </div>
        {ordersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 animate-pulse">
                <div className="h-5 w-40 bg-[var(--muted)] rounded" />
                <div className="h-3 w-28 bg-[var(--muted)] rounded mt-2" />
                <div className="mt-4 h-8 w-full bg-[var(--muted)] rounded" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="text-[var(--muted-foreground)]">No recent orders.</p>
        ) : (
          <motion.div initial="hidden" animate="show" variants={gridVariants} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {orders.map((order) => (
              <motion.div key={order.id} variants={cardVariants} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:shadow-sm transition">
                <Link href={`/customer/orders/${order.cart_id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">Order #{formatOrderId(order.id)}</h3>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] capitalize">{order.payment_status}</span>
                  </div>
                  <div className="mt-3 text-sm flex items-center justify-between">
                    <div className="text-[var(--muted-foreground)]">Amount</div>
                    <div className="font-medium">₹{order.amount_paid}</div>
                  </div>
                  <div className="mt-1 text-sm flex items-center justify-between">
                    <div className="text-[var(--muted-foreground)]">Shop</div>
                    <div className="font-medium truncate max-w-[60%] text-right">{order.Shops?.shop_name}</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
    {showLocationPrompt && isMounted && createPortal(
      <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5 relative">
          {location && (
            <button
              onClick={() => setShowLocationPrompt(false)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Select Your Location</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-2">
              We need your location to show shops and products near you.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleGeolocation}
              disabled={isDetectingLocation}
              className="w-full py-3 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {isDetectingLocation ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--primary-foreground)]" />
                  Detecting Location...
                </>
              ) : (
                "Use Browser Location"
              )}
            </button>

            <div className="text-xs text-[var(--muted-foreground)] font-bold uppercase tracking-wider text-center my-1">
              Or Select an Indian City
            </div>

            <div className="relative">
              <select
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [lat, lng] = e.target.value.split(",").map(Number);
                  const loc = { latitude: lat, longitude: lng };
                  localStorage.setItem("userLocation", JSON.stringify(loc));
                  setLocation(loc);
                  setShowLocationPrompt(false);
                }}
                defaultValue=""
                className="w-full px-4 py-3 bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/30 rounded-xl text-sm font-medium cursor-pointer"
              >
                <option value="" disabled>Select a city...</option>
                <option value="19.0760,72.8777">Mumbai</option>
                <option value="28.6139,77.2090">Delhi</option>
                <option value="12.9716,77.5946">Bengaluru</option>
                <option value="17.3850,78.4867">Hyderabad</option>
                <option value="13.0827,80.2707">Chennai</option>
                <option value="22.5726,88.3639">Kolkata</option>
                <option value="18.5204,73.8567">Pune</option>
                <option value="23.0225,72.5714">Ahmedabad</option>
              </select>
            </div>

            {savedAddresses.length > 0 && (
              <>
                <div className="text-xs text-[var(--muted-foreground)] font-bold uppercase tracking-wider text-center my-1">
                  Or Use a Saved Address
                </div>
                <div className="max-h-40 overflow-y-auto flex flex-col gap-2 pr-1">
                  {savedAddresses.map((addr) => {
                    const lat = Number(addr.location?.lat ?? addr.location?.latitude);
                    const lng = Number(addr.location?.long ?? addr.location?.longitude ?? addr.location?.lng);
                    if (isNaN(lat) || isNaN(lng)) return null;
                    return (
                      <button
                        key={addr.id}
                        onClick={() => {
                          const loc = { latitude: lat, longitude: lng };
                          localStorage.setItem("userLocation", JSON.stringify(loc));
                          setLocation(loc);
                          setShowLocationPrompt(false);
                        }}
                        className="w-full text-left p-3 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)]/50 transition text-sm flex flex-col"
                      >
                        <span className="font-semibold text-[var(--foreground)]">{addr.title}</span>
                        <span className="text-xs text-[var(--muted-foreground)] truncate">{addr.address}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}
  </>
  );
}
