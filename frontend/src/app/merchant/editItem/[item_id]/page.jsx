'use client'
import { useEffect, useState, useMemo } from "react"
import { createPortal } from "react-dom"
import { useParams, useRouter } from "next/navigation"
import { useUser, useAuth } from "@clerk/nextjs"
import axios from "axios"
// 🔹 Import AntD components
import { Select, Input, ConfigProvider, theme, Spin } from "antd"
import { useTheme } from "@/components/theme/ThemeProvider"
import toast from 'react-hot-toast';

export default function EditItemPage() {
  const router = useRouter()
  const { item_id } = useParams()
  const { user } = useUser()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL
  const { theme: currentTheme } = useTheme()

  const categoryOptions = [
    "Fruits", "Vegetables", "Dairy", "Bakery", "Beverages",
    "Snacks", "Frozen", "Meat", "Seafood", "Grains",
    "Spices", "Condiments", "Breakfast", "Coffee & Tea", "Juices",
    "Personal Care", "Cleaning", "Pet Food", "Organic", "Health"
  ]

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    quantity: "",
    price: "",
    category: [],
    images: [],
    id: ""
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [showAiTitleModal, setShowAiTitleModal] = useState(false)
  const [aiModalTitleInput, setAiModalTitleInput] = useState("")

  useEffect(() => {
    setMounted(true)
  }, [])

  const [hasShop, setHasShop] = useState(null);
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/merchant/check_shop_exists`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ owner_id: user.id }),
        });
        setHasShop(res.ok);
      } catch {
        setHasShop(false);
      }
    })();
  }, [user, isLoaded, isSignedIn, API_URL, getToken]);

  useEffect(() => {
    if (hasShop === false) {
      toast.error("Please set up your shop first before editing items.", { duration: 4000 });
      router.push('/merchant/createShop');
    }
  }, [hasShop]);

  useEffect(() => {
    if (showAiTitleModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAiTitleModal]);

  const [isDuplicateTitle, setIsDuplicateTitle] = useState(false);

  useEffect(() => {
    const trimmedTitle = formData.name.trim();
    if (!trimmedTitle) {
      setIsDuplicateTitle(false);
      return;
    }

    const handler = setTimeout(async () => {
      if (!user || !isLoaded || !isSignedIn) return;
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/merchant/check_duplicate_title`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: trimmedTitle,
            owner_id: user.id,
            excludeId: item_id
          })
        });
        if (res.ok) {
          const data = await res.json();
          setIsDuplicateTitle(data.exists);
        }
      } catch (err) {
        console.error("Error checking duplicate title:", err);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [formData.name, user, isLoaded, isSignedIn, item_id, API_URL, getToken]);
  // 🔹 State for the "Other" category input
  const [otherCategory, setOtherCategory] = useState("")
  // 🔹 Carousel state
  const [activeIndex, setActiveIndex] = useState(0)


  // ... (useEffect and fetchItem logic is unchanged) ...
  useEffect(() => {
    if (!user || !isLoaded || !isSignedIn) return
    const fetchItem = async () => {
      try {
        const token = await getToken()

        const urlToBase64 = async (url) => {
          const res = await fetch(url)
          const blob = await res.blob()
          return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
        }

        const res = await axios.post(
          `${API_URL}/api/merchant/get_item`,
          { item_id, owner_id: user.id },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        )
        if (res.status === 200) {
          const item = res.data.item
          const images = await Promise.all(
            item.images?.map(img => urlToBase64(img.url)) || []
          )
          setFormData({
            name: item.name || "",
            description: item.description || "",
            quantity: item.quantity || "",
            price: item.price || "",
            category: item.category || [],
            images: images,
          })
        }
      } catch (err) {
        console.error("Error fetching item:", err)
        toast.error("Failed to load item details")
      } finally {
        setLoading(false)
      }
    }

    fetchItem()
  }, [user, isLoaded, isSignedIn, item_id, API_URL, getToken])

  // 🔹 Handle text input changes (unchanged)
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (name === "name") {
      setIsDuplicateTitle(false);
    }
  }

  // 🔹 NEW: Handler for AntD Select
  const handleCategorySelectChange = (selectedValues) => {
    setFormData(prev => ({
      ...prev,
      category: selectedValues
    }));
  };

  // 🔹 NEW: Handler to add a new category from the "Other" input
  const handleAddNewCategory = (e) => {
    // Check for 'Enter' key or 'blur' event
    if (e.type === 'blur' || (e.type === 'keydown' && e.key === 'Enter')) {
      e.preventDefault();
      const newCat = otherCategory.trim();
      if (newCat) {
        setFormData(prev => ({
          ...prev,
          // Add the new category, remove 'Other', and keep existing ones
          category: [...new Set([...prev.category.filter(c => c !== 'Other'), newCat])]
        }));
        // Clear the input
        setOtherCategory("");
      }
    }
  };

  // 🔹 Generate options for the Select, including custom ones
  const allCategoryOptions = useMemo(() => {
    const customCategories = formData.category.filter(c => !categoryOptions.includes(c) && c !== 'Other');
    const combined = [...categoryOptions, ...customCategories, 'Other'];
    return [...new Set(combined)].map(cat => ({ label: cat, value: cat }));
  }, [formData.category]);

  // ... (handleImageChange and handleRemoveImage logic is unchanged) ...
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files)
    const readers = files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
    )
    Promise.all(readers).then((base64Images) => {
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...base64Images],
      }))
      setActiveIndex((prev) => (prev === 0 && formData.images.length === 0 ? 0 : prev))
    })
  }
  const handleRemoveImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
    setActiveIndex((prev) => {
      if (index === prev) {
        return Math.max(0, prev - 1)
      }
      if (index < prev) return prev - 1
      return prev
    })
  };

  const goPrev = () => {
    setActiveIndex((prev) => (formData.images.length ? (prev - 1 + formData.images.length) % formData.images.length : 0))
  }
  const goNext = () => {
    setActiveIndex((prev) => (formData.images.length ? (prev + 1) % formData.images.length : 0))
  }

  const handleGenerateAiClick = () => {
    const currentTitle = formData.name.trim();
    if (!currentTitle) {
      setAiModalTitleInput('');
      setShowAiTitleModal(true);
    } else {
      generateDescription(currentTitle);
    }
  };

  const generateDescription = async (titleToUse) => {
    if (!isLoaded || !isSignedIn || !user) return;
    const toastId = toast.loading("AI generating item description...");
    try {
      setAiLoading(true);
      const token = await getToken();
      const first = formData.images && formData.images[0] || '';
      const firstUrl = typeof first === 'object' ? (first.url || '') : first;
      const base64 = firstUrl.includes(',') ? firstUrl.split(',')[1] : firstUrl;

      const body = {
        clerkId: user.id,
        hints: titleToUse
      };
      if (base64) {
        body.base64Image = base64;
      }

      let lastErr = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const resp = await fetch(`${API_URL}/api/merchant/ai/generateFromImage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data?.message || 'AI generation failed');
          
          setFormData(prev => ({
            ...prev,
            description: data?.description ?? prev.description,
          }));
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          await new Promise(r => setTimeout(r, 250));
        }
      }
      if (lastErr) throw lastErr;
      toast.success("AI description generated successfully!", { id: toastId });
    } catch (e) {
      const raw = String(e && e.message ? e.message : '');
      const lower = raw.toLowerCase();
      const friendly = lower.includes('model did not return expected json')
          ? 'AI could not generate description right now. Please try again.'
          : (raw ? `AI error: ${raw}` : 'AI error: Something went wrong.');
      toast.error(friendly, { id: toastId });
    } finally {
      setAiLoading(false);
    }
  };

  // ... (handleSubmit logic is unchanged) ...
  const friendlyItemError = (data) => {
    const msg = typeof data?.error?.message === 'string' ? data.error.message : '';
    const code = data?.error?.code || '';
    if (code === '23502') {
      const col = msg.match(/column "(\w+)"/)?.[1];
      const fieldMap = { quantity: 'Quantity', price: 'Price', name: 'Item Name', description: 'Description', category: 'Category' };
      const field = fieldMap[col] || col || 'a required field';
      return `Please fill in the "${field}" field — it cannot be left empty.`;
    }
    if (code === '23505') {
      return 'An item with this name already exists in your shop. Please choose a different name.';
    }
    if (code === '22P02') {
      return 'One of the fields has an invalid value (for example, quantity or price must be a number). Please check your inputs and try again.';
    }
    if (code === '23503') {
      return 'Something went wrong with the shop link. Please refresh the page and try again.';
    }
    if (data?.message) return data.message;
    return 'Something went wrong while updating the item. Please try again.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user || !isLoaded || !isSignedIn) return
    const toastId = toast.loading("Updating item...")
    setSaving(true)

    try {
      const token = await getToken()
      const res = await axios.put(
        `${API_URL}/api/merchant/update_items`,
        { ...formData, owner_id: user.id, id: item_id },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (res.status === 200) {
        toast.success("Item updated successfully!", { id: toastId })
        router.push("/merchant/dashboard")
      } else {
        toast.error(friendlyItemError(res.data), { id: toastId })
      }
    } catch (err) {
      console.error("Error updating item:", err)
      const data = err.response?.data
      toast.error(friendlyItemError(data || {}), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  

  if (!mounted) return (
    <div className="min-h-screen p-4 md:p-8 bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-7xl mx-auto animate-pulse">
        <div className="h-10 w-48 bg-[var(--muted)] rounded mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
          <div className="md:col-span-2 md:order-last">
            <div className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              <div className="aspect-square w-full bg-[var(--muted)]" />
              <div className="grid grid-cols-5 gap-2 p-3 border-t border-[var(--border)]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-[var(--muted)] rounded-md" />
                ))}
              </div>
            </div>
            <div className="mt-4 h-12 bg-[var(--muted)] rounded" />
          </div>
          <div className="md:col-span-3 flex flex-col gap-8">
            <div className="h-12 bg-[var(--muted)] rounded" />
            <div className="h-28 bg-[var(--muted)] rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-12 bg-[var(--muted)] rounded" />
              <div className="h-12 bg-[var(--muted)] rounded" />
            </div>
            <div className="h-16 bg-[var(--muted)] rounded" />
            <div className="h-12 bg-[var(--muted)] rounded" />
          </div>
        </div>
      </div>
    </div>
  )

  if (hasShop === null) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[var(--primary)] border-t-transparent animate-spin" />
          <p className="text-[var(--muted-foreground)] text-sm animate-pulse">Checking shop...</p>
        </div>
      </div>
    );
  }

  if (hasShop === false) return null;

  // 🔹 Skeleton loading state
  if (loading) return (
    <>
      <div className="min-h-screen p-4 md:p-8 bg-[var(--background)] text-[var(--foreground)]">
        <div className="max-w-7xl mx-auto animate-pulse">
          <div className="h-10 w-48 bg-[var(--muted)] rounded mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
            <div className="md:col-span-2 md:order-last">
              <div className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <div className="aspect-square w-full bg-[var(--muted)]" />
                <div className="grid grid-cols-5 gap-2 p-3 border-t border-[var(--border)]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-[var(--muted)] rounded-md" />
                  ))}
                </div>
              </div>
              <div className="mt-4 h-12 bg-[var(--muted)] rounded" />
            </div>
            <div className="md:col-span-3 flex flex-col gap-8">
              <div className="h-12 bg-[var(--muted)] rounded" />
              <div className="h-28 bg-[var(--muted)] rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="h-12 bg-[var(--muted)] rounded" />
                <div className="h-12 bg-[var(--muted)] rounded" />
              </div>
              <div className="h-16 bg-[var(--muted)] rounded" />
              <div className="h-12 bg-[var(--muted)] rounded" />
            </div>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <ConfigProvider
      theme={{
        algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: 'var(--primary)',
          colorBgBase: 'var(--background)',
          colorBgContainer: 'var(--card)',
          colorBorder: 'var(--border)',
          colorText: 'var(--foreground)',
        },
        components: {
          Select: {
            colorBgContainer: 'var(--card)',
            colorBgElevated: 'var(--popover)',
            colorText: 'var(--foreground)',
            colorTextPlaceholder: 'var(--muted-foreground)',
            colorBorder: 'var(--border)',
            optionSelectedBg: 'var(--accent)',
            optionSelectedColor: 'var(--accent-foreground)',
            optionActiveBg: 'var(--muted)',
            controlItemBgHover: 'var(--muted)',
            controlHeight: 48,
          },
          Input: {
            colorBgContainer: 'var(--card)',
            colorText: 'var(--foreground)',
            colorBorder: 'var(--border)',
            controlHeight: 48,
          },
        }
      }}
    >
      <div className="min-h-screen p-4 md:p-8 bg-[var(--background)] text-[var(--foreground)]">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-[var(--foreground)]">Edit Item</h1>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
            {/* Images (right on desktop) */}
            <div className="md:col-span-2 md:order-last md:sticky md:top-8 h-fit">
              <label className="text-sm font-medium mb-2 block text-[var(--muted-foreground)]">Item Images</label>
              <div className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <div className="relative aspect-square w-full">
                  {formData.images && formData.images.length > 0 ? (
                    <img src={formData.images[activeIndex]?.url || formData.images[activeIndex]} alt={`image-${activeIndex}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-[var(--muted-foreground)]">No images</div>
                  )}
                  {formData.images && formData.images.length > 1 && (
                    <>
                      <button type="button" onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-[var(--popover)]/80 text-[var(--popover-foreground)] border border-[var(--border)] hover:bg-[var(--accent)]/50 transition">‹</button>
                      <button type="button" onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-[var(--popover)]/80 text-[var(--popover-foreground)] border border-[var(--border)] hover:bg-[var(--accent)]/50 transition">›</button>
                    </>
                  )}
                </div>
                {formData.images && formData.images.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 p-3 bg-[var(--card)] border-t border-[var(--border)]">
                    {formData.images.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setActiveIndex(i)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveIndex(i); } }}
                        role="button"
                        tabIndex={0}
                        className={`relative aspect-square rounded-md overflow-hidden border cursor-pointer ${i === activeIndex ? 'border-[var(--primary)]' : 'border-[var(--border)]'}`}
                        aria-label={`Select image ${i + 1}`}
                      >
                        <img src={img.url || img} alt={`thumb-${i}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveImage(i) }} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs" aria-label={`Remove image ${i + 1}`}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <label htmlFor="file-upload" className="mt-4 block w-full text-center py-3 px-4 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] font-medium cursor-pointer transition-colors">Upload More Images</label>
              <input id="file-upload" type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
            </div>

            {/* Details (left on desktop) */}
            <form onSubmit={handleSubmit} className="md:col-span-3 flex flex-col gap-8">
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)]">Item Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-transparent border-b-2 border-[var(--border)] text-[var(--foreground)] text-lg p-2 focus:outline-none focus:ring-0 focus:border-[var(--primary)] transition-colors" placeholder="Enter item name" />
                {isDuplicateTitle && (
                  <p className="text-amber-500 text-sm mt-1 animate-pulse">
                    ⚠️ A product with this title already exists.
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-[var(--muted-foreground)]">Description</label>
                  <button
                    type="button"
                    onClick={handleGenerateAiClick}
                    disabled={aiLoading}
                    className={`text-xs px-2.5 py-1.5 rounded-md border border-[var(--border)] flex items-center gap-1.5 font-medium transition-all ${
                      aiLoading
                        ? 'opacity-50 cursor-not-allowed bg-[var(--muted)]'
                        : 'hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    {aiLoading ? 'Generating…' : 'Generate with AI'}
                  </button>
                </div>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full bg-transparent border-b-2 border-[var(--border)] text-[var(--foreground)] text-lg p-2 focus:outline-none focus:ring-0 focus:border-[var(--primary)] transition-colors" placeholder="Enter description" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="text-sm font-medium text-[var(--muted-foreground)]">Quantity</label>
                  <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} className="w-full bg-transparent border-b-2 border-[var(--border)] text-[var(--foreground)] text-lg p-2 focus:outline-none focus:ring-0 focus:border-[var(--primary)] transition-colors" placeholder="Enter quantity" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--muted-foreground)]">Price</label>
                  <input type="number" name="price" min={1} value={formData.price} onChange={handleChange} className="w-full bg-transparent border-b-2 border-[var(--border)] text-[var(--foreground)] text-lg p-2 focus:outline-none focus:ring-0 focus:border-[var(--primary)] transition-colors" placeholder="Enter price" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-2 block">Categories</label>
                <Select mode="multiple" allowClear style={{ width: '100%' }} placeholder="Select categories" value={formData.category} onChange={handleCategorySelectChange} options={allCategoryOptions} size="large" styles={{ popup: { root: { background: 'var(--popover)', color: 'var(--popover-foreground)' } } }} />
                {formData.category.includes('Other') && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-[var(--muted-foreground)]">New Category Name</label>
                    <Input type="text" value={otherCategory} onChange={(e) => setOtherCategory(e.target.value)} onBlur={handleAddNewCategory} onKeyDown={handleAddNewCategory} className="w-full mt-2 bg-transparent !border-[var(--border)] text-[var(--foreground)] !text-lg p-2 focus:!border-[var(--primary)]" placeholder="Type new category and press Enter" size="large" />
                  </div>
                )}
              </div>
              <button type="submit" disabled={saving} className="w-full bg-[var(--primary)] hover:opacity-90 text-[var(--primary-foreground)] font-semibold py-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-lg mt-4">{saving ? 'Updating...' : 'Update Item'}</button>
            </form>
          </div>
        </div>
      </div>

      {showAiTitleModal && mounted && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[20000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm pointer-events-auto">
          <div className="w-full max-w-sm bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-[var(--foreground)]">Generate Description</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Please enter a product title first to generate a description.
            </p>
            <input
              type="text"
              placeholder="Enter product title..."
              value={aiModalTitleInput}
              onChange={(e) => setAiModalTitleInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
            />
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowAiTitleModal(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!aiModalTitleInput.trim()}
                onClick={() => {
                  const title = aiModalTitleInput.trim();
                  if (title) {
                    setShowAiTitleModal(false);
                    generateDescription(title);
                  }
                }}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Generate
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ConfigProvider>
  )
}