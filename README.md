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
git clone https://github.com/prajindezaa/Jaikrishna-Industries-bizz-hub.git
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

## AI Operations Assistant (Propose-Then-Confirm)

The AI Assistant operates under a strict **Propose-Then-Confirm** model. It has **zero direct write tools** in its model schema and cannot alter records on its own.

### What the AI Assistant CAN Do:
1. **Tasks**: Propose scheduled follow-up calls, visits, packing, or dispatch tasks with automatic Asia/Kolkata date resolution (defaults to 10:00 AM – 10:30 AM IST).
2. **Customers**: Propose adding wholesale/retail leads, updating contact persons or stages (`New`, `Contacted`, `Interested`, `Sample sent`, `Negotiation`, `Ordered`, `Not interested`), setting next follow-up dates, and logging call outcomes.
3. **Planning**: Propose daily morning briefings and weekly target plans.
4. **Festivals & Meta Ads**: Propose festival calendar events and Meta ad planning drafts.

### What the AI Assistant CANNOT Do (Blocked by Scope):
* Delete or move records to Trash directly.
* Restore records or run bulk imports.
* Process orders, accept payments, modify stock or pricing.
* Send direct messages (WhatsApp, Email, SMS, Push) to customers.
* Modify automation rules, team members, or system settings.

### How Undo Works:
* Every executed action captures the before-state and creates an audit entry in `activity_logs` as `by AI assistant for {member}`.
* The member has a **30-minute undo window**.
* **Concurrency Protection**: If another member has modified the record since the AI action, undo is safely blocked to protect human edits.

### Privacy Notice:
* Spoken audio and customer notes are processed through the **private enterprise Gemini tier**.
* Voice recordings are processed in memory and **never saved to disk or stored in Firestore**.
* Customer data is never used to train public AI models.

### Microphone Permission & Audio Capture System:
* **Central Service (`src/services/microphoneService.ts`)**: Single authoritative module for `getUserMedia` streams, permission state tracking, AnalyserNode audio meter, and safe track cleanup on cancel, route change, blur, or background.
* **Permissions-Policy**: Configured on Vercel as `camera=(), microphone=(self), geolocation=(), payment=()`, guaranteeing that only the canonical domain `jaikrishnabizzhub.in` can access the audio stream.
* **Educational Explanation Modal**: Displays first-use sheet explaining why the mic is needed, zero permanent storage, Gemini processing, and 7-day snooze for "Not now".
* **Recovery Guidance**: Platform-detected step-by-step unblock instructions for Desktop Chrome/Edge, Android Chrome & OS app permissions, and iPhone Safari / Home Screen PWA. Includes a "Check again" live verification button.
* **Audio Track Release & Safety**: Guaranteed track closure on all exit paths, countdown timer (default 60s), and level meter visualization so the microphone is never open silently.
* **Settings & Diagnostics**: Available in `SettingsView` with live input device selector, 3-second local loopback test (100% in-memory, never uploaded), and complete hardware report with "Copy diagnostics" button.

---

## Deployment

* **Frontend & Serverless API**: Connect GitHub repository directly to **Vercel** with the Vite preset.
  * **Canonical Production URL**: [https://jaikrishnabizzhub.in](https://jaikrishnabizzhub.in)
  * **Secondary URL (301 Redirect)**: `https://www.jaikrishnabizzhub.in`
  * **Transition Redirect (90 Days)**: `https://jaikrishna-industries-bizz-hub.vercel.app` → `https://jaikrishnabizzhub.in`
* **Firestore Rules & Cloud Functions**: Deploy via Firebase CLI:
  ```bash
  firebase deploy --only firestore:rules,firestore:indexes,functions
  ```

