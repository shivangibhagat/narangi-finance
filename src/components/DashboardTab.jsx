import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { T, MONTHS, PIE_COLORS } from "../constants/theme";
import { fmt } from "../utils/format";
import { OUTFLOW_CATS } from "../utils/finance";
import { Card } from "./ui/primitives";
import { OpeningBalanceCard } from "./OpeningBalanceCard";

export function DashboardTab({
  s,
  updNow,
  activeYear,
  activeMonth,
  isMobile,
  members,
  monthTxns,
  summary,
  prevSummary,
  isFirstTrackedMonth,
  prevIdx,
  openingTotal,
  currentBalance,
  varPct,
  varStatus,
  annualData,
  catBreakdown,
  ob,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 14 }}>
      <OpeningBalanceCard
        state={s}
        upd={updNow}
        activeYear={activeYear}
        activeMonth={activeMonth}
      />
      {summary.variable > 0 && (
        <div
          style={{
            background: varStatus + "15",
            border: `1px solid ${varStatus}44`,
            borderRadius: 12,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: varStatus,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: varStatus }}>
            Variable: {fmt(summary.variable)} / {fmt(s.variableBudget)} ({varPct}%)
            {varPct >= 100 ? " 🔴 Over!" : varPct >= 80 ? " ⚠️ Near limit" : " ✅ On track"}
          </span>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)",
          gap: isMobile ? 10 : 14,
        }}
      >
        {[
          { label: "Opening", val: openingTotal, color: T.blue, icon: "🏦" },
          { label: "Income", val: summary.income, prev: prevSummary.income, color: T.accent, icon: "↑" },
          { label: "Fixed", val: summary.fixed, prev: prevSummary.fixed, color: T.blue, icon: "🔒" },
          { label: "Variable", val: summary.variable, prev: prevSummary.variable, color: varStatus, icon: "📊" },
          {
            label: "Balance",
            val: currentBalance,
            color: currentBalance >= 0 ? T.green : T.rose,
            icon: "💰",
          },
        ].map((k, i) => {
          const delta =
            !isFirstTrackedMonth && k.prev != null && k.prev > 0
              ? Math.round(((k.val - k.prev) / k.prev) * 100)
              : null;
          return (
            <Card
              key={k.label}
              style={{ padding: "14px", gridColumn: isMobile && i === 4 ? "span 2" : "auto" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    color: T.muted,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {k.label}
                </span>
                <span style={{ fontSize: 12 }}>{k.icon}</span>
              </div>
              <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: k.color }}>
                {fmt(k.val)}
              </div>
              {delta != null && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: delta >= 0 ? T.green : T.rose,
                    background: (delta >= 0 ? T.green : T.rose) + "18",
                    borderRadius: 999,
                    padding: "2px 6px",
                    marginTop: 4,
                    display: "inline-block",
                  }}
                >
                  {delta >= 0 ? "↑" : "↓"}
                  {Math.abs(delta)}% vs {prevIdx >= 0 ? MONTHS[prevIdx] : MONTHS[11]}
                </span>
              )}
            </Card>
          );
        })}
      </div>
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          {activeYear} Annual Overview
        </div>
        <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
          <BarChart data={annualData} barSize={isMobile ? 8 : 12}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="month" stroke={T.muted} tick={{ fontSize: 9 }} />
            <YAxis
              stroke={T.muted}
              tick={{ fontSize: 9 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              width={28}
            />
            <Tooltip
              formatter={(v) => fmt(v)}
              contentStyle={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                color: T.text,
                fontSize: 12,
              }}
            />
            <Bar dataKey="opening" fill={T.blue} radius={[3, 3, 0, 0]} name="Opening" />
            <Bar dataKey="income" fill={T.accent} radius={[3, 3, 0, 0]} name="Income" />
            <Bar dataKey="expenses" fill={T.amber} radius={[3, 3, 0, 0]} name="Expenses" />
            <Bar dataKey="savings" fill={T.purple} radius={[3, 3, 0, 0]} name="Savings" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          Spend by Category — {activeMonth}
        </div>
        {catBreakdown.length === 0 ? (
          <div style={{ color: T.muted, textAlign: "center", padding: "24px 0" }}>
            No expense data yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {catBreakdown.map((c, i) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: PIE_COLORS[i % PIE_COLORS.length],
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.name}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: PIE_COLORS[i % PIE_COLORS.length],
                        marginLeft: 8,
                        flexShrink: 0,
                      }}
                    >
                      {fmt(c.value)}
                    </span>
                  </div>
                  <div style={{ height: 4, background: T.border, borderRadius: 99 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, (c.value / catBreakdown[0].value) * 100)}%`,
                        background: PIE_COLORS[i % PIE_COLORS.length],
                        borderRadius: 99,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(2,1fr)",
          gap: isMobile ? 10 : 14,
        }}
      >
        {members.map((m, i) => {
          const spent = monthTxns
            .filter((t) => t.person === m && OUTFLOW_CATS.includes(t.category))
            .reduce((a, t) => a + t.amount, 0);
          const earned = monthTxns
            .filter((t) => t.person === m && t.category === "INCOME")
            .reduce((a, t) => a + t.amount, 0);
          const personOb = ob[m] || 0;
          const clr = [T.accent, T.purple][i % 2];
          return (
            <Card key={m}>
              <div style={{ fontWeight: 700, color: clr, fontSize: 15, marginBottom: 10 }}>
                {m}
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 3 }}>
                Opening{" "}
                <span style={{ color: T.blue, fontWeight: 700 }}>{fmt(personOb)}</span>
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 3 }}>
                Earned{" "}
                <span style={{ color: T.accent, fontWeight: 700 }}>{fmt(earned)}</span>
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>
                Spent <span style={{ color: T.rose, fontWeight: 700 }}>{fmt(spent)}</span>
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: personOb + earned - spent >= 0 ? T.green : T.rose,
                }}
              >
                {fmt(personOb + earned - spent)}
              </div>
              <div style={{ marginTop: 8, height: 4, background: T.border, borderRadius: 99 }}>
                <div
                  style={{
                    height: "100%",
                    width:
                      personOb + earned > 0
                        ? `${Math.min(100, (spent / (personOb + earned)) * 100)}%`
                        : "0%",
                    background: clr,
                    borderRadius: 99,
                  }}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
