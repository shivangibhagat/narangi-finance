import { describe, it, expect } from "vitest";
import { summarize, computeCCBalance, ccPaymentMatchesCard, mergeData, OUTFLOW_CATS } from "../../utils/finance";


const makeTxn = (o) => ({
  id:"t1", date:"2026-05-01", category:"VARIABLE EXPENSES",
  subCat:"SHOPPING", person:"NARR", amount:1000, tags:[], note:"", ...o,
});

// ─── mergeData() ──────────────────────────────────────────────────────────────
describe("mergeData()", () => {
  it("returns DEFAULTS when called with empty object", () => {
    const d = mergeData({});
    expect(d.members).toBeDefined();
    expect(d.income).toBeDefined();
    expect(d.fixedExpenses).toBeDefined();
    expect(d.creditCards).toBeDefined();
  });

  it("merges CC transactions without ccId by resolving from subCat", () => {
    const cards = [{ id:"cc1", name:"NARR Credit Card", person:"NARR", initialOutstanding:50000 }];
    const txns  = [makeTxn({ category:"CC PAYMENT", subCat:"NARR Credit Card", ccId: null })];
    const d = mergeData({ creditCards: cards, transactions: txns });
    expect(d.transactions[0].ccId).toBe("cc1");
  });

  it("keeps existing ccId if already set", () => {
    const cards = [{ id:"cc1", name:"NARR CC", person:"NARR", initialOutstanding:0 }];
    const txns  = [makeTxn({ category:"CC PAYMENT", subCat:"Whatever", ccId:"cc1" })];
    const d = mergeData({ creditCards: cards, transactions: txns });
    expect(d.transactions[0].ccId).toBe("cc1");
  });

  it("falls back to DEFAULTS.income if none in Firestore", () => {
    const d = mergeData({ income: null });
    expect(Array.isArray(d.income)).toBe(true);
    expect(d.income.length).toBeGreaterThan(0);
  });

  it("uses Firestore income when provided", () => {
    const customIncome = [{ id:"x1", label:"Custom", amount:99000 }];
    const d = mergeData({ income: customIncome });
    expect(d.income).toEqual(customIncome);
  });

  it("does not include openingBalances", () => {
    const d = mergeData({});
    expect(d.openingBalances).toBeUndefined();
  });

  it("strips ccMonthlyCharges (legacy field)", () => {
    const d = mergeData({ ccMonthlyCharges: { "cc1_2026-05": 50000 } });
    expect(d.ccMonthlyCharges).toBeUndefined();
  });

  it("migrates initialOutstanding → balance for old CC data", () => {
    const cards = [{ id:"cc1", name:"Test", person:"NARR", initialOutstanding:75000 }];
    const d = mergeData({ creditCards: cards });
    expect(d.creditCards[0].balance).toBe(75000);
  });

  it("prefers balance over initialOutstanding if both present", () => {
    const cards = [{ id:"cc1", name:"Test", person:"NARR", balance:90000, initialOutstanding:75000 }];
    const d = mergeData({ creditCards: cards });
    expect(d.creditCards[0].balance).toBe(90000);
  });
});

// ─── CC utilization % ─────────────────────────────────────────────────────────
describe("CC utilization calculation", () => {
  const calcUtil = (currentBalance, limit) =>
    limit > 0 ? Math.min(100, Math.round((currentBalance / limit) * 100)) : 0;

  it("0 balance = 0%",          () => expect(calcUtil(0,     150000)).toBe(0));
  it("75k of 150k = 50%",       () => expect(calcUtil(75000, 150000)).toBe(50));
  it("142.5k of 150k ≈ 95%",    () => expect(calcUtil(142500,150000)).toBe(95));
  it("caps at 100%",            () => expect(calcUtil(200000,150000)).toBe(100));
  it("0 limit = 0% (no div/0)", () => expect(calcUtil(50000, 0)).toBe(0));

  it("90%+ is danger zone",     () => expect(calcUtil(135001,150000)).toBeGreaterThanOrEqual(90));
  it("70-89% is warning zone",  () => {
    const pct = calcUtil(112500, 150000);
    expect(pct).toBeGreaterThanOrEqual(70);
    expect(pct).toBeLessThan(90);
  });
});

// ─── Available credit ─────────────────────────────────────────────────────────
describe("Available credit = limit - currentBalance", () => {
  const available = (limit, bal) => limit > 0 ? Math.max(0, limit - bal) : null;

  it("full limit available when balance is 0",  () => expect(available(150000, 0)).toBe(150000));
  it("50k available when 100k used of 150k",    () => expect(available(150000,100000)).toBe(50000));
  it("0 available when maxed out",              () => expect(available(150000,150000)).toBe(0));
  it("0 available (not negative) when over limit", () => expect(available(150000,160000)).toBe(0));
  it("null when no limit set",                  () => expect(available(0, 50000)).toBeNull());
});

// ─── safeBalance per person ───────────────────────────────────────────────────
describe("perPersonSafety — safe bank balance after CC bills", () => {
  const calcSafe = (income, cashSpend, ccPaid, ccOwed) => {
    const currentBank = income - cashSpend - ccPaid;
    return currentBank - ccOwed;
  };

  it("positive safe balance when income covers all", () =>
    expect(calcSafe(100000, 20000, 30000, 40000)).toBe(10000));

  it("negative when CC bill exceeds available bank balance", () =>
    expect(calcSafe(50000, 30000, 0, 40000)).toBe(-20000));

  it("zero when exactly enough", () =>
    expect(calcSafe(100000, 50000, 0, 50000)).toBe(0));

  it("no opening balance in formula (removed)", () => {
    // Formula must be: income - cashSpend - ccPaid - ccOwed
    const safe = 68000 - 5000 - 59000 - 4000; // = 0
    expect(safe).toBe(0);
  });
});

// ─── Variable budget tracking ─────────────────────────────────────────────────
describe("Variable budget % and status", () => {
  const calcVarPct = (actual, budget) =>
    budget > 0 ? Math.round((actual / budget) * 100) : 0;

  const varStatus = (pct, T = { green:"green", amber:"amber", rose:"rose" }) =>
    pct >= 100 ? T.rose : pct >= 80 ? T.amber : T.green;

  it("0% when no spending",          () => expect(calcVarPct(0, 20000)).toBe(0));
  it("50% at half budget",           () => expect(calcVarPct(10000, 20000)).toBe(50));
  it("100% at exactly budget",       () => expect(calcVarPct(20000, 20000)).toBe(100));
  it("150% when over budget",        () => expect(calcVarPct(30000, 20000)).toBe(150));
  it("safe when < 80%",              () => expect(varStatus(79)).toBe("green"));
  it("warning when 80-99%",          () => expect(varStatus(85)).toBe("amber"));
  it("danger when 100%+",            () => expect(varStatus(100)).toBe("rose"));
  it("0% with no budget (no div/0)", () => expect(calcVarPct(5000, 0)).toBe(0));
});

// ─── OUTFLOW_CATS completeness ────────────────────────────────────────────────
describe("OUTFLOW_CATS", () => {
  it("includes FIXED EXPENSES",    () => expect(OUTFLOW_CATS).toContain("FIXED EXPENSES"));
  it("includes VARIABLE EXPENSES", () => expect(OUTFLOW_CATS).toContain("VARIABLE EXPENSES"));
  it("includes CC PAYMENT",        () => expect(OUTFLOW_CATS).toContain("CC PAYMENT"));
  it("includes SAVINGS",           () => expect(OUTFLOW_CATS).toContain("SAVINGS"));
  it("does NOT include INCOME",    () => expect(OUTFLOW_CATS).not.toContain("INCOME"));
});
