# Narangi Finance — 2026 Monthly Financial Planner

A full-featured personal finance app built from your Excel plan.

## Features
- 📊 **Dashboard** — Monthly KPIs, income vs expenses chart, category breakdown, per-person spend
- ➕ **Transactions** — Add, view, and delete transactions by month
- 📋 **Financial Plan** — Edit your budget targets (income, fixed expenses, savings goals)
- 💳 **Credit Cards** — Track outstanding balances and repayment progress for NARR & SHIVU

---

## Run Locally

```bash
npm install
npm run dev
```
Open http://localhost:5173

---

## Deploy to Vercel (Recommended — free)

### Option A: Vercel CLI
```bash
npm install -g vercel
vercel
```
Follow the prompts. Done in ~60 seconds.

### Option B: Vercel Dashboard
1. Push this folder to a GitHub repo
2. Go to https://vercel.com/new
3. Import your repo → Vercel auto-detects Vite → click **Deploy**

---

## Deploy to Netlify

### Option A: Netlify CLI
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Option B: Netlify Dashboard
1. Go to https://app.netlify.com
2. Drag & drop the `dist/` folder (after running `npm run build`)
   **or** connect your GitHub repo for auto-deploys

---

## Build for Production
```bash
npm run build
# Output in /dist — upload anywhere (S3, GitHub Pages, etc.)
```

---

## Tech Stack
- React 18 + Vite
- Recharts (charts)
- Zero external UI libraries — all custom styled
