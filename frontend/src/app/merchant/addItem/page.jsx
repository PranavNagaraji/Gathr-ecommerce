'use client'
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUser, useAuth } from "@clerk/nextjs";
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Select, ConfigProvider, theme, Input as AntInput } from 'antd'
import { useTheme } from '@/components/theme/ThemeProvider'
import toast from 'react-hot-toast';
import { MdQrCodeScanner } from 'react-icons/md';

export default function addItemPage() {
    const { theme: currentTheme } = useTheme();
    const categoryOptions = [
        "Fruits", "Vegetables", "Dairy", "Bakery", "Beverages",
        "Snacks", "Frozen", "Meat", "Seafood", "Grains",
        "Spices", "Condiments", "Breakfast", "Coffee & Tea", "Juices",
        "Personal Care", "Cleaning", "Pet Food", "Organic", "Health"
    ];

    const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
    const router = useRouter();
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const { user } = useUser();
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        quantity: "",
        price: "",
        category: [],
        images: [],
    });
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
                        owner_id: user.id
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
    }, [formData.name, user, isLoaded, isSignedIn, API_URL, getToken]);

    const cropMarginsBase64 = (base64, marginPct = 0.08) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const w = img.width, h = img.height;
            const mx = Math.round(w * marginPct), my = Math.round(h * marginPct);
            const cw = Math.max(1, w - 2*mx), ch = Math.max(1, h - 2*my);
            const canvas = document.createElement('canvas');
            canvas.width = cw; canvas.height = ch;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, mx, my, cw, ch, 0, 0, cw, ch);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64);
        img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    });

    const cropBottomBandBase64 = (base64, bandRatio = 0.35) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const w = img.width, h = img.height;
            const bandH = Math.max(1, Math.round(h * bandRatio));
            const y = Math.max(0, h - bandH);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = bandH;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, y, w, bandH, 0, 0, w, bandH);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64);
        img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    });

    const ensureTesseract = () => new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && window.Tesseract) return resolve(window.Tesseract);
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4.0.2/dist/tesseract.min.js';
        s.onload = () => resolve(window.Tesseract);
        s.onerror = reject;
        document.head.appendChild(s);
    });

    const ocrDigits = async (dataUrl) => {
        try {
            const T = await ensureTesseract();
            const result = await T.recognize(dataUrl, 'eng', { tessedit_char_whitelist: '0123456789' });
            const text = result?.data?.text || '';
            const digits = String(text).replace(/\D+/g, '');
            if (digits.length >= 8) {
                const m = digits.match(/(\d{13}|\d{12}|\d{14}|\d{8,})/);
                return m ? m[1] : digits;
            }
            return '';
        } catch { return ''; }
    };

    const mirrorBase64 = (base64) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64);
        img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    });

    const loadImageEl = (dataUrl) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });

    const decodeWithNative = async (dataUrl) => {
        try {
            if (!('BarcodeDetector' in window)) return '';
            const formats = ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf'];
            const det = new window.BarcodeDetector({ formats });
            const img = await loadImageEl(dataUrl);
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const results = await det.detect(canvas);
            const val = Array.isArray(results) && results[0] && results[0].rawValue;
            return val ? String(val).trim() : '';
        } catch { return ''; }
    };

    const cropCenterBandBase64 = (base64, bandRatio = 0.5) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const w = img.width, h = img.height;
            const bandH = Math.max(1, Math.round(h * bandRatio));
            const y = Math.round((h - bandH) / 2);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = bandH;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, y, w, bandH, 0, 0, w, bandH);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64);
        img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    });
    const [activeIndex, setActiveIndex] = useState(0)
    const [otherCategory, setOtherCategory] = useState("")
    const [aiLoading, setAiLoading] = useState(false)
    const [barcodeBusy, setBarcodeBusy] = useState(false)
    const barcodeFileRef = useRef(null)
    const folderInputRef = useRef(null)
    const cameraInputRef = useRef(null)
    const [isDragging, setIsDragging] = useState(false)
    const [barcodeLastImage, setBarcodeLastImage] = useState('')
    const [bandRatio, setBandRatio] = useState(45) // percent
    // image center/crop modal
    const [cropOpen, setCropOpen] = useState(false)
    const [cropScale, setCropScale] = useState(1)
    const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
    const cropDrag = useRef(null)
    // barcode centering modal
    const [barcodeCenterOpen, setBarcodeCenterOpen] = useState(false)
    const [barcodeCenterScale, setBarcodeCenterScale] = useState(1)
    const [barcodeCenterOffset, setBarcodeCenterOffset] = useState({ x: 0, y: 0 })
    const [barcodeCenterRotate, setBarcodeCenterRotate] = useState(0)
    const barcodeCenterDrag = useRef(null)
    const [scanOverlay, setScanOverlay] = useState({ active: false, state: 'scanning', errorMsg: '' });
    const scanAbortControllerRef = useRef(null);

    useEffect(() => {
        if (scanOverlay.active) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [scanOverlay.active]);

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        return () => {
            if (scanAbortControllerRef.current) {
                scanAbortControllerRef.current.abort();
            }
        };
    }, []);

    const handleCancelScan = () => {
        if (scanAbortControllerRef.current) {
            scanAbortControllerRef.current.abort();
            scanAbortControllerRef.current = null;
        }
        setScanOverlay({ active: false, state: 'scanning', errorMsg: '' });
        setBarcodeBusy(false);
        setBarcodeCenterOpen(false);
    };



    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === "name") {
            setIsDuplicateTitle(false);
        }
    };

    const [barcodeManual, setBarcodeManual] = useState('');
    const handleManualBarcodeLookup = async () => {
        const code = String(barcodeManual || '').replace(/\D+/g, '');
        if (!code) return;

        if (scanAbortControllerRef.current) {
            scanAbortControllerRef.current.abort();
        }
        scanAbortControllerRef.current = new AbortController();
        const signal = scanAbortControllerRef.current.signal;

        setScanOverlay({ active: true, state: 'fetching', errorMsg: '' });
        setBarcodeBusy(true);
        try {
            const prod = await fetchProductByBarcode(code, signal);
            if (signal.aborted) return;

            if (!prod) {
                setScanOverlay({ active: true, state: 'error', errorMsg: `No product info found for barcode ${code}.` });
                return;
            }
            let imgB64 = '';
            if (prod.img) {
                try { imgB64 = await fetchImageUrlToBase64(prod.img, signal); } catch {}
            }
            if (signal.aborted) return;

            let priceVal = prod.price;
            if (!priceVal && prod.img) {
              const hints = [prod.name, ...(prod.categories||[])].filter(Boolean).join(', ');
              priceVal = await estimatePriceFromImage(prod.img, hints, signal);
            }
            if (signal.aborted) return;

            setFormData(prev => ({
                ...prev,
                name: prod.name || prev.name,
                description: prod.desc || prev.description,
                category: Array.from(new Set([...(prev.category||[]), ...((prod.categories||[]))])),
                images: imgB64 ? [imgB64, ...(prev.images||[])] : prev.images,
                price: priceVal ? String(priceVal) : prev.price
            }));
            setActiveIndex(0);
            setScanOverlay({ active: false, state: 'scanning', errorMsg: '' });
        } catch (err) {
            if (err.name === 'AbortError' || signal.aborted) {
                return;
            }
            setScanOverlay({ active: true, state: 'error', errorMsg: err.message || 'Failed to lookup product info.' });
        } finally {
            if (!signal.aborted) {
                setBarcodeBusy(false);
            }
        }
    };

    const readSingleFileAsBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const fetchImageUrlToBase64 = async (url, signal) => {
        const res = await fetch(url, { signal });
        const blob = await res.blob();
        return await new Promise((resolve) => {
            const fr = new FileReader();
            fr.onloadend = () => resolve(String(fr.result || ''));
            fr.readAsDataURL(blob);
        });
    };

    const rotateBase64 = (base64, deg) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const rad = (deg * Math.PI) / 180;
            const w = img.width, h = img.height;
            if (deg % 180 === 0) { canvas.width = w; canvas.height = h; }
            else { canvas.width = h; canvas.height = w; }
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rad);
            ctx.drawImage(img, -w / 2, -h / 2);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64);
        img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    });

    const preprocessBase64 = (base64, { grayscale = true, invert = false, contrast = 1.3, threshold = null, maxSize = 2000, minSize = 980 } = {}) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const maxDim = Math.max(img.width, img.height);
            const targetMax = Math.min(Math.max(maxDim, minSize), maxSize);
            const scale = targetMax / maxDim;
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i], g = data[i+1], b = data[i+2];
                if (grayscale) {
                    const y = 0.299*r + 0.587*g + 0.114*b;
                    r = g = b = y;
                }
                // contrast around mid-gray
                if (contrast && contrast !== 1) {
                    r = (r - 128) * contrast + 128;
                    g = (g - 128) * contrast + 128;
                    b = (b - 128) * contrast + 128;
                }
                if (threshold != null) {
                    const avg = (r+g+b)/3;
                    r = g = b = avg > threshold ? 255 : 0;
                }
                if (invert) {
                    r = 255 - r; g = 255 - g; b = 255 - b;
                }
                data[i] = Math.max(0, Math.min(255, r));
                data[i+1] = Math.max(0, Math.min(255, g));
                data[i+2] = Math.max(0, Math.min(255, b));
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64);
        img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    });

    const sharpenBase64 = (base64, strength = 0.6) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const w = img.width, h = img.height;
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0);
            const src = ctx.getImageData(0, 0, w, h);
            const dst = ctx.createImageData(w, h);
            const k = [
                0, -strength, 0,
                -strength, 1 + 4*strength, -strength,
                0, -strength, 0
            ];
            const s = src.data, d = dst.data;
            const idx = (x,y)=> (y*w + x) * 4;
            for (let y=1;y<h-1;y++){
                for (let x=1;x<w-1;x++){
                    let r=0,g=0,b=0,a=0, ki=0;
                    for (let j=-1;j<=1;j++){
                        for (let i=-1;i<=1;i++){
                            const p = idx(x+i,y+j);
                            const kval = k[ki++];
                            r += s[p]*kval; g += s[p+1]*kval; b += s[p+2]*kval; a += s[p+3]*kval;
                        }
                    }
                    const q = idx(x,y);
                    d[q] = Math.max(0, Math.min(255, r));
                    d[q+1] = Math.max(0, Math.min(255, g));
                    d[q+2] = Math.max(0, Math.min(255, b));
                    d[q+3] = s[q+3];
                }
            }
            ctx.putImageData(dst,0,0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64);
        img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    });

    const ensureZXing = () => new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && window.ZXing) return resolve(window.ZXing);
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js';
        s.onload = () => resolve(window.ZXing);
        s.onerror = reject;
        document.head.appendChild(s);
    });

    const decodeWithZXing = async (dataUrl) => {
        try {
            const ZX = await ensureZXing();
            const hints = new Map();
            if (ZX.DecodeHintType) {
                try { hints.set(ZX.DecodeHintType.TRY_HARDER, true); } catch {}
                try { hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
                    ZX.BarcodeFormat.EAN_13,
                    ZX.BarcodeFormat.EAN_8,
                    ZX.BarcodeFormat.UPC_A,
                    ZX.BarcodeFormat.UPC_E,
                    ZX.BarcodeFormat.CODE_128,
                    ZX.BarcodeFormat.CODE_39,
                ]); } catch {}
            }
            const reader = new ZX.BrowserMultiFormatReader(hints);
            const res = await reader.decodeFromImageUrl(dataUrl);
            const text = res && (res.text || (res.getText && res.getText())) || '';
            return String(text || '').trim();
        } catch { return ''; }
    };

    const ensureQuagga = () => new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && window.Quagga) return resolve(window.Quagga);
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@2.0.0-beta.3/dist/quagga.min.js';
        s.onload = () => resolve(window.Quagga);
        s.onerror = reject;
        document.head.appendChild(s);
    });

    const decodeWithQuagga = async (dataUrl) => {
        try {
            const Quagga = await ensureQuagga();
            const tryOnce = (patchSize) => new Promise((resolve) => {
                Quagga.decodeSingle({
                    src: dataUrl,
                    numOfWorkers: 0,
                    inputStream: { size: 1280 },
                    locate: true,
                    locator: { halfSample: true, patchSize },
                    decoder: { readers: ['ean_reader','ean_8_reader','upc_reader','upc_e_reader','code_128_reader','code_39_reader','i2of5_reader','code_93_reader','codabar_reader'] }
                }, (result) => {
                    const code = result && result.codeResult && result.codeResult.code;
                    resolve(code ? String(code).trim() : '');
                });
            });
            const sizes = ['medium','large','x-large'];
            for (const s of sizes) {
                const out = await tryOnce(s);
                if (out) return out;
            }
            return '';
        } catch { return ''; }
    };

    const decodeAny = async (dataUrl) => {
        const angles = [0, -7, -5, -3, 3, 5, 7, 90, 180, 270];
        for (const a of angles) {
            const candidate = a === 0 ? dataUrl : await rotateBase64(dataUrl, a);
            let code = await decodeWithNative(candidate);
            if (code) return code;
            code = await decodeWithZXing(candidate);
            if (code) return code;
            code = await decodeWithQuagga(candidate);
            if (code) return code;
            // OCR fallback on bottom digits
            const bottom = await cropBottomBandBase64(candidate, 0.45);
            code = await ocrDigits(bottom);
            if (code) return code;
        }
        return '';
    };

    const decodeBarcodeFromBase64 = async (base64) => {
        const url = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
        const processed = [
            url,
            await preprocessBase64(url, { grayscale: true, contrast: 1.6, threshold: 128 }),
            await preprocessBase64(url, { grayscale: true, contrast: 1.8, threshold: 110 }),
            await preprocessBase64(url, { grayscale: true, contrast: 1.4, threshold: 150 }),
            await preprocessBase64(url, { grayscale: true, invert: true, contrast: 1.5, threshold: 135 }),
            await mirrorBase64(url),
            await cropCenterBandBase64(url, 0.45),
            await cropCenterBandBase64(url, 0.35),
            await sharpenBase64(await preprocessBase64(url, { grayscale: true, contrast: 1.7, threshold: 120 })),
            await cropMarginsBase64(url, 0.06),
            await cropMarginsBase64(url, 0.12),
            await preprocessBase64(url, { grayscale: true, contrast: 2.0, threshold: 100 }),
            await preprocessBase64(url, { grayscale: true, contrast: 1.9, threshold: 160 }),
        ];
        for (const imgUrl of processed) {
            const code = await decodeAny(imgUrl);
            if (code) return code;
        }
        // Try Quagga across variants and rotations (last attempt)
        for (const imgUrl of processed) {
            const code = await decodeWithQuagga(imgUrl);
            if (code) return code;
        }
        return '';
    };

    const fetchProductByBarcode = async (code, signal) => {
        try {
            const resp = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`, { signal });
            const data = await resp.json();
            if (data && data.status === 1) {
                const p = data.product || {};
                const name = p.product_name || p.generic_name || '';
                const desc = [p.generic_name, p.brands, p.categories].filter(Boolean).join(' • ');
                const img = p.image_front_url || p.image_url || p.image_small_url || '';
                const categories = String(p.categories || '')
                  .toLowerCase()
                  .split(',')
                  .map(s=>s.trim())
                  .filter(Boolean);
                const mappedCats = categoryOptions.filter(opt => categories.some(c => c.includes(opt.toLowerCase())));
                // try parse price if available (rare)
                let price = null;
                if (typeof p.price === 'number') price = Math.round(p.price);
                if (typeof p.price === 'string') {
                  const m = p.price.match(/\d+(?:\.\d+)?/);
                  if (m) price = Math.round(parseFloat(m[0]));
                }
                return { name, desc, img, categories: mappedCats, price };
            }
        } catch {}
        return null;
    };

    const estimatePriceFromImage = async (imgUrl, hints, signal) => {
        try {
            const token = await getToken();
            const base64 = await fetchImageUrlToBase64(imgUrl, signal);
            const b64 = base64.includes(',') ? base64.split(',')[1] : base64;
            let data = null;
            for (let attempt = 0; attempt < 2; attempt++) {
                if (signal?.aborted) return null;
                const resp = await fetch(`${API_URL}/api/merchant/ai/generateFromImage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ clerkId: user.id, base64Image: b64, hints }),
                    signal
                });
                data = await resp.json().catch(()=>({}));
                if (resp.ok && typeof data?.price === 'number' && data.price > 0) {
                    return Math.round(data.price);
                }
                if (signal?.aborted) return null;
                await new Promise(r => setTimeout(r, 250));
            }
        } catch {}
        return null;
    };

    const onBarcodeImageChosen = async (file) => {
        if (!file) return;
        try {
            const base64 = await readSingleFileAsBase64(file);
            setBarcodeLastImage(base64);
            setBarcodeCenterScale(1);
            setBarcodeCenterOffset({ x: 0, y: 0 });
            setBarcodeCenterRotate(0);
            setBarcodeCenterOpen(true);
        } finally {
            if (barcodeFileRef.current) barcodeFileRef.current.value = '';
        }
    };

    const handleScanToggle = () => {
        if (barcodeBusy || scanOverlay.active) return;
        if (barcodeFileRef.current) barcodeFileRef.current.click();
    };
    const handleCategoryChange = (e) => {
        const { value, checked } = e.target;

        setFormData((prev) => {
            if (checked) {
                // Add category if checked
                return { ...prev, category: [...prev.category, value] };
            } else {
                // Remove category if unchecked
                return { ...prev, category: prev.category.filter((cat) => cat !== value) };
            }
        });
    };

    const handleFiles = (files) => {
        const fileList = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (fileList.length === 0) return;

        const readers = fileList.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        Promise.all(readers).then((base64Images) => {
            setFormData((prev) => ({
                ...prev,
                images: [...(prev.images || []), ...base64Images],
            }));
            setActiveIndex((prev) => (formData.images.length === 0 ? 0 : prev));
        });
    };

    const handleImageChange = (e) => {
        if (e.target.files) {
            handleFiles(e.target.files);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleFolderUploadClick = () => {
        if (folderInputRef.current) {
            folderInputRef.current.click();
        }
    };

    const handleCameraUploadClick = () => {
        if (cameraInputRef.current) {
            cameraInputRef.current.click();
        }
    };
    const handleRemoveImage = (index) => {
        setFormData((prev) => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index),
        }))
        setActiveIndex((prev) => {
            if (index === prev) return Math.max(0, prev - 1)
            if (index < prev) return prev - 1
            return prev
        })
    }
    const goPrev = () => {
        setActiveIndex((prev) => (formData.images.length ? (prev - 1 + formData.images.length) % formData.images.length : 0))
    }
    const goNext = () => {
        setActiveIndex((prev) => (formData.images.length ? (prev + 1) % formData.images.length : 0))
    }

    const handleGenerateAI = async () => {
        if (!isLoaded || !isSignedIn || !user) return;
        if (!formData.images || formData.images.length === 0) {
            toast.error('Please upload at least one image first.');
            return;
        }
        const toastId = toast.loading("AI generating item description...");
        try {
            setAiLoading(true);
            const token = await getToken();
            const first = formData.images[0] || '';
            const base64 = first.includes(',') ? first.split(',')[1] : first;
            const hints = [formData.name, ...(formData.category||[])].filter(Boolean).join(', ');
            let lastErr = null;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const resp = await fetch(`${API_URL}/api/merchant/ai/generateFromImage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ clerkId: user.id, base64Image: base64, hints })
                    });
                    const data = await resp.json();
                    if (!resp.ok) throw new Error(data?.message || 'AI generation failed');
                    setFormData(prev => ({
                        ...prev,
                        description: data?.description ?? prev.description,
                        price: typeof data?.price === 'number' ? String(data.price) : prev.price,
                        category: Array.from(new Set([...(prev.category||[]), ...((data?.categories||[]) )]))
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
                : (raw ? `AI error: ${raw}` : 'AI error: Something went wrong while generating description.');
            toast.error(friendly, { id: toastId });
        } finally {
            setAiLoading(false);
        }
    }

    const friendlyItemError = (data) => {
        const msg = typeof data?.error?.message === 'string' ? data.error.message : '';
        const code = data?.error?.code || '';
        const details = typeof data?.error?.details === 'string' ? data.error.details : '';
        // Not-null constraint violations
        if (code === '23502') {
            const col = msg.match(/column "(\w+)"/)?.[1];
            const fieldMap = { quantity: 'Quantity', price: 'Price', name: 'Item Name', description: 'Description', category: 'Category' };
            const field = fieldMap[col] || col || 'a required field';
            return `Please fill in the "${field}" field — it cannot be left empty.`;
        }
        // Unique constraint violation
        if (code === '23505') {
            return 'An item with this name already exists in your shop. Please choose a different name.';
        }
        // Invalid input (e.g. wrong type)
        if (code === '22P02') {
            return 'One of the fields has an invalid value (for example, quantity or price must be a number). Please check your inputs and try again.';
        }
        // Foreign key violation
        if (code === '23503') {
            return 'Something went wrong with the shop link. Please refresh the page and try again.';
        }
        // Fallback to server message
        if (data?.message) return data.message;
        return 'Something went wrong while saving the item. Please try again.';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isLoaded || !isSignedIn || !user) return;
        const token = await getToken();
        const body = {
            ...formData,
            owner_id: user.id,
        };
        const toastId = toast.loading("Saving item details...");
        try {
            const res = await fetch(`${API_URL}/api/merchant/add_items`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (res.ok) {
                toast.success("Item details saved!", { id: toastId });
                router.push("/merchant/dashboard");
            } else {
                toast.error(friendlyItemError(data), { id: toastId });
            }
        } catch (err) {
            toast.error("Failed to save item details.", { id: toastId });
        }
    };

    if (!mounted) {
        return (
            <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-4 border-[var(--primary)] border-t-transparent animate-spin" />
                    <p className="text-[var(--muted-foreground)] text-sm animate-pulse">Loading form...</p>
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
                    colorBorder: 'var(--border)',
                    colorText: 'var(--foreground)'
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
                        controlItemBgHover: 'var(--muted)'
                    },
                    Input: { colorBgContainer: 'var(--card)', colorBorder: 'var(--border)', colorText: 'var(--foreground)' }
                }
            }}
        >
            <div className="min-h-screen p-4 md:p-8 bg-[var(--background)] text-[var(--foreground)]">
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Add New Product</h1>
                        <p className="text-sm text-[var(--muted-foreground)]">Create a new item in your store inventory.</p>
                    </div>

                    {/* Top Scan/Lookup Section */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-[var(--primary)] font-semibold text-lg justify-center">
                            <MdQrCodeScanner className="w-6 h-6 animate-pulse" />
                            <h2>Barcode Scanner</h2>
                        </div>
                        <p className="text-sm text-[var(--muted-foreground)] text-center">
                            Scan a new barcode to reload details.
                        </p>
                        <div className="flex flex-col gap-3">
                            <div className="relative w-full">
                                <button
                                    type="button"
                                    onClick={handleScanToggle}
                                    disabled={barcodeBusy || scanOverlay.active}
                                    className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed font-semibold transition-all ${scanOverlay.active ? '!bg-gray-400 !text-gray-200 dark:!bg-gray-700 dark:!text-gray-500' : ''}`}
                                >
                                    <MdQrCodeScanner className="w-5 h-5" />
                                    {barcodeBusy ? 'Scanning…' : 'Scan Barcode / Choose Image'}
                                </button>
                                <input ref={barcodeFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onBarcodeImageChosen(e.target.files?.[0])} />
                            </div>
                            
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Enter barcode number manually (e.g. 5900123...)"
                                    value={barcodeManual}
                                    disabled={barcodeBusy || scanOverlay.active}
                                    onChange={(e)=> setBarcodeManual(e.target.value)}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <button type="button" onClick={handleManualBarcodeLookup} disabled={barcodeBusy || scanOverlay.active || !barcodeManual.trim()} className="px-5 py-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)] font-medium disabled:opacity-60 disabled:cursor-not-allowed transition-colors">Lookup</button>
                            </div>
                        </div>
                    </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
                        {/* Details - LEFT (3/5) */}
                        <form onSubmit={handleSubmit} className="md:col-span-3 space-y-6">
                            {/* Card 1: Basic Information */}
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-6">
                                <h2 className="text-lg font-bold border-b border-[var(--border)] pb-3">Basic Information</h2>
                                <div>
                                    <label className="text-sm font-semibold text-[var(--foreground)] mb-2 block">Item Name / Title</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="e.g. Organic Bananas (Bundle)"
                                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] p-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all placeholder:text-[var(--muted-foreground)]"
                                    />
                                    {isDuplicateTitle && (
                                        <p className="text-amber-500 text-sm mt-1 animate-pulse flex items-center gap-1">
                                            <span>⚠️</span> A product with this title already exists.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-semibold text-[var(--foreground)]">Description</label>
                                        <button
                                            type="button"
                                            onClick={handleGenerateAI}
                                            disabled={aiLoading || !(formData.images && formData.images.length)}
                                            className={`text-xs px-2.5 py-1.5 rounded-md border border-[var(--border)] flex items-center gap-1.5 font-medium transition-all ${
                                                aiLoading || !(formData.images && formData.images.length)
                                                    ? 'opacity-50 cursor-not-allowed bg-[var(--muted)]'
                                                    : 'hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                                            }`}
                                        >
                                            {/* AI/Sparkles SVG Icon */}
                                            <svg className="w-3.5 h-3.5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                            </svg>
                                            {aiLoading ? 'Generating…' : 'Generate with AI'}
                                        </button>
                                    </div>
                                    <textarea
                                        name="description"
                                        placeholder="Describe features, size, ingredients or other details..."
                                        value={formData.description}
                                        onChange={handleChange}
                                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] p-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all placeholder:text-[var(--muted-foreground)]"
                                        rows={4}
                                    />
                                </div>
                            </div>

                            {/* Card 2: Pricing & Stock */}
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-6">
                                <h2 className="text-lg font-bold border-b border-[var(--border)] pb-3">Pricing & Inventory</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-sm font-semibold text-[var(--foreground)] mb-2 block">Quantity in Stock</label>
                                        <input
                                            type="number"
                                            value={formData.quantity}
                                            onChange={handleChange}
                                            name="quantity"
                                            placeholder="e.g. 50"
                                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] p-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all placeholder:text-[var(--muted-foreground)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-[var(--foreground)] mb-2 block">Price (INR)</label>
                                        <input
                                            type="number"
                                            value={formData.price}
                                            onChange={handleChange}
                                            name="price"
                                            placeholder="e.g. 150"
                                            min={1}
                                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] p-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all placeholder:text-[var(--muted-foreground)]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Categories */}
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-6">
                                <h2 className="text-lg font-bold border-b border-[var(--border)] pb-3">Categorization</h2>
                                <div>
                                    <label className="text-sm font-semibold text-[var(--foreground)] mb-2 block">Product Categories</label>
                                    <Select
                                        mode="multiple"
                                        allowClear
                                        style={{ width: '100%' }}
                                        placeholder="Select one or more categories"
                                        value={formData.category}
                                        onChange={(values) => setFormData(prev => ({ ...prev, category: values }))}
                                        options={[...new Set([...categoryOptions, 'Other'])].map(cat => ({ label: cat, value: cat }))}
                                        size="large"
                                        styles={{ popup: { root: { background: 'var(--popover)', color: 'var(--popover-foreground)' } } }}
                                    />
                                    {formData.category.includes('Other') && (
                                        <div className="mt-4 animate-fadeIn">
                                            <label className="text-sm font-semibold text-[var(--foreground)] mb-2 block">New Category Name</label>
                                            <input
                                                type="text"
                                                value={otherCategory}
                                                onChange={(e) => setOtherCategory(e.target.value)}
                                                onBlur={() => {
                                                    const newCat = otherCategory.trim();
                                                    if (newCat) {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            category: [...new Set(prev.category.filter(c => c !== 'Other').concat(newCat))]
                                                        }));
                                                        setOtherCategory("");
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const newCat = otherCategory.trim();
                                                        if (newCat) {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                category: [...new Set(prev.category.filter(c => c !== 'Other').concat(newCat))]
                                                            }));
                                                            setOtherCategory("");
                                                        }
                                                    }
                                                }}
                                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] p-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all placeholder:text-[var(--muted-foreground)]"
                                                placeholder="Type new category and press Enter"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className="w-full bg-[var(--primary)] hover:opacity-95 text-[var(--primary-foreground)] font-bold py-3.5 rounded-xl transition-all duration-300 shadow-md flex items-center justify-center gap-2 hover:scale-[1.01]"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path>
                                </svg>
                                Add Product to Inventory
                            </button>
                        </form>

                        {/* Images - RIGHT (2/5) */}
                        <div className="md:col-span-2 md:sticky md:top-8 space-y-6">
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-4">
                                <h2 className="text-lg font-bold border-b border-[var(--border)] pb-3">Product Images</h2>
                                
                                {/* Hidden input tags wired to ref hooks */}
                                <input
                                    ref={folderInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                                <input
                                    ref={cameraInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />

                                {/* Carousel Preview Box */}
                                <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)]">
                                    {formData.images && formData.images.length > 0 ? (
                                        <img
                                            src={formData.images[activeIndex]}
                                            alt={`image-${activeIndex}`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-sm text-[var(--muted-foreground)] p-4 text-center">
                                            <svg className="w-12 h-12 text-[var(--border)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                            </svg>
                                            <span>No images uploaded yet</span>
                                        </div>
                                    )}
                                    {formData.images && formData.images.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => { setCropOpen(true); setCropScale(1); setCropOffset({ x: 0, y: 0 }); }}
                                            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-[var(--popover)]/90 backdrop-blur-sm border border-[var(--border)] text-sm font-semibold hover:bg-[var(--muted)] transition-colors shadow-sm"
                                        >
                                            Edit & Center
                                        </button>
                                    )}
                                    {formData.images && formData.images.length > 1 && (
                                        <>
                                            <button type="button" onClick={goPrev} className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-[var(--popover)]/90 backdrop-blur-sm text-[var(--popover-foreground)] border border-[var(--border)] hover:bg-[var(--accent)] hover:scale-105 shadow-md flex items-center justify-center font-bold text-lg transition-all select-none">‹</button>
                                            <button type="button" onClick={goNext} className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-[var(--popover)]/90 backdrop-blur-sm text-[var(--popover-foreground)] border border-[var(--border)] hover:bg-[var(--accent)] hover:scale-105 shadow-md flex items-center justify-center font-bold text-lg transition-all select-none">›</button>
                                        </>
                                    )}
                                </div>

                                {/* Thumbnail Carousel Grid */}
                                {formData.images && formData.images.length > 0 && (
                                    <div className="grid grid-cols-5 gap-2 p-1 max-h-32 overflow-y-auto">
                                        {formData.images.map((img, i) => (
                                            <div
                                                key={i}
                                                onClick={() => setActiveIndex(i)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveIndex(i); } }}
                                                role="button"
                                                tabIndex={0}
                                                className={`relative aspect-square rounded-lg overflow-hidden border cursor-pointer transition-all ${
                                                    i === activeIndex
                                                        ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20 scale-95 shadow-sm'
                                                        : 'border-[var(--border)] hover:opacity-85'
                                                }`}
                                                aria-label={`Select image ${i + 1}`}
                                            >
                                                <img src={img} alt={`thumb-${i}`} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveImage(i) }}
                                                    className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] transition-colors"
                                                    aria-label={`Remove image ${i + 1}`}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Unified Bordered Dropzone Area */}
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={handleFolderUploadClick}
                                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                                        isDragging
                                            ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                                            : 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--muted)]/30'
                                    } ${formData.images && formData.images.length > 0 ? 'mt-4 py-4 px-4 gap-2 text-sm' : ''}`}
                                >
                                    {/* Cloud Icon */}
                                    <svg className={`mx-auto text-[var(--muted-foreground)] transition-colors ${formData.images && formData.images.length > 0 ? 'w-8 h-8' : 'w-12 h-12'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                                    </svg>
                                    
                                    <div className="space-y-0.5">
                                        <p className="font-semibold text-sm text-[var(--foreground)]">
                                            Drag & drop or click to upload
                                        </p>
                                        {!(formData.images && formData.images.length > 0) && (
                                            <p className="text-xs text-[var(--muted-foreground)]">
                                                Supports PNG, JPG, JPEG
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-center gap-3 mt-1">
                                        <button
                                            type="button"
                                            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors shadow-sm"
                                        >
                                            Choose from folder
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Image Center/Crop Modal */}
            {cropOpen && (
              <div className="fixed inset-0 z-[10000] bg-black/60 grid place-items-center">
                <div className="w-[90vw] max-w-3xl rounded-xl bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] shadow-2xl overflow-hidden">
                  <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
                    <div className="font-semibold">Center image</div>
                    <button type="button" onClick={()=> setCropOpen(false)} className="px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--muted)]">Close</button>
                  </div>
                  <div className="p-4 grid gap-4">
                    <div className="relative w-full aspect-square overflow-hidden rounded-lg bg-[var(--muted)]">
                      <div
                        className="absolute inset-0 cursor-grab active:cursor-grabbing"
                        onPointerDown={(e)=>{ e.currentTarget.setPointerCapture(e.pointerId); cropDrag.current = { x: e.clientX, y: e.clientY, start: { ...cropOffset } }; }}
                        onPointerMove={(e)=>{ if (!cropDrag.current) return; const dx = e.clientX - cropDrag.current.x; const dy = e.clientY - cropDrag.current.y; setCropOffset({ x: cropDrag.current.start.x + dx, y: cropDrag.current.start.y + dy }); }}
                        onPointerUp={()=>{ cropDrag.current = null; }}
                      >
                        <img src={formData.images?.[activeIndex] || ''} alt="crop" style={{ transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropScale})`, transformOrigin: 'center center' }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none" />
                        {/* Center guides */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
                          <div className="absolute inset-x-0 top-1/2 h-px bg-white/40" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-[var(--muted-foreground)]">Zoom</label>
                      <input type="range" min={0.5} max={3} step={0.01} value={cropScale} onChange={(e)=> setCropScale(parseFloat(e.target.value))} className="flex-1" />
                      <button type="button" onClick={()=>{ setCropOffset({x:0,y:0}); setCropScale(1); }} className="px-3 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--muted)]">Reset</button>
                      <button type="button" onClick={async ()=>{
                        // export canvas square
                        const imgSrc = formData.images?.[activeIndex] || '';
                        const img = new Image();
                        img.onload = () => {
                          const size = 1024;
                          const canvas = document.createElement('canvas');
                          canvas.width = size; canvas.height = size;
                          const ctx = canvas.getContext('2d');
                          ctx.fillStyle = '#fff'; ctx.fillRect(0,0,size,size);
                          const cx = size/2 + cropOffset.x;
                          const cy = size/2 + cropOffset.y;
                          const iw = img.width * cropScale;
                          const ih = img.height * cropScale;
                          ctx.drawImage(img, cx - iw/2, cy - ih/2, iw, ih);
                          const out = canvas.toDataURL('image/png');
                          setFormData(prev => {
                            const arr = [...(prev.images||[])];
                            arr[activeIndex] = out;
                            return { ...prev, images: arr };
                          });
                          setCropOpen(false);
                        };
                        img.src = imgSrc;
                      }} className="px-3 py-1.5 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)]">Apply</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {barcodeCenterOpen && (
              <div className="fixed inset-0 z-[10000] bg-black/60 grid place-items-center">
                <div className="w-[92vw] max-w-3xl rounded-xl bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] shadow-2xl overflow-hidden">
                  <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
                    <div className="font-semibold">Center barcode image</div>
                    <button type="button" onClick={()=> { setBarcodeCenterOpen(false); }} className="px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--muted)]">Close</button>
                  </div>
                  <div className="p-4 grid gap-4 relative">
                    {barcodeBusy && (
                      <div className="absolute inset-0 z-10 grid place-items-center bg-[var(--background)]/60">
                        <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin" />
                      </div>
                    )}
                    <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-[var(--muted)]">
                      <div
                        className="absolute inset-0 cursor-grab active:cursor-grabbing"
                        onPointerDown={(e)=>{ e.currentTarget.setPointerCapture(e.pointerId); barcodeCenterDrag.current = { x: e.clientX, y: e.clientY, start: { ...barcodeCenterOffset } }; }}
                        onPointerMove={(e)=>{ if (!barcodeCenterDrag.current) return; const dx = e.clientX - barcodeCenterDrag.current.x; const dy = e.clientY - barcodeCenterDrag.current.y; setBarcodeCenterOffset({ x: barcodeCenterDrag.current.start.x + dx, y: barcodeCenterDrag.current.start.y + dy }); }}
                        onPointerUp={()=>{ barcodeCenterDrag.current = null; }}
                      >
                        <img src={barcodeLastImage || ''} alt="barcode-center" style={{ transform: `translate(${barcodeCenterOffset.x}px, ${barcodeCenterOffset.y}px) scale(${barcodeCenterScale}) rotate(${barcodeCenterRotate}deg)`, transformOrigin: 'center center' }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none" />
                        {/* Guides */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute inset-x-0 top-1/2 h-px bg-white/40" />
                          <div className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-sm text-[var(--muted-foreground)]">Zoom</label>
                      <input type="range" min={0.5} max={3} step={0.01} value={barcodeCenterScale} onChange={(e)=> setBarcodeCenterScale(parseFloat(e.target.value))} className="flex-1" />
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={()=> setBarcodeCenterRotate(r => (r - 90 + 360) % 360)} className="px-2 py-1 rounded-md border border-[var(--border)]">Rotate -90°</button>
                        <button type="button" onClick={()=> setBarcodeCenterRotate(r => (r + 90) % 360)} className="px-2 py-1 rounded-md border border-[var(--border)]">Rotate +90°</button>
                      </div>
                      <button type="button" onClick={()=> { setBarcodeCenterScale(1); setBarcodeCenterOffset({x:0,y:0}); setBarcodeCenterRotate(0); }} className="px-3 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--muted)]">Reset</button>
                      <button type="button" disabled={barcodeBusy} onClick={async ()=>{
                        if (scanAbortControllerRef.current) {
                            scanAbortControllerRef.current.abort();
                        }
                        scanAbortControllerRef.current = new AbortController();
                        const signal = scanAbortControllerRef.current.signal;

                        setScanOverlay({ active: true, state: 'scanning', errorMsg: '' });
                        setBarcodeBusy(true);
                        try {
                          // render a new aligned image into canvas for decode
                          const img = new Image();
                          const imgLoadPromise = new Promise((resolve, reject) => {
                            img.onload = () => resolve(img);
                            img.onerror = () => reject(new Error('Failed to load alignment image.'));
                          });
                          img.src = barcodeLastImage || '';
                          
                          await imgLoadPromise;
                          if (signal.aborted) return;

                          const W = 1280, H = 720; // wide canvas for barcode
                          const canvas = document.createElement('canvas');
                          canvas.width = W; canvas.height = H;
                          const ctx = canvas.getContext('2d');
                          ctx.fillStyle = '#fff';
                          ctx.fillRect(0,0,W,H);
                          ctx.save();
                          ctx.translate(W/2 + barcodeCenterOffset.x, H/2 + barcodeCenterOffset.y);
                          ctx.rotate((barcodeCenterRotate * Math.PI)/180);
                          const iw = img.width * barcodeCenterScale;
                          const ih = img.height * barcodeCenterScale;
                          ctx.drawImage(img, -iw/2, -ih/2, iw, ih);
                          ctx.restore();
                          const aligned = canvas.toDataURL('image/png');
                          const code = await decodeAny(aligned);
                          if (signal.aborted) return;

                          if (!code) {
                            setScanOverlay({ active: true, state: 'error', errorMsg: 'No barcode detected after centering. Try adjusting zoom/position/rotation.' });
                            return;
                          }

                          setScanOverlay({ active: true, state: 'fetching', errorMsg: '' });
                          const prod = await fetchProductByBarcode(code, signal);
                          if (signal.aborted) return;

                          if (!prod) {
                            setScanOverlay({ active: true, state: 'error', errorMsg: `No product info found for barcode ${code}.` });
                            return;
                          }
                          let imgB64 = '';
                          if (prod.img) { try { imgB64 = await fetchImageUrlToBase64(prod.img, signal); } catch {} }
                          if (signal.aborted) return;

                          let priceVal = prod.price;
                          if (!priceVal && prod.img) {
                            const hints = [prod.name, ...(prod.categories||[])].filter(Boolean).join(', ');
                            priceVal = await estimatePriceFromImage(prod.img, hints, signal);
                          }
                          if (signal.aborted) return;

                          setFormData(prev => ({
                            ...prev,
                            name: prod.name || prev.name,
                            description: prod.desc || prev.description,
                            category: Array.from(new Set([...(prev.category||[]), ...((prod.categories||[]))])),
                            images: imgB64 ? [imgB64, ...(prev.images||[])] : prev.images,
                            price: priceVal ? String(priceVal) : prev.price
                          }));
                          setActiveIndex(0);
                          setBarcodeCenterOpen(false);
                          setScanOverlay({ active: false, state: 'scanning', errorMsg: '' });
                        } catch (err) {
                          if (err.name === 'AbortError' || signal.aborted) {
                            return;
                          }
                          setScanOverlay({ active: true, state: 'error', errorMsg: err.message || 'An error occurred during barcode scanning.' });
                        } finally {
                          if (!signal.aborted) {
                            setBarcodeBusy(false);
                          }
                        }
                      }} className="px-4 py-2 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-60">{barcodeBusy ? 'Decoding…' : 'Apply & Decode'}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {scanOverlay.active && mounted && typeof window !== 'undefined' && createPortal(
              <div className="fixed inset-0 z-[20000] bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm pointer-events-auto">
                <div className="w-[90vw] max-w-sm bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-6 text-center">
                  
                  {/* Pulsing Scanner Icon */}
                  <MdQrCodeScanner className="w-16 h-16 text-[var(--primary)] animate-pulse" />
                  
                  {/* Status / Message Text */}
                  <p className="text-lg font-semibold text-[var(--foreground)] animate-pulse">
                    {scanOverlay.state === 'scanning' && 'Scanning barcode…'}
                    {scanOverlay.state === 'fetching' && 'Fetching item details…'}
                    {scanOverlay.state === 'error' && (scanOverlay.errorMsg || 'Scan failed')}
                  </p>
                  
                  {/* Cancel / Close Button */}
                  <button
                    type="button"
                    onClick={handleCancelScan}
                    className="w-full py-2.5 px-4 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] font-semibold transition-colors mt-2"
                  >
                    {scanOverlay.state === 'error' ? 'Close' : 'Cancel'}
                  </button>
                </div>
              </div>,
              document.body
            )}
          </ConfigProvider>
    );
}