# Narangi Finance — 2026+ Financial Planner

Real-time sync across all devices via Firebase (one shared family document).

---

## Step 1 — Set Up Firebase (5 minutes, free)

### 1.1 Create project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click "Add project" → name it `narangi-finance` → click through

### 1.2 Create Firestore database
1. Click "Firestore Database" in the left menu
2. "Create database" → pick a location → Done

### 1.3 Secure Firestore (required)
1. Firestore → **Rules**
2. Copy `firestore.rules.example` into the rules editor
3. Replace the placeholder emails with your family's Google addresses
4. Publish rules (do **not** leave test mode open in production)

### 1.4 Enable Google sign-in
1. Authentication → Sign-in method → enable **Google**

### 1.5 Get config keys
1. Gear icon → **Project settings**
2. "Your apps" → Web (`</>`) → register app
3. Copy the `firebaseConfig` values

### 1.6 Local environment
```bash
cp .env.example .env
```
Fill each `VITE_FIREBASE_*` variable in `.env` from your Firebase web app config.

**Important:** use `KEY=value` with no space after `=` (wrong: `KEY= "value"` → `auth/invalid-api-key`). Restart the dev server after editing `.env`.

---

## Project structure

```
src/
  App.jsx                 # Shell: auth, tabs, header, modals
  firebase.js             # Firebase init (reads .env)
  constants/
    theme.js              # Colors, months, tabs
    defaults.js           # Default plan + seed transactions
  utils/
    format.js             # fmt, dates, ids
    finance.js            # CC balance, merge, summarize
  hooks/
    useIsMobile.js
    useOutsideClick.js
    useFirestoreSync.js   # Firestore read/write + debounced save
  components/
    ui/primitives.jsx     # Card, Btn, Modal, inputs…
    LoginScreen.jsx
    DashboardTab.jsx
    TransactionsTab.jsx
    PlanTab.jsx
    CreditCardsTab.jsx
    TxnForm.jsx
    OpeningBalanceCard.jsx
    ImportModal.jsx
```

---

## Step 2 — Run locally

```bash
npm install
npm run dev
```

---

## Step 3 — Deploy

```bash
npm run build
npx vercel --prod
```

Add the same `VITE_FIREBASE_*` variables in your host's environment settings (Vercel / Netlify).

Visit your URL on both phones — data syncs instantly.

---

## Add to Home Screen
- iPhone: Safari → Share → "Add to Home Screen"
- Android: Chrome → 3-dot menu → "Add to Home Screen"

---

## Re-deploy after code changes
```bash
npx vercel --prod
```
