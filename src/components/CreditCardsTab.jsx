import { useState, useEffect, useMemo } from "react";
import { T, getVisibleMonths } from "../constants/theme";
import { DEFAULTS } from "../constants/defaults";
import { fmt, mNum, ccKey, uid, confirmDel } from "../utils/format";
import { computeCCBalance, ccPaymentMatchesCard } from "../utils/finance";
import { Badge, Btn, Card, TI, Sel, iSty } from "./ui/primitives";

export function CreditCardsTab({s,upd,updNow,transactions,getTxns,activeMonth,setActiveMonth,activeYear,addTxn,isMobile}) {
  const [showAddCard,setShowAddCard]=useState(false);
  const members=s.members||DEFAULTS.members;
  const [newCard,setNewCard]=useState({name:"",person:members[0],initialOutstanding:"",limit:""});
  const [payForm,setPayForm]=useState({ccId:null,amount:"",date:`${activeYear}-${mNum(activeMonth)}-01`,note:""});
  const [editCardId,setEditCardId]=useState(null);
  const [editCardVal,setEditCardVal]=useState({});
  const iSt={...iSty,fontSize:13,padding:"8px 10px"};

  useEffect(()=>setPayForm(f=>f.ccId?{...f,date:`${activeYear}-${mNum(activeMonth)}-01`}:f),[activeYear,activeMonth]);

  const ccStats=useMemo(()=>(s.creditCards||[]).map(cc=>{
    const openingBalance=computeCCBalance(cc,activeYear,activeMonth,transactions,s.ccMonthlyCharges);
    const newCharges=(s.ccMonthlyCharges||{})[ccKey(cc.id,activeYear,activeMonth)]||0;
    const monthPayments=getTxns(activeMonth,activeYear)
      .filter(t=>ccPaymentMatchesCard(t,cc))
      .reduce((a,t)=>a+t.amount,0);
    const closingBalance=Math.max(0,openingBalance+newCharges-monthPayments);
    const totalPaid=transactions.filter(t=>ccPaymentMatchesCard(t,cc)).reduce((a,t)=>a+t.amount,0);
    const totalCharges=Object.entries(s.ccMonthlyCharges||{}).filter(([k])=>k.startsWith(cc.id+"_")).reduce((a,[,v])=>a+v,0);
    const recentPmts=transactions.filter(t=>ccPaymentMatchesCard(t,cc)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
    return {...cc,openingBalance,newCharges,monthPayments,closingBalance,totalPaid,totalCharges,currentBalance:closingBalance,recentPmts};
  }),[s.creditCards,s.ccMonthlyCharges,transactions,activeMonth,activeYear,getTxns]);

  const CC_COLORS=[T.accent,T.purple,T.blue,T.amber,T.green];

  const logPayment=ccId=>{
    const amt=parseFloat(payForm.amount);
    if(!(amt>0)) return;
    const cc=(s.creditCards||[]).find(c=>c.id===ccId);
    if(!cc) return;
    addTxn({date:payForm.date,category:"CC PAYMENT",subCat:cc.name,spentOn:`CC Payment - ${cc.name}`,amount:amt,person:cc.person,note:payForm.note,tags:[],ccId});
    setPayForm(f=>({...f,ccId:null,amount:"",note:""}));
  };

  const updateCharges=(ccId,value)=>{
    const k=ccKey(ccId,activeYear,activeMonth);
    const charge=+value||0;
    upd(p=>({ccMonthlyCharges:{...(p.ccMonthlyCharges||{}),[k]:charge}}));
  };

  const deleteCreditCard=(ccId)=>{
    if(!confirmDel((s.creditCards||[]).find(c=>c.id===ccId)?.name||"this card")) return;
    const newCharges=Object.fromEntries(
      Object.entries(s.ccMonthlyCharges||{}).filter(([key])=>!key.startsWith(ccId+"_"))
    );
    const newTxns=(transactions||[]).map(t=>t.ccId===ccId?{...t,ccId:null}:t);
    updNow({
      creditCards:(s.creditCards||[]).filter(c=>c.id!==ccId),
      ccMonthlyCharges:newCharges,
      transactions:newTxns,
    });
  };

  // Empty state
  if((s.creditCards||[]).length===0&&!showAddCard) return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{textAlign:"center",padding:"48px 24px",color:T.muted}}>
        <div style={{fontSize:40,marginBottom:12}}>ðŸ’³</div>
        <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>No credit cards yet</div>
        <div style={{fontSize:13,marginBottom:20}}>Add your credit cards to track balances and payments</div>
        <Btn onClick={()=>setShowAddCard(true)}>+ Add Credit Card</Btn>
      </div>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        {[
          {label:"Total Debt",val:ccStats.reduce((a,c)=>a+c.currentBalance,0),color:T.rose},
          {label:"Total Paid (All)",val:ccStats.reduce((a,c)=>a+c.totalPaid,0),color:T.accent},
          {label:`Paid in ${activeMonth}`,val:ccStats.reduce((a,c)=>a+c.monthPayments,0),color:T.purple},
        ].map(k=>(
          <Card key={k.label} style={{padding:"12px 10px",textAlign:"center"}}>
            <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
            <div style={{fontSize:isMobile?14:18,fontWeight:800,color:k.color}}>{fmt(k.val)}</div>
          </Card>
        ))}
      </div>

      <div style={{display:"flex",gap:5,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:2}}>
        {getVisibleMonths(activeYear).map(m=>{
          const has=transactions.filter(t=>t.category==="CC PAYMENT"&&t.date.startsWith(`${activeYear}-${mNum(m)}`)).length>0;
          return <button key={m} onClick={()=>setActiveMonth(m)} style={{background:activeMonth===m?T.rose:"transparent",color:activeMonth===m?T.bg:has?T.rose:T.muted,border:`1px solid ${activeMonth===m?T.rose:has?T.rose+"55":T.border}`,borderRadius:7,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",WebkitTapHighlightColor:"transparent"}}>{m}</button>;
        })}
      </div>

      {ccStats.map((cc,i)=>{
        const clr=CC_COLORS[i%CC_COLORS.length];
        const utilPct=cc.limit>0?Math.min(100,Math.round((cc.currentBalance/cc.limit)*100)):0;
        return(
          <Card key={cc.id}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Credit Card</div>
                {editCardId===cc.id?(
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
                    <input value={editCardVal.name||""} onChange={e=>setEditCardVal(v=>({...v,name:e.target.value}))} style={{...iSt,fontSize:15,fontWeight:700}}/>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <input type="number" value={editCardVal.initialOutstanding||""} onChange={e=>setEditCardVal(v=>({...v,initialOutstanding:+e.target.value}))} placeholder="Starting debt â‚¹" style={iSt}/>
                      <input type="number" value={editCardVal.limit||""} onChange={e=>setEditCardVal(v=>({...v,limit:+e.target.value}))} placeholder="Credit limit â‚¹" style={iSt}/>
                    </div>
                    <div style={{fontSize:11,color:T.muted,background:T.surface,borderRadius:8,padding:"8px 12px"}}>ðŸ’¡ Starting debt = what you owed when you first started tracking this card</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <button onClick={()=>{updNow({creditCards:(s.creditCards||[]).map(c=>c.id===cc.id?{...c,...editCardVal}:c)});setEditCardId(null);}} style={{background:T.accent,border:"none",color:T.bg,borderRadius:8,padding:"10px",fontWeight:700,cursor:"pointer"}}>Save</button>
                      <button onClick={()=>setEditCardId(null)} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"10px",fontWeight:700,cursor:"pointer"}}>Cancel</button>
                    </div>
                  </div>
                ):(
                  <div style={{fontSize:18,fontWeight:800,color:clr,marginTop:4}}>{cc.name}</div>
                )}
                <div style={{marginTop:6,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <Badge color={cc.person===members[0]?T.accent:T.purple}>{cc.person}</Badge>
                  {cc.limit>0&&<span style={{fontSize:11,color:T.muted}}>Limit {fmt(cc.limit)} Â· Used <span style={{color:utilPct>=90?T.rose:utilPct>=70?T.amber:T.green,fontWeight:700}}>{utilPct}%</span></span>}
                </div>
              </div>
              {editCardId!==cc.id&&(
                <div style={{display:"flex",gap:8,flexShrink:0}}>
                  <button onClick={()=>{setEditCardId(cc.id);setEditCardVal({name:cc.name,initialOutstanding:cc.initialOutstanding||cc.outstanding||0,limit:cc.limit});}} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:20,padding:"4px",WebkitTapHighlightColor:"transparent"}}>âœï¸</button>
                  <button onClick={()=>deleteCreditCard(cc.id)} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:20,padding:"4px",WebkitTapHighlightColor:"transparent"}}>ðŸ—‘</button>
                </div>
              )}
            </div>

            {/* Monthly Statement */}
            <div style={{background:T.surface,borderRadius:12,padding:"14px",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:clr,marginBottom:10}}>ðŸ“‹ {activeMonth} {activeYear} Statement</div>
              {[
                {label:"Opening Balance",val:cc.openingBalance,color:T.muted,editable:false},
                {label:"+ New Charges",val:cc.newCharges,color:T.rose,editable:true},
                {label:"âˆ’ Payments Made",val:cc.monthPayments,color:T.green,editable:false},
                {label:"Closing Balance",val:cc.closingBalance,color:cc.closingBalance===0?T.green:T.amber,bold:true},
              ].map((row,ri)=>(
                <div key={ri} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}22`}}>
                  <span style={{fontSize:13,color:T.muted}}>{row.label}</span>
                  {row.editable?(
                    <input type="number" value={row.val||""} onChange={e=>updateCharges(cc.id,e.target.value)} placeholder="0" style={{...iSt,width:130,textAlign:"right",color:T.rose,fontWeight:700,padding:"5px 8px"}}/>
                  ):(
                    <span style={{fontSize:14,fontWeight:row.bold?800:700,color:row.color}}>{row.val===0?"âœ… Cleared":fmt(row.val)}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Overall */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`,marginBottom:14}}>
              <span style={{fontSize:13,color:T.muted}}>Current Balance (Overall)</span>
              <span style={{fontSize:15,fontWeight:800,color:cc.currentBalance===0?T.green:T.amber}}>{cc.currentBalance===0?"âœ… Cleared":fmt(cc.currentBalance)}</span>
            </div>

            {cc.limit>0&&(
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:11,color:T.muted}}>Credit Utilization</span>
                  <span style={{fontSize:11,fontWeight:700,color:utilPct>=90?T.rose:utilPct>=70?T.amber:T.green}}>{utilPct}%</span>
                </div>
                <div style={{height:8,background:T.border,borderRadius:99}}><div style={{height:"100%",width:`${utilPct}%`,background:`linear-gradient(90deg,${T.green},${utilPct>70?T.amber:T.green},${utilPct>90?T.rose:T.green})`,borderRadius:99}}/></div>
              </div>
            )}

            {payForm.ccId===cc.id?(
              <div style={{padding:14,background:T.surface,borderRadius:12,border:`1px solid ${clr}44`,marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:13,color:clr,marginBottom:10}}>Log Payment â€” {activeMonth} {activeYear}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <input type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))} style={iSt}/>
                  <input type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} placeholder="Amount â‚¹" style={iSt}/>
                </div>
                <input value={payForm.note} onChange={e=>setPayForm(f=>({...f,note:e.target.value}))} placeholder="Note (e.g. May bill)" style={{...iSt,marginBottom:10}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <button onClick={()=>logPayment(cc.id)} style={{background:clr,border:"none",color:T.bg,borderRadius:8,padding:"11px",fontWeight:700,cursor:"pointer"}}>Submit Payment</button>
                  <button onClick={()=>setPayForm(f=>({...f,ccId:null}))} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"11px",fontWeight:700,cursor:"pointer"}}>Cancel</button>
                </div>
              </div>
            ):(
              <button onClick={()=>setPayForm(f=>({...f,ccId:cc.id,date:`${activeYear}-${mNum(activeMonth)}-01`,amount:""}))} style={{background:clr,border:"none",color:T.bg,borderRadius:10,padding:"12px",fontWeight:700,cursor:"pointer",fontSize:14,width:"100%",marginBottom:12,WebkitTapHighlightColor:"transparent"}}>+ Log Payment for {activeMonth}</button>
            )}

            {cc.recentPmts.length>0&&(
              <div>
                <div style={{fontSize:11,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Recent Payments</div>
                {cc.recentPmts.map(t=>(
                  <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${T.border}22`}}>
                    <span style={{fontSize:12,color:T.muted}}>{t.date} â€” {t.note||"Payment"}</span>
                    <span style={{fontSize:12,fontWeight:700,color:clr}}>{fmt(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {showAddCard?(
        <Card style={{border:`1px dashed ${T.accent}55`}}>
          <div style={{fontWeight:700,fontSize:14,color:T.accent,marginBottom:14}}>+ New Credit Card</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <TI label="Card Name" value={newCard.name} onChange={v=>setNewCard(c=>({...c,name:v}))} placeholder="e.g. HDFC Regalia"/>
            <Sel label="Assigned To" value={newCard.person} onChange={v=>setNewCard(c=>({...c,person:v}))} options={members}/>
            <TI label="Current Debt â‚¹ (what you owe today)" type="number" value={newCard.initialOutstanding} onChange={v=>setNewCard(c=>({...c,initialOutstanding:v}))} placeholder="0"/>
            <TI label="Credit Limit â‚¹" type="number" value={newCard.limit} onChange={v=>setNewCard(c=>({...c,limit:v}))} placeholder="0"/>
            <div style={{fontSize:11,color:T.muted,padding:"8px 12px",background:T.surface,borderRadius:8}}>ðŸ’¡ Enter your current debt once. Then log new monthly charges and payments â€” the balance auto-calculates.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
              <button onClick={()=>{if(!newCard.name)return;updNow({creditCards:[...(s.creditCards||[]),{id:uid(),name:newCard.name,person:newCard.person,initialOutstanding:+newCard.initialOutstanding||0,limit:+newCard.limit||0}]});setNewCard({name:"",person:members[0],initialOutstanding:"",limit:""});setShowAddCard(false);}} style={{background:T.accent,border:"none",color:T.bg,borderRadius:10,padding:"12px",fontWeight:700,cursor:"pointer"}}>Add Card</button>
              <button onClick={()=>setShowAddCard(false)} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:10,padding:"12px",fontWeight:700,cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </Card>
      ):(
        <button onClick={()=>setShowAddCard(true)} style={{background:"transparent",border:`2px dashed ${T.border}`,borderRadius:16,color:T.muted,fontSize:15,fontWeight:600,cursor:"pointer",padding:"24px",display:"flex",alignItems:"center",justifyContent:"center",gap:10,WebkitTapHighlightColor:"transparent"}}>
          <span style={{fontSize:24}}>+</span> Add Credit Card
        </button>
      )}
    </div>
  );
}
