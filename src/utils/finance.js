import { DEFAULTS } from "../constants/defaults";
import { MONTHS, START_MONTH_IDX, START_YEAR } from "../constants/theme";
import { ccKey, mNum } from "./format";

export const OUTFLOW_CATS = ["FIXED EXPENSES", "VARIABLE EXPENSES", "CC PAYMENT", "SAVINGS"];
const num = (v) => Number(v) || 0;

export const sumOutflows = (txns) =>
  txns.filter((t) => OUTFLOW_CATS.includes(t.category)).reduce((a, t) => a + num(t.amount), 0);

export const resolveCcId = (subCat, spentOn, creditCards) => {
  const hay = `${subCat || ""} ${spentOn || ""}`.toUpperCase();
  const card = (creditCards || []).find((c) => {
    const name = (c.name || "").toUpperCase();
    const person = (c.person || "").toUpperCase();
    // Guard: empty strings match everything (hay.includes("") === true),
    // so a card with a blank name would swallow every payment.
    return (name && hay.includes(name)) || (person && hay.includes(person));
  });
  return card?.id || null;
};

export const ccPaymentMatchesCard = (t, cc) => {
  if (t.category !== "CC PAYMENT") return false;
  if (t.ccId === cc.id) return true;
  if (!t.ccId) return resolveCcId(t.subCat, t.spentOn, [cc]) === cc.id;
  return false;
};

export function computeCCBalance(cc, upToYear, upToMonth, transactions, ccMonthlyCharges) {
  let bal = num(cc.initialOutstanding ?? cc.balance ?? cc.outstanding);
  for (let y = START_YEAR; y <= upToYear; y++) {
    const minMi = y === START_YEAR ? START_MONTH_IDX : 0;
    const maxMi = y === upToYear ? MONTHS.indexOf(upToMonth) - 1 : 11;
    for (let mi = minMi; mi <= maxMi; mi++) {
      const m = MONTHS[mi];
      bal += num((ccMonthlyCharges || {})[ccKey(cc.id, y, m)]);
      bal -= transactions
        .filter(
          (t) =>
            ccPaymentMatchesCard(t, cc) &&
            t.date?.startsWith(`${y}-${mNum(m)}`)
        )
        .reduce((a, t) => a + num(t.amount), 0);
    }
  }
  return Math.max(0, bal);
}

export function mergeData(data) {
  const creditCards = (data.creditCards || DEFAULTS.creditCards).map((cc) => ({
    ...cc,
    // Migrate legacy field names so old Firestore docs don't lose their debt figures:
    // older app versions persisted `balance` (and very old ones `outstanding`).
    initialOutstanding: num(cc.initialOutstanding ?? cc.balance ?? cc.outstanding),
    limit: num(cc.limit),
  }));
  const transactions = (Array.isArray(data.transactions) ? data.transactions : []).map((t) => {
    // Coerce amount to a number — legacy Firestore docs may store strings,
    // which would corrupt every sum via string concatenation ("1000" + 500).
    const txn = { ...t, amount: Number(t.amount) || 0 };
    if (txn.category === "CC PAYMENT" && !txn.ccId) {
      const ccId = resolveCcId(txn.subCat, txn.spentOn, creditCards);
      if (ccId) txn.ccId = ccId;
    }
    return txn;
  });
  return {
    ...DEFAULTS,
    ...data,
    creditCards,
    transactions,
    members: data.members || DEFAULTS.members,
    ccMonthlyCharges: data.ccMonthlyCharges || {},
    customTags: data.customTags || DEFAULTS.customTags,
    variableSubCats: data.variableSubCats || DEFAULTS.variableSubCats,
    // Coerce plan amounts to numbers — same string-concat hazard as transactions.
    variableBudget: num(data.variableBudget ?? DEFAULTS.variableBudget),
    savings: (data.savings || DEFAULTS.savings).map((sv) => ({
      ...sv,
      monthlyTarget: num(sv.monthlyTarget),
      goalTarget: num(sv.goalTarget),
    })),
    income: (data.income || DEFAULTS.income).map((i) => ({ ...i, amount: num(i.amount) })),
    fixedExpenses: (data.fixedExpenses || DEFAULTS.fixedExpenses).map((f) => ({
      ...f,
      budget: num(f.budget),
    })),
  };
}

export const cleanForDb = (obj) =>
  JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));

export const summarize = (txns) => ({
  income: txns.filter((t) => t.category === "INCOME").reduce((a, t) => a + num(t.amount), 0),
  fixed: txns.filter((t) => t.category === "FIXED EXPENSES").reduce((a, t) => a + num(t.amount), 0),
  variable: txns
    .filter((t) => t.category === "VARIABLE EXPENSES")
    .reduce((a, t) => a + num(t.amount), 0),
  savings: txns.filter((t) => t.category === "SAVINGS").reduce((a, t) => a + num(t.amount), 0),
  ccPaid: txns.filter((t) => t.category === "CC PAYMENT").reduce((a, t) => a + num(t.amount), 0),
});

// ─── Plan-tab matching helpers (pure, tested) ────────────────────────────────
// Which member does a plan item (income source) belong to? Matches member name
// inside the item's label or subCat, case-insensitive. Returns null if unknown.
export const incomePersonFor = (item, members) =>
  (members || []).find(
    (m) =>
      (item.label || "").toUpperCase().includes(m.toUpperCase()) ||
      (item.subCat || "").toUpperCase().includes(m.toUpperCase())
  ) || null;

// Actual spend for a fixed-expense plan item: matches by subCat OR label
// (both patterns exist in real data), case-insensitive.
export function fixedActualFor(fe, monthTxns) {
  const canon = (fe.subCat || "").trim().toUpperCase();
  const lbl = (fe.label || "").trim().toUpperCase();
  return (monthTxns || [])
    .filter((t) => t.category === "FIXED EXPENSES")
    .filter((t) => {
      const sc = (t.subCat || "").trim().toUpperCase();
      return (canon && sc === canon) || (lbl && sc === lbl);
    })
    .reduce((a, t) => a + num(t.amount), 0);
}

// Totals of SAVINGS transactions keyed by UPPER-CASED subCat, so goal labels
// match regardless of case ("Travel Fund" vs imported "TRAVEL FUND").
export function savingsTotalsByLabel(txns) {
  const mp = {};
  (txns || [])
    .filter((t) => t.category === "SAVINGS")
    .forEach((t) => {
      const k = (t.subCat || "").toUpperCase();
      mp[k] = (mp[k] || 0) + num(t.amount);
    });
  return mp;
}
