# Jaikrishna Industries — Business Hub

[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-v13-FFCA28?style=flat&logo=firebase&logoColor=black)](https://firebase.google.com/)

**Jaikrishna Industries Business Hub** is the dedicated enterprise operations platform and Progressive Web Application (PWA) powering manufacturing operations, wholesale CRM, omnichannel leads, atomic order fulfillment, logistics tracking, and AI-assisted workflow planning for **Jaikrishna Industries** (flagship brands: **Kalasam** and **Temple Dharisana**).

* **Official Corporate Website**: [https://kalasamjaikrishna.co.in](https://kalasamjaikrishna.co.in)
* **Production Operations Hub**: [https://jaikrishnabizzhub.in](https://jaikrishnabizzhub.in)

---

## 🏢 About Jaikrishna Industries

Established in 1995 with over 30 years of manufacturing excellence, Jaikrishna Industries is a certified chemical processor, pooja products manufacturer, and global exporter operating from Theni, Tamil Nadu, India.

* **Headquarters & Manufacturing Plant**: Telephone Nagar, Theni, Tamil Nadu – 625531, India
* **Key Brands**: **Kalasam** & **Temple Dharisana**
* **Certifications**: ISO 9001:2015, GMP Certified, FSSAI Certified, MSME / UDYAM Registered, IEC (Import Export Code)
* **Annual Capacity**: 10,000+ Metric Tons with up to 99.9% purity standards
* **Global Footprint**: Supplying wholesale buyers, supermarkets, retail distributors, temple trusts, and OEM clients across India and 17+ countries worldwide
* **Official Support Channels**:
  * Phone / WhatsApp: [+91 6383020848](https://wa.me/916383020848)
  * Email: `support@kalasamjaikrishna.co.in` | `export@kalasamjaikrishna.co.in`

### Product Manufacturing Portfolio
1. **Camphor Products**: Pure Bhimseni / Pachi Karpooram flakes, refined pooja camphor tablets (₹1, ₹2, ₹5, ₹10 covers; 15g, 20g, 25g, 40g, 50g jars; and 500g/1kg bulk packs).
2. **Industrial Chemicals**: High-purity Synthetic Camphor (CAS 76-22-2), D-Camphor (CAS 464-49-3), Isoborneol Flakes (CAS 124-76-5), and pure Camphor Essential Oil (CAS 8008-51-3).
3. **Pooja Products & Sacred Fragrances**:
   * **Deepam Lamp Oil**: Pure aromatic pooja oil in 50ml, 100ml, 200ml, 500ml, and 1L formats.
   * **Incense Sticks (Agarbathi)**: Premium hand-rolled and machine-scented sticks (Flora, Black, Pineapple).
   * **Sambrani Cups**: Traditional cup sambrani and compressed computer sambrani fragrance cups (12-pack boxes).
   * **Rose Water (Panneer)**: Steam-distilled pure rose water (100ml, 200ml, 500ml, and 1000ml bottles).

---

## 🚀 Key Modules & Hub Capabilities

### 1. Wholesale CRM & Customer Management (`/customers`)
* **Customer Groups & Segmentation**: Categorize accounts into Wholesale Distributors, Retailers & Pooja Shops, Temple/Institutions, Super Stockists, and Custom Groups with group-specific pricing and counters.
* **Pan-India & Global Geographic Coverage**: Full support for all 28 Indian States and 8 Union Territories, mapped to their specific districts (with Tamil Nadu and India defaults), plus international country support.
* **Pipeline Stages**: Visual tracking across 7 lead stages: `New` → `Contacted` → `Interested` → `Sample sent` → `Negotiation` → `Ordered` → `Not interested`.
* **Lead Ingestion & Excel Import/Export**: Bulk upload customer spreadsheets with automated column header detection, duplicate phone resolution modal (skip, update, move, or duplicate), and formatted Excel exports using SheetJS.
* **Follow-up Reminders**: Per-customer next follow-up dates integrated into dashboard focus lists.

### 2. Orders & Invoicing (`/orders`)
* **Atomic Order Processing**: Multi-item order creation with automatic tax calculations, wholesale discounts, and stock validation.
* **Invoice Parsing & Digitization**: OCR/PDF parser for incoming invoices extracting buyer names, addresses, item lists, and total bill values.
* **Logistics & Dispatch Tracking**: Real-time delivery status (`Pending` → `Packed` → `Dispatched` → `Delivered`), LR (Lorry Receipt) consignment number tracking, and transporter details.

### 3. Meta Ads Performance & Lead Tracking (`/meta-ads`)
* **Campaign Planner**: Target demographic and geographic planning with state-level district selection.
* **Ad Stages & Metrics**: Track ads across stages (`Draft` → `Published` → `Fulfilled`) with automated calculation of CTR, Frequency, Cost per Conversation (CPC), Cost per Customer, and ROI.
* **Festival Suggestions**: Built-in festival calendar engine calculating preparation lead times (14 days ahead) for peak pooja demand periods (Diwali, Karthigai Deepam, Pongal).

### 4. Daily Operations & Task Management (`/tasks`)
* **Role-Based Task Board**: Task types for `Call`, `WhatsApp`, `Visit`, `Meta ads`, `Packing`, and `Other` with priority flags (`Low`, `Medium`, `High`, `Urgent`).
* **WhatsApp Outreach Hub**: One-click WhatsApp message drafting with pre-approved templates and phone normalization (+91 E.164).

### 5. Automated Background Jobs & Notifications (`/settings`)
* **Scheduled Automations**: Daily cron runner (GitHub Actions at 08:00 AM IST) for overdue task alerts, reorder nudges, and customer follow-up digests.
* **Multi-Channel Delivery**: In-app toast alerts, PWA Web Push notifications (FCM), and verified email delivery via Resend (`reminders@jaikrishnabizzhub.in`).

### 6. AI Operations Assistant (`/assistant`)
* **Architecture**: Powered by Google Gemini API (`@google/genai`) with fallback rules.
* **Context-Aware Analytics**: Inquires live workspace data for customer counts, pending orders, dispatch logistics, and festival preparation advice.

---

## 🛠️ Tech Stack & Architecture

| Tier | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, TailwindCSS v4, Vite 8, Lucide React, Motion (Framer Motion), Recharts, Three.js, VitePWA |
| **Backend & APIs** | Express on Node.js (`server.ts` local dev runner) & Vercel Serverless Functions (`/api/*`) |
| **Database & Security** | Google Firebase Authentication (strict allowlist), Cloud Firestore, Security Rules, Firebase Admin SDK |
| **Cloud Functions** | Firebase Cloud Functions v2 (Node 22, Asia/Kolkata timezone) |
| **AI Integration** | Google Gemini 2.5/1.5 Flash via `@google/genai` |
| **Email & Assets** | Resend API (transactional notifications), Cloudinary (product & Meta ad creative storage) |
| **Data Parsing** | SheetJS (`xlsx`) for Excel import/export, PDF.js & jsPDF for invoice and document handling |

---

## 💻 Quickstart (Local Development)

### 1. Prerequisites
* **Node.js**: LTS `20.x` or `22.x` (or newer)
* **Git**: Installed and configured
* **Package Manager**: `npm` (bundled with Node.js)

### 2. Clone and Install
```bash
# Clone the repository
git clone https://github.com/prajindezaa/Jaikrishna-Industries-bizz-hub.git
cd Jaikrishna-Industries-bizz-hub-main/Jaikrishna-Industries-bizz-hub-main

# Install root dependencies
npm install

# Install Cloud Functions dependencies
npm --prefix functions install
```

### 3. Environment Variables Setup
Copy the template file to `.env.local`:
```bash
# On Windows PowerShell
Copy-Item .env.example .env.local

# On macOS / Linux
cp .env.example .env.local
```

Fill in your configuration in `.env.local`:
* **Firebase Web Config**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, etc.
* **Google Gemini API**: `GEMINI_API_KEY` (from Google AI Studio)
* **Firebase Admin**: `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
* **Email Service**: `RESEND_API_KEY`

### 4. Run the Local Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser. The Express API server and Vite HMR middleware will run concurrently.

---

## 📋 Available Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `tsx server.ts` | Starts full-stack development server on port 3000 |
| `npm run build` | `vite build` | Compiles optimized production bundle into `dist/` |
| `npm run preview` | `vite preview` | Previews the compiled production build locally |
| `npm run lint` | `tsc --noEmit` | Runs TypeScript static type checking |
| `npm run test` | `tsx src/lib/meta-ads.test.ts` | Runs unit tests (ad math, metrics, transitions, formatters) |
| `npm run clean` | `node scripts/clean.js` | Cross-platform cleanup of `dist/` and build caches |
| `npm --prefix functions run build` | `tsc` (in functions) | Compiles Firebase Cloud Functions TypeScript |

---

## 🌐 Production Deployment

### Vercel (Frontend & Serverless API)
The project is configured for continuous zero-downtime deployment on **Vercel**:
* **Canonical URL**: [https://jaikrishnabizzhub.in](https://jaikrishnabizzhub.in)
* Pushing any commit to the `main` branch triggers an automated build and deploy:
  ```bash
  git push origin main
  ```

### Firebase (Firestore Rules & Cloud Functions)
Deploy security rules, indexes, and background functions via Firebase CLI:
```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes,functions
```

---

## 📜 License & Ownership
Copyright © 1995–2026 **Jaikrishna Industries**. All rights reserved.  
Internal enterprise management software designed for authorized company team members.
