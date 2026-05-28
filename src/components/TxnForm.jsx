import { useEffect, useMemo } from "react";
import { CATS } from "../constants/theme";
import { DEFAULTS } from "../constants/defaults";
import { Btn, Lbl, Sel, TI } from "./ui/primitives";

// ─── Transaction Form ──────────────────────────────────────────────────────────
export function TxnForm({state,value,onChange,onSubmit,submitLabel="Add Transaction"}) {
  const members = state.members||DEFAULTS.members;
  const subCatMap = useMemo(()=>({
    INCOME: state.income.map(i=>i.label),
    "FIXED EXPENSES": state.fixedExpenses.map(f=>f.label),
    "VARIABLE EXPENSES": state.variableSubCats||[],
    SAVINGS: state.savings.map(s=>s.label),
    "CC PAYMENT": state.creditCards.map(c=>c.name),
  }),[state.income,state.fixedExpenses,state.variableSubCats,state.savings,state.creditCards]);

  const subCats = subCatMap[value.category]||[];

  // FIX: Use useEffect (not render-time call) to reset subCat when options change
  useEffect(()=>{
    if(subCats.length>0 && !subCats.includes(value.subCat)){
      const cc=value.category==="CC PAYMENT"?state.creditCards.find(c=>c.name===subCats[0]):null;
      onChange({...value,subCat:subCats[0],ccId:cc?.id??null});
    }
  },[subCats.join("|"),value.category,value.subCat,state.creditCards]);

  const upd = patch=>onChange({...value,...patch});

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <TI label="Date" type="date" value={value.date} onChange={v=>upd({date:v})} style={{}} min="2026-05-01"/>
        <Sel label="Person" value={value.person} onChange={v=>upd({person:v})} options={members}/>
      </div>
      <Sel label="Category" value={value.category} onChange={v=>{
        const subs=subCatMap[v]||[];
        const cc=v==="CC PAYMENT"?state.creditCards.find(c=>c.name===subs[0]):null;
        upd({category:v,subCat:subs[0]||"",ccId:cc?.id});
      }} options={CATS}/>
      {subCats.length>0&&(
        <Sel label="Sub-Category" value={subCats.includes(value.subCat)?value.subCat:subCats[0]} onChange={v=>{
          const cc=value.category==="CC PAYMENT"?state.creditCards.find(c=>c.name===v):null;
          upd({subCat:v,ccId:cc?.id});
        }} options={subCats}/>
      )}
      <TI label="Description" value={value.spentOn} onChange={v=>upd({spentOn:v})} placeholder="What was this for?"/>
      <TI label="Amount (₹)" type="number" value={String(value.amount||"")} onChange={v=>upd({amount:v})} placeholder="0"/>
      <TI label="Note (optional)" value={value.note||""} onChange={v=>upd({note:v})} placeholder="Any details..."/>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        <Lbl>Tags</Lbl>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {(state.customTags||[]).map(tag=>{
            const active=(value.tags||[]).includes(tag);
            return <button key={tag} onClick={()=>upd({tags:active?(value.tags||[]).filter(t=>t!==tag):[...(value.tags||[]),tag]})} style={{background:active?T.accent+"33":"transparent",color:active?T.accent:T.muted,border:`1px solid ${active?T.accent:T.border}`,borderRadius:999,padding:"6px 14px",fontSize:13,fontWeight:600,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>{tag}</button>;
          })}
        </div>
      </div>
      <Btn full onClick={onSubmit} style={{marginTop:4,padding:"14px"}}>{submitLabel}</Btn>
    </div>
  );
}
