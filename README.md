# <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/shopping-cart.svg" width="32" height="32" valign="middle" /> Gathr E-Commerce Platform

> **A hyper-local marketplace platform** connecting customers with merchants and shopkeepers in their immediate vicinity.

[![Next.js](https://img.shields.io/badge/Next.js-15.4-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Express](https://img.shields.io/badge/Express.js-5.1-000000?style=flat-square&logo=express)](https://expressjs.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![Redis](https://img.shields.io/badge/Redis-JSON%20%26%20Search-FF4438?style=flat-square&logo=redis)](https://redis.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?style=flat-square&logo=clerk)](https://clerk.com)
[![OpenStreetMap](https://img.shields.io/badge/Maps-Leaflet%20%26%20OSM-7EBC6F?style=flat-square&logo=openstreetmap)](https://openstreetmap.org)
[![Socket.io](https://img.shields.io/badge/Real--Time-Socket.io-010101?style=flat-square&logo=socket.io)](https://socket.io)
[![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini-8E75B2?style=flat-square&logo=google)](https://aistudio.google.com)

---

## <img src="https://img.shields.io/badge/-Overview-000000?style=flat-square&logo=readme&logoColor=white" /> Project Overview

Gathr is a full-stack, production-grade web application that enables local businesses to showcase their products and services to nearby customers. It features real-time order tracking, AI-powered product listing tools, geolocation-based discovery, role-based multi-actor authentication, high-performance product caching/searching and in-order chat persistence powered by **Redis**, and an end-to-end payment pipeline using Razorpay.

---

## <img src="https://img.shields.io/badge/-Architecture-000000?style=flat-square&logo=diagramsdotnet&logoColor=white" /> System Architecture

### <img src="https://img.shields.io/badge/-Frontend-000000?style=flat-square&logo=nextdotjs&logoColor=white" /> Frontend — Next.js 15 (App Router)

| Concern | Technology |
|---|---|
| Framework | Next.js 15.x with App Router + Turbopack |
| Authentication | Clerk (multi-role: Customer / Merchant / Carrier / Admin) |
| UI Components | Ant Design (AntD) v5, MUI v7, Lucide React, React Icons |
| Styling | Tailwind CSS v4, vanilla CSS variables (dark/light theming) |
| Animations | Framer Motion v12, GSAP v3, Three.js v0.179, OGL |
| HTTP Client | Axios v1 |
| Real-time | Socket.IO client (order tracking, live delivery, in-order chat) |
| Maps | Leaflet.js, OpenStreetMap (Nominatim search/reverse geocoding & OSRM routing) |
| i18n | react-i18next (English, Telugu, Tamil, Hindi) |
| Notifications | react-hot-toast |
| Carousel | react-slick + slick-carousel |
| Firebase | Firebase v12 (auxiliary services) |

### <img src="https://img.shields.io/badge/-Backend-000000?style=flat-square&logo=express&logoColor=white" /> Backend — Express.js 5

| Concern | Technology |
|---|---|
| Framework | Express.js v5.1 (ES Modules) |
| Authentication | Clerk SDK for Node.js + custom `requireAuth` middleware |
| Database | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| Cache & Search | Redis (RedisJSON & RediSearch v6) |
| Real-time | Socket.IO server (order rooms, location updates) + Redis Lists (chat persistence) |
| Image Storage | Cloudinary v2 |
| File Uploads | Multer v2 |
| Payments | Razorpay (order creation + webhook verification) |
| Email / OTP | SMTP via Nodemailer (Gmail/custom) with Mailjet as fallback |
| AI | Google Gemini 2.5 Flash API |

---

## <img src="https://img.shields.io/badge/-Structure-000000?style=flat-square&logo=gnubash&logoColor=white" /> Project Structure

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
│       │   ├── firebase.js         # Firebase client config (loaded via process.env)
│       │   ├── geo.js              # Free open-source geolocation, search & routing (Nominatim/OSRM)
│       │   └── i18n.js             # Internationalization config
│       └── middleware.js           # Clerk route-protection middleware
│
├── backend/                        # Express.js REST + Socket.IO server
│   ├── controllers/
│   │   ├── admin.controller.js     # Admin: ban users, resolve complaints
│   │   ├── complaints.controller.js
│   │   ├── customer.controller.js  # Cart, shops, search, ratings
│   │   ├── customer2.controller.js # Addresses, wishlist, order history
│   │   ├── customer3.contoller.js  # Recommendations, similar items
│   │   ├── customer_ai.controller.js # Gemini image description for customers
│   │   ├── delivery.controller.js  # Carrier assignment + live tracking
│   │   ├── merchant.controller.js  # Shop & inventory CRUD
│   │   ├── merchant3.controller.js # Order status management
│   │   ├── merchant_ai.controller.js # Gemini AI product generation from image/title
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
│   │   ├── adminPublicRoute.js     # Admin search (email-gated, no Clerk auth)
│   │   └── otpRoute.js
│   ├── redis/
│   │   ├── redis.js                # Redis client connection and error handling
│   │   ├── redisIndex.js           # RediSearch schema setup for idx:products
│   │   └── redisSeed.js            # Seeding/syncing product data from Supabase to Redis
│   ├── utils/
│   │   ├── check.js                # Clerk JWT verification middleware
│   │   └── mailer.js               # Unified email sender (SMTP → Mailjet fallback)
│   ├── cloudinary.js               # Cloudinary SDK config
│   ├── db.js                       # Supabase client singleton
│   ├── index.js                    # Express app + Socket.IO server entry & Socket.IO Redis chat store
│   └── razorpayIntegration.js      # Razorpay order + webhook handler
├── README.md
└── .gitignore
```

---

## <img src="https://img.shields.io/badge/-Features-000000?style=flat-square&logo=github&logoColor=white" /> Core Feature Set

### <img src="https://img.shields.io/badge/-Auth-000000?style=flat-square&logo=clerk&logoColor=white" /> Authentication & Authorization
- **Multi-role Clerk authentication**: Customer, Merchant, Carrier, Admin
- **JWT-protected API routes** with `requireAuth` middleware
- **Role-based route protection** via Next.js middleware
- **Admin login** via separate PIN-gated flow (localStorage-persisted session)

### <img src="https://img.shields.io/badge/-Customer-000000?style=flat-square&logo=target&logoColor=white" /> Customer Experience
- **Geolocation-based shop discovery**: finds shops within configurable radius
- **Fuzzy full-text item search** and category browsing powered by **RediSearch** and sorted by popularity/sales
- **Shopping Cart**: optimistic UI, auto-save on `+`/`−`, animated item removal, instant navbar badge via `cart:changed` event
- **Wishlist** with instant badge updates via `wishlist:changed` event
- **Checkout** with Razorpay payment integration (UPI, cards, netbanking)
- **Live order tracking** with real-time carrier GPS via Socket.IO
- **In-order chat** between customer, merchant, and carrier (restored from Redis cache)
- **AI product descriptions**: Gemini-powered "describe this item" feature
- **Personalised recommendations** based on purchase history

### <img src="https://img.shields.io/badge/-Merchant-000000?style=flat-square&logo=shopware&logoColor=white" /> Merchant Dashboard
- **Shop creation and management** with Cloudinary image uploads
- **Inventory management**: add, edit, delete products (automatically synced to RedisJSON cache)
- **AI-assisted product listing** (see Innovations section below)
- **Barcode / UPC scan-to-list** (see Innovations section below)
- **Order management**: accept/reject/update order status
- **Pending orders badge** in navbar, auto-refreshed on navigation

### <img src="https://img.shields.io/badge/-Carrier-000000?style=flat-square&logo=openstreetmap&logoColor=white" /> Carrier (Delivery Agent) Portal
- **Assigned delivery queue** with order details
- **Live GPS location streaming** via Socket.IO to all parties
- **Delivery history** with earnings summary
- **Profile management**

### <img src="https://img.shields.io/badge/-Admin-000000?style=flat-square&logo=superuser&logoColor=white" /> Admin Panel
- **User ban/unban management**
- **Complaint resolution queue**
- **Transactional email dispatch** via SMTP/Mailjet

### <img src="https://img.shields.io/badge/-Real--Time-000000?style=flat-square&logo=socketdotio&logoColor=white" /> Real-Time Services (Socket.IO & Redis)
- Carrier GPS location broadcast to order-specific rooms
- **In-order live chat persistence**: Chat history is persisted in **Redis Lists** (`chat:{orderId}`), maintaining the last 200 messages with a 7-day expiration (TTL).
- Cart badge and wishlist badge instant updates via custom browser events

---

## <img src="https://img.shields.io/badge/-Innovations-000000?style=flat-square&logo=googlegemini&logoColor=white" /> System Innovations

### <img src="https://img.shields.io/badge/-AI%20Listing-000000?style=flat-square&logo=googlegemini&logoColor=white" /> 1. AI-Powered Product Listing (Gemini Vision)

**Problem**: Merchants, especially small shopkeepers, struggle to write accurate product names, descriptions, and prices — particularly for items they just unpacked.

**Solution**: On the `Add Item` and `Edit Item` pages, merchants can click **"Generate with AI"**. The system sends whichever data is available — product images, the product title, or both — to the backend, which forwards them to **Google Gemini 2.5 Flash** (multimodal) with a structured prompt. Gemini returns a strict JSON response containing:
- `name` – human-readable product name
- `description` – 2–4 sentence marketing description
- `categories` – array of matched inventory categories
- `price` – AI-estimated MRP in INR

**Input priority**: If product images are available, they are sent alongside the title for best accuracy. If no images are uploaded, the title alone is used as input — so the button always works. A two-pass retry mechanism with decreasing temperature ensures reliable JSON parsing. The frontend pre-fills all form fields instantly, allowing the merchant to review and submit without typing.

**Files**: [`merchant_ai.controller.js`](backend/controllers/merchant_ai.controller.js) · [`addItem/page.jsx`](frontend/src/app/merchant/addItem/page.jsx) · [`editItem/page.jsx`](frontend/src/app/merchant/editItem/page.jsx)

---

### <img src="https://img.shields.io/badge/-Barcode%20Scan-000000?style=flat-square&logo=barcode&logoColor=white" /> 2. Barcode / UPC Scan-to-List Product Pipeline

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

**Files**: [`addItem/page.jsx`](frontend/src/app/merchant/addItem/page.jsx)

---

### <img src="https://img.shields.io/badge/-Location%20Services-000000?style=flat-square&logo=openstreetmap&logoColor=white" /> 3. Geolocation-Based Shop & Product Discovery

Customers see only shops and products within their proximity. Location is resolved from:
1. Browser Geolocation API (GPS-precise)
2. OpenStreetMap / Nominatim Address Search & Autocomplete (with interactive Leaflet map pin-drop)
3. Pre-selected Indian city presets (Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad) — shown in a modal if no location is set

The backend filters shops using Haversine distance formula, and all product category sections on the home dashboard are populated exclusively from nearby shop inventories — no fake or out-of-range products are shown.

---

### <img src="https://img.shields.io/badge/-Live%20Tracking-000000?style=flat-square&logo=socketdotio&logoColor=white" /> 4. Real-Time Order Lifecycle with Live GPS Tracking

Entire order flow is real-time via Socket.IO:
- Customer, merchant, and carrier join a shared `order:{id}` room on Socket.IO
- Carrier streams GPS coordinates (`location:update`) — received live on the customer's tracking map
- System join events broadcast role-specific notifications
- In-order live chat works between all three parties with no message storage

---

### <img src="https://img.shields.io/badge/-i18n-000000?style=flat-square&logo=translate&logoColor=white" /> 5. Multi-language Support (i18n)

Gathr supports four languages out of the box: **English**, **Telugu (తెలుగు)**, **Tamil (தமிழ்)**, and **Hindi (हिन्दी)**. Language preference is persisted in `localStorage` and survives page reloads.

---

## <img src="https://img.shields.io/badge/-Getting%20Started-000000?style=flat-square&logo=rocket&logoColor=white" /> Quick Start & Installation

### <img src="https://img.shields.io/badge/-Prerequisites-000000?style=flat-square&logo=node.js&logoColor=white" /> Prerequisites
- Node.js v18 or higher
- npm (v9+) or yarn
- Accounts/Instances with: [Clerk](https://clerk.com), [Supabase](https://supabase.com), [Cloudinary](https://cloudinary.com), [Razorpay](https://razorpay.com), [Google AI Studio](https://aistudio.google.com) (for Gemini API; Google Maps API key is optional if needed)
- A running **Redis** instance (e.g., Redis Cloud or local Redis Stack)
- A Gmail account (or any SMTP provider) for transactional email. Optionally, a [Mailjet](https://mailjet.com) account as a fallback.

---

### <img src="https://img.shields.io/badge/-Environment%20Variables-000000?style=flat-square&logo=dotenv&logoColor=white" /> Environment Variables

#### <img src="https://img.shields.io/badge/-Frontend%20Env-000000?style=flat-square&logo=nextdotjs&logoColor=white" /> Frontend — `frontend/.env`

```env
# Backend server base URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000

# Frontend base URL (used for absolute redirects)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Clerk — publishable key (safe for browser)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_CLERK_PUBLISHABLE_KEY

# Clerk — secret key (also used by Next.js API routes)
CLERK_SECRET_KEY=sk_test_YOUR_CLERK_SECRET_KEY

# Clerk routing (required for custom auth pages)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/auth-callback

# Maps & Geolocation (Default: OpenStreetMap + Leaflet — 100% Free, No Key Required)
# NOTE: If you need to use Google Maps Platform services in the frontend environment, strictly use NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (instead of LocationIQ):
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

# (Optional fallback) LocationIQ API Key for higher Nominatim rate limits (leave blank to use default OpenStreetMap Nominatim for free):
NEXT_PUBLIC_LOCATIONIQ_API_KEY=

# Google Gemini API key (used by Next.js API routes / Shop Assistant)
GOOGLE_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY

# Firebase — web SDK configuration (phone auth & auxiliary services)
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=YOUR_FIREBASE_MEASUREMENT_ID
```

> [!IMPORTANT]
> **Maps & Geolocation Configuration**
> - **Default (Zero-Key)**: Open-source Leaflet with OpenStreetMap (Nominatim search & OSRM driving routes) is fully enabled out of the box with zero API keys required.
> - **Google Maps (Optional)**: If you need to integrate Google Maps Platform services in the frontend environment, strictly configure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (instead of LocationIQ).
> - **LocationIQ (Optional Fallback)**: If higher Nominatim geocoding rate limits are needed without Google Maps, populate `NEXT_PUBLIC_LOCATIONIQ_API_KEY`.

#### <img src="https://img.shields.io/badge/-Backend%20Env-000000?style=flat-square&logo=express&logoColor=white" /> Backend — `backend/.env`

```env
# CORS: allowed frontend origin
FRONTEND_URL=http://localhost:3000

# Clerk authentication
CLERK_SECRET_KEY=sk_test_YOUR_CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_CLERK_PUBLISHABLE_KEY

# Supabase — project URL and service role key (bypasses RLS for server-side ops)
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Supabase — direct PostgreSQL connection string (used for raw pg queries / migrations)
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

# Redis connection string (used for caching, search, and chat history persistence)
REDIS_URL=redis://default:YOUR_REDIS_PASSWORD@YOUR_REDIS_HOST:PORT

# Email — Primary: SMTP (Gmail recommended)
# Enable "App Passwords" in your Google account for Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password

# Email — Fallback: Mailjet API (optional, used if SMTP is not configured or fails)
MJ_APIKEY_PUBLIC=YOUR_MAILJET_PUBLIC_KEY
MJ_APIKEY_PRIVATE=YOUR_MAILJET_PRIVATE_KEY
MJ_SENDER_EMAIL=your-verified-sender@yourdomain.com

# Delivery fee configuration (adjustable)
GST_RATE=0
DELIVERY_BASE_KM=2
DELIVERY_BASE_FEE=30
DELIVERY_PER_KM_FEE=10
```

> [!NOTE]
> **Email Priority & Cloud Hosting (Render) Optimization**
> - **Localhost**: The backend attempts to send via SMTP first. If SMTP fails (configured with a 5-second timeout safeguard) or is not configured, it falls back to Mailjet.
> - **Render / Deployed Environment**: Since cloud platforms like Render block outbound SMTP ports (`25`, `465`, `587`) on free tiers, the backend automatically detects the Render environment (`RENDER=true`) and **skips SMTP entirely**, executing the Mailjet fallback instantly if `MJ_APIKEY_PUBLIC`, `MJ_APIKEY_PRIVATE`, and `MJ_SENDER_EMAIL` are configured. This prevents 60-second connection timeout delays.
> - **Dark Mode Safety**: Transactional email templates are explicitly styled with dark text colors (`#111111`) to prevent OTP visibility issues in dark-mode email clients.

> [!WARNING]
> **Security Requirement**: Never commit your `.env` files to version control. Both `frontend/.env` and `backend/.env` are listed in `.gitignore`.

---

### <img src="https://img.shields.io/badge/-Execution-000000?style=flat-square&logo=gnubash&logoColor=white" /> Installation & Execution

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

# 5. Start frontend with Turbopack (runs on http://localhost:3000)
cd ../frontend
npm run dev
```

---

## <img src="https://img.shields.io/badge/-API%20Routes-000000?style=flat-square&logo=express&logoColor=white" /> API Reference

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
| `POST` | `/api/merchant/get_item` | Get a single product |
| `POST` | `/api/merchant/get_shop` | Get shop details |
| `POST` | `/api/merchant/check_shop_exists` | Check if merchant has a shop |
| `POST` | `/api/merchant/check_duplicate_title` | Check for duplicate product title |
| `POST` | `/api/merchant/show_orders` | Get orders for merchant |
| `PUT` | `/api/merchant/update_shop` | Update shop info |
| `PUT` | `/api/merchant/update_items` | Update product |
| `PUT` | `/api/merchant/update_order_status` | Update order status |
| `DELETE` | `/api/merchant/delete_item` | Delete product |
| `DELETE` | `/api/merchant/delete_shop` | Delete shop |
| `GET` | `/api/merchant/get_pending_carts/:clerkId` | Get pending orders |
| `GET` | `/api/merchant/get_all_carts/:clerkId` | Get all order history |
| `GET` | `/api/merchant/banStatus/:clerkId` | Check merchant ban status |
| `POST` | `/api/merchant/ai/generateFromImage` | AI product generation from image and/or title |

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

### OTP (public — no Clerk auth required)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/otp/` | Send OTP (omit `otp` field) or verify OTP (include `otp` field) |

---

## <img src="https://img.shields.io/badge/-Design%20System-000000?style=flat-square&logo=tailwindcss&logoColor=white" /> Design System

- **Color scheme**: Fully CSS-variable-driven dark/light theming (`oklch` color space), toggleable at runtime without page reload
- **Typography**: Inter, Outfit, Quicksand (Google Fonts)
- **Animations**: Framer Motion for page transitions, micro-interactions, and animated list entry/exit; GSAP for landing page hero sequences; Three.js / OGL for 3D visual effects
- **Accessibility**: `aria-label`, `focus-visible` ring styles, keyboard-navigable steppers throughout

---

## <img src="https://img.shields.io/badge/-Status-000000?style=flat-square&logo=githubactions&logoColor=white" /> Feature Roadmap & Status

- [x] Multi-role authentication (Clerk)
- [x] Geolocation-based shop and product discovery (Leaflet + OpenStreetMap + OSRM)
- [x] Full shopping cart with optimistic auto-save UX
- [x] Wishlist with real-time badge
- [x] Razorpay checkout integration
- [x] Real-time order tracking + live GPS (Socket.IO)
- [x] In-order live chat
- [x] Merchant inventory management (CRUD)
- [x] AI product listing from image and/or title (Gemini Vision)
- [x] Barcode / UPC scan-to-list pipeline
- [x] Admin panel (ban/unban, complaints, bulk email)
- [x] Carrier delivery portal
- [x] Multilingual UI (EN / TE / TA / HI)
- [x] Dark / light mode (no reload, CSS variable-based)
- [x] Personalised product recommendations
- [x] Address book management
- [x] OTP-verified delivery confirmation via email

---

## <img src="https://img.shields.io/badge/-Contributing-000000?style=flat-square&logo=git&logoColor=white" /> Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with appropriate tests
4. Submit a pull request with a clear description

---

## <img src="https://img.shields.io/badge/-License-000000?style=flat-square&logo=opensourceinitiative&logoColor=white" /> License

This project is developed as part of a software engineering capstone and is intended for educational and demonstration purposes.

---

**Last Updated**: August 2026  
**Version**: 1.0.0  
**Maintainer(s)**: pranavnagaraji22@gmail.com
