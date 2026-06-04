export const DEFAULTS = {
  members: ["NARR", "SHIVU"],
  income: [
    // Excel Financial Plan: NARR=55000 (planned), SHIVU=100000
    // May actual: NARR=68000, SHIVU=100000 → keeping actuals as defaults
    { id: "i1", label: "NARR Salary", subCat: "SALARY_NARR", amount: 55000 },
    { id: "i2", label: "SHIVU Salary", subCat: "SALARY_SHIVU", amount: 100000 },
  ],
  fixedExpenses: [
    // Aligned with Excel "Financial Plan" sheet
    { id: "f1",  label: "House Rent",         subCat: "HOUSE RENT",            budget: 19500 },
    { id: "f2",  label: "Send to Home",        subCat: "SEND TO HOME",          budget: 15000 },
    { id: "f3",  label: "Light Bill",          subCat: "LIGHTBILL",             budget: 2000  },
    { id: "f4",  label: "Gas Bill",            subCat: "GAS BILL",              budget: 1500  },
    { id: "f5",  label: "WiFi + Phone Bill",   subCat: "WIFI + PHONE BILL",     budget: 500   },
    { id: "f6",  label: "Vegetables + Grocery",subCat: "VEGETABLES + GROCERY",  budget: 10000 },
    { id: "f7",  label: "Monthly SIP",         subCat: "MONTHLY SIP",           budget: 10000 },
    { id: "f8",  label: "Misc",                subCat: "MISC",                  budget: 5000  },
    { id: "f9",  label: "Mediclaim",           subCat: "MEDICLAIM",             budget: 5000  },
    { id: "f10", label: "RentMojo Items",      subCat: "RENTMOJO ITEMS",        budget: 1700  },
    { id: "f11", label: "Car & Scooty Wash",   subCat: "CAR AND SCOOTY WASH",   budget: 1100  },
  ],
  variableBudget: 20000,
  variableSubCats: [
    "ENTERTAINMENT",
    "CAFES/RESTAURANTS",
    "SUBSCRIPTIONS",
    "GIFTS",
    "ONLINE FOOD",
    "SHOPPING",
    "BODY CARE",
    "CREDIT CARD BILLS",
    "TRANSPORT",
  ],
  savings: [
    // Excel Financial Plan savings targets: each ₹13,700 except Personal Savings ₹10,000
    { id: "s1", label: "Travel Fund",     monthlyTarget: 13700, goalTarget: 300000 },
    { id: "s2", label: "Emergency Fund",  monthlyTarget: 13700, goalTarget: 500000 },
    { id: "s3", label: "Home Fund",       monthlyTarget: 13700, goalTarget: 1000000 },
    { id: "s4", label: "Car Fund",        monthlyTarget: 13700, goalTarget: 800000 },
    { id: "s5", label: "Personal Savings",monthlyTarget: 10000, goalTarget: 200000 },
  ],
  creditCards: [
    // Excel "Credit Card" sheet: Narr outstanding=94572, Shivu=68356 (code had 67606 — mismatch)
    { id: "cc1", name: "NARR Credit Card",  person: "NARR",  limit: 150000, initialOutstanding: 94572 },
    { id: "cc2", name: "SHIVU Credit Card", person: "SHIVU", limit: 150000, initialOutstanding: 68356 },
  ],
  ccMonthlyCharges: {},
  customTags: ["reimbursable", "birthday", "travel", "emergency", "work"],
};
