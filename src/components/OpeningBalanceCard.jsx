import { useState, useEffect } from "react";
import { T, MONTHS } from "../constants/theme";
import { DEFAULTS } from "../constants/defaults";
import { fmt, mNum, monthKey } from "../utils/format";
import { sumOutflows } from "../utils/finance";
import { Btn, Card, iSty } from "./ui/primitives";

export function OpeningBalanceCard({state,upd,activeYear,activeMonth}) {
  const members = state.members||DEFAULTS.members;
  const key=monthKey(activeYear,activeMonth);
  const bal=state.openingBalances?.[key]||{note:""};
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState({});
  useEffect(()=>{ setDraft(state.openingBalances?.[key]||{note:""}); setEditing(false); },[key]);

  // Suggest carry-forward from previous month's computed closing
  const prevMi=MONTHS.indexOf(activeMonth)-1;
  const prevM=prevMi>=0?MONTHS[prevMi]:"Dec";
  const prevY=prevMi>=0?activeYear:activeYear-1;
  const prevKey=monthKey(prevY,prevM);
  const prevBal=state.openingBalances?.[prevKey]||{};
  const prevOb=members.reduce((a,m)=>a+(prevBal[m]||0),0);
  const prevTxns=(state.transactions||[]).filter(t=>t.date.startsWith(`${prevY}-${mNum(prevM)}`));
  const prevIn=prevTxns.filter(t=>t.category==="INCOME").reduce((a,t)=>a+t.amount,0);
  const prevOut=sumOutflows(prevTxns);
  const prevClosing=prevOb+prevIn-prevOut;

  const combined=members.reduce((a,m)=>a+(bal[m]||0),0);

  // FIX: save uses dynamic member keys, not hardcoded NARR/SHIVU
  const save=()=>{
    const newBal={note:draft.note||""};
    members.forEach(m=>{ newBal[m]=+draft[m]||0; });
    upd({openingBalances:{...state.openingBalances,[key]:newBal}});
    setEditing(false);
  };

  // FIX: single upd call for carry-forward
  const carryForward=()=>{
    const perMember=members.length>0?Math.round(prevClosing/members.length):0;
    const newBal={note:`Carried from ${prevM} ${prevY}`};
    members.forEach(m=>{ newBal[m]=perMember; });
    upd({openingBalances:{...state.openingBalances,[key]:newBal}});
  };

  return(
    <Card style={{border:`1px solid ${T.accent}33`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:T.accent}}>🏦 Opening Bank Balance</div>
          <div style={{fontSize:11,color:T.muted}}>{activeMonth} {activeYear} · Start of month</div>
        </div>
        {!editing&&(
          <div style={{display:"flex",gap:8}}>
            {prevClosing>0&&!combined&&(
              <Btn small variant="outline" color={T.green} onClick={carryForward}>↑ Carry {fmt(prevClosing)}</Btn>
            )}
            <Btn small variant="outline" color={T.accent} onClick={()=>{setDraft(bal);setEditing(true);}}>Edit</Btn>
          </div>
        )}
      </div>
      {editing?(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {members.map((m,i)=>(
            <div key={m} style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:13,fontWeight:700,color:[T.accent,T.purple][i%2],width:60,flexShrink:0}}>{m}</span>
              <input type="number" value={draft[m]||""} onChange={e=>setDraft(d=>({...d,[m]:e.target.value}))} placeholder="0" style={{...iSty,flex:1,fontSize:16,fontWeight:700}}/>
            </div>
          ))}
          <input value={draft.note||""} onChange={e=>setDraft(d=>({...d,note:e.target.value}))} placeholder="Note (e.g. SHIVU salary expected 8th)" style={iSty}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <Btn full onClick={save}>Save</Btn>
            <Btn full variant="outline" color={T.muted} onClick={()=>setEditing(false)}>Cancel</Btn>
          </div>
        </div>
      ):(
        <>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${members.length+1},1fr)`,gap:10}}>
            {members.map((m,i)=>(
              <div key={m} style={{padding:"10px 12px",background:T.surface,borderRadius:10,border:`1px solid ${[T.accent,T.purple][i%2]}33`}}>
                <div style={{fontSize:10,color:[T.accent,T.purple][i%2],fontWeight:700,marginBottom:4}}>{m}</div>
                <div style={{fontSize:17,fontWeight:800}}>{fmt(bal[m]||0)}</div>
              </div>
            ))}
            <div style={{padding:"10px 12px",background:T.surface,borderRadius:10,border:`1px solid ${T.green}33`}}>
              <div style={{fontSize:10,color:T.green,fontWeight:700,marginBottom:4}}>TOTAL</div>
              <div style={{fontSize:17,fontWeight:800,color:T.green}}>{fmt(combined)}</div>
            </div>
          </div>
          {bal.note&&<div style={{fontSize:11,color:T.muted,marginTop:8,fontStyle:"italic"}}>📝 {bal.note}</div>}
        </>
      )}
    </Card>
  );
}
