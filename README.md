# Gathr 🛍️

> **A hyper-local marketplace platform** connecting customers with merchants and shopkeepers in their immediate vicinity.

[![Next.js](https://img.shields.io/badge/Next.js-15.4-black?logo=next.js)](https://nextjs.org)
[![Express](https://img.shields.io/badge/Express.js-5.1-lightgrey?logo=express)](https://expressjs.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)](https://supabase.com)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-purple?logo=clerk)](https://clerk.com)

---

## 🚀 Project Overview

Gathr is a full-stack, production-grade web application that enables local businesses to showcase their products and services to nearby customers. It features real-time order tracking, AI-powered product listing tools, geolocation-based discovery, role-based multi-actor authentication, and an end-to-end payment pipeline using Razorpay.

---

## 🏗️ Architecture

### Frontend — Next.js 15 (App Router)

| Concern | Technology |
|---|---|
| Framework | Next.js 15.x with App Router |
| Authentication | Clerk (multi-role: Customer / Merchant / Carrier / Admin) |
| UI Components | Ant Design (AntD) v5, Lucide React icons |
| Styling | Tailwind CSS v4, vanilla CSS variables (dark/light theming) |
| Animations | Framer Motion v12, GSAP v3, Three.js v0.179 |
| HTTP Client | Axios v1 |
| Real-time | Socket.IO client (order tracking, live delivery, in-order chat) |
| Maps | Google Maps JavaScript API, Google Places Autocomplete |
| i18n | react-i18next (English, Telugu, Tamil, Hindi) |
| Notifications | react-hot-toast |

### Backend — Express.js 5

| Concern | Technology |
|---|---|
| Framework | Express.js v5.1 (ES Modules) |
| Authentication | Clerk SDK for Node.js + custom `requireAuth` middleware |
| Database | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| Real-time | Socket.IO server (order rooms, carrier location updates, in-order chat) |
| Image Storage | Cloudinary v2 |
| File Uploads | Multer v2 |
| Payments | Razorpay (order creation + webhook verification) |
| Email / OTP | Mailjet API |
| AI | Google Gemini 2.5 Flash API |

---

## 📁 Project Structure

```
Gathr/
├── frontend/                       # Next.js 15 App Router application
│   ├── public/                     # Static assets
│   └── src/
│       ├── app/
│       │   ├── about/              # Contact & about page
│       │   ├── admin/              # Admin dashboard + complaints
│       │   ├── auth-callback/      # Clerk post-auth redirect handler
│       │   ├── customer/
│       │   │   ├── cart/           # Shopping cart (optimistic UI, auto-save)
│       │   │   ├── checkout/       # Order placement + Razorpay integration
│       │   │   ├── dashboard/      # Home: nearby products, categories
│       │   │   ├── getShops/       # Geo-filtered shop discovery
│       │   │   ├── orders/         # Order history + live tracking
│       │   │   ├── profile/        # Customer profile + address book
│       │   │   └── wishlist/       # Saved items
│       │   ├── merchant/
│       │   │   ├── addItem/        # Product creation (AI + Barcode/UPC scan)
│       │   │   ├── allOrders/      # Full order history for merchant
│       │   │   ├── createShop/     # One-time shop setup flow
│       │   │   ├── dashboard/      # Merchant analytics overview
│       │   │   ├── editItem/       # Product editing (AI regenerate)
│       │   │   ├── inventory/      # Inventory management grid
│       │   │   ├── orders/         # Pending order management
│       │   │   ├── profile/        # Merchant public profile
│       │   │   └── updateShop/     # Shop settings editor
│       │   ├── sign-in/ sign-up/   # Clerk-hosted auth UI
│       │   ├── layout.jsx          # Root layout with providers + Navbar
│       │   └── page.jsx            # Public landing page (GSAP animations)
│       ├── components/
│       │   ├── gsap/               # GSAP animation primitives
│       │   ├── theme/              # ThemeProvider + ThemeToggle (dark/light)
│       │   ├── ui/                 # UIProviders (Clerk, Theme, RouteTransition)
│       │   ├── Navbar.jsx          # Role-aware navbar (real-time cart badge)
│       │   ├── Notification.jsx    # Shared toast notification component
│       │   └── RouteTransition.jsx # Page transition overlay
│       ├── lib/
│       │   └── i18n.js             # Internationalization config
│       └── middleware.js           # Clerk route-protection middleware
│
├── backend/                        # Express.js REST + Socket.IO server
│   ├── controllers/
│   │   ├── admin.controller.js     # Admin: ban users, resolve complaints
│   │   ├── complaints.controller.js
│   │   ├── customer.controller.js  # Cart, shops, search, ratings
│   │   ├── customer2.controller.js # Addresses, wishlist, order history
│   │   ├── customer3.controller.js # Recommendations, similar items
│   │   ├── customer_ai.controller.js # Gemini image description for customers
│   │   ├── delivery.controller.js  # Carrier assignment + live tracking
│   │   ├── merchant.controller.js  # Shop & inventory CRUD
│   │   ├── merchant3.controller.js # Order status management
│   │   ├── merchant_ai.controller.js # Gemini AI product generation from image
│   │   ├── merchantup.controller.js  # Shop/item update & delete
│   │   ├── notify.controller.js    # Email/OTP notifications
│   │   └── order.controller.js     # Order lifecycle management
│   ├── routes/
│   │   ├── merchantRoute.js
│   │   ├── customerRoute.js
│   │   ├── orderRoute.js
│   │   ├── deliveryRoute.js
│   │   ├── notifyRoute.js
│   │   ├── complaintsRoute.js
│   │   ├── adminRoute.js
│   │   └── otpRoute.js
│   ├── utils/
│   │   └── check.js                # Clerk JWT verification middleware
│   ├── cloudinary.js               # Cloudinary SDK config
│   ├── db.js                       # Supabase client singleton
│   ├── index.js                    # Express app + Socket.IO server entry
│   └── razorpayIntegration.js      # Razorpay order + webhook handler
├── README.md
└── .gitignore
```

---

## 🎯 Feature Set

### 🔐 Authentication & Authorization
- **Multi-role Clerk authentication**: Customer, Merchant, Carrier, Admin
- **JWT-protected API routes** with `requireAuth` middleware
- **Role-based route protection** via Next.js middleware
- **Admin login** via separate PIN-gated flow (localStorage-persisted session)

### 🛒 Customer Experience
- **Geolocation-based shop discovery**: finds shops within configurable radius
- **Product browsing** with category filters and real-time search
- **Shopping Cart**: optimistic UI, auto-save on `+`/`−`, animated item removal, instant navbar badge via `cart:changed` event
- **Wishlist** with instant badge updates via `wishlist:changed` event
- **Checkout** with Razorpay payment integration (UPI, cards, netbanking)
- **Live order tracking** with real-time carrier GPS via Socket.IO
- **In-order chat** between customer, merchant, and carrier
- **AI product descriptions**: Gemini-powered "describe this item" feature
- **Personalised recommendations** based on purchase history

### 🏪 Merchant Dashboard
- **Shop creation and management** with Cloudinary image uploads
- **Inventory management**: add, edit, delete products
- **AI-assisted product listing** (see Innovations section below)
- **Barcode / UPC scan-to-list** (see Innovations section below)
- **Order management**: accept/reject/update order status
- **Pending orders badge** in navbar, auto-refreshed on navigation

### 🚚 Carrier (Delivery Agent) Portal
- **Assigned delivery queue** with order details
- **Live GPS location streaming** via Socket.IO to all parties
- **Delivery history** with earnings summary
- **Profile management**

### 🛠️ Admin Panel
- **User ban/unban management**
- **Complaint resolution queue**
- **Transactional email dispatch** via Mailjet

### 💬 Real-time Features (Socket.IO)
- Carrier GPS location broadcast to order-specific rooms
- In-order live chat (no message persistence by design)
- Cart badge and wishlist badge instant updates via custom browser events

---

## 💡 Innovations

### 1. AI-Powered Product Listing (Gemini Vision)

**Problem**: Merchants, especially small shopkeepers, struggle to write accurate product names, descriptions, and prices — particularly for items they just unpacked.

**Solution**: On the `Add Item` and `Edit Item` pages, merchants can upload a product photo and click **"Generate with AI"**. The backend sends the image to **Google Gemini 2.5 Flash** (multimodal) with a structured prompt. Gemini returns a strict JSON response containing:
- `name` – human-readable product name
- `description` – 2–4 sentence marketing description
- `categories` – array of matched inventory categories
- `price` – AI-estimated MRP in INR

A two-pass retry mechanism with decreasing temperature ensures reliable JSON parsing. The frontend pre-fills all form fields instantly, allowing the merchant to review and submit without typing.

**Files**: [`merchant_ai.controller.js`](backend/controllers/merchant_ai.controller.js) · [`addItem/page.jsx`](frontend/src/app/merchant/addItem/page.jsx)

---

### 2. Barcode / UPC Scan-to-List Product Pipeline

**Problem**: Merchants who stock branded/packaged goods (FMCG, electronics accessories, etc.) must manually look up product details that are already publicly available via global product databases.

**Solution**: The Add Item page features a comprehensive **barcode scanning and lookup pipeline**:

#### Scanning Pipeline (client-side, zero-server-cost)
The system attempts barcode decoding in order of priority:

1. **Native Browser `BarcodeDetector` API** — fastest, hardware-accelerated, available on Chromium 83+
2. **ZXing (`@zxing/library`)** — battle-tested cross-format decoder loaded on demand from CDN
3. **Quagga2 (`@ericblade/quagga2`)** — fallback decoder with multi-patchsize scanning
4. **Tesseract.js OCR** — last-resort optical digit extraction from the barcode numeral strip

Each decoder runs across **13 image preprocessing variants** (grayscale, contrast-enhanced, inverted, thresholded, cropped bands, mirrored, sharpened, multi-rotation at ±3°/±5°/±7°/90°/180°/270°) to maximise decode success on low-quality or angled photos.

Supported barcode formats: **EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF, Codabar, Code 93, I2of5**.

#### Product Data Lookup
Once a barcode is decoded, the system queries **Open Food Facts API** (`world.openfoodfacts.org`) — a free, community-maintained global product database — to retrieve:
- Product name and brand
- Category information (mapped to Gathr's inventory categories)
- Front product image URL

#### AI Price Estimation
If Open Food Facts does not include a price (most products), the retrieved product image is forwarded to the **Gemini AI pipeline** (see Innovation #1) with category hints to estimate an appropriate MRP in INR.

#### Manual Barcode Lookup
Merchants can also **type a barcode number manually** and trigger the lookup without scanning, accommodating damaged barcodes or typed GTIN codes.

**Result**: A merchant can point their phone camera at a product barcode and have name, description, image, categories, and estimated price pre-filled in ~3 seconds — dramatically reducing listing friction for high-volume inventory ingestion.

**Files**: [`addItem/page.jsx`](frontend/src/app/merchant/addItem/page.jsx) (lines 63–508)

---

### 3. Geolocation-Based Shop & Product Discovery

Customers see only shops and products within their proximity. Location is resolved from:
1. Browser Geolocation API (GPS-precise)
2. Google Maps Places Autocomplete (address-based)
3. Pre-selected Indian city presets (Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad) — shown in a modal if no location is set

The backend filters shops using Haversine distance formula, and all product category sections on the home dashboard are populated exclusively from nearby shop inventories — no fake or out-of-range products are shown.

---

### 4. Real-Time Order Lifecycle with Live GPS Tracking

Entire order flow is real-time via Socket.IO:
- Customer, merchant, and carrier join a shared `order:{id}` room on Socket.IO
- Carrier streams GPS coordinates (`location:update`) — received live on the customer's tracking map
- System join events broadcast role-specific notifications
- In-order live chat works between all three parties with no message storage

---

### 5. Multi-language Support (i18n)

Gathr supports four languages out of the box: **English**, **Telugu (తెలుగు)**, **Tamil (தமிழ்)**, and **Hindi (हिन्दी)**. Language preference is persisted in `localStorage` and survives page reloads.

---

## 🛠️ Setup Instructions

### Prerequisites
- Node.js v18 or higher
- npm (v9+) or yarn
- Accounts with: [Clerk](https://clerk.com), [Supabase](https://supabase.com), [Cloudinary](https://cloudinary.com), [Razorpay](https://razorpay.com), [Mailjet](https://mailjet.com), [Google Cloud](https://cloud.google.com) (Maps + Gemini APIs)

---

### Environment Variables

#### Frontend — `frontend/.env`

```env
# Backend server base URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000

# Frontend base URL (used for absolute redirects)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Clerk — publishable key (safe for browser)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_CLERK_PUBLISHABLE_KEY

# Clerk — secret key (also used by Next.js API routes)
CLERK_SECRET_KEY=sk_test_YOUR_CLERK_SECRET_KEY

# Google Maps JavaScript API key (enable: Maps JS API, Places API, Geocoding API)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

# Google Gemini API key (used by Next.js API routes / AI shop assistant)
GOOGLE_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY
```

#### Backend — `backend/.env`

```env
# CORS: allowed frontend origin
FRONTEND_URL=http://localhost:3000

# Clerk authentication
CLERK_SECRET_KEY=sk_test_YOUR_CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_CLERK_PUBLISHABLE_KEY

# Supabase — project URL and service role key (bypasses RLS for server-side ops)
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Supabase — direct PostgreSQL connection string (used for raw pg queries)
SUPABASE_DB_URL=postgresql://postgres.YOUR_PROJECT_ID:YOUR_DB_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres

# Cloudinary — image and asset storage
CLOUDINARY_CLOUD_NAME=YOUR_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=YOUR_CLOUDINARY_API_SECRET

# Google Gemini AI — for merchant AI product generation
GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY

# Razorpay — payment gateway (use test keys for development)
RAZORPAY_KEY_ID=rzp_test_YOUR_RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_KEY_SECRET

# Mailjet — transactional email / OTP delivery
MJ_APIKEY_PUBLIC=YOUR_MAILJET_PUBLIC_KEY
MJ_APIKEY_PRIVATE=YOUR_MAILJET_PRIVATE_KEY
MJ_SENDER_EMAIL=your-verified-sender@yourdomain.com

# Delivery fee configuration (adjustable)
GST_RATE=0.18
DELIVERY_BASE_KM=2
DELIVERY_BASE_FEE=30
DELIVERY_PER_KM_FEE=10
```

> **Security Note**: Never commit your `.env` files to version control. Both `frontend/.env` and `backend/.env` are listed in `.gitignore`.

---

### Installation & Running

```bash
# 1. Clone the repository
git clone https://github.com/PranavNagaraji/Gathr-ecommerce.git
cd Gathr-ecommerce

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install

# 4. Start backend (runs on http://localhost:5000)
cd ../backend
npm run dev

# 5. Start frontend (runs on http://localhost:3000)
cd ../frontend
npm run dev
```

---

## 🔗 API Reference

### Public / Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/set-role` | Set user role and sync to Supabase |

### Merchant Routes (all `requireAuth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/merchant/add_shop` | Create shop |
| `POST` | `/api/merchant/add_items` | Add product to inventory |
| `POST` | `/api/merchant/get_items` | Get merchant's products |
| `POST` | `/api/merchant/get_shop` | Get shop details |
| `PUT` | `/api/merchant/update_shop` | Update shop info |
| `PUT` | `/api/merchant/update_items` | Update product |
| `PUT` | `/api/merchant/update_order_status` | Update order status |
| `DELETE` | `/api/merchant/delete_item` | Delete product |
| `DELETE` | `/api/merchant/delete_shop` | Delete shop |
| `GET` | `/api/merchant/get_pending_carts/:clerkId` | Get pending orders |
| `GET` | `/api/merchant/get_all_carts/:clerkId` | Get all order history |
| `POST` | `/api/merchant/ai/generateFromImage` | AI product generation from image |

### Customer Routes
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/customer/getShops` | Get nearby shops (geo-filtered) |
| `GET` | `/api/customer/getShopItem/:shopId` | Get items for a shop |
| `POST` | `/api/customer/addToCart` | Add item to cart |
| `POST` | `/api/customer/deleteFromCart` | Remove/reduce cart item |
| `POST` | `/api/customer/getCart` | Get current cart |
| `POST` | `/api/customer/wishlist/add` | Add to wishlist |
| `POST` | `/api/customer/wishlist/remove` | Remove from wishlist |
| `POST` | `/api/customer/wishlist/list` | Get wishlist items |
| `GET` | `/api/customer/recommendations/:clerkId` | Personalised recommendations |
| `GET` | `/api/customer/items/:itemId/similar` | Similar item suggestions |
| `POST` | `/api/customer/ai/describeImage` | Gemini AI item description |

### Order Routes
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/order/...` | Order placement and lifecycle |

### Razorpay
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/razorpay/create-order` | Create Razorpay payment order |
| `POST` | `/razorpay/webhook` | Webhook for payment confirmation |

### OTP / Notifications (public)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/otp/send` | Send OTP email via Mailjet |
| `POST` | `/api/otp/verify` | Verify OTP |

---

## 🎨 Design System

- **Color scheme**: Fully CSS-variable-driven dark/light theming (`oklch` color space), toggleable at runtime without page reload
- **Typography**: Inter, Outfit, Quicksand (Google Fonts)
- **Animations**: Framer Motion for page transitions, micro-interactions, and animated list entry/exit; GSAP for landing page hero sequences
- **Accessibility**: `aria-label`, `focus-visible` ring styles, keyboard-navigable steppers throughout

---

## ✅ Completed Features

- [x] Multi-role authentication (Clerk)
- [x] Geolocation-based shop and product discovery
- [x] Full shopping cart with optimistic auto-save UX
- [x] Wishlist with real-time badge
- [x] Razorpay checkout integration
- [x] Real-time order tracking + live GPS (Socket.IO)
- [x] In-order live chat
- [x] Merchant inventory management (CRUD)
- [x] AI product listing from image (Gemini Vision)
- [x] Barcode / UPC scan-to-list pipeline
- [x] Admin panel (ban/unban, complaints, bulk email)
- [x] Carrier delivery portal
- [x] Multilingual UI (EN / TE / TA / HI)
- [x] Dark / light mode (no reload, CSS variable-based)
- [x] Personalised product recommendations
- [x] Address book management

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with appropriate tests
4. Submit a pull request with a clear description

---

## 📄 License

This project is developed as part of a software engineering capstone and is intended for educational and demonstration purposes.

---

**Last Updated**: June 2026  
**Version**: 1.0.0  
**Maintainers**: Gathr Engineering Team
