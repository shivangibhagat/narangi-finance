import { describe, it, expect } from "vitest";
import {
  summarize,
  sumOutflows,
  computeCCBalance,
  ccPaymentMatchesCard,
  resolveCcId,
  mergeData,
  incomePersonFor,
  fixedActualFor,
  savingsTotalsByLabel,
} from "../../utils/finance";

const makeTxn = (o) => ({
  id: "t1", date: "2026-05-01", category: "VARIABLE EXPENSES",
  subCat: "SHOPPING", person: "NARR", amount: 1000, tags: [], note: "", ...o,
});

// ─── resolveCcId() — empty-field guard ────────────────────────────────────────
describe("resolveCcId() corner cases", () => {
  it("ignores cards with empty name AND empty person (''.includes trap)", () => {
    // String.includes("") is always true — without the guard, a nameless card
    // would claim every payment.
    const cards = [{ id: "bad", name: "", person: "" }];
    expect(resolveCcId("HDFC", "payment", cards)).toBeNull();
  });

  it("still matches by person when name is empty", () => {
    const cards = [{ id: "cc1", name: "", person: "NARR" }];
    expect(resolveCcId("BILL", "NARR card bill", cards)).toBe("cc1");
  });

  it("matches case-insensitively", () => {
    const cards = [{ id: "cc1", name: "HDFC Regalia", person: "NARR" }];
    expect(resolveCcId("hdfc regalia", "x", cards)).toBe("cc1");
  });

  it("returns null when nothing matches / no cards", () => {
    const cards = [{ id: "cc1", name: "HDFC", person: "NARR" }];
    expect(resolveCcId("SHOPPING", "mall", cards)).toBeNull();
    expect(resolveCcId("HDFC", "x", [])).toBeNull();
    expect(resolveCcId("HDFC", "x", null)).toBeNull();
    expect(resolveCcId(null, null, cards)).toBeNull();
  });
});

describe("ccPaymentMatchesCard() corner cases", () => {
  const card = { id: "cc1", name: "NARR Credit Card", person: "NARR" };

  it("matches legacy payments via person fallback", () => {
    const t = makeTxn({ category: "CC PAYMENT", subCat: "NARR", spentOn: "bill", ccId: null });
    expect(ccPaymentMatchesCard(t, card)).toBe(true);
  });

  it("does not match when neither ccId nor names line up", () => {
    const t = makeTxn({ category: "CC PAYMENT", subCat: "SHOPPING", spentOn: "mall", ccId: null });
    expect(ccPaymentMatchesCard(t, card)).toBe(false);
  });
});

// ─── summarize()/sumOutflows() — type coercion ────────────────────────────────
describe("summarize() corner cases", () => {
  it("coerces string amounts (legacy Firestore data)", () => {
    const s = summarize([makeTxn({ category: "INCOME", amount: "68000" })]);
    expect(s.income).toBe(68000);
    expect(typeof s.income).toBe("number");
  });

  it("treats missing/NaN amounts as 0 instead of NaN", () => {
    const s = summarize([
      makeTxn({ category: "INCOME", amount: undefined }),
      makeTxn({ category: "VARIABLE EXPENSES", amount: NaN }),
    ]);
    expect(s.income).toBe(0);
    expect(s.variable).toBe(0);
  });

  it("ignores unknown categories", () => {
    const s = summarize([makeTxn({ category: "LOTTERY", amount: 999 })]);
    expect(s).toEqual({ income: 0, fixed: 0, variable: 0, savings: 0, ccPaid: 0 });
  });

  it("sumOutflows coerces strings too", () => {
    const txns = [
      makeTxn({ category: "FIXED EXPENSES", amount: "1000" }),
      makeTxn({ category: "INCOME", amount: "5000" }),
    ];
    expect(sumOutflows(txns)).toBe(1000);
  });
});

// ─── computeCCBalance() — cross-year + bad input ──────────────────────────────
describe("computeCCBalance() corner cases", () => {
  const card = { id: "cc1", name: "NARR CC", person: "NARR", initialOutstanding: 50000, limit: 150000 };

  it("carries December charges into next January's opening", () => {
    const charges = { "cc1_2026-12": 7000 };
    const bal = computeCCBalance(card, 2027, "Jan", [], charges);
    expect(bal).toBe(57000);
  });

  it("counts December payments for next January's opening", () => {
    const pmt = makeTxn({ category: "CC PAYMENT", ccId: "cc1", date: "2026-12-20", amount: 20000 });
    expect(computeCCBalance(card, 2027, "Jan", [pmt], {})).toBe(30000);
  });

  it("ignores transactions with missing dates instead of crashing", () => {
    const bad = makeTxn({ category: "CC PAYMENT", ccId: "cc1", date: undefined, amount: 20000 });
    expect(() => computeCCBalance(card, 2026, "Jun", [bad], {})).not.toThrow();
    expect(computeCCBalance(card, 2026, "Jun", [bad], {})).toBe(50000);
  });

  it("coerces string charges / payments", () => {
    const pmt = makeTxn({ category: "CC PAYMENT", ccId: "cc1", date: "2026-05-10", amount: "5000" });
    expect(computeCCBalance(card, 2026, "Jun", [pmt], { "cc1_2026-05": "10000" })).toBe(55000);
  });

  it("handles unknown month gracefully (no history counted)", () => {
    expect(computeCCBalance(card, 2026, "Foo", [], { "cc1_2026-05": 999 })).toBe(50000);
  });

  it("reads legacy `balance` field when initialOutstanding is absent", () => {
    const legacy = { id: "cc1", name: "X", person: "NARR", balance: 42000 };
    expect(computeCCBalance(legacy, 2026, "May", [], {})).toBe(42000);
  });

  it("handles a card with no balance fields at all", () => {
    expect(computeCCBalance({ id: "cc9" }, 2026, "May", [], {})).toBe(0);
  });
});

// ─── mergeData() — migration + coercion ───────────────────────────────────────
describe("mergeData() corner cases", () => {
  it("migrates legacy card.balance → initialOutstanding", () => {
    const d = mergeData({ creditCards: [{ id: "cc1", name: "X", person: "NARR", balance: 90000 }] });
    expect(d.creditCards[0].initialOutstanding).toBe(90000);
  });

  it("prefers initialOutstanding over legacy balance", () => {
    const d = mergeData({
      creditCards: [{ id: "cc1", name: "X", person: "NARR", initialOutstanding: 75000, balance: 90000 }],
    });
    expect(d.creditCards[0].initialOutstanding).toBe(75000);
  });

  it("defaults missing card figures to 0", () => {
    const d = mergeData({ creditCards: [{ id: "cc1", name: "X", person: "NARR" }] });
    expect(d.creditCards[0].initialOutstanding).toBe(0);
    expect(d.creditCards[0].limit).toBe(0);
  });

  it("coerces string plan amounts to numbers", () => {
    const d = mergeData({
      variableBudget: "20000",
      income: [{ id: "i1", label: "X", amount: "55000" }],
      fixedExpenses: [{ id: "f1", label: "Y", budget: "19500" }],
      savings: [{ id: "s1", label: "Z", monthlyTarget: "13700", goalTarget: "300000" }],
      creditCards: [{ id: "cc1", name: "C", person: "NARR", limit: "150000" }],
      transactions: [makeTxn({ amount: "1200" })],
    });
    expect(d.variableBudget).toBe(20000);
    expect(d.income[0].amount).toBe(55000);
    expect(d.fixedExpenses[0].budget).toBe(19500);
    expect(d.savings[0].monthlyTarget).toBe(13700);
    expect(d.savings[0].goalTarget).toBe(300000);
    expect(d.creditCards[0].limit).toBe(150000);
    expect(d.transactions[0].amount).toBe(1200);
  });

  it("keeps empty arrays empty (user deleted everything — don't resurrect DEFAULTS)", () => {
    const d = mergeData({ income: [], fixedExpenses: [], savings: [], creditCards: [] });
    expect(d.income).toEqual([]);
    expect(d.fixedExpenses).toEqual([]);
    expect(d.savings).toEqual([]);
    expect(d.creditCards).toEqual([]);
  });

  it("falls back to DEFAULTS on null/undefined collections", () => {
    const d = mergeData({ income: null, fixedExpenses: undefined, transactions: null });
    expect(d.income.length).toBeGreaterThan(0);
    expect(d.fixedExpenses.length).toBeGreaterThan(0);
    expect(d.transactions).toEqual([]);
  });

  it("non-array transactions become []", () => {
    expect(mergeData({ transactions: "oops" }).transactions).toEqual([]);
    expect(mergeData({ transactions: 42 }).transactions).toEqual([]);
  });

  it("does not blow up on a totally empty doc", () => {
    const d = mergeData({});
    expect(d.variableBudget).toBeGreaterThan(0);
    expect(d.ccMonthlyCharges).toEqual({});
    expect(d.members.length).toBeGreaterThan(0);
  });
});

// ─── Plan-tab matching helpers ────────────────────────────────────────────────
describe("incomePersonFor()", () => {
  const members = ["NARR", "SHIVU"];

  it("matches member inside label", () => {
    expect(incomePersonFor({ label: "NARR Salary", subCat: "X" }, members)).toBe("NARR");
  });

  it("matches member inside subCat", () => {
    expect(incomePersonFor({ label: "Salary", subCat: "SALARY_SHIVU" }, members)).toBe("SHIVU");
  });

  it("is case-insensitive", () => {
    expect(incomePersonFor({ label: "shivu payout", subCat: "" }, members)).toBe("SHIVU");
  });

  it("returns null when no member matches", () => {
    expect(incomePersonFor({ label: "Freelance", subCat: "GIG" }, members)).toBeNull();
    expect(incomePersonFor({ label: "", subCat: "" }, members)).toBeNull();
    expect(incomePersonFor({ label: "NARR x" }, [])).toBeNull();
    expect(incomePersonFor({ label: "NARR x" }, null)).toBeNull();
  });
});

describe("fixedActualFor()", () => {
  const txns = [
    makeTxn({ category: "FIXED EXPENSES", subCat: "HOUSE RENT", amount: 19000 }),
    makeTxn({ category: "FIXED EXPENSES", subCat: "House Rent", amount: 500 }),
    makeTxn({ category: "VARIABLE EXPENSES", subCat: "HOUSE RENT", amount: 999 }),
  ];

  it("matches by subCat (case-insensitive), ignoring other categories", () => {
    expect(fixedActualFor({ label: "Rent", subCat: "HOUSE RENT" }, txns)).toBe(19500);
  });

  it("falls back to matching by label", () => {
    expect(fixedActualFor({ label: "HOUSE RENT", subCat: "WRONG" }, txns)).toBe(19500);
  });

  it("returns 0 when nothing matches", () => {
    expect(fixedActualFor({ label: "Nope", subCat: "NOPE" }, txns)).toBe(0);
    expect(fixedActualFor({ label: "Rent", subCat: "HOUSE RENT" }, [])).toBe(0);
    expect(fixedActualFor({ label: "Rent", subCat: "HOUSE RENT" }, null)).toBe(0);
  });
});

describe("savingsTotalsByLabel()", () => {
  it("keys totals by upper-cased subCat (imported rows match goals)", () => {
    const txns = [
      makeTxn({ category: "SAVINGS", subCat: "Travel Fund", amount: 10000 }),
      makeTxn({ category: "SAVINGS", subCat: "TRAVEL FUND", amount: 3700 }),
      makeTxn({ category: "SAVINGS", subCat: "travel fund", amount: 300 }),
    ];
    expect(savingsTotalsByLabel(txns)["TRAVEL FUND"]).toBe(14000);
  });

  it("ignores non-savings categories and missing subCats", () => {
    const txns = [
      makeTxn({ category: "INCOME", subCat: "Travel Fund", amount: 99999 }),
      makeTxn({ category: "SAVINGS", subCat: "", amount: 100 }),
      makeTxn({ category: "SAVINGS", subCat: "", amount: 50 }),
    ];
    const mp = savingsTotalsByLabel(txns);
    expect(mp["TRAVEL FUND"]).toBeUndefined();
    expect(mp[""]).toBe(150);
  });

  it("handles empty input", () => {
    expect(savingsTotalsByLabel([])).toEqual({});
    expect(savingsTotalsByLabel(null)).toEqual({});
  });
});
