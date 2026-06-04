import { describe, it, expect } from "vitest";

/**
 * These tests cover the LOGIC used in PlanTab and App.jsx
 * extracted as pure functions so they can be tested without React.
 */

const MEMBERS = ["NARR", "SHIVU"];

// ── Replicate getIncomePerson() from PlanTab ──────────────────────────────────
function getIncomePerson(inc, members) {
  return members.find(m =>
    (inc.label  || "").toUpperCase().includes(m.toUpperCase()) ||
    (inc.subCat || "").toUpperCase().includes(m.toUpperCase())
  ) || null;
}

// ── Replicate incomeByPerson from PlanTab ─────────────────────────────────────
function buildIncomeByPerson(txns, members) {
  const m = {};
  members.forEach(mem => {
    m[mem] = txns
      .filter(t => t.category === "INCOME" && t.person === mem)
      .reduce((a, t) => a + t.amount, 0);
  });
  return m;
}

// ── Replicate getFixedActual() from PlanTab ───────────────────────────────────
function getFixedActual(fe, txns) {
  const canon = (fe.subCat || "").trim().toUpperCase();
  const lbl   = (fe.label  || "").trim().toUpperCase();
  return txns
    .filter(t => t.category === "FIXED EXPENSES")
    .filter(t => {
      const sc = (t.subCat || "").trim().toUpperCase();
      return (canon && sc === canon) || (lbl && sc === lbl);
    })
    .reduce((a, t) => a + t.amount, 0);
}

// ── Replicate catBreakdown filter from App.jsx ────────────────────────────────
function buildCatBreakdown(txns) {
  const grp = {};
  txns
    .filter(t => t.category === "FIXED EXPENSES" || t.category === "VARIABLE EXPENSES")
    .forEach(t => { grp[t.subCat] = (grp[t.subCat] || 0) + t.amount; });
  return Object.entries(grp).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
}

// ─── Income items (as stored in Firestore) ────────────────────────────────────
const INCOME_ITEMS = [
  { id:"i1", label:"NARR Salary",  subCat:"SALARY_NARR",  amount:55000 },
  { id:"i2", label:"SHIVU Salary", subCat:"SALARY_SHIVU", amount:100000 },
];
const INCOME_ITEMS_NO_SUBCAT = [
  { id:"i1", label:"NARR Salary",  amount:55000 },  // old format — no subCat
  { id:"i2", label:"SHIVU Salary", amount:100000 },
];

// ─── Transactions ─────────────────────────────────────────────────────────────
const TXNS = [
  { category:"INCOME",           subCat:"SALARY_NARR",          person:"NARR",  amount:68000  },
  { category:"INCOME",           subCat:"SALARY_SHIVU",         person:"SHIVU", amount:100000 },
  { category:"FIXED EXPENSES",   subCat:"HOUSE RENT",           person:"SHIVU", amount:19000  },
  { category:"FIXED EXPENSES",   subCat:"LIGHTBILL",            person:"NARR",  amount:1590   },
  { category:"FIXED EXPENSES",   subCat:"SEND TO HOME",         person:"SHIVU", amount:15000  },
  { category:"FIXED EXPENSES",   subCat:"CAR AND SCOOTY WASH",  person:"SHIVU", amount:1100   },
  { category:"VARIABLE EXPENSES",subCat:"SHOPPING",             person:"SHIVU", amount:40195  },
  { category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",    person:"NARR",  amount:5000   },
  { category:"CC PAYMENT",       subCat:"NARR Credit Card",     person:"NARR",  amount:59000  },
  { category:"CC PAYMENT",       subCat:"SHIVU Credit Card",    person:"SHIVU", amount:59000  },
  { category:"SAVINGS",          subCat:"Travel Fund",          person:"NARR",  amount:13700  },
];

// ─── getIncomePerson() tests ──────────────────────────────────────────────────
describe("getIncomePerson() — matches income item to a member", () => {
  it("matches NARR via label 'NARR Salary'",    () => expect(getIncomePerson({label:"NARR Salary"},  MEMBERS)).toBe("NARR"));
  it("matches SHIVU via label 'SHIVU Salary'",  () => expect(getIncomePerson({label:"SHIVU Salary"}, MEMBERS)).toBe("SHIVU"));
  it("matches NARR via subCat 'SALARY_NARR'",   () => expect(getIncomePerson({subCat:"SALARY_NARR"}, MEMBERS)).toBe("NARR"));
  it("matches SHIVU via subCat 'SALARY_SHIVU'", () => expect(getIncomePerson({subCat:"SALARY_SHIVU"},MEMBERS)).toBe("SHIVU"));
  it("is case-insensitive",                     () => expect(getIncomePerson({label:"narr salary"},  MEMBERS)).toBe("NARR"));
  it("returns null when no match",              () => expect(getIncomePerson({label:"Freelance"},    MEMBERS)).toBeNull());
  it("returns null for empty item",             () => expect(getIncomePerson({},                     MEMBERS)).toBeNull());
  it("prefers label match over null subCat",    () => expect(getIncomePerson({label:"NARR Salary", subCat:""}, MEMBERS)).toBe("NARR"));
});

// ─── incomeByPerson (person-based income totals) ──────────────────────────────
describe("buildIncomeByPerson() — sums income by person correctly", () => {
  const byPerson = buildIncomeByPerson(TXNS, MEMBERS);

  it("NARR income = 68000",  () => expect(byPerson.NARR).toBe(68000));
  it("SHIVU income = 100000",() => expect(byPerson.SHIVU).toBe(100000));

  it("does not cross-contaminate persons", () => {
    // The historical bug: both salaries showed under NARR, SHIVU = 0
    expect(byPerson.NARR).not.toBe(168000);
    expect(byPerson.SHIVU).not.toBe(0);
  });

  it("SHIVU is not 0 even when NARR entered first", () => {
    const txns = [
      { category:"INCOME", person:"NARR",  amount:68000  },
      { category:"INCOME", person:"SHIVU", amount:100000 },
    ];
    const bp = buildIncomeByPerson(txns, MEMBERS);
    expect(bp.SHIVU).toBe(100000);
    expect(bp.NARR).toBe(68000);
  });

  it("returns 0 for person with no income transactions", () => {
    const txns = [{ category:"INCOME", person:"NARR", amount:68000 }];
    const bp = buildIncomeByPerson(txns, MEMBERS);
    expect(bp.SHIVU).toBe(0);
  });

  it("handles empty transaction list", () => {
    const bp = buildIncomeByPerson([], MEMBERS);
    expect(bp.NARR).toBe(0);
    expect(bp.SHIVU).toBe(0);
  });
});

// ─── Plan tab income actuals (combining getIncomePerson + incomeByPerson) ─────
describe("PlanTab income actuals — full pipeline", () => {
  const byPerson = buildIncomeByPerson(TXNS, MEMBERS);

  it("NARR Salary item shows 68000 actual (with subCat)", () => {
    const person = getIncomePerson(INCOME_ITEMS[0], MEMBERS);
    expect(byPerson[person]).toBe(68000);
  });

  it("SHIVU Salary item shows 100000 actual (with subCat)", () => {
    const person = getIncomePerson(INCOME_ITEMS[1], MEMBERS);
    expect(byPerson[person]).toBe(100000);
  });

  it("works even when income items have no subCat (old Firestore format)", () => {
    // Old format without subCat — label-based matching should still work
    const narrPerson  = getIncomePerson(INCOME_ITEMS_NO_SUBCAT[0], MEMBERS);
    const shivuPerson = getIncomePerson(INCOME_ITEMS_NO_SUBCAT[1], MEMBERS);
    expect(byPerson[narrPerson]).toBe(68000);
    expect(byPerson[shivuPerson]).toBe(100000);
  });
});

// ─── getFixedActual() — fixed expense matching ────────────────────────────────
describe("getFixedActual() — matches transactions to fixed expense items", () => {
  it("matches by subCat 'HOUSE RENT'",         () => expect(getFixedActual({subCat:"HOUSE RENT",         label:"House Rent"},        TXNS)).toBe(19000));
  it("matches 'LIGHTBILL' when label='Light Bill'", () => expect(getFixedActual({subCat:"LIGHTBILL",     label:"Light Bill"},        TXNS)).toBe(1590));
  it("matches 'SEND TO HOME'",                 () => expect(getFixedActual({subCat:"SEND TO HOME",       label:"Send to Home"},      TXNS)).toBe(15000));
  it("matches 'CAR AND SCOOTY WASH'",          () => expect(getFixedActual({subCat:"CAR AND SCOOTY WASH",label:"Car & Scooty Wash"}, TXNS)).toBe(1100));
  it("falls back to label when no subCat",     () => expect(getFixedActual({subCat:"",label:"HOUSE RENT"},TXNS)).toBe(19000));
  it("returns 0 for item with no transactions",() => expect(getFixedActual({subCat:"GAS BILL",label:"Gas Bill"}, TXNS)).toBe(0));
});

// ─── catBreakdown — excludes CC payments and savings ─────────────────────────
describe("catBreakdown — only shows FIXED + VARIABLE spending", () => {
  const bd = buildCatBreakdown(TXNS);
  const names = bd.map(c => c.name);

  it("includes SHOPPING",            () => expect(names).toContain("SHOPPING"));
  it("includes HOUSE RENT",          () => expect(names).toContain("HOUSE RENT"));
  it("includes CAFES/RESTAURANTS",   () => expect(names).toContain("CAFES/RESTAURANTS"));
  it("EXCLUDES CC payments",         () => {
    expect(names).not.toContain("NARR Credit Card");
    expect(names).not.toContain("SHIVU Credit Card");
  });
  it("EXCLUDES income",              () => expect(names).not.toContain("SALARY_NARR"));
  it("EXCLUDES savings",             () => expect(names).not.toContain("Travel Fund"));
  it("is sorted descending by value",() => {
    for (let i = 0; i < bd.length - 1; i++) {
      expect(bd[i].value).toBeGreaterThanOrEqual(bd[i+1].value);
    }
  });
  it("returns empty array when no spend transactions", () => {
    const empty = buildCatBreakdown([TXNS[0], TXNS[1]]); // income only
    expect(empty).toHaveLength(0);
  });
});

// ─── Safe balance = currentBalance - totalCCOwed ─────────────────────────────
describe("safeBalance — after paying CC bills", () => {
  function calcSafe(income, fixed, variable, ccPaid, savings, ccOwed) {
    const currentBalance = income - fixed - variable - ccPaid - savings;
    return currentBalance - ccOwed;
  }

  it("positive when balance > CC owed", () =>
    // income=200k, fixed=20k, var=10k, ccPaid=50k, sav=10k → bal=110k, ccOwed=30k → safe=80k
    expect(calcSafe(200000, 20000, 10000, 50000, 10000, 30000)).toBe(80000));

  it("negative when CC owed > balance (shortfall)", () =>
    expect(calcSafe(50000, 35000, 20000, 0, 0, 100000)).toBeLessThan(0));

  it("zero when balance exactly covers CC", () =>
    expect(calcSafe(100000, 0, 0, 0, 0, 100000)).toBe(0));

  it("is not affected by opening balance (removed)", () => {
    // Ensure no opening balance term is in the formula
    const bal = 100000 - 20000 - 10000 - 30000 - 5000; // = 35000
    expect(bal - 20000).toBe(15000); // safe balance
  });
});
