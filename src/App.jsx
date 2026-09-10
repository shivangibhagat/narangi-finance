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
import { fmt, mNum, ccKey, uid } from "./utils/format";
import { summarize, computeCCBalance, ccPaymentMatchesCard, mergeData } from "./utils/finance";
import {
  snapshotState,
  pushHistory,
  appendActivity,
  mergeUndoActivity,
  makeActivityEntry,
  actorFromUser,
  transactionsToCSV,
  buildBackup,
  parseBackup,
  downloadFile,
  todayStamp,
} from "./utils/safety";
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
import { ConfirmDialog } from "./components/ConfirmDialog";
import { UndoToast } from "./components/UndoToast";
import { MoreTab } from "./components/MoreTab";

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

  const { s, setS, loaded, syncStatus, upd, saveNow } = useFirestoreSync(user);

  // ─── Safety pack: confirm dialog, undo history, activity log ──────────────
  // sRef mirrors the latest state so callbacks always mutate a fresh base
  // (avoids stale-closure drops and StrictMode double-fired updater effects).
  const sRef = useRef(s);
  sRef.current = s;
  const actor = actorFromUser(user);
  const entry = useCallback(
    (action, detail) => makeActivityEntry({ actor, action, detail }),
    [actor]
  );

  // Toast (auto-dismisses after 12s)
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((msg, canUndo = false) => {
    clearTimeout(toastTimer.current);
    setToast({ id: uid(), msg, canUndo });
    toastTimer.current = setTimeout(() => setToast(null), 12000);
  }, []);
  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Undo history (ref — never triggers renders, capped at 10 snapshots)
  const historyRef = useRef([]);
  const withUndo = useCallback(
    (label, applyFn) => {
      historyRef.current = pushHistory(historyRef.current, {
        state: snapshotState(sRef.current),
        ts: Date.now(),
      });
      applyFn();
      showToast(label, true);
    },
    [showToast]
  );
  const handleUndo = useCallback(() => {
    const stack = historyRef.current;
    if (!stack.length) {
      dismissToast();
      return;
    }
    const last = stack[stack.length - 1];
    historyRef.current = stack.slice(0, -1);
    const prev = last.state;
    const restored = {
      ...prev,
      activity: mergeUndoActivity(
        sRef.current.activity,
        prev.activity,
        makeActivityEntry({ actor, action: "undo", detail: "Undid the last change" }),
        last.ts || 0
      ),
    };
    setS(restored);
    saveNow(restored);
    showToast("Change undone", false);
  }, [actor, setS, saveNow, showToast, dismissToast]);

  // Confirm dialog (in-app replacement for window.confirm, which iOS PWA blocks)
  const [confirmState, setConfirmState] = useState(null);
  const requestConfirm = useCallback((opts) => setConfirmState(opts), []);
  const closeConfirm = useCallback(() => setConfirmState(null), []);
  const fireConfirm = useCallback(() => {
    const c = confirmState;
    setConfirmState(null);
    c?.onConfirm?.();
  }, [confirmState]);

  // Drop-in for the sync hook's updNow that also appends an activity entry.
  // Resolves against sRef (not inside a setS updater) so StrictMode dev
  // double-invocation can't fire the save twice.
  const updNowLogged = useCallback(
    (patch, activity) => {
      const p = sRef.current;
      const resolved = typeof patch === "function" ? patch(p) : patch;
      const newS = { ...p, ...resolved };
      if (activity)
        newS.activity = appendActivity(
          newS.activity,
          entry(activity.action, activity.detail)
        );
      setS(newS);
      saveNow(newS);
    },
    [entry, setS, saveNow]
  );

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
      return (s.transactions || []).filter((t) => t.date?.startsWith(`${yr}-${mNum(m)}`));
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

  // Balance = this month's income minus all outflows (no opening balance)
  const currentBalance =
    summary.income -
    summary.fixed -
    summary.variable -
    summary.ccPaid -
    summary.savings;
  // Total CC debt still owed this month (opening balance + charges − payments)
  const totalCCOwed = useMemo(() => {
    return (s.creditCards || []).reduce((total, cc) => {
      const opening = computeCCBalance(cc, activeYear, activeMonth, s.transactions || [], s.ccMonthlyCharges);
      const charges = (s.ccMonthlyCharges || {})[ccKey(cc.id, activeYear, activeMonth)] || 0;
      const paid = getTxns(activeMonth, activeYear)
        .filter(t => ccPaymentMatchesCard(t, cc))
        .reduce((a, t) => a + t.amount, 0);
      return total + Math.max(0, opening + charges - paid);
    }, 0);
  }, [s.creditCards, s.ccMonthlyCharges, s.transactions, activeYear, activeMonth, getTxns]);

  // What's truly safe to spend once all CC bills are paid
  const safeBalance = currentBalance - totalCCOwed;

  const totalIncome = (s.income || []).reduce((a, i) => a + i.amount, 0);
  const totalFixed = (s.fixedExpenses || []).reduce((a, f) => a + f.budget, 0);
  const totalSavings = (s.savings || []).reduce((a, sv) => a + sv.monthlyTarget, 0);
  const varPct =
    s.variableBudget > 0 ? Math.round((summary.variable / s.variableBudget) * 100) : 0;
  const varStatus = varPct >= 100 ? T.rose : varPct >= 80 ? T.amber : T.green;

  const addTxn = useCallback(
    (form) => {
      const p = sRef.current;
      const spentOn = (form.spentOn || "").trim();
      const amt = parseFloat(form.amount);
      if (!spentOn || !(amt > 0)) return;
      const txn = {
        ...form,
        id: uid(),
        // A missing date would make the txn invisible in every month view —
        // fall back to the 1st of the viewed month instead of saving "".
        date: form.date || `${activeYear}-${mNum(activeMonth)}-01`,
        spentOn,
        amount: amt,
        tags: form.tags || [],
        ccId: form.ccId || null,
        note: (form.note || "").trim(),
      };
      const newS = { ...p, transactions: [...(p.transactions || []), txn] };
      newS.activity = appendActivity(
        newS.activity,
        entry("txn_add", `Added "${spentOn}" · ${fmt(amt)}`)
      );
      setS(newS);
      saveNow(newS);
    },
    [saveNow, setS, activeYear, activeMonth, entry]
  );

  const delTxn = useCallback(
    (id) => {
      const t = (sRef.current.transactions || []).find((t) => t.id === id);
      if (!t) return;
      requestConfirm({
        title: "Delete transaction?",
        message: `"${t.spentOn || "this transaction"}" · ${fmt(t.amount)}${t.date ? ` · ${t.date}` : ""}`,
        confirmLabel: "Delete",
        onConfirm: () =>
          withUndo(`Deleted "${t.spentOn || "transaction"}"`, () => {
            const p = sRef.current;
            const newS = {
              ...p,
              transactions: (p.transactions || []).filter((x) => x.id !== id),
            };
            newS.activity = appendActivity(
              newS.activity,
              entry("txn_delete", `Deleted "${t.spentOn || "transaction"}" · ${fmt(t.amount)}`)
            );
            setS(newS);
            saveNow(newS);
          }),
      });
    },
    [requestConfirm, withUndo, entry, setS, saveNow]
  );

  const saveEditTxn = useCallback(
    (form) => {
      const p = sRef.current;
      const original = (p.transactions || []).find((t) => t.id === form.id);
      const updated = {
        ...form,
        // Never blank out the date on edit — keep the original if cleared.
        date: form.date || original?.date || `${activeYear}-${mNum(activeMonth)}-01`,
        spentOn: (form.spentOn || "").trim() || original?.spentOn || "",
        amount: parseFloat(form.amount) || 0,
        ccId: form.ccId || null,
        note: (form.note || "").trim(),
      };
      const newS = {
        ...p,
        transactions: (p.transactions || []).map((t) => (t.id === form.id ? updated : t)),
      };
      newS.activity = appendActivity(
        newS.activity,
        entry("txn_edit", `Edited "${updated.spentOn || "transaction"}" · ${fmt(updated.amount)}`)
      );
      setS(newS);
      setEditTxn(null);
      saveNow(newS);
    },
    [saveNow, setS, activeYear, activeMonth, entry]
  );

  // ─── Backup / restore ────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const ok = downloadFile(
      `narangi-transactions-${todayStamp()}.csv`,
      transactionsToCSV(sRef.current.transactions),
      "text/csv"
    );
    showToast(ok ? "Transactions exported as CSV" : "Export failed in this browser", false);
  }, [showToast]);

  const handleExportJSON = useCallback(() => {
    const ok = downloadFile(
      `narangi-backup-${todayStamp()}.json`,
      JSON.stringify(buildBackup(sRef.current, actor), null, 2),
      "application/json"
    );
    showToast(ok ? "Full backup downloaded" : "Export failed in this browser", false);
  }, [actor, showToast]);

  const handleRestoreFile = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = parseBackup(reader.result);
        if (!parsed.ok) {
          showToast(`Restore failed: ${parsed.error}`, false);
          return;
        }
        const data = mergeData(parsed.data);
        requestConfirm({
          title: "Restore backup?",
          message: `Replace ALL current shared data with this backup (${parsed.txnCount} transaction${parsed.txnCount === 1 ? "" : "s"}${parsed.exportedAt ? `, exported ${new Date(parsed.exportedAt).toLocaleString("en-IN")}` : ""})? You can undo this right after restoring.`,
          confirmLabel: "Restore",
          tone: "accent",
          onConfirm: () =>
            withUndo("Backup restored", () => {
              const newS = {
                ...data,
                activity: appendActivity(
                  data.activity,
                  entry("restore", `Restored backup (${parsed.txnCount} transactions)`)
                ),
              };
              setS(newS);
              saveNow(newS);
            }),
        });
      };
      reader.onerror = () => showToast("Restore failed: could not read file.", false);
      reader.readAsText(file);
    },
    [requestConfirm, withUndo, entry, setS, saveNow, showToast]
  );

  const annualData = useMemo(
    () =>
      getVisibleMonths(activeYear).map((m) => {
        const t = summarize(getTxns(m, activeYear));
        return {
          month: m,
          income: t.income,
          expenses: t.fixed + t.variable,
          savings: t.savings,
        };
      }),
    [getTxns, activeYear, members]
  );

  // FIX: only show FIXED + VARIABLE in spend breakdown (not CC payments or savings)
  const catBreakdown = useMemo(() => {
    const grp = {};
    monthTxns
      .filter((t) => t.category === "FIXED EXPENSES" || t.category === "VARIABLE EXPENSES")
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
            activeYear={activeYear}
            activeMonth={activeMonth}
            isMobile={isMobile}
            members={members}
            monthTxns={monthTxns}
            summary={summary}
            prevSummary={prevSummary}
            isFirstTrackedMonth={isFirstTrackedMonth}
            prevIdx={prevIdx}
            currentBalance={currentBalance}
            totalCCOwed={totalCCOwed}
            safeBalance={safeBalance}
            varPct={varPct}
            varStatus={varStatus}
            annualData={annualData}
            catBreakdown={catBreakdown}
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
            updNow={updNowLogged}
            requestConfirm={requestConfirm}
            withUndo={withUndo}
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
            updNow={updNowLogged}
            requestConfirm={requestConfirm}
            withUndo={withUndo}
            transactions={s.transactions || []}
            getTxns={getTxns}
            activeMonth={activeMonth}
            setActiveMonth={setActiveMonth}
            activeYear={activeYear}
            addTxn={addTxn}
            isMobile={isMobile}
          />
        )}
        {tab === "more" && (
          <MoreTab
            s={s}
            isMobile={isMobile}
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
            onRestoreFile={handleRestoreFile}
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
            // Guard: don't close/clear when the form is invalid (addTxn ignores it)
            if (!quickForm.spentOn?.trim() || !(parseFloat(quickForm.amount) > 0)) return;
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
      <ConfirmDialog confirmState={confirmState} onConfirm={fireConfirm} onCancel={closeConfirm} />
      <UndoToast toast={toast} onUndo={handleUndo} onDismiss={dismissToast} isMobile={isMobile} />
      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        s={s}
        onImport={(txns) => {
          if (!txns || !txns.length) return;
          withUndo(
            `Imported ${txns.length} transaction${txns.length === 1 ? "" : "s"}`,
            () => {
              const p = sRef.current;
              const newS = { ...p, transactions: [...(p.transactions || []), ...txns] };
              newS.activity = appendActivity(
                newS.activity,
                entry("import", `Imported ${txns.length} transactions from Excel`)
              );
              setS(newS);
              saveNow(newS);
            }
          );
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
