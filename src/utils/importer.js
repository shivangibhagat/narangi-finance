/**
 * Pure helpers for the Excel/CSV import pipeline (ImportModal).
 * Kept free of React/XLSX so they are easy to unit test.
 */

/** Parse an amount cell: numbers pass through, strings are cleaned of ₹ , spaces and Rs./INR prefixes. */
export function parseImportAmount(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (raw == null) return 0;
  const cleaned = String(raw)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/^(rs\.?|inr|rupees?)/i, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const CATEGORY_MAP = {
  INCOME: "INCOME",
  FIXED: "FIXED EXPENSES",
  "FIXED EXPENSES": "FIXED EXPENSES",
  VARIABLE: "VARIABLE EXPENSES",
  "VARIABLE EXPENSES": "VARIABLE EXPENSES",
  SAVING: "SAVINGS",
  SAVINGS: "SAVINGS",
  CC: "CC PAYMENT",
  "CC PAYMENT": "CC PAYMENT",
};

/** Normalize a raw category cell to one of the app's canonical categories. Unknown → VARIABLE EXPENSES. */
export function normalizeCategory(rawCat) {
  const norm = String(rawCat ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  return CATEGORY_MAP[norm] || CATEGORY_MAP[norm.split(" ")[0]] || "VARIABLE EXPENSES";
}

/**
 * Excel sheets often store CC bill payments as VARIABLE EXPENSES / CREDIT CARD BILLS.
 * Convert those rows to real CC PAYMENT transactions so card balances stay correct.
 */
export function maybeConvertCCPayment(category, rawSubCatUpper) {
  const sub = String(rawSubCatUpper || "");
  if (
    category === "VARIABLE EXPENSES" &&
    (sub.includes("CREDIT CARD") || sub.includes("CC BILL"))
  ) {
    return "CC PAYMENT";
  }
  return category;
}

// Aliases for Excel sub-category spellings that differ from the app's canonical names.
// (Kept minimal on purpose — unknown values pass through upper-cased, never dropped.)
const SUBCAT_ALIASES = {};

export function normalizeSubCatName(rawSubCat) {
  const upper = String(rawSubCat ?? "").trim().toUpperCase();
  return SUBCAT_ALIASES[upper] || upper;
}

/** Stable key for duplicate detection — tolerant of case/whitespace differences in description. */
export function txnDedupeKey(t) {
  return `${t.date}|${Number(t.amount) || 0}|${String(t.spentOn || "").trim().toLowerCase()}`;
}

/**
 * Auto-detect which spreadsheet column maps to which transaction field,
 * based on header names. Returns { date, category, subCat, spentOn, amount, person, note }
 * with column indices (-1 = not found).
 */
export function autoDetectMapping(headers) {
  const m = { date: -1, category: -1, subCat: -1, spentOn: -1, amount: -1, person: -1, note: -1 };
  (headers || []).forEach((h, i) => {
    const hl = String(h || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!hl) return;
    if (/date/.test(hl) && m.date === -1) m.date = i;
    else if (/(category|cat)/.test(hl) && !/sub/.test(hl) && m.category === -1) m.category = i;
    else if (/(subcat|subcategory|sub)/.test(hl) && m.subCat === -1) m.subCat = i;
    else if (/(descr|spenton|spent|what|particular|detail|narrat|item)/.test(hl) && m.spentOn === -1) m.spentOn = i;
    else if (/(amount|amt|rs|inr|rupee|money|value)/.test(hl) && m.amount === -1) m.amount = i;
    else if (/(person|who|member|by|paid)/.test(hl) && m.person === -1) m.person = i;
    else if (/(note|remark|comment|desc)/.test(hl) && m.note === -1) m.note = i;
  });
  return m;
}
