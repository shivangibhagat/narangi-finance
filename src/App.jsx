import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import {
  T,
  MONTHS,
  YEARS,
  START_YEAR,
  START_MONTH,
  START_MONTH_IDX,
  getVisibleMonths,
  TABS,
} from "./constants/theme";
import { DEFAULTS } from "./constants/defaults";
import { mNum, monthKey, uid, confirmDel } from "./utils/format";
import { summarize } from "./utils/finance";
import { useIsMobile } from "./hooks/useIsMobile";
import { useOutsideClick } from "./hooks/useOutsideClick";
import { useFirestoreSync } from "./hooks/useFirestoreSync";
import { Modal, LoadingScreen, ConnectingScreen } from "./components/ui/primitives";
import { LoginScreen } from "./components/LoginScreen";
import { TxnForm } from "./components/TxnForm";
import { ImportModal } from "./components/ImportModal";
import { DashboardTab } from "./components/DashboardTab";
import { TransactionsTab } from "./components/TransactionsTab";
import { PlanTab } from "./components/PlanTab";
import { CreditCardsTab } from "./components/CreditCardsTab";

export default function App() {
  const isMobile = useIsMobile();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  const { s, setS, loaded, syncStatus, upd, updNow, saveNow } = useFirestoreSync(user);

  const [tab, setTab] = useState("dashboard");
  const [activeYear, setActiveYear] = useState(2026);
  const [activeMonth, setActiveMonth] = useState("May");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTxn, setEditTxn] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const yearPickerRef = useRef(null);

  const defaultDate = `${activeYear}-${mNum(activeMonth)}-01`;
  const [quickForm, setQuickForm] = useState({
    date: defaultDate,
    category: "VARIABLE EXPENSES",
    subCat: "CAFES/RESTAURANTS",
    spentOn: "",
    amount: "",
    person: (s.members || DEFAULTS.members)[0],
    note: "",
    tags: [],
  });

  useOutsideClick(yearPickerRef, useCallback(() => setShowYearPicker(false), []));
  useOutsideClick(userMenuRef, useCallback(() => setShowUserMenu(false), []));
  useEffect(() => {
    setQuickForm((f) => ({ ...f, date: `${activeYear}-${mNum(activeMonth)}-01` }));
  }, [activeYear, activeMonth]);

  const members = s.members || DEFAULTS.members;
  const getTxns = useCallback(
    (m, y) => {
      const yr = y ?? activeYear;
      return (s.transactions || []).filter((t) => t.date.startsWith(`${yr}-${mNum(m)}`));
    },
    [s.transactions, activeYear]
  );

  const monthTxns = useMemo(
    () => getTxns(activeMonth, activeYear),
    [getTxns, activeMonth, activeYear]
  );
  const summary = useMemo(() => summarize(monthTxns), [monthTxns]);
  const prevIdx = MONTHS.indexOf(activeMonth) - 1;
  const isFirstTrackedMonth = activeYear === START_YEAR && activeMonth === START_MONTH;
  const prevSummary = useMemo(() => {
    if (isFirstTrackedMonth) return { income: 0, fixed: 0, variable: 0, savings: 0, ccPaid: 0 };
    return summarize(
      prevIdx >= 0 ? getTxns(MONTHS[prevIdx], activeYear) : getTxns("Dec", activeYear - 1)
    );
  }, [getTxns, activeMonth, activeYear, isFirstTrackedMonth]);

  const ob = s.openingBalances?.[monthKey(activeYear, activeMonth)] || {};
  const openingTotal = members.reduce((a, m) => a + (ob[m] || 0), 0);
  const currentBalance =
    openingTotal +
    summary.income -
    summary.fixed -
    summary.variable -
    summary.ccPaid -
    summary.savings;
  const totalIncome = (s.income || []).reduce((a, i) => a + i.amount, 0);
  const totalFixed = (s.fixedExpenses || []).reduce((a, f) => a + f.budget, 0);
  const totalSavings = (s.savings || []).reduce((a, sv) => a + sv.monthlyTarget, 0);
  const varPct =
    s.variableBudget > 0 ? Math.round((summary.variable / s.variableBudget) * 100) : 0;
  const varStatus = varPct >= 100 ? T.rose : varPct >= 80 ? T.amber : T.green;

  const addTxn = useCallback(
    (form) => {
      const amt = parseFloat(form.amount);
      if (!form.spentOn || !(amt > 0)) return;
      const txn = {
        ...form,
        id: uid(),
        amount: amt,
        tags: form.tags || [],
        ccId: form.ccId || null,
        note: form.note || "",
      };
      const newS = { ...s, transactions: [...(s.transactions || []), txn] };
      setS(newS);
      saveNow(newS);
    },
    [s, saveNow, setS]
  );

  const delTxn = useCallback(
    (id) => {
      const t = (s.transactions || []).find((t) => t.id === id);
      if (!t || !confirmDel(t.spentOn || "this")) return;
      const newS = { ...s, transactions: (s.transactions || []).filter((t) => t.id !== id) };
      setS(newS);
      saveNow(newS);
    },
    [s, saveNow, setS]
  );

  const saveEditTxn = useCallback(
    (form) => {
      const updated = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        ccId: form.ccId || null,
        note: form.note || "",
      };
      const newS = {
        ...s,
        transactions: (s.transactions || []).map((t) => (t.id === form.id ? updated : t)),
      };
      setS(newS);
      setEditTxn(null);
      saveNow(newS);
    },
    [s, saveNow, setS]
  );

  const annualData = useMemo(
    () =>
      getVisibleMonths(activeYear).map((m) => {
        const t = summarize(getTxns(m, activeYear));
        const ob2 = s.openingBalances?.[monthKey(activeYear, m)] || {};
        return {
          month: m,
          income: t.income,
          expenses: t.fixed + t.variable,
          savings: t.savings,
          opening: members.reduce((a, mem) => a + (ob2[mem] || 0), 0),
        };
      }),
    [s.transactions, s.openingBalances, activeYear, members]
  );

  const catBreakdown = useMemo(() => {
    const grp = {};
    monthTxns
      .filter((t) => t.category !== "INCOME")
      .forEach((t) => {
        grp[t.subCat] = (grp[t.subCat] || 0) + t.amount;
      });
    return Object.entries(grp)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [monthTxns]);

  const syncDot = { live: T.green, saving: T.amber, connecting: T.muted, error: T.rose }[
    syncStatus
  ];
  const syncLabel = {
    live: "Synced",
    saving: "Saving…",
    connecting: "Connecting…",
    error: "Sync error",
  }[syncStatus];
  const p = isMobile ? 12 : 24;

  if (authLoading) return <LoadingScreen />;
  if (!user) return <LoginScreen />;
  if (!loaded) return <ConnectingScreen />;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
        paddingBottom: isMobile ? 76 : 80,
      }}
    >
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          padding: `0 ${p}px`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: isMobile ? 56 : 64,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: `linear-gradient(135deg,${T.accent},${T.purple})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              🪙
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16 }}>Narangi Finance</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: syncDot,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: T.muted, fontSize: 10 }}>
                  {syncLabel} · {activeMonth} {activeYear}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }} ref={yearPickerRef}>
            <button
              onClick={() => setShowYearPicker((v) => !v)}
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                color: T.accent,
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {activeYear} ▾
            </button>
            {showYearPicker && (
              <div
                style={{
                  position: "absolute",
                  top: isMobile ? 56 : 64,
                  right: p,
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: 8,
                  zIndex: 300,
                  boxShadow: "0 8px 32px #00000088",
                }}
              >
                {YEARS.map((y) => (
                  <button
                    key={y}
                    onClick={() => {
                      setActiveYear(y);
                      if (y === START_YEAR)
                        setActiveMonth((m) =>
                          MONTHS.indexOf(m) < START_MONTH_IDX ? START_MONTH : m
                        );
                      setShowYearPicker(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      background: activeYear === y ? T.accent : "transparent",
                      color: activeYear === y ? T.bg : T.text,
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 20px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
            {!isMobile &&
              TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    background: tab === t.id ? T.accent : "transparent",
                    color: tab === t.id ? T.bg : T.muted,
                    border: `1px solid ${tab === t.id ? T.accent : T.border}`,
                    borderRadius: 8,
                    padding: "7px 14px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t.label}
                </button>
              ))}
            <div style={{ position: "relative" }} ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                title={`Signed in as ${user?.email}`}
                style={{
                  background: "transparent",
                  border: `1px solid ${T.border}`,
                  color: T.muted,
                  borderRadius: 8,
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {isMobile ? "👤" : `👤 ${user?.displayName?.split(" ")[0] || "Account"}`}
              </button>
              {showUserMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: 44,
                    right: 0,
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 12,
                    padding: 0,
                    zIndex: 300,
                    boxShadow: "0 8px 32px #00000088",
                    minWidth: 220,
                  }}
                >
                  <div
                    style={{
                      padding: "12px 16px",
                      borderBottom: `1px solid ${T.border}`,
                      fontSize: 12,
                      color: T.muted,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: T.text, marginBottom: 2 }}>
                      {user?.displayName || "User"}
                    </div>
                    <div style={{ fontSize: 11 }}>{user?.email}</div>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      signOut(auth);
                    }}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: "transparent",
                      border: "none",
                      color: T.rose,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: `8px ${p}px`,
            minWidth: "max-content",
          }}
        >
          {getVisibleMonths(activeYear).map((m) => {
            const has = getTxns(m, activeYear).length > 0;
            return (
              <button
                key={m}
                onClick={() => setActiveMonth(m)}
                style={{
                  background: activeMonth === m ? T.accent : has ? T.accentDim : "transparent",
                  color: activeMonth === m ? T.bg : has ? T.accent : T.muted,
                  border: `1px solid ${activeMonth === m ? T.accent : has ? T.accent + "55" : T.border}`,
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: `${p}px` }}>
        {tab === "dashboard" && (
          <DashboardTab
            s={s}
            updNow={updNow}
            activeYear={activeYear}
            activeMonth={activeMonth}
            isMobile={isMobile}
            members={members}
            monthTxns={monthTxns}
            summary={summary}
            prevSummary={prevSummary}
            isFirstTrackedMonth={isFirstTrackedMonth}
            prevIdx={prevIdx}
            openingTotal={openingTotal}
            currentBalance={currentBalance}
            varPct={varPct}
            varStatus={varStatus}
            annualData={annualData}
            catBreakdown={catBreakdown}
            ob={ob}
          />
        )}
        {tab === "transactions" && (
          <TransactionsTab
            s={s}
            addTxn={addTxn}
            delTxn={delTxn}
            editTxn={editTxn}
            setEditTxn={setEditTxn}
            saveEditTxn={saveEditTxn}
            activeMonth={activeMonth}
            setActiveMonth={setActiveMonth}
            activeYear={activeYear}
            getTxns={getTxns}
            summarize={summarize}
            isMobile={isMobile}
            onOpenImport={() => setShowImport(true)}
          />
        )}
        {tab === "plan" && (
          <PlanTab
            s={s}
            upd={upd}
            updNow={updNow}
            totalIncome={totalIncome}
            totalFixed={totalFixed}
            totalSavings={totalSavings}
            transactions={s.transactions || []}
            activeMonth={activeMonth}
            activeYear={activeYear}
            isMobile={isMobile}
          />
        )}
        {tab === "credit cards" && (
          <CreditCardsTab
            s={s}
            upd={upd}
            updNow={updNow}
            transactions={s.transactions || []}
            getTxns={getTxns}
            activeMonth={activeMonth}
            setActiveMonth={setActiveMonth}
            activeYear={activeYear}
            addTxn={addTxn}
            isMobile={isMobile}
          />
        )}
      </div>

      <button
        onClick={() => setShowQuickAdd(true)}
        style={{
          position: "fixed",
          bottom: isMobile ? 80 : 28,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: `linear-gradient(135deg,${T.accent},${T.purple})`,
          border: "none",
          color: "white",
          fontSize: 28,
          cursor: "pointer",
          boxShadow: `0 4px 20px ${T.accent}66`,
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        +
      </button>

      <Modal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} title="⚡ Quick Add">
        <TxnForm
          state={s}
          value={quickForm}
          onChange={setQuickForm}
          onSubmit={() => {
            addTxn(quickForm);
            setQuickForm((f) => ({ ...f, spentOn: "", amount: "", note: "", tags: [] }));
            setShowQuickAdd(false);
          }}
        />
      </Modal>
      <Modal open={!!editTxn} onClose={() => setEditTxn(null)} title="✏️ Edit Transaction">
        {editTxn && (
          <TxnForm
            state={s}
            value={editTxn}
            onChange={setEditTxn}
            onSubmit={() => saveEditTxn(editTxn)}
            submitLabel="Save Changes"
          />
        )}
      </Modal>
      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        s={s}
        onImport={(txns) => {
          const newS = { ...s, transactions: [...(s.transactions || []), ...txns] };
          setS(newS);
          saveNow(newS);
        }}
      />

      {isMobile && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: T.surface,
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            zIndex: 300,
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                padding: "10px 4px",
                background: "transparent",
                border: "none",
                color: tab === t.id ? T.accent : T.muted,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                minHeight: 56,
              }}
            >
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{t.label}</span>
              {tab === t.id && (
                <div
                  style={{
                    width: 20,
                    height: 2,
                    background: T.accent,
                    borderRadius: 99,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
