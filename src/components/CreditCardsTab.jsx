import { useState, useMemo } from "react";
import { T } from "../constants/theme";
import { DEFAULTS } from "../constants/defaults";
import { fmt, uid, confirmDel } from "../utils/format";
import { ccPaymentMatchesCard } from "../utils/finance";
import { Badge, Btn, Card, TI, Sel, iSty } from "./ui/primitives";

export function CreditCardsTab({ s, upd, updNow, transactions, getTxns, activeMonth, setActiveMonth, activeYear, addTxn, isMobile, runningBalance = 0, totalCCOwed: externalCCOwed }) {
  const [showAdd, setShowAdd]   = useState(false);
  const [editId, setEditId]     = useState(null);
  const [editVal, setEditVal]   = useState({});
  const [payId,  setPayId]      = useState(null);
  const [payAmt, setPayAmt]     = useState("");
  const [payDate,setPayDate]    = useState(`${activeYear}-05-01`);
  const [payNote,setPayNote]    = useState("");
  const [newCard,setNewCard]    = useState({ name:"", person:(s.members||DEFAULTS.members)[0], balance:"", limit:"" });

  const members = s.members || DEFAULTS.members;

  // ── Simple per-card stats: balance stored on card + payments this month ─────
  const ccStats = useMemo(() => (s.creditCards || []).map(cc => {
    const balance    = cc.balance || 0;
    const paid       = getTxns(activeMonth, activeYear)
      .filter(t => ccPaymentMatchesCard(t, cc))
      .reduce((a, t) => a + t.amount, 0);
    // Expenses specifically charged to this card this month
    const charged    = getTxns(activeMonth, activeYear)
      .filter(t => ["FIXED EXPENSES","VARIABLE EXPENSES"].includes(t.category) && t.paidByCCId === cc.id)
      .reduce((a, t) => a + t.amount, 0);
    const cashback   = cc.cashbackRate > 0 ? Math.round(charged * cc.cashbackRate / 100) : 0;
    const utilPct    = cc.limit > 0 ? Math.min(100, Math.round((balance / cc.limit) * 100)) : 0;
    const available  = cc.limit > 0 ? Math.max(0, cc.limit - balance) : null;
    const utilClr    = utilPct >= 90 ? T.rose : utilPct >= 70 ? T.amber : T.green;
    const recentPmts = transactions
      .filter(t => ccPaymentMatchesCard(t, cc))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4);
    return { ...cc, balance, paid, charged, cashback, utilPct, available, utilClr, recentPmts };
  }), [s.creditCards, transactions, activeMonth, activeYear, getTxns]);

  const totOwed  = ccStats.reduce((a, c) => a + c.balance, 0);
  const totAvail = ccStats.reduce((a, c) => a + (c.available || 0), 0);
  const totLimit = ccStats.reduce((a, c) => a + (c.limit || 0), 0);
  const totPaid  = ccStats.reduce((a, c) => a + c.paid, 0);

  const logPayment = () => {
    const amt = parseFloat(payAmt);
    if (!(amt > 0) || !payId) return;
    const cc = (s.creditCards || []).find(c => c.id === payId);
    if (!cc) return;
    // Add payment transaction
    addTxn({ date: payDate, category: "CC PAYMENT", subCat: cc.name, spentOn: `CC Payment – ${cc.name}`, amount: amt, person: cc.person, note: payNote, tags: [], ccId: payId });
    // Reduce card balance
    updNow({ creditCards: (s.creditCards || []).map(c => c.id === payId ? { ...c, balance: Math.max(0, (c.balance || 0) - amt) } : c) });
    setPayId(null); setPayAmt(""); setPayNote("");
  };

  const saveEdit = () => {
    updNow({ creditCards: (s.creditCards || []).map(c => c.id === editId ? { ...c, ...editVal, balance: +editVal.balance || 0, limit: +editVal.limit || 0 } : c) });
    setEditId(null);
  };

  const deleteCard = ccId => {
    if (!confirmDel((s.creditCards || []).find(c => c.id === ccId)?.name || "this card")) return;
    updNow({ creditCards: (s.creditCards || []).filter(c => c.id !== ccId) });
  };

  const CC_COLORS = [T.accent, T.purple, T.blue, T.amber];

  if ((s.creditCards || []).length === 0 && !showAdd) return (
    <div style={{ textAlign:"center", padding:"60px 24px", color:T.muted }}>
      <div style={{ fontSize:40, marginBottom:12 }}>💳</div>
      <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>No credit cards yet</div>
      <div style={{ fontSize:13, marginBottom:24 }}>Add your cards to track balances and payments</div>
      <Btn onClick={() => setShowAdd(true)}>+ Add Credit Card</Btn>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* ── Running bank balance ── */}
      {(() => {
        const safe    = runningBalance - totOwed;
        const safeClr = safe >= 0 ? T.green : T.rose;
        return (
          <div style={{
            padding:"16px",
            background: safeClr + "10",
            border:`1px solid ${safeClr}30`,
            borderRadius:14,
          }}>
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:12 }}>
              {[
                { label:"Bank Balance",    val:runningBalance,   color: runningBalance >= 0 ? T.accent : T.rose, hint:"All-time running" },
                { label:"CC Bills Owed",   val:totOwed,          color:T.rose,   hint:"Outstanding" },
                { label:"Safe to Spend",   val:Math.abs(safe),   color:safeClr,  hint: safe < 0 ? "⚠️ Shortfall" : "✅ After bills" },
                { label:"Paid This Month", val:totPaid,          color:T.accent, hint:`${activeMonth}` },
              ].map(k => (
                <div key={k.label} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:9, color:T.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:3 }}>{k.label}</div>
                  <div style={{ fontSize:isMobile ? 14 : 18, fontWeight:800, color:k.color }}>{fmt(k.val)}</div>
                  <div style={{ fontSize:9, color:T.muted, marginTop:2 }}>{k.hint}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Available credit across cards ── */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap:10 }}>
        {[
          { label:"Total Limit",     val:totLimit, color:T.muted },
          { label:"Total Used",      val:totOwed,  color:T.rose  },
          { label:"Available Credit",val:totAvail, color:T.green },
        ].map(k => (
          <Card key={k.label} style={{ padding:"12px 10px", textAlign:"center" }}>
            <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:isMobile ? 14 : 16, fontWeight:800, color:k.color }}>{fmt(k.val)}</div>
          </Card>
        ))}
      </div>

      {/* ── Per-card ── */}
      {ccStats.map((cc, i) => {
        const clr = CC_COLORS[i % CC_COLORS.length];
        const isEditing = editId === cc.id;
        const isPaying  = payId  === cc.id;

        return (
          <Card key={cc.id}>
            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:clr }}>{cc.name}</div>
                <div style={{ display:"flex", gap:8, marginTop:6, alignItems:"center", flexWrap:"wrap" }}>
                  <Badge color={cc.person === members[0] ? T.accent : T.purple}>{cc.person}</Badge>
                  {cc.limit > 0 && <span style={{ fontSize:11, color:T.muted }}>Limit <span style={{ color:T.text, fontWeight:600 }}>{fmt(cc.limit)}</span></span>}
                </div>
              </div>
              {!isEditing && (
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => { setEditId(cc.id); setEditVal({ name:cc.name, balance:cc.balance||0, limit:cc.limit||0, cashbackRate:cc.cashbackRate||"" }); }} style={{ background:"transparent", border:"none", color:T.blue, cursor:"pointer", fontSize:20, WebkitTapHighlightColor:"transparent" }}>✏️</button>
                  <button onClick={() => deleteCard(cc.id)} style={{ background:"transparent", border:"none", color:T.rose, cursor:"pointer", fontSize:20, WebkitTapHighlightColor:"transparent" }}>🗑</button>
                </div>
              )}
            </div>

            {/* Edit form */}
            {isEditing && (
              <div style={{ background:T.surface, borderRadius:12, padding:14, marginBottom:14 }}>
                <div style={{ fontWeight:700, fontSize:13, color:clr, marginBottom:10 }}>Edit Card</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <TI label="Card Name" value={editVal.name||""} onChange={v => setEditVal(e=>({...e,name:v}))} />
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <TI label="Current Balance ₹" type="number" value={String(editVal.balance||"")} onChange={v => setEditVal(e=>({...e,balance:v}))} placeholder="0" />
                    <TI label="Credit Limit ₹"    type="number" value={String(editVal.limit||"")}   onChange={v => setEditVal(e=>({...e,limit:v}))}   placeholder="0" />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <TI label="Cashback Rate %" type="number" value={String(editVal.cashbackRate||"")} onChange={v => setEditVal(e=>({...e,cashbackRate:v}))} placeholder="e.g. 1.5" />
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:"uppercase" }}>Est. Cashback</div>
                      <div style={{ fontSize:14, fontWeight:800, color:T.green, paddingTop:8 }}>
                        {editVal.cashbackRate > 0 ? `~${(editVal.cashbackRate||0)}% per ₹100` : "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:T.muted, background:T.card, borderRadius:8, padding:"8px 12px" }}>
                    💡 Update balance whenever you get your CC statement
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <button onClick={saveEdit} style={{ background:clr, border:"none", color:T.bg, borderRadius:8, padding:10, fontWeight:700, cursor:"pointer" }}>Save</button>
                    <button onClick={() => setEditId(null)} style={{ background:"transparent", border:`1px solid ${T.border}`, color:T.muted, borderRadius:8, padding:10, fontWeight:700, cursor:"pointer" }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* Balance + Limit bar */}
            {!isEditing && (
              <>
                {/* Cashback earned this month */}
                {(cc.charged > 0 || cc.cashbackRate > 0) && (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:T.green+"10", border:`1px solid ${T.green}25`, borderRadius:10, marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:11, color:T.muted, fontWeight:700, textTransform:"uppercase" }}>CC Charged This Month</div>
                      <div style={{ fontSize:16, fontWeight:800, color:T.text }}>{fmt(cc.charged)}</div>
                    </div>
                    {cc.cashbackRate > 0 && (
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:11, color:T.muted, fontWeight:700, textTransform:"uppercase" }}>Est. Cashback</div>
                        <div style={{ fontSize:16, fontWeight:800, color:T.green }}>+{fmt(cc.cashback)}</div>
                        <div style={{ fontSize:10, color:T.muted }}>{cc.cashbackRate}%</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Big balance display */}
                <div style={{ background:T.surface, borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: cc.limit > 0 ? 12 : 0 }}>
                    <div>
                      <div style={{ fontSize:11, color:T.muted, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Outstanding Balance</div>
                      <div style={{ fontSize:24, fontWeight:800, color: cc.balance > 0 ? T.rose : T.green }}>
                        {fmt(cc.balance)}
                      </div>
                    </div>
                    {cc.paid > 0 && (
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Paid this month</div>
                        <div style={{ fontSize:18, fontWeight:800, color:T.accent }}>✓ {fmt(cc.paid)}</div>
                      </div>
                    )}
                  </div>

                  {cc.limit > 0 && (
                    <>
                      <div style={{ height:8, background:T.border, borderRadius:99, overflow:"hidden", marginBottom:10 }}>
                        <div style={{ height:"100%", width:`${cc.utilPct}%`, background:`linear-gradient(90deg,${cc.utilClr},${cc.utilClr}cc)`, borderRadius:99, transition:"width 0.4s" }} />
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                        {[
                          { label:"Used",      val:cc.balance,   color:cc.utilClr },
                          { label:"Available", val:cc.available, color:T.green    },
                          { label:"Limit",     val:cc.limit,     color:T.muted    },
                        ].map(cell => (
                          <div key={cell.label} style={{ textAlign:"center", padding:"8px 6px", background:T.card, borderRadius:8 }}>
                            <div style={{ fontSize:9, color:T.muted, fontWeight:700, textTransform:"uppercase", marginBottom:3 }}>{cell.label}</div>
                            <div style={{ fontSize:isMobile ? 11 : 13, fontWeight:800, color:cell.color }}>{fmt(cell.val)}</div>
                          </div>
                        ))}
                      </div>
                      {cc.utilPct >= 90 && <div style={{ marginTop:10, padding:"8px 12px", background:T.rose+"18", borderRadius:8, fontSize:12, color:T.rose, fontWeight:600 }}>🚨 {cc.utilPct}% utilization — keep under 30% for healthy credit score.</div>}
                      {cc.utilPct >= 70 && cc.utilPct < 90 && <div style={{ marginTop:10, padding:"8px 12px", background:T.amber+"18", borderRadius:8, fontSize:12, color:T.amber, fontWeight:600 }}>⚠️ Getting high — ideally keep under 30%.</div>}
                    </>
                  )}

                  {!cc.limit && (
                    <button onClick={() => { setEditId(cc.id); setEditVal({ name:cc.name, balance:cc.balance||0, limit:"", cashbackRate:cc.cashbackRate||"" }); }} style={{ marginTop:10, width:"100%", padding:"8px", background:T.amber+"12", border:`1px dashed ${T.amber}55`, borderRadius:8, color:T.amber, fontWeight:600, fontSize:12, cursor:"pointer" }}>
                      + Set credit limit to track utilization →
                    </button>
                  )}
                </div>

                {/* Pay bill */}
                {isPaying ? (
                  <div style={{ background:T.surface, borderRadius:12, padding:14, marginBottom:12 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:clr, marginBottom:10 }}>Log Payment</div>
                    {cc.balance > 0 && (
                      <button onClick={() => setPayAmt(String(cc.balance))} style={{ width:"100%", padding:"10px", marginBottom:10, background:T.green+"22", border:`1px solid ${T.green}44`, borderRadius:8, color:T.green, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                        Pay Full Balance — {fmt(cc.balance)}
                      </button>
                    )}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                      <input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} style={{...iSty, fontSize:13}} />
                      <input type="number" inputMode="decimal" value={payAmt} onChange={e=>setPayAmt(e.target.value)} placeholder="Amount ₹" style={{...iSty, color:T.accent, fontWeight:700}} />
                    </div>
                    <input value={payNote} onChange={e=>setPayNote(e.target.value)} placeholder="Note (optional)" style={{...iSty, marginBottom:10}} />
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                      <button onClick={logPayment} style={{ background:clr, border:"none", color:T.bg, borderRadius:8, padding:11, fontWeight:700, cursor:"pointer" }}>Submit</button>
                      <button onClick={() => setPayId(null)} style={{ background:"transparent", border:`1px solid ${T.border}`, color:T.muted, borderRadius:8, padding:11, fontWeight:700, cursor:"pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setPayId(cc.id); setPayDate(`${activeYear}-${String(new Date().getMonth()+1).padStart(2,"0")}-${String(new Date().getDate()).padStart(2,"0")}`); setPayAmt(""); }} style={{ width:"100%", padding:12, background:clr, border:"none", color:T.bg, borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:12, WebkitTapHighlightColor:"transparent" }}>
                    💸 Log Payment{cc.balance > 0 ? ` · Bill ${fmt(cc.balance)}` : ""}
                  </button>
                )}

                {/* Recent payments */}
                {cc.recentPmts.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, color:T.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Recent Payments</div>
                    {cc.recentPmts.map(t => (
                      <div key={t.id} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${T.border}22` }}>
                        <span style={{ fontSize:12, color:T.muted }}>{t.date} — {t.note || "Payment"}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:clr }}>{fmt(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        );
      })}

      {/* ── Add card ── */}
      {showAdd ? (
        <Card style={{ border:`1px dashed ${T.accent}55` }}>
          <div style={{ fontWeight:700, fontSize:14, color:T.accent, marginBottom:14 }}>+ New Credit Card</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <TI label="Card Name" value={newCard.name} onChange={v=>setNewCard(c=>({...c,name:v}))} placeholder="e.g. HDFC Regalia" />
            <Sel label="Assigned To" value={newCard.person} onChange={v=>setNewCard(c=>({...c,person:v}))} options={members} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <TI label="Current Balance ₹" type="number" value={newCard.balance} onChange={v=>setNewCard(c=>({...c,balance:v}))} placeholder="0" />
              <TI label="Credit Limit ₹"    type="number" value={newCard.limit}   onChange={v=>setNewCard(c=>({...c,limit:v}))}   placeholder="0" />
            </div>
            <TI label="Cashback Rate % (optional)" type="number" value={newCard.cashbackRate||""} onChange={v=>setNewCard(c=>({...c,cashbackRate:v}))} placeholder="e.g. 1.5" />
            <div style={{ fontSize:11, color:T.muted, padding:"8px 12px", background:T.surface, borderRadius:8 }}>
              💡 Enter what you currently owe. Update it anytime from your statement.
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:4 }}>
              <button onClick={() => { if (!newCard.name) return; updNow({ creditCards:[...(s.creditCards||[]),{id:uid(),name:newCard.name,person:newCard.person,balance:+newCard.balance||0,limit:+newCard.limit||0,cashbackRate:+newCard.cashbackRate||0}] }); setNewCard({name:"",person:members[0],balance:"",limit:"",cashbackRate:""}); setShowAdd(false); }} style={{ background:T.accent, border:"none", color:T.bg, borderRadius:10, padding:12, fontWeight:700, cursor:"pointer" }}>Add Card</button>
              <button onClick={()=>setShowAdd(false)} style={{ background:"transparent", border:`1px solid ${T.border}`, color:T.muted, borderRadius:10, padding:12, fontWeight:700, cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={()=>setShowAdd(true)} style={{ background:"transparent", border:`2px dashed ${T.border}`, borderRadius:16, color:T.muted, fontSize:15, fontWeight:600, cursor:"pointer", padding:24, display:"flex", alignItems:"center", justifyContent:"center", gap:10, WebkitTapHighlightColor:"transparent" }}>
          <span style={{ fontSize:24 }}>+</span> Add Credit Card
        </button>
      )}
    </div>
  );
}
