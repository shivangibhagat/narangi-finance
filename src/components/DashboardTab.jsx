import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { T, MONTHS, PIE_COLORS } from "../constants/theme";
import { fmt } from "../utils/format";
import { OUTFLOW_CATS } from "../utils/finance";
import { Card } from "./ui/primitives";

export function DashboardTab({
  s,
  activeYear,
  activeMonth,
  isMobile,
  members,
  monthTxns,
  summary,
  prevSummary,
  isFirstTrackedMonth,
  prevIdx,
  currentBalance,
  totalCCOwed = 0,
  safeBalance,
  varPct,
  varStatus,
  annualData,
  catBreakdown,
}) {
  const effectiveSafe = safeBalance ?? currentBalance;

  // 4 summary cards — no Opening card
  const cards = [
    { label: "Income",   val: summary.income,             prev: prevSummary.income,   color: T.accent, icon: "↑" },
    { label: "Fixed",    val: summary.fixed,              prev: prevSummary.fixed,    color: T.blue,   icon: "🔒" },
    { label: "Variable", val: summary.variable,           prev: prevSummary.variable, color: varStatus, icon: "📊" },
    { label: "Balance",  val: currentBalance,             color: currentBalance >= 0 ? T.green : T.rose, icon: "💰" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 14 }}>

      {/* Variable spend alert */}
      {summary.variable > 0 && (
        <div style={{
          background: varStatus + "15",
          border: `1px solid ${varStatus}44`,
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: varStatus, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: varStatus }}>
            Variable: {fmt(summary.variable)} / {fmt(s.variableBudget)} ({varPct}%)
            {varPct >= 100 ? " 🔴 Over!" : varPct >= 80 ? " ⚠️ Near limit" : " ✅ On track"}
          </span>
        </div>
      )}

      {/* 4 summary cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
        gap: isMobile ? 10 : 14,
      }}>
        {cards.map((k) => {
          const delta =
            !isFirstTrackedMonth && k.prev != null && k.prev > 0
              ? Math.round(((k.val - k.prev) / k.prev) * 100)
              : null;
          return (
            <Card key={k.label} style={{ padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {k.label}
                </span>
                <span style={{ fontSize: 12 }}>{k.icon}</span>
              </div>
              <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: k.color }}>
                {fmt(k.val)}
              </div>
              {delta != null && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: delta >= 0 ? T.green : T.rose,
                  background: (delta >= 0 ? T.green : T.rose) + "18",
                  borderRadius: 999, padding: "2px 6px", marginTop: 4, display: "inline-block",
                }}>
                  {delta >= 0 ? "↑" : "↓"}{Math.abs(delta)}% vs {prevIdx >= 0 ? MONTHS[prevIdx] : MONTHS[11]}
                </span>
              )}
            </Card>
          );
        })}
      </div>

      {/* Safe Balance after CC Bills */}
      {(s.creditCards || []).length > 0 && (() => {
        const isShortfall = effectiveSafe < 0;
        const statusClr = isShortfall ? T.rose : effectiveSafe < totalCCOwed * 0.2 ? T.amber : T.green;
        return (
          <div style={{
            padding: "16px",
            background: statusClr + "10",
            border: `1px solid ${statusClr}33`,
            borderRadius: 14,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>💳 After Paying CC Bills</div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: statusClr,
                background: statusClr + "18", padding: "3px 10px", borderRadius: 999,
              }}>
                {isShortfall ? "⚠️ Shortfall" : "✅ Covered"}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: 8, alignItems: "center" }}>
              {[
                { label: "Balance", val: currentBalance, color: T.blue },
                { label: "−", val: null },
                { label: "CC Owed",  val: totalCCOwed,   color: T.rose },
                { label: "=", val: null },
                { label: "Safe",    val: Math.abs(effectiveSafe), color: statusClr },
              ].map((cell, i) =>
                cell.val === null ? (
                  <div key={i} style={{ fontSize: 18, color: T.muted, textAlign: "center" }}>{cell.label}</div>
                ) : (
                  <div key={i} style={{
                    background: i === 4 ? statusClr + "18" : T.surface,
                    border: i === 4 ? `1px solid ${statusClr}44` : "none",
                    borderRadius: 10, padding: "10px 12px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{cell.label}</div>
                    <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: cell.color }}>{fmt(cell.val)}</div>
                  </div>
                )
              )}
            </div>
            {isShortfall && (
              <div style={{ fontSize: 12, color: T.rose, marginTop: 8 }}>
                ⚠️ Balance is {fmt(Math.abs(effectiveSafe))} short of covering all CC bills.
              </div>
            )}
          </div>
        );
      })()}

      {/* Annual Overview chart */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{activeYear} Annual Overview</div>
        <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
          <BarChart data={annualData} barSize={isMobile ? 8 : 12}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="month" stroke={T.muted} tick={{ fontSize: 9 }} />
            <YAxis stroke={T.muted} tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={28} />
            <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 12 }} />
            <Bar dataKey="income"   fill={T.accent} radius={[3,3,0,0]} name="Income" />
            <Bar dataKey="expenses" fill={T.amber}  radius={[3,3,0,0]} name="Expenses" />
            <Bar dataKey="savings"  fill={T.purple} radius={[3,3,0,0]} name="Savings" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Spend by Category */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Spend by Category — {activeMonth}</div>
        {catBreakdown.length === 0 ? (
          <div style={{ color: T.muted, textAlign: "center", padding: "24px 0" }}>No expense data yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {catBreakdown.map((c, i) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: PIE_COLORS[i % PIE_COLORS.length], marginLeft: 8, flexShrink: 0 }}>{fmt(c.value)}</span>
                  </div>
                  <div style={{ height: 4, background: T.border, borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (c.value / catBreakdown[0].value) * 100)}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 99 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Per-person cards — income vs spend, no opening balance */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(2,1fr)",
        gap: isMobile ? 10 : 14,
      }}>
        {members.map((m, i) => {
          const spent  = monthTxns.filter(t => t.person === m && OUTFLOW_CATS.includes(t.category)).reduce((a, t) => a + t.amount, 0);
          const earned = monthTxns.filter(t => t.person === m && t.category === "INCOME").reduce((a, t) => a + t.amount, 0);
          const net    = earned - spent;
          const clr    = [T.accent, T.purple][i % 2];
          return (
            <Card key={m}>
              <div style={{ fontWeight: 700, color: clr, fontSize: 15, marginBottom: 10 }}>{m}</div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 3 }}>
                Earned <span style={{ color: T.accent, fontWeight: 700 }}>{fmt(earned)}</span>
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>
                Spent <span style={{ color: T.rose, fontWeight: 700 }}>{fmt(spent)}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: net >= 0 ? T.green : T.rose }}>
                {fmt(net)}
              </div>
              <div style={{ marginTop: 8, height: 4, background: T.border, borderRadius: 99 }}>
                <div style={{
                  height: "100%",
                  width: earned > 0 ? `${Math.min(100, (spent / earned) * 100)}%` : "0%",
                  background: clr,
                  borderRadius: 99,
                }} />
              </div>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
