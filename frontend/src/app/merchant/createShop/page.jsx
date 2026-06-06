'use client'
import { useState, useEffect } from "react";
import { Button, Typography } from "@mui/material";
import { Select, ConfigProvider, theme } from 'antd';
import { useUser, useAuth } from "@clerk/nextjs";
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/theme/ThemeProvider';
import AddressMapPicker from '@/components/shared/AddressMapPicker';

const CATEGORIES = [
  "Grocery", "Electronics", "Clothing", "Food", "Books",
  "Pharmacy", "Home & Kitchen", "Beauty", "Stationery", "Toys", "Other",
];

export default function CreateShop() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
  const router = useRouter();
  const { theme: currentTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [formData, setFormData] = useState({
    shop_name: "", address: "", contact: "",
    account_no: "", mobile_no: "",
    category: [], image: null,
    location: { latitude: 17.385044, longitude: 78.486671 }, // Hyderabad default
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [otherCategory, setOtherCategory] = useState("");

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFormData(prev => ({ ...prev, image: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    const errors = {};
    if (!/^\d{9,18}$/.test(formData.account_no.trim())) {
      errors.account_no = "Account number must be 9–18 digits.";
    }
    if (!/^[6-9]\d{9}$/.test(formData.mobile_no.trim())) {
      errors.mobile_no = "Enter a valid 10-digit Indian mobile number (starting with 6–9).";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const token = await getToken();
    const body = { ...formData, owner_id: user.id, Location: formData.location };
    const res = await fetch(`${API_URL}/api/merchant/add_shop`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) router.push('/merchant/dashboard');
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[var(--primary)] border-t-transparent animate-spin" />
          <p className="text-[var(--muted-foreground)] text-sm animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: 'var(--primary)',
          colorBgBase: 'var(--background)',
          colorBgContainer: 'var(--card)',
          colorText: 'var(--foreground)',
          colorTextPlaceholder: 'var(--muted-foreground)',
          colorBorder: 'var(--border)',
          colorBgElevated: 'var(--popover)',
          borderRadius: 8,
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
            borderRadius: 8,
          },
        }
      }}
    >
      <div className="min-h-screen p-4 md:p-8 bg-[var(--background)] text-[var(--foreground)]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Shop Registration</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-10">

            {/* ── Left: Form ── */}
            <form onSubmit={handleSubmit} className="md:col-span-3 flex flex-col gap-6">

              {/* Basic fields ── Card */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-6">
                <h2 className="text-lg font-bold border-b border-[var(--border)] pb-3">Shop Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {['shop_name', 'contact', 'account_no', 'mobile_no'].map((field) => {
                    const isRequired = ['shop_name', 'account_no', 'mobile_no'].includes(field);
                    const label = field === 'account_no'
                      ? 'Account Number *'
                      : field === 'mobile_no'
                      ? 'Mobile Number *'
                      : field === 'shop_name'
                      ? 'Shop Name *'
                      : field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <div key={field}>
                        <label className="text-sm font-semibold text-[var(--foreground)] mb-2 block">
                          {label}
                        </label>
                        <input
                          type="text"
                          name={field}
                          value={formData[field] || ''}
                          onChange={(e) => {
                            handleChange(e);
                            if (fieldErrors[field]) setFieldErrors(prev => ({ ...prev, [field]: '' }));
                          }}
                          required={isRequired}
                          inputMode={['account_no', 'mobile_no'].includes(field) ? 'numeric' : 'text'}
                          className={`w-full rounded-lg border text-[var(--foreground)] p-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all ${
                            fieldErrors[field] ? 'border-red-500 bg-red-500/5' : 'border-[var(--border)] bg-[var(--background)]'
                          }`}
                        />
                        {fieldErrors[field] && (
                          <p className="text-red-500 text-xs mt-1">{fieldErrors[field]}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Categories ── Card */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-6">
                <h2 className="text-lg font-bold border-b border-[var(--border)] pb-3">Categories</h2>
                <div>
                  <label className="text-sm font-semibold text-[var(--foreground)] mb-2 block">Product Categories</label>
                  <Select
                    mode="multiple"
                    value={formData.category}
                    onChange={(values) => setFormData(p => ({ ...p, category: values }))}
                    style={{ width: '100%' }}
                    placeholder="Select categories"
                    maxTagCount="responsive"
                    size="large"
                    popupClassName="!bg-[var(--popover)]"
                    options={CATEGORIES.map(v => ({ value: v, label: v }))}
                  />
                  {formData.category?.includes('Other') && (
                    <div className="mt-3">
                      <label className="text-sm font-semibold text-[var(--foreground)] mb-2 block">Custom Category Name</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={otherCategory}
                          onChange={(e) => setOtherCategory(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = otherCategory.trim();
                              if (val) {
                                setFormData(p => ({
                                  ...p,
                                  category: [...new Set(p.category.filter(c => c !== 'Other').concat(val))]
                                }));
                                setOtherCategory('');
                              }
                            }
                          }}
                          placeholder="Type a custom category"
                          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] p-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all placeholder:text-[var(--muted-foreground)]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = otherCategory.trim();
                            if (val) {
                              setFormData(p => ({
                                ...p,
                                category: [...new Set(p.category.filter(c => c !== 'Other').concat(val))]
                              }));
                              setOtherCategory('');
                            }
                          }}
                          disabled={!otherCategory.trim()}
                          className="px-4 py-3 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Image upload ── Card */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-6">
                <h2 className="text-lg font-bold border-b border-[var(--border)] pb-3">Shop Image</h2>
                <div className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
                  <div className="relative aspect-video w-full">
                    {formData.image
                      ? <img src={formData.image} alt="Shop" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-sm text-[var(--muted-foreground)]">No image selected</div>
                    }
                    {formData.image && (
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, image: null }))}
                        className="absolute top-2 right-2 h-8 px-3 rounded-full bg-red-600 text-white text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <label
                  htmlFor="shop-image-upload"
                  className="inline-flex items-center gap-2 py-2.5 px-4 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] font-medium cursor-pointer transition-colors"
                >
                  Upload Image
                </label>
                <input id="shop-image-upload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </div>

              <Button
                type="submit"
                variant="contained"
                sx={{ mt: 1, width: 'fit-content', px: 5, py: 1.5, bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
              >
                Save Shop
              </Button>
            </form>

            {/* ── Right: AddressMapPicker ── */}
            <div className="md:col-span-2 md:sticky md:top-8 h-fit">
              <AddressMapPicker
                value={{
                  lat: formData.location.latitude,
                  lng: formData.location.longitude,
                  address: formData.address,
                }}
                onChange={({ lat, lng, address }) =>
                  setFormData(prev => ({
                    ...prev,
                    address,
                    location: { latitude: lat, longitude: lng },
                  }))
                }
                label="SHOP ADDRESS"
                markerPopupText="Your Shop Location"
                mapHeight="calc(100vh - 16rem)"
              />
            </div>

          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}