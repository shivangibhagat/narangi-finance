import { useState, useEffect, useMemo } from "react";
import { T, getVisibleMonths } from "../constants/theme";
import { DEFAULTS } from "../constants/defaults";
import { fmt, mNum, ccKey, uid, confirmDel } from "../utils/format";
import { computeCCBalance, ccPaymentMatchesCard } from "../utils/finance";
import { Badge, Btn, Card, TI, Sel, iSty } from "./ui/primitives";

export function CreditCardsTab({ s, upd, updNow, transactions, getTxns, activeMonth, setActiveMonth, activeYear, addTxn, isMobile }) {
  const [showAddCard, setShowAddCard] = useState(false);
  const members = s.members || DEFAULTS.members;
  const [newCard, setNewCard] = useState({ name: "", person: members[0], initialOutstanding: "", limit: "" });
  const [payForm, setPayForm] = useState({ ccId: null, amount: "", date: `${activeYear}-${mNum(activeMonth)}-01`, note: "" });
  const [editCardId, setEditCardId] = useState(null);
  const [editCardVal, setEditCardVal] = useState({});
  const iSt = { ...iSty, fontSize: 13, padding: "8px 10px" };

  useEffect(() => setPayForm(f => f.ccId ? { ...f, date: `${activeYear}-${mNum(activeMonth)}-01` } : f), [activeYear, activeMonth]);

  const ccStats = useMemo(() => (s.creditCards || []).map(cc => {
    const openingBalance = computeCCBalance(cc, activeYear, activeMonth, transactions, s.ccMonthlyCharges);
    const newCharges = (s.ccMonthlyCharges || {})[ccKey(cc.id, activeYear, activeMonth)] || 0;
    const monthPayments = getTxns(activeMonth, activeYear)
      .filter(t => ccPaymentMatchesCard(t, cc))
      .reduce((a, t) => a + t.amount, 0);
    const closingBalance = Math.max(0, openingBalance + newCharges - monthPayments);
    const totalPaid = transactions.filter(t => ccPaymentMatchesCard(t, cc)).reduce((a, t) => a + t.amount, 0);
    const totalCharges = Object.entries(s.ccMonthlyCharges || {}).filter(([k]) => k.startsWith(cc.id + "_")).reduce((a, [, v]) => a + v, 0);
    const recentPmts = transactions.filter(t => ccPaymentMatchesCard(t, cc)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    // Available credit = limit minus what you currently owe (current balance)
    const availableCredit = (cc.limit || 0) > 0 ? Math.max(0, cc.limit - closingBalance) : null;
    // Utilization % based on current balance
    const utilPct = cc.limit > 0 ? Math.min(100, Math.round((closingBalance / cc.limit) * 100)) : 0;

    return { ...cc, openingBalance, newCharges, monthPayments, closingBalance, totalPaid, totalCharges, currentBalance: closingBalance, recentPmts, availableCredit, utilPct };
  }), [s.creditCards, s.ccMonthlyCharges, transactions, activeMonth, activeYear, getTxns]);

  // ─── Total CC debt to pay across all cards ────────────────────────────────
  const totalCCDebt = ccStats.reduce((a, c) => a + c.currentBalance, 0);
  const totalCCLimit = ccStats.reduce((a, c) => a + (c.limit || 0), 0);
  const totalAvailable = ccStats.reduce((a, c) => a + (c.availableCredit || 0), 0);

  // ─── Per-person bank balance safety check ────────────────────────────────
  // For each person: income this month - cash expenses (fixed+variable) - CC payments already made
  // "Still owe on CC" = their card's current balance (not yet paid)
  // "Safe bank balance" = what they have after paying off remaining CC bill
  const perPersonSafety = useMemo(() => {
    return members.map((member, i) => {
      const memberCards = ccStats.filter(cc => cc.person === member);
      const memberIncome = transactions
        .filter(t => t.person === member && t.category === "INCOME" && t.date.startsWith(`${activeYear}-${mNum(activeMonth)}`))
        .reduce((a, t) => a + t.amount, 0);
      const memberCashSpend = transactions
        .filter(t => t.person === member && (t.category === "FIXED EXPENSES" || t.category === "VARIABLE EXPENSES") && t.date.startsWith(`${activeYear}-${mNum(activeMonth)}`))
        .reduce((a, t) => a + t.amount, 0);
      const memberCCPaid = transactions
        .filter(t => t.person === member && t.category === "CC PAYMENT" && t.date.startsWith(`${activeYear}-${mNum(activeMonth)}`))
        .reduce((a, t) => a + t.amount, 0);
      const memberCCOwed = memberCards.reduce((a, cc) => a + cc.currentBalance, 0);

      // Current bank: income this month - cash spends - CC payments already made
      const currentBank = memberIncome - memberCashSpend - memberCCPaid;
      // Safe balance: current bank minus what still needs to be paid to CC
      const safeBalance = currentBank - memberCCOwed;
      const clr = [T.accent, T.purple][i % 2];

      return { member, memberIncome, memberCashSpend, memberCCPaid, memberCCOwed, currentBank, safeBalance, clr };
    });
  }, [members, ccStats, transactions, activeYear, activeMonth]);

  const CC_COLORS = [T.accent, T.purple, T.blue, T.amber, T.green];

  const logPayment = ccId => {
    const amt = parseFloat(payForm.amount);
    if (!(amt > 0)) return;
    const cc = (s.creditCards || []).find(c => c.id === ccId);
    if (!cc) return;
    addTxn({ date: payForm.date, category: "CC PAYMENT", subCat: cc.name, spentOn: `CC Payment - ${cc.name}`, amount: amt, person: cc.person, note: payForm.note, tags: [], ccId });
    setPayForm(f => ({ ...f, ccId: null, amount: "", note: "" }));
  };

  const updateCharges = (ccId, value) => {
    const k = ccKey(ccId, activeYear, activeMonth);
    const charge = +value || 0;
    upd(p => ({ ccMonthlyCharges: { ...(p.ccMonthlyCharges || {}), [k]: charge } }));
  };

  const deleteCreditCard = ccId => {
    if (!confirmDel((s.creditCards || []).find(c => c.id === ccId)?.name || "this card")) return;
    const newCharges = Object.fromEntries(Object.entries(s.ccMonthlyCharges || {}).filter(([key]) => !key.startsWith(ccId + "_")));
    const newTxns = (transactions || []).map(t => t.ccId === ccId ? { ...t, ccId: null } : t);
    updNow({ creditCards: (s.creditCards || []).filter(c => c.id !== ccId), ccMonthlyCharges: newCharges, transactions: newTxns });
  };

  if ((s.creditCards || []).length === 0 && !showAddCard) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ textAlign: "center", padding: "48px 24px", color: T.muted }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No credit cards yet</div>
        <div style={{ fontSize: 13, marginBottom: 20 }}>Add your credit cards to track balances, limits and payments</div>
        <Btn onClick={() => setShowAddCard(true)}>+ Add Credit Card</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Top summary row ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
        {[
          { label: "Total CC Debt", val: totalCCDebt, color: T.rose, icon: "💳" },
          { label: "Available Credit", val: totalAvailable, color: T.green, icon: "✅" },
          { label: `Paid in ${activeMonth}`, val: ccStats.reduce((a, c) => a + c.monthPayments, 0), color: T.accent, icon: "✓" },
          { label: "Total Limit", val: totalCCLimit, color: T.muted, icon: "🏦" },
        ].map(k => (
          <Card key={k.label} style={{ padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 800, color: k.color }}>{fmt(k.val)}</div>
          </Card>
        ))}
      </div>

      {/* ── Safe Bank Balance panel ── */}
      <Card style={{ background: `linear-gradient(135deg, ${T.card}, #1a2840)`, border: `1px solid ${T.border}` }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🏦 Safe Bank Balance — {activeMonth} {activeYear}</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
          What's actually safe to spend after paying your CC bills in full
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : `repeat(${members.length}, 1fr)`, gap: 12, marginBottom: 14 }}>
          {perPersonSafety.map(p => (
            <div key={p.member} style={{ background: T.surface, borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: p.clr, marginBottom: 10 }}>{p.member}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "Income this month", val: p.memberIncome, color: T.accent, sign: "+" },
                  { label: "Cash expenses paid", val: p.memberCashSpend, color: T.amber, sign: "−" },
                  { label: "CC payments made", val: p.memberCCPaid, color: T.blue, sign: "−" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: T.muted }}>{row.label}</span>
                    <span style={{ fontWeight: 700, color: row.color }}>{row.sign} {fmt(row.val)}</span>
                  </div>
                ))}

                {/* Divider */}
                <div style={{ borderTop: `1px solid ${T.border}`, margin: "4px 0" }} />

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: T.text, fontWeight: 600 }}>Current bank est.</span>
                  <span style={{ fontWeight: 800, color: p.currentBank >= 0 ? T.green : T.rose }}>{fmt(p.currentBank)}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: T.muted }}>CC bill still owed</span>
                  <span style={{ fontWeight: 700, color: T.rose }}>− {fmt(p.memberCCOwed)}</span>
                </div>

                {/* Divider */}
                <div style={{ borderTop: `1px solid ${T.border}`, margin: "4px 0" }} />

                {/* Safe balance */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: (p.safeBalance >= 0 ? T.green : T.rose) + "18",
                  border: `1px solid ${(p.safeBalance >= 0 ? T.green : T.rose)}44`,
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: p.safeBalance >= 0 ? T.green : T.rose }}>
                    {p.safeBalance >= 0 ? "✅ Safe to spend" : "⚠️ Shortfall!"}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 15, color: p.safeBalance >= 0 ? T.green : T.rose }}>
                    {fmt(Math.abs(p.safeBalance))}
                  </span>
                </div>

                {p.safeBalance < 0 && (
                  <div style={{ fontSize: 11, color: T.amber, marginTop: 4 }}>
                    ⚠️ You'd need {fmt(Math.abs(p.safeBalance))} more to fully clear your CC bill this month.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Combined family view */}
        {members.length > 1 && (() => {
          const totalSafe = perPersonSafety.reduce((a, p) => a + p.safeBalance, 0);
          const totalCurrentBank = perPersonSafety.reduce((a, p) => a + p.currentBank, 0);
          return (
            <div style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: (totalSafe >= 0 ? T.green : T.rose) + "12",
              border: `1px solid ${(totalSafe >= 0 ? T.green : T.rose)}33`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>Combined — after paying all CC bills</div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  Current bank est. <span style={{ color: T.text, fontWeight: 700 }}>{fmt(totalCurrentBank)}</span>
                  {" · "}CC due <span style={{ color: T.rose, fontWeight: 700 }}>{fmt(totalCCDebt)}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>Safe balance</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: totalSafe >= 0 ? T.green : T.rose }}>{fmt(totalSafe)}</div>
              </div>
            </div>
          );
        })()}
      </Card>

      {/* ── Month picker ── */}
      <div style={{ display: "flex", gap: 5, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 2 }}>
        {getVisibleMonths(activeYear).map(m => {
          const has = transactions.filter(t => t.category === "CC PAYMENT" && t.date.startsWith(`${activeYear}-${mNum(m)}`)).length > 0;
          return (
            <button key={m} onClick={() => setActiveMonth(m)} style={{
              background: activeMonth === m ? T.rose : "transparent",
              color: activeMonth === m ? T.bg : has ? T.rose : T.muted,
              border: `1px solid ${activeMonth === m ? T.rose : has ? T.rose + "55" : T.border}`,
              borderRadius: 7, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent",
            }}>{m}</button>
          );
        })}
      </div>

      {/* ── Per-card detail ── */}
      {ccStats.map((cc, i) => {
        const clr = CC_COLORS[i % CC_COLORS.length];
        const utilClr = cc.utilPct >= 90 ? T.rose : cc.utilPct >= 70 ? T.amber : T.green;

        return (
          <Card key={cc.id}>
            {/* Card header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Credit Card</div>
                {editCardId === cc.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    <input value={editCardVal.name || ""} onChange={e => setEditCardVal(v => ({ ...v, name: e.target.value }))} style={{ ...iSt, fontSize: 15, fontWeight: 700 }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Starting Debt ₹</div>
                        <input type="number" value={editCardVal.initialOutstanding || ""} onChange={e => setEditCardVal(v => ({ ...v, initialOutstanding: +e.target.value }))} placeholder="0" style={iSt} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Credit Limit ₹</div>
                        <input type="number" value={editCardVal.limit || ""} onChange={e => setEditCardVal(v => ({ ...v, limit: +e.target.value }))} placeholder="0" style={iSt} />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, background: T.surface, borderRadius: 8, padding: "8px 12px" }}>
                      💡 Starting debt = what you owed when you first started tracking this card
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <button onClick={() => { updNow({ creditCards: (s.creditCards || []).map(c => c.id === cc.id ? { ...c, ...editCardVal } : c) }); setEditCardId(null); }} style={{ background: T.accent, border: "none", color: T.bg, borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer" }}>Save</button>
                      <button onClick={() => setEditCardId(null)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 18, fontWeight: 800, color: clr, marginTop: 4 }}>{cc.name}</div>
                )}
                <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge color={cc.person === members[0] ? T.accent : T.purple}>{cc.person}</Badge>
                  {cc.limit > 0 && (
                    <span style={{ fontSize: 11, color: T.muted }}>
                      Limit <span style={{ color: T.text, fontWeight: 600 }}>{fmt(cc.limit)}</span>
                    </span>
                  )}
                </div>
              </div>
              {editCardId !== cc.id && (
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => { setEditCardId(cc.id); setEditCardVal({ name: cc.name, initialOutstanding: cc.initialOutstanding || cc.outstanding || 0, limit: cc.limit }); }} style={{ background: "transparent", border: "none", color: T.blue, cursor: "pointer", fontSize: 20, padding: "4px", WebkitTapHighlightColor: "transparent" }}>✏️</button>
                  <button onClick={() => deleteCreditCard(cc.id)} style={{ background: "transparent", border: "none", color: T.rose, cursor: "pointer", fontSize: 20, padding: "4px", WebkitTapHighlightColor: "transparent" }}>🗑</button>
                </div>
              )}
            </div>

            {/* ── Limit & utilization bar ── */}
            {!(cc.limit > 0) ? (
              // No limit set — show a clear prompt
              <div
                onClick={() => { setEditCardId(cc.id); setEditCardVal({ name: cc.name, initialOutstanding: cc.initialOutstanding || 0, limit: "" }); }}
                style={{ marginBottom: 14, padding: "12px 14px", background: T.amber + "12", border: `1px dashed ${T.amber}55`, borderRadius: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.amber }}>Credit Limit not set</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Tap to set your card limit to track usage</div>
                </div>
                <span style={{ fontSize: 18, color: T.amber }}>→</span>
              </div>
            ) : (
              <div style={{ marginBottom: 14, padding: "12px 14px", background: T.surface, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Credit Limit Usage</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: utilClr }}>{cc.utilPct}% used</span>
                </div>
                <div style={{ height: 10, background: T.border, borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ height: "100%", width: `${cc.utilPct}%`, background: `linear-gradient(90deg, ${utilClr}, ${utilClr}cc)`, borderRadius: 99, transition: "width 0.4s" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Used",      val: cc.currentBalance,  color: utilClr },
                    { label: "Available", val: cc.availableCredit, color: T.green },
                    { label: "Limit",     val: cc.limit,           color: T.muted },
                  ].map(cell => (
                    <div key={cell.label} style={{ textAlign: "center", padding: "8px 6px", background: T.card, borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>{cell.label}</div>
                      <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 800, color: cell.color }}>{fmt(cell.val)}</div>
                    </div>
                  ))}
                </div>
                {cc.utilPct >= 90 && <div style={{ marginTop: 10, padding: "8px 12px", background: T.rose + "18", borderRadius: 8, fontSize: 12, color: T.rose, fontWeight: 600 }}>🚨 At {cc.utilPct}% utilization — try to keep under 30%.</div>}
                {cc.utilPct >= 70 && cc.utilPct < 90 && <div style={{ marginTop: 10, padding: "8px 12px", background: T.amber + "18", borderRadius: 8, fontSize: 12, color: T.amber, fontWeight: 600 }}>⚠️ Getting high — ideally keep under 30%.</div>}
              </div>
            )}

            {/* ── Monthly Statement ── */}
            <div style={{ background: T.surface, borderRadius: 12, padding: "14px", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: clr, marginBottom: 10 }}>📋 {activeMonth} {activeYear} Statement</div>
              {[
                { label: "Opening Balance", val: cc.openingBalance, color: T.muted, editable: false },
                { label: "+ New Charges", val: cc.newCharges, color: T.rose, editable: true },
                { label: "− Payments Made", val: cc.monthPayments, color: T.green, editable: false },
                { label: "Closing Balance", val: cc.closingBalance, color: cc.closingBalance === 0 ? T.green : T.amber, bold: true },
              ].map((row, ri) => (
                <div key={ri} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}22` }}>
                  <span style={{ fontSize: 13, color: T.muted }}>{row.label}</span>
                  {row.editable ? (
                    <input type="number" value={row.val || ""} onChange={e => updateCharges(cc.id, e.target.value)} placeholder="0" style={{ ...iSt, width: 130, textAlign: "right", color: T.rose, fontWeight: 700, padding: "5px 8px" }} />
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: row.bold ? 800 : 700, color: row.color }}>
                      {row.val === 0 ? "✅ Cleared" : fmt(row.val)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* ── Pay Bill button / form ── */}
            {payForm.ccId === cc.id ? (
              <div style={{ padding: 14, background: T.surface, borderRadius: 12, border: `1px solid ${clr}44`, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: clr, marginBottom: 10 }}>Log Payment — {activeMonth} {activeYear}</div>

                {/* Quick-pay: full bill suggestion */}
                {cc.closingBalance > 0 && (
                  <button
                    onClick={() => setPayForm(f => ({ ...f, amount: String(cc.closingBalance) }))}
                    style={{ width: "100%", padding: "10px", marginBottom: 10, background: T.green + "22", border: `1px solid ${T.green}44`, borderRadius: 8, color: T.green, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    Pay Full Bill — {fmt(cc.closingBalance)}
                  </button>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} style={iSt} />
                  <input type="number" inputMode="decimal" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount ₹" style={{ ...iSt, color: T.accent, fontWeight: 700 }} />
                </div>
                <input value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} placeholder="Note (e.g. May bill)" style={{ ...iSt, marginBottom: 10 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button onClick={() => logPayment(cc.id)} style={{ background: clr, border: "none", color: T.bg, borderRadius: 8, padding: "11px", fontWeight: 700, cursor: "pointer" }}>Submit Payment</button>
                  <button onClick={() => setPayForm(f => ({ ...f, ccId: null }))} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "11px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setPayForm(f => ({ ...f, ccId: cc.id, date: `${activeYear}-${mNum(activeMonth)}-01`, amount: "" }))}
                style={{ background: clr, border: "none", color: T.bg, borderRadius: 10, padding: "12px", fontWeight: 700, cursor: "pointer", fontSize: 14, width: "100%", marginBottom: 12, WebkitTapHighlightColor: "transparent" }}
              >
                + Log Payment for {activeMonth}
                {cc.closingBalance > 0 && <span style={{ opacity: 0.8, fontWeight: 400 }}> · Bill: {fmt(cc.closingBalance)}</span>}
              </button>
            )}

            {/* ── Recent payments ── */}
            {cc.recentPmts.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Recent Payments</div>
                {cc.recentPmts.map(t => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}22` }}>
                    <span style={{ fontSize: 12, color: T.muted }}>{t.date} — {t.note || "Payment"}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: clr }}>{fmt(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {/* ── Add new card ── */}
      {showAddCard ? (
        <Card style={{ border: `1px dashed ${T.accent}55` }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: T.accent, marginBottom: 14 }}>+ New Credit Card</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TI label="Card Name" value={newCard.name} onChange={v => setNewCard(c => ({ ...c, name: v }))} placeholder="e.g. HDFC Regalia" />
            <Sel label="Assigned To" value={newCard.person} onChange={v => setNewCard(c => ({ ...c, person: v }))} options={members} />
            <TI label="Current Debt ₹ (what you owe today)" type="number" value={newCard.initialOutstanding} onChange={v => setNewCard(c => ({ ...c, initialOutstanding: v }))} placeholder="0" />
            <TI label="Credit Limit ₹" type="number" value={newCard.limit} onChange={v => setNewCard(c => ({ ...c, limit: v }))} placeholder="0" />
            <div style={{ fontSize: 11, color: T.muted, padding: "8px 12px", background: T.surface, borderRadius: 8 }}>
              💡 Enter current debt once. Log new monthly charges and payments — the balance auto-calculates.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
              <button
                onClick={() => {
                  if (!newCard.name) return;
                  updNow({ creditCards: [...(s.creditCards || []), { id: uid(), name: newCard.name, person: newCard.person, initialOutstanding: +newCard.initialOutstanding || 0, limit: +newCard.limit || 0 }] });
                  setNewCard({ name: "", person: members[0], initialOutstanding: "", limit: "" });
                  setShowAddCard(false);
                }}
                style={{ background: T.accent, border: "none", color: T.bg, borderRadius: 10, padding: "12px", fontWeight: 700, cursor: "pointer" }}
              >Add Card</button>
              <button onClick={() => setShowAddCard(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 10, padding: "12px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setShowAddCard(true)}
          style={{ background: "transparent", border: `2px dashed ${T.border}`, borderRadius: 16, color: T.muted, fontSize: 15, fontWeight: 600, cursor: "pointer", padding: "24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, WebkitTapHighlightColor: "transparent" }}
        >
          <span style={{ fontSize: 24 }}>+</span> Add Credit Card
        </button>
      )}
    </div>
  );
}
