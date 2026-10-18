# Jaikrishna Industries — Business Hub

Modern Business Management PWA for pooja products manufacturing (Pure Bhimseni Camphor, Camphor Tablets, Premium Agarbatti, Deepam Lamp Oil, Pure Sambrani Cups, and Traditional Rose Water), wholesale CRM, Meta ads lead tracking, follow-ups, atomic order transactions, and read-only AI operations assistant.

---

## Tech Stack

* **Frontend**: React 19, TypeScript, TailwindCSS v4, Vite 8, VitePWA
* **Backend**: Express on Node.js (Local development) & Vercel Serverless Functions (`/api/*`)
* **Database & Auth**: Firebase Authentication (strict 3-member allowlist), Cloud Firestore, Cloud Functions v2 (Asia/Kolkata)
* **AI Assistant**: Google Gemini API (`@google/genai` v2) with offline rule-based fallback
* **Integrations**: Resend (email reminders & digests), Cloudinary (image assets & Meta ad creatives)

---

## Quickstart (Local Development)

### 1. Prerequisites
* **Node.js**: LTS 20.x or 22.x installed
* **Git**: Installed

### 2. Clone and Install
```bash
git clone <your-private-repo-url>
cd jaikrishna-industries
npm install
npm --prefix functions install
```

### 3. Environment Setup
Copy the template to `.env.local` and fill in your Firebase and service credentials:
```bash
cp .env.example .env.local
```
*(On Windows PowerShell, use `Copy-Item .env.example .env.local`)*

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

* `npm run dev`: Runs the full-stack server (Express API + Vite HMR) on port 3000.
* `npm run build`: Compiles production assets into `dist/`.
* `npm run preview`: Previews the production build locally.
* `npm run lint`: Runs TypeScript typecheck (`tsc --noEmit`).
* `npm run test`: Runs unit tests (`src/lib/meta-ads.test.ts`).
* `npm run clean`: Cross-platform cleanup of `dist/` and build caches.

---

## Deployment

* **Frontend & Serverless API**: Connect GitHub repository directly to **Vercel** with the Vite preset.
* **Firestore Rules & Cloud Functions**: Deploy via Firebase CLI:
  ```bash
  firebase deploy --only firestore:rules,firestore:indexes,functions
  ```
