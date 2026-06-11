import { useState, useEffect, useMemo } from "react";
import { T, CATS, CAT_CLR, CAT_ICON } from "../constants/theme";
import { DEFAULTS } from "../constants/defaults";
import { fmt, mNum } from "../utils/format";
import { Badge, Btn, Card, iSty, Modal } from "./ui/primitives";
import { TxnForm } from "./TxnForm";

export function TransactionsTab({ s, addTxn, delTxn, editTxn, setEditTxn, saveEditTxn, activeMonth, setActiveMonth, activeYear, getTxns, summarize, isMobile, onOpenImport }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: `${activeYear}-${mNum(activeMonth)}-01`,
    category: "VARIABLE EXPENSES",
    subCat: (s.variableSubCats || [])[0] || "",
    spentOn: "",
    amount: "",
    person: (s.members || DEFAULTS.members)[0],
    note: "",
    tags: [],
    paidByCC: true,      // default CC since most expenses go on card
    paidByCCId: null,
  });
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  // BUG FIX: added "person" filter to allow per-person view
  const [personFilter, setPersonFilter] = useState("ALL");
  const [addedToast, setAddedToast] = useState(null);

  useEffect(() => setForm(f => ({ ...f, date: `${activeYear}-${mNum(activeMonth)}-01` })), [activeYear, activeMonth]);

  const monthTxns = getTxns(activeMonth, activeYear);
  const summary = summarize(monthTxns);
  const members = s.members || DEFAULTS.members;

  const filtered = useMemo(() => monthTxns.filter(t => {
    if (filter !== "ALL" && t.category !== filter) return false;
    if (personFilter !== "ALL" && t.person !== personFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${t.spentOn} ${t.subCat} ${t.person} ${t.note || ""} ${(t.tags || []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date)), [monthTxns, filter, personFilter, search]);

  // Group by date for mobile view
  const groupedByDate = useMemo(() => {
    const groups = {};
    filtered.forEach(t => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const handleAdd = () => {
    addTxn(form);
    setAddedToast(form.spentOn || "Transaction");
    setForm(f => ({ ...f, spentOn: "", amount: "", note: "", tags: [] }));
    if (isMobile) setShowForm(false);
    setTimeout(() => setAddedToast(null), 2500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Income",       val: summary.income,                       color: T.accent },
          { label: "Expenses",     val: summary.fixed + summary.variable,     color: T.rose   },
          { label: "Transactions", val: monthTxns.length, color: T.muted, raw: true },
        ].map(k => (
          <Card key={k.label} style={{ padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.raw ? k.val : fmt(k.val)}</div>
          </Card>
        ))}
      </div>

      {/* Mobile: Add + Import buttons */}
      {isMobile && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Btn full onClick={() => setShowForm(true)} style={{ padding: "13px", fontSize: 14 }}>➕ Add</Btn>
          <Btn full variant="outline" color={T.purple} onClick={onOpenImport} style={{ padding: "13px", fontSize: 14 }}>📥 Import</Btn>
        </div>
      )}

      {/* Desktop: Import button + inline form */}
      {!isMobile && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="outline" color={T.purple} onClick={onOpenImport}>📥 Import from Excel</Btn>
        </div>
      )}
      {!isMobile && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>➕ Add Transaction</div>
          <TxnForm state={s} value={form} onChange={setForm} onSubmit={handleAdd} />
        </Card>
      )}

      {/* Search + filters */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Search description, category, tags…"
        style={{ ...iSty, fontSize: 13, padding: "10px 14px" }}
      />

      {/* Category filter chips */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 2 }}>
        {["ALL", ...CATS].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? (CAT_CLR[f] || T.accent) + "33" : "transparent",
              color: filter === f ? (CAT_CLR[f] || T.accent) : T.muted,
              border: `1px solid ${filter === f ? (CAT_CLR[f] || T.accent) + "66" : T.border}`,
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {f === "ALL" ? "All" : f.replace(" EXPENSES", "").replace("CC PAYMENT", "CC")}
          </button>
        ))}
      </div>

      {/* Person filter */}
      <div style={{ display: "flex", gap: 6 }}>
        {["ALL", ...members].map((m, i) => {
          const clr = i === 0 ? T.muted : i === 1 ? T.accent : T.purple;
          const active = personFilter === m;
          return (
            <button
              key={m}
              onClick={() => setPersonFilter(m)}
              style={{
                padding: "5px 14px",
                borderRadius: 999,
                border: `1px solid ${active ? clr : T.border}`,
                background: active ? clr + "22" : "transparent",
                color: active ? clr : T.muted,
                fontWeight: 700,
                fontSize: 11,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {m}
            </button>
          );
        })}
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted, alignSelf: "center" }}>
          {filtered.length} txns · {fmt(filtered.reduce((a, t) => t.category === "INCOME" ? a : a + t.amount, 0))}
        </span>
      </div>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: T.muted, padding: "48px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          No transactions found
        </div>
      ) : isMobile ? (
        // Mobile: grouped by date
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groupedByDate.map(([date, txns]) => (
            <div key={date}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
                paddingLeft: 4,
              }}>
                {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {txns.map(t => {
                  const catClr = CAT_CLR[t.category] || T.muted;
                  const personClr = t.person === members[0] ? T.accent : T.purple;
                  return (
                    <div
                      key={t.id}
                      style={{
                        background: T.card,
                        border: `1px solid ${T.border}`,
                        borderRadius: 14,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        borderLeft: `3px solid ${catClr}`,
                      }}
                    >
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: catClr + "18",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        flexShrink: 0,
                      }}>
                        {CAT_ICON[t.category] || "📌"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.spentOn}
                        </div>
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ color: catClr, fontWeight: 600 }}>{t.subCat}</span>
                          <span>·</span>
                          <span style={{ color: personClr, fontWeight: 600 }}>{t.person}</span>
                          {t.paidByCCId && (() => {
                            const card = (s.creditCards || []).find(c => c.id === t.paidByCCId);
                            return card ? <><span>·</span><span style={{ color: T.muted }}>💳 {card.name}</span></> : null;
                          })()}
                          {t.note && <><span>·</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>{t.note}</span></>}
                        </div>
                        {(t.tags || []).length > 0 && (
                          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                            {(t.tags || []).map(tag => (
                              <span key={tag} style={{ fontSize: 10, background: T.accent + "22", color: T.accent, borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: t.category === "INCOME" ? T.accent : T.text }}>
                          {t.category === "INCOME" ? "+" : ""}{fmt(t.amount)}
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                          <button
                            onClick={() => setEditTxn({ ...t, amount: String(t.amount) })}
                            style={{ background: "transparent", border: "none", color: T.blue, cursor: "pointer", fontSize: 16, padding: "4px", WebkitTapHighlightColor: "transparent" }}
                          >✏️</button>
                          <button
                            onClick={() => delTxn(t.id)}
                            style={{ background: "transparent", border: "none", color: T.rose, cursor: "pointer", fontSize: 16, padding: "4px", WebkitTapHighlightColor: "transparent" }}
                          >🗑</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Desktop: table view
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(t => {
            const catClr = CAT_CLR[t.category] || T.muted;
            return (
              <div key={t.id} style={{ background: T.surface, borderRadius: 10, padding: "10px 14px", display: "grid", gridTemplateColumns: "80px 1fr 150px 110px 70px 60px", gap: 10, alignItems: "center", borderLeft: `2px solid ${catClr}` }}>
                <span style={{ color: T.muted, fontSize: 12 }}>{t.date.slice(5)}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.spentOn}</div>
                  {(t.note || (t.tags || []).length > 0) && <div style={{ fontSize: 11, color: T.muted }}>{t.note}{t.note && (t.tags || []).length > 0 ? " · " : ""}{(t.tags || []).join(", ")}</div>}
                </div>
                <Badge color={catClr}>{t.subCat}</Badge>
                <span style={{ fontWeight: 700, color: t.category === "INCOME" ? T.accent : T.text, textAlign: "right" }}>{fmt(t.amount)}</span>
                <Badge color={t.person === (s.members || [])[0] ? T.accent : T.purple} small>{t.person}</Badge>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditTxn({ ...t, amount: String(t.amount) })} style={{ background: "transparent", border: "none", color: T.blue, cursor: "pointer", fontSize: 16, padding: "2px" }}>✏️</button>
                  <button onClick={() => delTxn(t.id)} style={{ background: "transparent", border: "none", color: T.rose, cursor: "pointer", fontSize: 16, padding: "2px" }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile: Add modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="➕ Add Transaction">
        <TxnForm
          state={s}
          value={form}
          onChange={setForm}
          onSubmit={handleAdd}
        />
      </Modal>

      {/* Toast notification */}
      {addedToast && (
        <div style={{
          position: "fixed",
          bottom: isMobile ? 86 : 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: T.accent,
          color: T.bg,
          padding: "10px 20px",
          borderRadius: 999,
          fontWeight: 700,
          fontSize: 13,
          zIndex: 9999,
          whiteSpace: "nowrap",
          boxShadow: `0 4px 20px ${T.accent}66`,
        }}>
          ✅ Added: {addedToast}
        </div>
      )}
    </div>
  );
}
