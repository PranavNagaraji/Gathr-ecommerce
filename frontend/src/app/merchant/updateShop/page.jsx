"use client";
import { useState, useEffect } from "react";
import { Button } from "@mui/material";
import { Select, ConfigProvider, theme } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { useUser, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useTheme } from "@/components/theme/ThemeProvider";
import AddressMapPicker from "@/components/shared/AddressMapPicker";

const categoriesOptions = [
  "Grocery", "Electronics", "Clothing", "Food", "Books", "Other",
  "Pharmacy", "Home & Kitchen", "Beauty", "Stationery", "Toys",
];

const UpdateShop = () => {
  const router = useRouter();
  const { user } = useUser();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
  const { theme: currentTheme } = useTheme();

  const [formData, setFormData] = useState({
    shop_name: "",
    address: "",
    contact: "",
    account_no: "",
    mobile_no: "",
    category: [],
    image: null,
    location: { latitude: 20.5937, longitude: 78.9629 },
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [otherCategory, setOtherCategory] = useState("");
  const [lowThreshold, setLowThreshold] = useState(5);

  // ✅ Fetch shop data on mount
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const urlToBase64 = async (url) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    };

    const getShop = async () => {
      const token = await getToken();
      try {
        const res = await axios.post(
          `${API_URL}/api/merchant/get_shop`,
          { owner_id: user.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const shopData = res.data.shop;
        let base64Image = null;
        if (shopData?.image?.url) {
          base64Image = await urlToBase64(shopData.image.url);
          setImagePreview(base64Image);
        }

        if (shopData) {
          const defaultLoc = { latitude: 20.5937, longitude: 78.9629 };
          const loc = shopData.Location;
          const safeLocation = {
            latitude: Number(loc?.latitude) || defaultLoc.latitude,
            longitude: Number(loc?.longitude) || defaultLoc.longitude,
          };

          setFormData({
            shop_name: shopData.shop_name || "",
            address: shopData.address || "",
            contact: shopData.contact || "",
            account_no: shopData.account_no || "",
            mobile_no: shopData.mobile_no || "",
            category: shopData.category || [],
            location: safeLocation,
            owner_id: user.id,
            image: base64Image,
          });
        }
      } catch (err) {
        console.error("Error fetching shop:", err);
      } finally {
        setLoading(false);
      }
    };

    getShop();
  }, [user, isSignedIn, isLoaded, getToken, API_URL]);

  // ✅ Low stock threshold persistence
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(`lowStockThreshold:${user?.id}`));
      if (!Number.isNaN(v) && v >= 0) setLowThreshold(v);
    } catch {}
  }, [user?.id]);

  const saveThreshold = () => {
    try {
      const v = Math.max(0, Number(lowThreshold) || 0);
      setLowThreshold(v);
      localStorage.setItem(`lowStockThreshold:${user?.id}`, String(v));
    } catch {}
  };

  // ✅ Field change handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ Image change handler
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, image: reader.result }));
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // ✅ Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = {};
    if (!/^\d{9,18}$/.test((formData.account_no || "").trim())) {
      errors.account_no = "Account number must be 9\u201318 digits.";
    }
    if (!/^[6-9]\d{9}$/.test((formData.mobile_no || "").trim())) {
      errors.mobile_no =
        "Enter a valid 10-digit Indian mobile number (starting with 6\u20139).";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const token = await getToken();
    const dataToSend = {
      ...formData,
      location: formData.location,
      Location: formData.location, // satisfy both casing variants in backend
    };

    try {
      const result = await axios.put(
        `${API_URL}/api/merchant/update_shop`,
        dataToSend,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (result.status === 200) {
        toast.success("Shop updated successfully!");
        router.push("/merchant/dashboard");
      }
    } catch {
      toast.error("Error updating shop");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">
        Loading shop details...
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm:
          currentTheme === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: "var(--primary)",
          colorBgBase: "var(--background)",
          colorBgContainer: "var(--card)",
          colorBorder: "var(--border)",
          colorText: "var(--foreground)",
        },
      }}
    >
      <div className="min-h-screen flex flex-col md:flex-row bg-[var(--background)] text-[var(--foreground)]">

        {/* ── LEFT: form fields ── */}
        <div className="flex-1 p-10 flex flex-col justify-start space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-[var(--primary)] mb-2">
              Update Shop
            </h1>
            <p className="text-[var(--muted-foreground)] text-sm">
              Modify your shop details and pinpoint your location on the map.
            </p>
          </div>

          {/* Basic fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
            {["shop_name", "contact", "account_no", "mobile_no"].map((field) => {
              const isRequired = ["account_no", "mobile_no"].includes(field);
              const label =
                field === "account_no"
                  ? "Account Number *"
                  : field === "mobile_no"
                  ? "Mobile Number *"
                  : field.replace("_", " ");
              return (
                <div key={field}>
                  <label className="block text-[var(--muted-foreground)] mb-1 capitalize">
                    {label}
                  </label>
                  <input
                    type="text"
                    name={field}
                    value={formData[field] || ""}
                    onChange={(e) => {
                      handleChange(e);
                      if (fieldErrors[field])
                        setFieldErrors((prev) => ({ ...prev, [field]: "" }));
                    }}
                    required={isRequired}
                    inputMode={
                      ["account_no", "mobile_no"].includes(field)
                        ? "numeric"
                        : "text"
                    }
                    className={`w-full rounded-lg bg-[var(--card)] text-[var(--foreground)] px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${
                      fieldErrors[field]
                        ? "border-red-500"
                        : "border-[var(--border)]"
                    }`}
                  />
                  {fieldErrors[field] && (
                    <p className="text-red-500 text-xs mt-1">
                      {fieldErrors[field]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Categories */}
          <div className="max-w-2xl">
            <label className="block text-[var(--muted-foreground)] mb-1">
              Categories
            </label>
            <Select
              mode="multiple"
              value={formData.category}
              onChange={(values) =>
                setFormData((p) => ({ ...p, category: values }))
              }
              style={{ width: "100%" }}
              placeholder="Select categories"
              maxTagCount="responsive"
              size="large"
              styles={{
                popup: {
                  root: {
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                  },
                },
              }}
              suffixIcon={
                <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                  <span>{formData.category?.length || 0}</span>
                  <DownOutlined />
                </span>
              }
              options={[...new Set([...categoriesOptions, "Other"])].map(
                (v) => ({ value: v, label: v })
              )}
            />
            {formData.category?.includes("Other") && (
              <div className="mt-3">
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">
                  Custom Category Name
                </label>
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
                          setFormData((p) => ({
                            ...p,
                            category: [...new Set(p.category.filter((c) => c !== "Other").concat(val))]
                          }));
                          setOtherCategory("");
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
                        setFormData((p) => ({
                          ...p,
                          category: [...new Set(p.category.filter((c) => c !== "Other").concat(val))]
                        }));
                        setOtherCategory("");
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

          {/* Image upload */}
          <div className="max-w-2xl">
            <label className="block text-[var(--muted-foreground)] mb-1">
              Shop Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="text-[var(--muted-foreground)]"
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="mt-3 w-48 h-48 object-cover rounded-lg border border-[var(--border)]"
              />
            )}
          </div>

          <Button
            type="submit"
            onClick={handleSubmit}
            variant="contained"
            sx={{
              mt: 2,
              width: "fit-content",
              px: 5,
              py: 1.5,
              bgcolor: "#16a34a",
              "&:hover": { bgcolor: "#15803d" },
            }}
          >
            Save Changes
          </Button>
        </div>

        {/* ── RIGHT: AddressMapPicker ── */}
        <div className="md:w-1/2 w-full p-6 md:p-8 flex flex-col justify-start md:sticky md:top-0 md:h-screen overflow-y-auto">
          <AddressMapPicker
            value={{
              lat: formData.location.latitude,
              lng: formData.location.longitude,
              address: formData.address,
            }}
            onChange={({ lat, lng, address }) =>
              setFormData((prev) => ({
                ...prev,
                address,
                location: { latitude: lat, longitude: lng },
              }))
            }
            label="Shop Address"
            markerPopupText="Your Shop Location"
            mapHeight="calc(100vh - 14rem)"
          />
        </div>

      </div>
    </ConfigProvider>
  );
};

export default function UpdateShopPage() {
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

  return <UpdateShop />;
}