# Narangi Finance — 2026+ Financial Planner

Real-time sync across all devices via Firebase.

---

## Step 1 — Set Up Firebase (5 minutes, free)

### 1.1 Create project
1. Go to console.firebase.google.com
2. Click "Add project" → name it "narangi-finance" → click through

### 1.2 Create Firestore database
1. Click "Firestore Database" in left menu
2. "Create database" → "Start in test mode" → pick any location → Done

### 1.3 Get config keys
1. Click gear icon → "Project settings"
2. Scroll to "Your apps" → click the </> Web icon
3. Register app → copy the firebaseConfig object

### 1.4 Paste into app
Open src/firebase.js and replace each PASTE_YOUR_..._HERE with your actual values.

---

## Step 2 — Deploy

  npm install
  npm run build
  npx vercel --prod

Visit your Vercel URL on both phones — data syncs instantly.

---

## Add to Home Screen
- iPhone: Safari → Share → "Add to Home Screen"
- Android: Chrome → 3-dot menu → "Add to Home Screen"

---

## Re-deploy after any code changes
  npx vercel --prod
