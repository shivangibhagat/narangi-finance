import { describe, it, expect } from "vitest";
import { summarize, computeCCBalance, ccPaymentMatchesCard } from "../../utils/finance";

// ─── Test data helpers ────────────────────────────────────────────────────────
const makeTxn = (overrides) => ({
  id: "t1", date: "2026-05-01", category: "VARIABLE EXPENSES",
  subCat: "SHOPPING", person: "NARR", amount: 1000, tags: [], note: "",
  ...overrides,
});

const NARR_INCOME   = makeTxn({ id:"i1", category:"INCOME",           subCat:"SALARY_NARR",  person:"NARR",  amount:68000, date:"2026-05-01" });
const SHIVU_INCOME  = makeTxn({ id:"i2", category:"INCOME",           subCat:"SALARY_SHIVU", person:"SHIVU", amount:100000,date:"2026-05-11" });
const FIXED_RENT    = makeTxn({ id:"f1", category:"FIXED EXPENSES",   subCat:"HOUSE RENT",   person:"SHIVU", amount:19000, date:"2026-05-19" });
const FIXED_LIGHT   = makeTxn({ id:"f2", category:"FIXED EXPENSES",   subCat:"LIGHTBILL",    person:"NARR",  amount:1590,  date:"2026-05-24" });
const VAR_SHOPPING  = makeTxn({ id:"v1", category:"VARIABLE EXPENSES",subCat:"SHOPPING",     person:"SHIVU", amount:27195, date:"2026-05-18" });
const CC_PAYMENT    = makeTxn({ id:"c1", category:"CC PAYMENT",       subCat:"NARR CC",      person:"NARR",  amount:59000, date:"2026-05-01", ccId:"cc1" });
const SAVINGS_TXN   = makeTxn({ id:"s1", category:"SAVINGS",          subCat:"Travel Fund",  person:"NARR",  amount:13700, date:"2026-05-05" });

// ─── summarize() ─────────────────────────────────────────────────────────────
describe("summarize()", () => {
  it("sums income correctly", () => {
    const s = summarize([NARR_INCOME, SHIVU_INCOME]);
    expect(s.income).toBe(168000);
  });

  it("sums fixed expenses correctly", () => {
    const s = summarize([FIXED_RENT, FIXED_LIGHT]);
    expect(s.fixed).toBe(20590);
  });

  it("sums variable expenses correctly", () => {
    const s = summarize([VAR_SHOPPING]);
    expect(s.variable).toBe(27195);
  });

  it("sums CC payments correctly", () => {
    const s = summarize([CC_PAYMENT]);
    expect(s.ccPaid).toBe(59000);
  });

  it("sums savings correctly", () => {
    const s = summarize([SAVINGS_TXN]);
    expect(s.savings).toBe(13700);
  });

  it("handles empty array", () => {
    const s = summarize([]);
    expect(s).toEqual({ income:0, fixed:0, variable:0, savings:0, ccPaid:0 });
  });

  it("handles mixed categories correctly", () => {
    const s = summarize([NARR_INCOME, FIXED_RENT, VAR_SHOPPING, CC_PAYMENT, SAVINGS_TXN]);
    expect(s.income).toBe(68000);
    expect(s.fixed).toBe(19000);
    expect(s.variable).toBe(27195);
    expect(s.ccPaid).toBe(59000);
    expect(s.savings).toBe(13700);
  });

  it("does NOT count CC payments as expenses", () => {
    const s = summarize([CC_PAYMENT]);
    expect(s.fixed).toBe(0);
    expect(s.variable).toBe(0);
  });

  it("does NOT count income as an expense", () => {
    const s = summarize([NARR_INCOME]);
    expect(s.fixed).toBe(0);
    expect(s.variable).toBe(0);
  });
});

// ─── currentBalance formula (no opening balance) ─────────────────────────────
describe("currentBalance = income - fixed - variable - ccPaid - savings", () => {
  it("positive balance when income > spending", () => {
    const s = summarize([NARR_INCOME, FIXED_RENT, VAR_SHOPPING]);
    const bal = s.income - s.fixed - s.variable - s.ccPaid - s.savings;
    expect(bal).toBe(68000 - 19000 - 27195); // 21805
    expect(bal).toBeGreaterThan(0);
  });

  it("negative balance when spending > income", () => {
    const big = makeTxn({ category:"VARIABLE EXPENSES", amount:100000 });
    const s = summarize([NARR_INCOME, big]);
    const bal = s.income - s.fixed - s.variable - s.ccPaid - s.savings;
    expect(bal).toBe(68000 - 100000); // -32000
    expect(bal).toBeLessThan(0);
  });

  it("zero when no transactions", () => {
    const s = summarize([]);
    const bal = s.income - s.fixed - s.variable - s.ccPaid - s.savings;
    expect(bal).toBe(0);
  });

  it("CC payments reduce balance (they are real cash outflows)", () => {
    const s = summarize([NARR_INCOME, CC_PAYMENT]);
    const bal = s.income - s.fixed - s.variable - s.ccPaid - s.savings;
    expect(bal).toBe(68000 - 59000); // 9000
  });
});

// ─── ccPaymentMatchesCard() ───────────────────────────────────────────────────
describe("ccPaymentMatchesCard()", () => {
  const card = { id: "cc1", name: "NARR Credit Card", person: "NARR" };

  it("matches by ccId", () => {
    const t = makeTxn({ category:"CC PAYMENT", ccId:"cc1" });
    expect(ccPaymentMatchesCard(t, card)).toBe(true);
  });

  it("matches by subCat === card name", () => {
    const t = makeTxn({ category:"CC PAYMENT", subCat:"NARR Credit Card", ccId: null });
    expect(ccPaymentMatchesCard(t, card)).toBe(true);
  });

  it("does NOT match wrong ccId", () => {
    const t = makeTxn({ category:"CC PAYMENT", ccId:"cc2" });
    expect(ccPaymentMatchesCard(t, card)).toBe(false);
  });

  it("does NOT match non-CC-PAYMENT transactions", () => {
    const t = makeTxn({ category:"FIXED EXPENSES", ccId:"cc1" });
    expect(ccPaymentMatchesCard(t, card)).toBe(false);
  });

  it("does NOT match INCOME transactions", () => {
    const t = makeTxn({ category:"INCOME", ccId:"cc1" });
    expect(ccPaymentMatchesCard(t, card)).toBe(false);
  });
});

// ─── computeCCBalance() ───────────────────────────────────────────────────────
describe("computeCCBalance()", () => {
  const card = { id:"cc1", name:"NARR CC", person:"NARR", initialOutstanding:50000, limit:150000 };

  it("returns initialOutstanding when no prior history", () => {
    const bal = computeCCBalance(card, 2026, "May", [], {});
    expect(bal).toBe(50000);
  });

  it("adds charges from previous month", () => {
    const charges = { "cc1_2026-05": 10000 }; // May charges
    const bal = computeCCBalance(card, 2026, "Jun", [], charges);
    expect(bal).toBe(60000); // 50000 + 10000
  });

  it("subtracts payments from previous month", () => {
    const payment = makeTxn({
      category:"CC PAYMENT", subCat:"NARR CC", ccId:"cc1",
      date:"2026-05-15", amount:20000 // May payment
    });
    const bal = computeCCBalance(card, 2026, "Jun", [payment], {});
    expect(bal).toBe(30000); // 50000 - 20000
  });

  it("balance cannot go below zero", () => {
    const payment = makeTxn({
      category:"CC PAYMENT", subCat:"NARR CC", ccId:"cc1",
      date:"2026-05-15", amount:100000 // overpayment in May
    });
    const bal = computeCCBalance(card, 2026, "Jun", [payment], {});
    expect(bal).toBe(0);
  });

  it("does NOT include current month's charges in opening balance", () => {
    const charges = { "cc1_2026-06": 15000 }; // current month (Jun) charge
    const bal = computeCCBalance(card, 2026, "Jun", [], charges);
    expect(bal).toBe(50000); // unchanged — current month not included
  });

  it("accumulates multiple months of charges", () => {
    const charges = { "cc1_2026-05": 5000, "cc1_2026-06": 8000 }; // May+Jun
    const bal = computeCCBalance(card, 2026, "Jul", [], charges);
    expect(bal).toBe(63000); // 50000 + 5000 + 8000
  });
});
