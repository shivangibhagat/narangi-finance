export const T = {
  bg: "#0A0E1A",
  surface: "#111827",
  card: "#1A2236",
  border: "#1E2D45",
  accent: "#00D4AA",
  accentDim: "#00D4AA18",
  amber: "#F59E0B",
  rose: "#F43F5E",
  blue: "#60A5FA",
  purple: "#A78BFA",
  green: "#22C55E",
  text: "#E2E8F0",
  muted: "#64748B",
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const YEARS = [2026, 2027, 2028, 2029, 2030];
export const CATS = ["INCOME", "FIXED EXPENSES", "VARIABLE EXPENSES", "SAVINGS", "CC PAYMENT"];
export const START_YEAR = 2026;
export const START_MONTH = "May";
export const START_MONTH_IDX = MONTHS.indexOf(START_MONTH);
export const CAT_CLR = {
  INCOME: T.accent,
  "FIXED EXPENSES": T.blue,
  "VARIABLE EXPENSES": T.amber,
  SAVINGS: T.purple,
  "CC PAYMENT": T.rose,
};
export const PIE_COLORS = [T.accent, T.blue, T.amber, T.purple, T.rose, "#34D399", "#818CF8", "#FB923C"];
export const CAT_ICON = {
  INCOME: "💰",
  "FIXED EXPENSES": "🔒",
  "VARIABLE EXPENSES": "📊",
  SAVINGS: "🎯",
  "CC PAYMENT": "💳",
};

export const getVisibleMonths = (year) =>
  year === START_YEAR ? MONTHS.slice(START_MONTH_IDX) : MONTHS;

export const TABS = [
  { id: "dashboard", icon: "📊", label: "Dashboard" },
  { id: "transactions", icon: "📋", label: "Txns" },
  { id: "plan", icon: "🎯", label: "Plan" },
  { id: "credit cards", icon: "💳", label: "Cards" },
  { id: "more", icon: "☰", label: "More" },
];
