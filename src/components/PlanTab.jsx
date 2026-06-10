import { useState, useMemo } from "react";
import { T, PIE_COLORS } from "../constants/theme";
import { fmt, mNum, uid, confirmDel } from "../utils/format";
import { ActualBar, Card, Lbl, iSty } from "./ui/primitives";

export function PlanTab({s,upd,updNow,totalIncome,totalFixed,totalSavings,transactions,activeMonth,activeYear,isMobile,runningBalance=0,totalCCOwed=0}) {
  const [newIncome,setNewIncome]=useState({label:"",amount:""});
  const [newFixed,setNewFixed]=useState({label:"",budget:""});
  const [newVarCat,setNewVarCat]=useState("");
  const [newSaving,setNewSaving]=useState({label:"",monthlyTarget:"",goalTarget:""});
  const [newTag,setNewTag]=useState("");
  const [editId,setEditId]=useState(null);
  const [editVal,setEditVal]=useState({});
  const stopEdit=()=>{setEditId(null);setEditVal({});};
  const planBalance=totalIncome-totalFixed-s.variableBudget-totalSavings;
  const iSt={...iSty,fontSize:13,padding:"8px 10px"};

  const monthTxns=useMemo(()=>transactions.filter(t=>t.date.startsWith(`${activeYear}-${mNum(activeMonth)}`)),[transactions,activeMonth,activeYear]);
  const members = s.members || DEFAULTS.members;

  // Income: match by person — "NARR Salary" item → all INCOME txns where person===NARR.
  // Person is always set correctly; subCat is not reliable (users may have wrong values).
  const incomeByPerson = useMemo(() => {
    const m = {};
    members.forEach(mem => {
      m[mem] = monthTxns
        .filter(t => t.category === "INCOME" && t.person === mem)
        .reduce((a, t) => a + t.amount, 0);
    });
    return m;
  }, [monthTxns, members]);

  const getIncomePerson = (inc) =>
    members.find(m =>
      (inc.label  || "").toUpperCase().includes(m.toUpperCase()) ||
      (inc.subCat || "").toUpperCase().includes(m.toUpperCase())
    ) || null;

  // Fixed expenses: match by subCat OR label (both patterns exist in real data)
  const getFixedActual = (fe) => {
    const canon = (fe.subCat || "").trim().toUpperCase();
    const lbl   = (fe.label  || "").trim().toUpperCase();
    return monthTxns
      .filter(t => t.category === "FIXED EXPENSES")
      .filter(t => {
        const sc = (t.subCat || "").trim().toUpperCase();
        return (canon && sc === canon) || (lbl && sc === lbl);
      })
      .reduce((a, t) => a + t.amount, 0);
  };
  const fixedActuals = useMemo(
    () => Object.fromEntries((s.fixedExpenses || []).map(fe => [fe.id, getFixedActual(fe)])),
    [monthTxns, s.fixedExpenses]
  );
  const varActual = useMemo(() => monthTxns.filter(t => t.category === "VARIABLE EXPENSES").reduce((a, t) => a + t.amount, 0), [monthTxns]);
  const savingsProgress=useMemo(()=>{ const mp={}; monthTxns.filter(t=>t.category==="SAVINGS").forEach(t=>{mp[t.subCat]=(mp[t.subCat]||0)+t.amount;}); return mp; },[monthTxns]);
  const savingsProgressAll=useMemo(()=>{ const mp={}; transactions.filter(t=>t.category==="SAVINGS").forEach(t=>{mp[t.subCat]=(mp[t.subCat]||0)+t.amount;}); return mp; },[transactions]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Card style={{background:`linear-gradient(135deg,${T.card},#1e2a44)`}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>📊 Plan — {activeMonth} {activeYear}</div>
        <div style={{fontSize:11,color:T.muted,marginBottom:12}}>Budget targets vs this month's actuals</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:10}}>
          {[
            {label:"Income",val:totalIncome,color:T.accent},
            {label:"Fixed",val:totalFixed,color:T.blue},
            {label:"Variable",val:s.variableBudget,color:T.amber},
            {label:"Savings",val:totalSavings,color:T.purple},
            {label:"Remaining",val:planBalance,color:planBalance>=0?T.green:T.rose},
          ].map(k=>(
            <div key={k.label} style={{textAlign:"center",padding:"10px 12px",background:T.surface,borderRadius:10}}>
              <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
              <div style={{fontSize:16,fontWeight:800,color:k.color}}>{fmt(k.val)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Income */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,color:T.accent,marginBottom:12}}>💰 Income Sources</div>
        {(s.income||[]).map(inc=>(
          <div key={inc.id} style={{marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${T.border}`}}>
            {editId===inc.id?(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input value={editVal.label||""} onChange={e=>setEditVal(v=>({...v,label:e.target.value}))} style={{...iSt,flex:1}}/>
                <input type="number" value={editVal.amount||""} onChange={e=>setEditVal(v=>({...v,amount:+e.target.value}))} style={{...iSt,width:110,color:T.accent,fontWeight:700,textAlign:"right"}}/>
                <button onClick={()=>{updNow({income:(s.income||[]).map(i=>i.id===inc.id?{...i,...editVal}:i)});stopEdit();}} style={{background:T.accent,border:"none",color:T.bg,borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer"}}>✓</button>
                <button onClick={stopEdit} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"8px 12px",fontWeight:700,cursor:"pointer"}}>×</button>
              </div>
            ):(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:14}}>{inc.label}</span>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontWeight:700,color:T.accent}}>{fmt(inc.amount)}</span>
                    <button onClick={()=>{setEditId(inc.id);setEditVal({label:inc.label,amount:inc.amount});}} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:18,padding:"4px",WebkitTapHighlightColor:"transparent"}}>✏️</button>
                    <button onClick={()=>{if(confirmDel(inc.label)) updNow({income:(s.income||[]).filter(i=>i.id!==inc.id)});}} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:18,padding:"4px",WebkitTapHighlightColor:"transparent"}}>🗑</button>
                  </div>
                </div>
                <ActualBar budget={inc.amount} actual={(() => { const p = getIncomePerson(inc); return p ? (incomeByPerson[p] || 0) : 0; })()} color={T.accent}/>
              </>
            )}
          </div>
        ))}
        <div style={{display:"flex",gap:8}}>
          <input value={newIncome.label} onChange={e=>setNewIncome(v=>({...v,label:e.target.value}))} placeholder="Source name" style={{...iSt,flex:1}}/>
          <input type="number" value={newIncome.amount} onChange={e=>setNewIncome(v=>({...v,amount:e.target.value}))} placeholder="₹" style={{...iSt,width:90,textAlign:"right"}}/>
          <button onClick={()=>{if(!newIncome.label||!newIncome.amount)return;updNow({income:[...(s.income||[]),{id:uid(),label:newIncome.label,subCat:newIncome.label.trim().toUpperCase(),amount:+newIncome.amount}]});setNewIncome({label:"",amount:""}); }} style={{background:T.accent,border:"none",color:T.bg,borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>+ Add</button>
        </div>
      </Card>

      {/* Fixed Expenses */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,color:T.blue,marginBottom:12}}>🔒 Fixed Expenses <span style={{fontSize:11,color:T.muted,fontWeight:400}}>({activeMonth} actuals shown)</span></div>
        {(s.fixedExpenses||[]).map(fe=>(
          <div key={fe.id} style={{marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${T.border}`}}>
            {editId===fe.id?(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input value={editVal.label||""} onChange={e=>setEditVal(v=>({...v,label:e.target.value}))} style={{...iSt,flex:1}}/>
                <input type="number" value={editVal.budget||""} onChange={e=>setEditVal(v=>({...v,budget:+e.target.value}))} style={{...iSt,width:100,color:T.blue,fontWeight:700,textAlign:"right"}}/>
                <button onClick={()=>{updNow({fixedExpenses:(s.fixedExpenses||[]).map(f=>f.id===fe.id?{...f,...editVal}:f)});stopEdit();}} style={{background:T.accent,border:"none",color:T.bg,borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer"}}>✓</button>
                <button onClick={stopEdit} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"8px 12px",fontWeight:700,cursor:"pointer"}}>×</button>
              </div>
            ):(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:14}}>{fe.label}</span>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontWeight:700,color:T.blue}}>{fmt(fe.budget)}</span>
                    <button onClick={()=>{setEditId(fe.id);setEditVal({label:fe.label,budget:fe.budget});}} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:18,padding:"4px",WebkitTapHighlightColor:"transparent"}}>✏️</button>
                    <button onClick={()=>{if(confirmDel(fe.label)) updNow({fixedExpenses:(s.fixedExpenses||[]).filter(f=>f.id!==fe.id)});}} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:18,padding:"4px",WebkitTapHighlightColor:"transparent"}}>🗑</button>
                  </div>
                </div>
                <ActualBar budget={fe.budget} actual={fixedActuals[fe.id]||0} color={T.blue}/>
              </>
            )}
          </div>
        ))}
        <div style={{display:"flex",gap:8}}>
          <input value={newFixed.label} onChange={e=>setNewFixed(v=>({...v,label:e.target.value}))} placeholder="Expense name" style={{...iSt,flex:1}}/>
          <input type="number" value={newFixed.budget} onChange={e=>setNewFixed(v=>({...v,budget:e.target.value}))} placeholder="₹" style={{...iSt,width:90,textAlign:"right"}}/>
          <button onClick={()=>{if(!newFixed.label||!newFixed.budget)return;updNow({fixedExpenses:[...(s.fixedExpenses||[]),{id:uid(),label:newFixed.label,subCat:newFixed.label.trim().toUpperCase(),budget:+newFixed.budget}]});setNewFixed({label:"",budget:""});}} style={{background:T.blue,border:"none",color:T.bg,borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>+ Add</button>
        </div>
        <div style={{paddingTop:12,marginTop:8,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",fontWeight:800}}><span>Total Fixed Budget</span><span style={{color:T.blue}}>{fmt(totalFixed)}</span></div>
      </Card>

      {/* Variable */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,color:T.amber,marginBottom:12}}>📊 Variable Expenses</div>
        <div style={{marginBottom:14}}>
          <Lbl>Monthly Budget</Lbl>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:T.muted}}>₹</span>
            <input type="number" value={s.variableBudget} onChange={e=>upd({variableBudget:+e.target.value})} style={{...iSt,width:160,color:T.amber,fontWeight:800,fontSize:18,textAlign:"right"}}/>
          </div>
          <ActualBar budget={s.variableBudget} actual={varActual} color={T.amber}/>
        </div>
        <Lbl>Sub-Categories</Lbl>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
          {(s.variableSubCats||[]).map(cat=>(
            <div key={cat} style={{display:"flex",alignItems:"center",gap:4,background:T.amber+"18",border:`1px solid ${T.amber}44`,borderRadius:999,padding:"5px 12px 5px 14px"}}>
              <span style={{fontSize:13,color:T.amber,fontWeight:600}}>{cat}</span>
              <button onClick={()=>{if(confirmDel(cat)) updNow({variableSubCats:(s.variableSubCats||[]).filter(c=>c!==cat)});}} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:16,padding:0,lineHeight:1,marginLeft:4,WebkitTapHighlightColor:"transparent"}}>×</button>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={newVarCat} onChange={e=>setNewVarCat(e.target.value.toUpperCase())} placeholder="NEW CATEGORY" onKeyDown={e=>{if(e.key==="Enter"&&newVarCat.trim()&&!(s.variableSubCats||[]).includes(newVarCat.trim())){updNow({variableSubCats:[...(s.variableSubCats||[]),newVarCat.trim()]});setNewVarCat("");}}} style={{...iSt,flex:1}}/>
          {/* FIX: prevent duplicate sub-categories */}
          <button onClick={()=>{const v=newVarCat.trim();if(!v||(s.variableSubCats||[]).includes(v))return;updNow({variableSubCats:[...(s.variableSubCats||[]),v]});setNewVarCat("");}} style={{background:T.amber,border:"none",color:T.bg,borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>+ Add</button>
        </div>
      </Card>

      {/* Savings Goals */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,color:T.purple,marginBottom:12}}>🎯 Savings Goals</div>
        {(s.savings||[]).map((sv,i)=>{
          const contributed=savingsProgressAll[sv.label]||0;
          const monthContributed=savingsProgress[sv.label]||0;
          const pct=sv.goalTarget>0?Math.min(100,(contributed/sv.goalTarget)*100):0;
          const monthsLeft=sv.monthlyTarget>0&&sv.goalTarget>contributed?Math.ceil((sv.goalTarget-contributed)/sv.monthlyTarget):null;
          const clr=PIE_COLORS[i%PIE_COLORS.length];
          return(
            <div key={sv.id} style={{marginBottom:14,padding:14,background:T.surface,borderRadius:12,border:`1px solid ${T.border}`}}>
              {editId===sv.id?(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <input value={editVal.label||""} onChange={e=>setEditVal(v=>({...v,label:e.target.value}))} style={iSt}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <input type="number" value={editVal.monthlyTarget||""} onChange={e=>setEditVal(v=>({...v,monthlyTarget:+e.target.value}))} placeholder="Monthly ₹" style={iSt}/>
                    <input type="number" value={editVal.goalTarget||""} onChange={e=>setEditVal(v=>({...v,goalTarget:+e.target.value}))} placeholder="Goal ₹" style={iSt}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <button onClick={()=>{updNow({savings:(s.savings||[]).map(s2=>s2.id===sv.id?{...s2,...editVal}:s2)});stopEdit();}} style={{background:T.accent,border:"none",color:T.bg,borderRadius:8,padding:"10px",fontWeight:700,cursor:"pointer"}}>Save</button>
                    <button onClick={stopEdit} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"10px",fontWeight:700,cursor:"pointer"}}>Cancel</button>
                  </div>
                </div>
              ):(
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:clr}}>{sv.label}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:3}}>{fmt(contributed)} of {fmt(sv.goalTarget)}{contributed>=sv.goalTarget?<span style={{color:T.green}}> · 🎉 Goal reached!</span>:monthsLeft?<span style={{color:T.amber}}> · {monthsLeft}mo left</span>:null}</div>
                      {monthContributed>0&&<div style={{fontSize:10,color:T.muted,marginTop:2}}>This month: <span style={{color:clr,fontWeight:600}}>{fmt(monthContributed)}</span></div>}
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:16,fontWeight:800,color:clr}}>{pct.toFixed(0)}%</span>
                      <button onClick={()=>{setEditId(sv.id);setEditVal({label:sv.label,monthlyTarget:sv.monthlyTarget,goalTarget:sv.goalTarget});}} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:18,padding:"4px",WebkitTapHighlightColor:"transparent"}}>✏️</button>
                      <button onClick={()=>{if(confirmDel(sv.label)) updNow({savings:(s.savings||[]).filter(s2=>s2.id!==sv.id)});}} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:18,padding:"4px",WebkitTapHighlightColor:"transparent"}}>🗑</button>
                    </div>
                  </div>
                  <div style={{height:6,background:T.border,borderRadius:99,marginBottom:6}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${clr},${clr}99)`,borderRadius:99}}/></div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.muted}}>
                    <span>Monthly: <span style={{color:T.purple,fontWeight:600}}>{fmt(sv.monthlyTarget)}</span></span>
                    <span>Goal: <span style={{color:clr,fontWeight:600}}>{fmt(sv.goalTarget)}</span></span>
                  </div>
                </>
              )}
            </div>
          );
        })}
        <div style={{borderTop:`1px solid ${T.border}`,paddingTop:12}}>
          <Lbl>Add Savings Goal</Lbl>
          <input value={newSaving.label} onChange={e=>setNewSaving(v=>({...v,label:e.target.value}))} placeholder="Goal name" style={{...iSt,marginBottom:8}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input type="number" value={newSaving.monthlyTarget} onChange={e=>setNewSaving(v=>({...v,monthlyTarget:e.target.value}))} placeholder="Monthly ₹" style={iSt}/>
            <input type="number" value={newSaving.goalTarget} onChange={e=>setNewSaving(v=>({...v,goalTarget:e.target.value}))} placeholder="Total goal ₹" style={iSt}/>
          </div>
          <button onClick={()=>{if(!newSaving.label||!newSaving.monthlyTarget)return;updNow({savings:[...(s.savings||[]),{id:uid(),label:newSaving.label,monthlyTarget:+newSaving.monthlyTarget,goalTarget:+newSaving.goalTarget||0}]});setNewSaving({label:"",monthlyTarget:"",goalTarget:""});}} style={{background:T.purple,border:"none",color:T.bg,borderRadius:8,padding:"10px 20px",fontWeight:700,cursor:"pointer",fontSize:13,width:"100%"}}>+ Add Goal</button>
        </div>
      </Card>

      {/* Custom Tags */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>🏷️ Custom Tags</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
          {(s.customTags||[]).map(tag=>(
            <div key={tag} style={{display:"flex",alignItems:"center",gap:4,background:T.purple+"18",border:`1px solid ${T.purple}44`,borderRadius:999,padding:"5px 12px 5px 14px"}}>
              <span style={{fontSize:13,color:T.purple,fontWeight:600}}>{tag}</span>
              <button onClick={()=>{if(confirmDel(tag)) updNow({customTags:(s.customTags||[]).filter(t=>t!==tag)});}} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:16,padding:0,lineHeight:1,marginLeft:4,WebkitTapHighlightColor:"transparent"}}>×</button>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={newTag} onChange={e=>setNewTag(e.target.value.toLowerCase())} placeholder="new tag" style={{...iSt,flex:1}}/>
          {/* FIX: prevent duplicate tags */}
          <button onClick={()=>{const v=newTag.trim();if(!v||(s.customTags||[]).includes(v))return;updNow({customTags:[...(s.customTags||[]),v]});setNewTag("");}} style={{background:T.purple,border:"none",color:T.bg,borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>+ Add</button>
        </div>
      </Card>
    {/* ── Starting Balance Setup ── */}
    <Card style={{ border:`1px solid ${T.accent}22` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:14 }}>💰 Starting Balance</div>
          <div style={{ fontSize:12, color:T.muted, marginTop:3 }}>
            What was in your bank before you started tracking? Set this once.
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:"uppercase" }}>Running Balance</div>
          <div style={{ fontSize:18, fontWeight:800, color: runningBalance >= 0 ? T.green : T.rose }}>{fmt(runningBalance)}</div>
          {totalCCOwed > 0 && (
            <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>
              Safe: <span style={{ fontWeight:700, color: runningBalance - totalCCOwed >= 0 ? T.green : T.rose }}>{fmt(runningBalance - totalCCOwed)}</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:T.muted, fontWeight:700, marginBottom:6, textTransform:"uppercase" }}>Starting Balance ₹</div>
          <input
            type="number"
            inputMode="decimal"
            value={s.startingBalance || ""}
            onChange={e => upd({ startingBalance: +e.target.value || 0 })}
            placeholder="e.g. 75000"
            style={{ ...iSty, fontSize:15, fontWeight:700 }}
          />
        </div>
      </div>
      <div style={{ fontSize:11, color:T.muted, marginTop:10, padding:"8px 10px", background:T.surface, borderRadius:8 }}>
        💡 Enter the combined amount in all your bank accounts as of when you started using this app.
        All transactions you add after that build on this number automatically.
      </div>
    </Card>

    </div>
  );
}
