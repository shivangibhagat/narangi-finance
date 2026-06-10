import { DEFAULTS } from "../constants/defaults";
import { MONTHS, START_MONTH_IDX, START_YEAR } from "../constants/theme";
import { ccKey, mNum } from "./format";

export const OUTFLOW_CATS = ["FIXED EXPENSES", "VARIABLE EXPENSES", "CC PAYMENT", "SAVINGS"];
export const sumOutflows = (txns) =>
  txns.filter((t) => OUTFLOW_CATS.includes(t.category)).reduce((a, t) => a + t.amount, 0);

export const resolveCcId = (subCat, spentOn, creditCards) => {
  const hay = `${subCat || ""} ${spentOn || ""}`.toUpperCase();
  const card = (creditCards || []).find(
    (c) =>
      hay.includes((c.name || "").toUpperCase()) ||
      hay.includes((c.person || "").toUpperCase())
  );
  return card?.id || null;
};

export const ccPaymentMatchesCard = (t, cc) => {
  if (t.category !== "CC PAYMENT") return false;
  if (t.ccId === cc.id) return true;
  if (!t.ccId) return resolveCcId(t.subCat, t.spentOn, [cc]) === cc.id;
  return false;
};

export function computeCCBalance(cc, upToYear, upToMonth, transactions, ccMonthlyCharges) {
  let bal = cc.initialOutstanding || cc.outstanding || 0;
  for (let y = START_YEAR; y <= upToYear; y++) {
    const minMi = y === START_YEAR ? START_MONTH_IDX : 0;
    const maxMi = y === upToYear ? MONTHS.indexOf(upToMonth) - 1 : 11;
    for (let mi = minMi; mi <= maxMi; mi++) {
      const m = MONTHS[mi];
      bal += (ccMonthlyCharges || {})[ccKey(cc.id, y, m)] || 0;
      bal -= transactions
        .filter(
          (t) =>
            ccPaymentMatchesCard(t, cc) &&
            t.date.startsWith(`${y}-${mNum(m)}`)
        )
        .reduce((a, t) => a + t.amount, 0);
    }
  }
  return Math.max(0, bal);
}

export function mergeData(data) {
  // Migrate old initialOutstanding / outstanding → balance (simplified CC model)
  const creditCards = (data.creditCards || DEFAULTS.creditCards).map((cc) => ({
    ...cc,
    balance: cc.balance ?? cc.initialOutstanding ?? cc.outstanding ?? 0,
  }));
  const transactions = (Array.isArray(data.transactions) ? data.transactions : []).map((t) => {
    if (t.category === "CC PAYMENT" && !t.ccId) {
      const ccId = resolveCcId(t.subCat, t.spentOn, creditCards);
      return ccId ? { ...t, ccId } : t;
    }
    return t;
  });
  return {
    ...DEFAULTS,
    ...data,
    creditCards,
    transactions,
    members:         data.members         || DEFAULTS.members,
    customTags:      data.customTags       || DEFAULTS.customTags,
    variableSubCats: data.variableSubCats  || DEFAULTS.variableSubCats,
    savings:         data.savings          || DEFAULTS.savings,
    income:          data.income           || DEFAULTS.income,
    fixedExpenses:   data.fixedExpenses    || DEFAULTS.fixedExpenses,
    startingBalance:  data.startingBalance  ?? 0,
    // Strip legacy fields so they don't persist back to Firestore
    ccMonthlyCharges: undefined,
    openingBalances:  undefined,
  };
}

export const cleanForDb = (obj) =>
  JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));

export const summarize = (txns) => ({
  income: txns.filter((t) => t.category === "INCOME").reduce((a, t) => a + t.amount, 0),
  fixed: txns.filter((t) => t.category === "FIXED EXPENSES").reduce((a, t) => a + t.amount, 0),
  variable: txns
    .filter((t) => t.category === "VARIABLE EXPENSES")
    .reduce((a, t) => a + t.amount, 0),
  savings: txns.filter((t) => t.category === "SAVINGS").reduce((a, t) => a + t.amount, 0),
  ccPaid: txns.filter((t) => t.category === "CC PAYMENT").reduce((a, t) => a + t.amount, 0),
});
