"use client";
import { useAuth, useUser } from "@clerk/nextjs";
import axios from "axios";
import { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import ChatbotWidget from "../../../../components/ChatbotWidget.jsx";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

import { Heart, Plus, Minus } from "lucide-react";
import { toast } from "react-hot-toast";

function ShopItemsContent() {
  const { user } = useUser();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const { shop_id } = useParams();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  const [items, setItems] = useState([]);
  const [shopConflictModal, setShopConflictModal] = useState(false);
  const [conflictItem, setConflictItem] = useState(null);
  const [clearCartBusy, setClearCartBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [didInitPriceRange, setDidInitPriceRange] = useState(false);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [isWlLoading, setIsWlLoading] = useState(false);
  const [quantities, setQuantities] = useState({});

  const defaultFilters = {
    categories: [],
    priceRange: [0, 1000000],
    sortBy: "featured",
    rating: 0,
  };

  const [search, setSearch] = useState("");
  const [searchAiOpen, setSearchAiOpen] = useState(false);
  const [searchAiBusy, setSearchAiBusy] = useState(false);
  const [searchVoiceBusy, setSearchVoiceBusy] = useState(false);
  const searchCameraRef = useRef(null);
  const searchUploadRef = useRef(null);
  const [searchImageMode, setSearchImageMode] = useState(false);
  const [searchEmptyMessage, setSearchEmptyMessage] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [categories, setCategories] = useState([]);

  const formatCurrency = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
  const isFilterActive = (filterState) =>
    (filterState.categories?.length || 0) > 0
    || filterState.rating > 0
    || filterState.priceRange?.[0] !== 0
    || filterState.priceRange?.[1] !== 1000000;
  const appliedFilterCount = [
    appliedFilters.categories.length > 0 ? 1 : 0,
    appliedFilters.rating > 0 ? 1 : 0,
    appliedFilters.priceRange[0] !== 0 || appliedFilters.priceRange[1] !== 1000000 ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
  const hasAppliedFilters = isFilterActive(appliedFilters);

  // Get unique values for filters
  const ratings = [4, 3, 2, 1];
  const sortOptions = [
    { value: "featured", label: "Featured" },
    { value: "price-asc", label: "Price: Low to High" },
    { value: "price-desc", label: "Price: High to Low" },
    { value: "name-asc", label: "Name: A to Z" },
    { value: "name-desc", label: "Name: Z to A" },
    { value: "newest", label: "Newest First" }
  ];

  // Reset filters and load state when shop changes
  useEffect(() => {
    setDidInitPriceRange(false);
    setSearch('');
    setSearchEmptyMessage('');
    setPage(1);
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setCategories([]);
  }, [shop_id]);

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const runImageToText = async (base64, hints) => {
    const token = await getToken().catch(() => null);
    const payload = {
      clerkId: user?.id,
      base64Image: base64.includes(',') ? base64.split(',')[1] : base64,
      hints: hints || ''
    };
    const resp = await fetch(`${API_URL}/api/customer/ai/describeImage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload)
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.message || 'AI analyze failed');
    return {
      description: data?.description || '',
      categories: Array.isArray(data?.categories) ? data.categories : [],
      searchQuery: data?.searchQuery || '',
      shortName: data?.shortName || ''
    };
  };

  const onSearchImageChosen = async (file) => {
    if (!file) return;
    try {
      setSearchAiBusy(true);
      setSearchImageMode(true);
      setSearchEmptyMessage('');
      const base64 = await readFileAsBase64(file);
      const aiResp = await runImageToText(base64, search);
      const q = String(aiResp?.shortName || aiResp?.searchQuery || aiResp?.description || '').trim();
      if (q) {
        try {
          const token = await getToken();
          const qs = new URLSearchParams();
          qs.set('page', '1');
          qs.set('limit', String(limit));
          qs.set('search', q);
          if (appliedFilters.categories?.length) qs.set('categories', appliedFilters.categories.join(','));
          const shouldApplyPriceFilter = appliedFilters.priceRange[0] !== 0 || appliedFilters.priceRange[1] !== 1000000;
          if (shouldApplyPriceFilter) {
            if (typeof appliedFilters.priceRange?.[0] === 'number') qs.set('minPrice', String(appliedFilters.priceRange[0]));
            if (typeof appliedFilters.priceRange?.[1] === 'number') qs.set('maxPrice', String(appliedFilters.priceRange[1]));
          }
          if (appliedFilters.rating > 0) qs.set('rating', String(appliedFilters.rating));
          if (appliedFilters.sortBy) qs.set('sort', appliedFilters.sortBy);
          setLoading(true);
          const res = await axios.get(`${API_URL}/api/customer/getShopItem/${shop_id}?${qs.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const payload = res?.data || {};
          const fetchedItems = Array.isArray(payload.items) ? payload.items : [];
          setItems(fetchedItems);
          setTotal(Number(payload.total || 0));
          setTotalPages(Number(payload.totalPages || 1));
          setPage(1);
          if (!fetchedItems.length) {
            console.warn('Shop image search returned no items', { q });
            setSearchEmptyMessage('No items found for the image.');
          }
        } catch (_) { }
      }
    } catch (_) {
    } finally {
      setSearchAiBusy(false);
      setSearchAiOpen(false);
      setLoading(false);
      if (searchCameraRef.current) searchCameraRef.current.value = '';
      if (searchUploadRef.current) searchUploadRef.current.value = '';
    }
  };

  const startVoice = (onResult, onBusy) => {
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return;
      const rec = new SR();
      rec.lang = 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      onBusy(true);
      rec.onresult = (ev) => {
        const txt = String(ev.results?.[0]?.[0]?.transcript || '').trim();
        if (txt) onResult(txt);
      };
      rec.onerror = () => { };
      rec.onend = () => onBusy(false);
      rec.start();
    } catch {
      onBusy(false);
    }
  };

  // --- Fetch items (debounced) ---
  useEffect(() => {
    if (!isLoaded || !shop_id) return;

    let alive = true;
    const fetchItems = async () => {
      try {
        setLoading(true);
        let token;
        try {
          token = await getToken();
        } catch {
          token = null;
        }
        const qs = new URLSearchParams();
        qs.set('page', String(page));
        qs.set('limit', String(limit));
        if (search && search.trim()) qs.set('search', search.trim());
        if (appliedFilters.categories?.length) qs.set('categories', appliedFilters.categories.join(','));
        const shouldApplyPriceFilter = appliedFilters.priceRange[0] !== 0 || appliedFilters.priceRange[1] !== 1000000;
        if (shouldApplyPriceFilter) {
          if (typeof appliedFilters.priceRange?.[0] === 'number') qs.set('minPrice', String(appliedFilters.priceRange[0]));
          if (typeof appliedFilters.priceRange?.[1] === 'number') qs.set('maxPrice', String(appliedFilters.priceRange[1]));
        }
        if (appliedFilters.rating > 0) qs.set('rating', String(appliedFilters.rating));
        if (appliedFilters.sortBy) qs.set('sort', appliedFilters.sortBy);

        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_URL}/api/customer/getShopItem/${shop_id}?${qs.toString()}`, {
          headers,
        });

        const payload = res?.data || {};
        const fetchedItems = Array.isArray(payload.items) ? payload.items : [];
        if (!alive) return;
        setItems(fetchedItems);
        setTotal(Number(payload.total || 0));
        setTotalPages(Number(payload.totalPages || 1));

        const allCategories = new Set(fetchedItems.flatMap((item) => item.category || []));
        if (!alive) return;
        setCategories(Array.from(allCategories).sort());

        if (alive && fetchedItems.length > 0 && !didInitPriceRange) {
          setDidInitPriceRange(true);
        }
      } catch (err) {
        console.error('Error fetching items:', err);
        if (!alive) return;
        setItems([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        if (alive) setLoading(false);
      }
    };

    const delay = setTimeout(fetchItems, 220);
    return () => {
      alive = false;
      clearTimeout(delay);
    };
  }, [user, isLoaded, isSignedIn, getToken, shop_id, page, limit, search, appliedFilters.categories, appliedFilters.priceRange, appliedFilters.rating, appliedFilters.sortBy, API_URL, didInitPriceRange]);

  useEffect(() => {
    const loadWishlist = async () => {
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
    };
    loadWishlist();
  }, [isSignedIn, user?.id, getToken, API_URL]);

  useEffect(() => {
    setPage(1);
  }, [search, appliedFilters.categories, appliedFilters.priceRange, appliedFilters.rating, appliedFilters.sortBy]);

  const displayedItems = items;
  const showingStart = total ? (page - 1) * limit + 1 : 0;
  const showingEnd = total ? Math.min(total, page * limit) : 0;

  // --- Animations ---
  const gridVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        when: "beforeChildren"
      }
    },
  };

  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.98
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        mass: 0.5
      }
    },
    hover: {
      y: -4,
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1]
      }
    },
    tap: {
      scale: 0.98
    }
  };

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
        window.dispatchEvent(new CustomEvent('wishlist:changed', { detail: { delta: -1 } }));
      } else {
        await axios.post(
          `${API_URL}/api/customer/wishlist/add`,
          { clerkId: user.id, itemId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const next = new Set(wishlistIds);
        next.add(itemId);
        setWishlistIds(next);
        window.dispatchEvent(new CustomEvent('wishlist:changed', { detail: { delta: 1 } }));
      }
    } catch (err) {
      console.error('Wishlist toggle failed', err);
      toast.error('Failed to update wishlist');
    }
  };

  const getQty = (id) => quantities[id] || 1;
  const incQty = (id) => setQuantities((prev) => ({ ...prev, [id]: Math.min((prev[id] || 1) + 1, 99) }));
  const decQty = (id) => setQuantities((prev) => ({ ...prev, [id]: Math.max((prev[id] || 1) - 1, 1) }));

  const addToCartQuick = async (itemId) => {
    if (!user) {
      toast.error("Please sign in to add items to cart");
      return;
    }
    const quantity = getQty(itemId);
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_URL}/api/customer/addToCart`,
        { itemId, quantity, clerkId: user.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res?.data?.message === "Not enough stock available") {
        toast.error("Not enough stock available");
      } else {
        toast.success("Added to cart");
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart:changed'));
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to add to cart";
      if (msg.includes("Cannot add items from different shops")) {
        setConflictItem({ itemId, quantity });
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

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] px-6 sm:px-10 lg:px-20 relative">
      {/* Header */}
      <div className="max-w-5xl mx-auto text-center mb-10">
        <h1 className="font-extrabold text-4xl sm:text-5xl md:text-6xl leading-tight tracking-tight text-[var(--foreground)]">
          Items in This Shop
        </h1>
        <p className="mt-4 text-[var(--muted-foreground)] text-base sm:text-lg max-w-2xl mx-auto">
          Browse and find the perfect items from this store.
        </p>
      </div>

      {/* Search + Filter */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col gap-6">
          <div className="relative max-w-2xl mx-auto w-full">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSearchImageMode(false); setSearchEmptyMessage(''); }}
              placeholder="Search items by name or description..."
              className="w-full px-5 py-3 pl-12 bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] shadow-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 rounded-full transition-all duration-200"
            />
            <svg className="w-5 h-5 text-[var(--muted-foreground)] absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                aria-label="Voice search"
                onClick={() => startVoice((t) => setSearch(t), setSearchVoiceBusy)}
                className={`relative overflow-visible p-1 rounded-md border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/60 disabled:opacity-50 ${searchVoiceBusy ? 'ring-2 ring-[var(--primary)]/40' : ''}`}
                disabled={searchVoiceBusy}
              >
                {searchVoiceBusy && (
                  <>
                    <motion.span
                      layoutId="shopitem-voice-pulse-1"
                      className="pointer-events-none absolute -inset-2 rounded-full bg-[var(--primary)]/15"
                      animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.span
                      layoutId="shopitem-voice-pulse-2"
                      className="pointer-events-none absolute -inset-3 rounded-full bg-[var(--primary)]/10"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </>
                )}
                <motion.svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 relative"
                  animate={searchVoiceBusy ? { y: [0, -1.5, 0] } : {}}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <path d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
                  <path d="M19 11a7 7 0 11-14 0h2a5 5 0 1010 0h2z" />
                  <path d="M13 19.95V22h-2v-2.05a8.001 8.001 0 01-6.32-6.9l1.99-.2A6.002 6.002 0 0012 18a6.002 6.002 0 005.33-3.15l1.99.2A8.001 8.001 0 0113 19.95z" />
                </motion.svg>
              </button>
              <div className="relative">
                <button type="button" aria-haspopup="menu" aria-expanded={searchAiOpen} onClick={() => setSearchAiOpen((o) => !o)} className="p-1 rounded-md border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/60 disabled:opacity-50" disabled={searchAiBusy}>
                  {searchAiBusy ? (
                    <motion.span className="inline-block h-4 w-4 rounded-full border-2 border-[var(--primary)] border-t-transparent" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M4 7a2 2 0 012-2h2l1-2h6l1 2h2a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" /><path d="M8 13l2.5-3 2 2.5L15 10l3 4H8z" /></svg>
                  )}
                </button>
                {searchAiOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-48 rounded-md border border-[var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)] shadow-2xl ring-1 ring-black/5 backdrop-blur-sm z-[10000]">
                    <button type="button" className="w-full text-left px-3 py-2 hover:bg-[var(--muted)]/50" onClick={() => searchCameraRef.current && searchCameraRef.current.click()} disabled={searchAiBusy}>Use Camera</button>
                    <button type="button" className="w-full text-left px-3 py-2 hover:bg-[var(--muted)]/50" onClick={() => searchUploadRef.current && searchUploadRef.current.click()} disabled={searchAiBusy}>Upload Photo</button>
                  </div>
                )}
                <input ref={searchCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onSearchImageChosen(e.target.files?.[0])} />
                <input ref={searchUploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => onSearchImageChosen(e.target.files?.[0])} />
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[var(--foreground)] shadow-sm transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 ${hasAppliedFilters ? 'border-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/15' : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:bg-[var(--background)]'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filters</span>
                {hasAppliedFilters ? (
                  <span className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-2 py-0.5 text-[10px] font-semibold">
                    {appliedFilterCount}
                  </span>
                ) : null}
              </button>
              <span className="text-sm text-[var(--muted-foreground)]">
                {total} {total === 1 ? 'item' : 'items'} found
              </span>
            </div>

            <div className="w-full sm:w-48">
              <FormControl fullWidth size="small" sx={{ minWidth: 170, borderRadius: '9999px', backgroundColor: 'var(--card)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--primary)' }, '& .MuiSvgIcon-root': { color: 'var(--muted-foreground)' } }}>
                <InputLabel id="sort-by-label" sx={{ color: 'var(--muted-foreground)' }}>Sort by</InputLabel>
                <Select
                  labelId="sort-by-label"
                  id="sort-by"
                  value={filters.sortBy}
                  label="Sort by"
                  onChange={(e) => {
                    setFilters({ ...filters, sortBy: e.target.value });
                    setAppliedFilters(prev => ({ ...prev, sortBy: e.target.value }));
                  }}
                  sx={{ borderRadius: '9999px', color: 'var(--foreground)' }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        backgroundColor: 'var(--card)',
                        color: 'var(--foreground)',
                        border: '1px solid var(--border)',
                      },
                    },
                  }}
                >
                  {sortOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value} sx={{ color: 'var(--foreground)' }}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </div>

          {/* Filter Panel */}
          <AnimatePresence initial={false}>
            {isFilterOpen && (
              <motion.div
                key="filters-panel"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`bg-[var(--card)] rounded-xl p-6 shadow-sm overflow-hidden ${hasAppliedFilters ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]/10' : 'border border-[var(--border)]'}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Category Filter (multi-select) */}
                  <div>
                    <h3 className="font-medium mb-3 text-[var(--foreground)]">Categories</h3>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => {
                        const active = filters.categories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setFilters((prev) => {
                                const set = new Set(prev.categories);
                                if (set.has(cat)) set.delete(cat); else set.add(cat);
                                return { ...prev, categories: Array.from(set) };
                              });
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--muted)]/70'}`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Price Range Filter */}
                  <div>
                    <h3 className="font-medium mb-4 text-[var(--foreground)]">Price Range</h3>
                    <style>{`
                      .dual-range-slider {
                        position: relative;
                        height: 6px;
                        background: var(--muted);
                        border-radius: 3px;
                        margin: 0.75rem 0 1.5rem;
                      }
                      .dual-range-slider-fill {
                        position: absolute;
                        height: 100%;
                        background: var(--primary);
                        border-radius: 3px;
                        pointer-events: none;
                        top: 0;
                      }
                      .dual-range-slider input[type='range'] {
                        position: absolute;
                        width: 100%;
                        height: 6px;
                        top: 0;
                        background: none;
                        pointer-events: none;
                        -webkit-appearance: none;
                        appearance: none;
                        z-index: 5;
                      }
                      .dual-range-slider input[type='range']::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        appearance: none;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: var(--primary);
                        cursor: grab;
                        pointer-events: auto;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        border: 3px solid var(--card);
                        transition: all 0.2s ease;
                      }
                      .dual-range-slider input[type='range']::-webkit-slider-thumb:hover {
                        box-shadow: 0 0 12px var(--primary), 0 2px 6px rgba(0,0,0,0.3), inset 0 0 0 1px var(--primary);
                        transform: scale(1.1);
                        cursor: grab;
                      }
                      .dual-range-slider input[type='range']::-webkit-slider-thumb:active {
                        cursor: grabbing;
                      }
                      .dual-range-slider input[type='range']:focus {
                        outline: none;
                      }
                      .dual-range-slider input[type='range']:focus::-webkit-slider-thumb {
                        box-shadow: 0 0 16px var(--primary), 0 2px 6px rgba(0,0,0,0.3), inset 0 0 0 2px var(--primary);
                        transform: scale(1.15);
                      }
                      .dual-range-slider input[type='range']::-moz-slider-thumb {
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: var(--primary);
                        cursor: grab;
                        border: 3px solid var(--card);
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        transition: all 0.2s ease;
                      }
                      .dual-range-slider input[type='range']::-moz-slider-thumb:hover {
                        box-shadow: 0 0 12px var(--primary), 0 2px 6px rgba(0,0,0,0.3), inset 0 0 0 1px var(--primary);
                        transform: scale(1.1);
                        cursor: grab;
                      }
                      .dual-range-slider input[type='range']::-moz-slider-thumb:active {
                        cursor: grabbing;
                      }
                      .dual-range-slider input[type='range']:focus::-moz-slider-thumb {
                        box-shadow: 0 0 16px var(--primary), 0 2px 6px rgba(0,0,0,0.3), inset 0 0 0 2px var(--primary);
                        transform: scale(1.15);
                      }
                      .dual-range-slider input[type='range']::-moz-range-track,
                      .dual-range-slider input[type='range']::-moz-range-progress {
                        background: transparent;
                        border: none;
                      }
                      .dual-range-slider input.min-slider {
                        z-index: 5;
                      }
                      .dual-range-slider input.max-slider {
                        z-index: 6;
                      }
                      .range-value-display {
                        text-align: center;
                        color: var(--foreground);
                        font-weight: 600;
                        font-size: 0.9rem;
                        margin-bottom: 0.75rem;
                        letter-spacing: 0.3px;
                      }
                    `}</style>
                    <div className="range-value-display">
                      ₹{formatCurrency(filters.priceRange[0])} — ₹{formatCurrency(filters.priceRange[1])}
                    </div>
                    <div className="dual-range-slider">
                      <div
                        className="dual-range-slider-fill"
                        style={{
                          left: `${(filters.priceRange[0] / 1000000) * 100}%`,
                          right: `${100 - (filters.priceRange[1] / 1000000) * 100}%`,
                        }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={1000000}
                        value={filters.priceRange[0]}
                        onChange={(e) => {
                          const newMin = Math.min(parseInt(e.target.value, 10), filters.priceRange[1]);
                          setFilters({ ...filters, priceRange: [newMin, filters.priceRange[1]] });
                        }}
                        className="min-slider"
                      />
                      <input
                        type="range"
                        min={0}
                        max={1000000}
                        value={filters.priceRange[1]}
                        onChange={(e) => {
                          const newMax = Math.max(parseInt(e.target.value, 10), filters.priceRange[0]);
                          setFilters({ ...filters, priceRange: [filters.priceRange[0], newMax] });
                        }}
                        className="max-slider"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Min</label>
                        <input
                          type="number"
                          min={0}
                          max={filters.priceRange[1]}
                          value={filters.priceRange[0]}
                          onChange={(e) => {
                            const newMin = Math.max(0, Math.min(parseInt(e.target.value || '0', 10), filters.priceRange[1]));
                            setFilters({ ...filters, priceRange: [newMin, filters.priceRange[1]] });
                          }}
                          inputMode="numeric"
                          step={1000}
                          onKeyDown={(e) => { if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault(); }}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Max</label>
                        <input
                          type="number"
                          min={filters.priceRange[0]}
                          max={1000000}
                          value={filters.priceRange[1]}
                          onChange={(e) => {
                            const newMax = Math.min(1000000, Math.max(parseInt(e.target.value || '0', 10), filters.priceRange[0]));
                            setFilters({ ...filters, priceRange: [filters.priceRange[0], newMax] });
                          }}
                          inputMode="numeric"
                          step={1000}
                          onKeyDown={(e) => { if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault(); }}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rating Filter */}
                  <div>
                    <h3 className="font-medium mb-3 text-[var(--foreground)]">Rating</h3>
                    <div className="space-y-2">
                      {[0, ...ratings].map((rating) => (
                        <div key={rating} className="flex items-center">
                          <input
                            type="radio"
                            id={`rating-${rating}`}
                            name="rating"
                            checked={filters.rating === rating}
                            onChange={() => setFilters({ ...filters, rating })}
                            className="h-4 w-4 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--border)]"
                          />
                          <label htmlFor={`rating-${rating}`} className="ml-2 flex items-center cursor-pointer">
                            {rating === 0 ? (
                              <span className="text-sm">All Ratings</span>
                            ) : (
                              <>
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className={`w-4 h-4 ${i < rating ? 'text-yellow-400' : 'text-[var(--muted-foreground)]'}`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                                <span className="ml-1 text-xs text-[var(--muted-foreground)]">& Up</span>
                              </>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>


                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setFilters(defaultFilters);
                      setAppliedFilters(defaultFilters);
                      setPage(1);
                      setDidInitPriceRange(false);
                      setSearchEmptyMessage('');
                      setIsFilterOpen(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] border border-[var(--border)] rounded-full hover:bg-[var(--muted)]/60 transition-colors"
                  >
                    Reset Filters
                  </button>
                  <button
                    onClick={() => {
                      setAppliedFilters(filters);
                      setPage(1);
                      setIsFilterOpen(false);
                    }}
                    className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium rounded-full hover:bg-[var(--primary)]/90 transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Items Grid */}
      <div className="max-w-7xl mx-auto">
        {loading && displayedItems.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: Math.min(limit, 12) }).map((_, i) => (
              <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden animate-pulse">
                <div className="h-44 md:h-48 bg-[var(--muted)]" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-2/3 bg-[var(--muted)] rounded" />
                  <div className="h-4 w-1/2 bg-[var(--muted)] rounded" />
                  <div className="h-8 w-full bg-[var(--muted)] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="text-center py-16">
            <svg className="mx-auto h-16 w-16 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-[var(--foreground)]">{searchImageMode && searchEmptyMessage ? 'No items found for the image' : 'No items found'}</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{searchImageMode && searchEmptyMessage ? 'Try a clearer photo or a different angle.' : "Try adjusting your search or filter to find what you're looking for."}</p>
            <div className="mt-6">
              <button
                onClick={() => {
                  setSearch('');
                  setFilters(defaultFilters);
                  setAppliedFilters(defaultFilters);
                  setPage(1);
                  setDidInitPriceRange(false);
                }}
                className="inline-flex items-center px-4 py-2 border border-[var(--border)] text-sm font-medium rounded-full shadow-sm text-[var(--foreground)] bg-[var(--card)] hover:bg-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              >
                Clear all filters
              </button>
            </div>
          </div>
        ) : (
          <motion.div initial={false} animate="show" variants={gridVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {displayedItems.length > 0 ? (
                displayedItems.map((item) => (
                  <motion.div
                    key={item.id}
                    variants={cardVariants}
                    whileHover="hover"
                    className="group relative bg-[var(--card)] text-[var(--card-foreground)] rounded-2xl shadow-sm overflow-hidden border border-[var(--border)] hover:shadow-md transition-all"
                  >
                    <motion.div whileTap={{ scale: 0.99 }} className="overflow-hidden">
                      <div className="relative h-44 md:h-48 bg-[var(--muted)] overflow-hidden rounded-t-2xl">
                        <Link href={`/customer/getShops/${shop_id}/item/${item.id}`} className="absolute inset-0 block" />
                        <img
                          src={item.images?.[0]?.url || "/placeholder.png"}
                          alt={item.name}
                          className="w-full h-full object-cover object-center"
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(item.id); }}
                          className="absolute top-2 right-2 p-2 rounded-full bg-[var(--card)]/90 border border-[var(--border)] shadow-sm hover:bg-[var(--muted)]/80"
                          aria-pressed={wishlistIds.has(item.id)}
                        >
                          <Heart className={wishlistIds.has(item.id) ? "text-red-500" : "text-[var(--foreground)]"} fill={wishlistIds.has(item.id) ? "currentColor" : "none"} size={18} />
                        </button>
                      </div>

                      <div className="bg-[var(--card)] p-4 md:p-5">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="text-[var(--card-foreground)] text-lg md:text-xl font-semibold truncate">{item.name}</h3>
                          <p className="text-md font-bold text-[var(--primary)]">₹{item.price}</p>
                        </div>
                        <p className="text-sm text-[var(--muted-foreground)] line-clamp-2">{item.description}</p>

                        <div className="mt-3 flex flex-wrap gap-2 min-h-[28px]">
                          {item.category?.map((cat, i) => (
                            <span key={i} className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">{cat}</span>
                          ))}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => decQty(item.id)}
                              aria-label="Decrease quantity"
                              className="h-9 w-9 grid place-items-center rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/60"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <div className="min-w-10 px-2 h-9 grid place-items-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm font-semibold">
                              {getQty(item.id)}
                            </div>
                            <button
                              type="button"
                              onClick={() => incQty(item.id)}
                              aria-label="Increase quantity"
                              className="h-9 w-9 grid place-items-center rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/60"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => addToCartQuick(item.id)}
                            className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-semibold hover:opacity-90"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                ))
              ) : (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full text-center text-[var(--muted-foreground)] mt-8">
                  No items found.
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <div className="max-w-7xl mx-auto mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/60 disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              Prev
              {loading && (
                <svg className="w-3.5 h-3.5 animate-spin text-[var(--muted-foreground)]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              )}
            </span>
          </button>
          <div className="hidden sm:flex items-center gap-1">
            {(() => {
              const len = Math.min(totalPages, 7);
              const start = totalPages > 7 ? Math.max(1, Math.min(page - 3, totalPages - 6)) : 1;
              const nums = Array.from({ length: len }, (_, i) => start + i);
              return nums.map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  disabled={loading}
                  className={`px-3 py-2 rounded-lg border ${page === pageNum ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' : 'bg-[var(--card)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--muted)]/60'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {pageNum}
                </button>
              ));
            })()}
          </div>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/60 disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              Next
              {loading && (
                <svg className="w-3.5 h-3.5 animate-spin text-[var(--muted-foreground)]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              )}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="hidden sm:flex items-center text-sm text-[var(--muted-foreground)] mr-2">
            <span>Showing&nbsp;</span>
            <span className="font-medium text-[var(--foreground)]">{showingStart}-{showingEnd}</span>
            <span>&nbsp;of&nbsp;{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--muted-foreground)]">Page</span>
            <input
              type="number"
              min={1}
              max={totalPages || 1}
              value={page}
              onChange={(e) => {
                const v = Math.max(1, Math.min(Number(e.target.value || 1), totalPages || 1));
                setPage(v);
              }}
              className="w-20 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)]"
            />
            <span className="text-sm text-[var(--muted-foreground)]">of {totalPages}</span>
            {loading && (
              <svg className="w-4 h-4 animate-spin text-[var(--muted-foreground)]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--muted-foreground)]">Per page</span>
            <select
              value={limit}
              onChange={(e) => { setPage(1); setLimit(Number(e.target.value)); }}
              className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)]"
            >
              {[8, 12, 24, 36].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Chatbot Widget */}
      <ChatbotWidget items={items} shopId={shop_id} />

      {/* Shop Conflict Modal — rendered via portal so it sits at document root */}
      {shopConflictModal && ReactDOM.createPortal(
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
                {clearCartBusy ? 'Clearing…' : 'Clear Cart & Add'}
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
export default function ShopItems() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin" />
      </div>
    );
  }

  return <ShopItemsContent />;
}
