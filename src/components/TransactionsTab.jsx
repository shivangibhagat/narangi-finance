import { useState, useEffect } from "react";
import { T, CATS, CAT_CLR, CAT_ICON } from "../constants/theme";
import { DEFAULTS } from "../constants/defaults";
import { fmt, mNum } from "../utils/format";
import { Badge, Btn, Card, iSty, Modal } from "./ui/primitives";
import { TxnForm } from "./TxnForm";

export function TransactionsTab({s,addTxn,delTxn,editTxn,setEditTxn,saveEditTxn,activeMonth,setActiveMonth,activeYear,getTxns,summarize,isMobile,onOpenImport}) {
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({date:`${activeYear}-${mNum(activeMonth)}-01`,category:"VARIABLE EXPENSES",subCat:(s.variableSubCats||[])[0]||"",spentOn:"",amount:"",person:(s.members||DEFAULTS.members)[0],note:"",tags:[]});
  const [filter,setFilter]=useState("ALL");
  const [search,setSearch]=useState("");

  useEffect(()=>setForm(f=>({...f,date:`${activeYear}-${mNum(activeMonth)}-01`})),[activeYear,activeMonth]);

  const monthTxns=getTxns(activeMonth,activeYear);
  const summary=summarize(monthTxns);
  // FIX: search includes notes and tags
  const filtered=monthTxns.filter(t=>{
    if(filter!=="ALL"&&t.category!==filter) return false;
    if(search){
      const q=search.toLowerCase();
      const hay=`${t.spentOn} ${t.subCat} ${t.person} ${t.note||""} ${(t.tags||[]).join(" ")}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        {[
          {label:"Income",val:summary.income,color:T.accent},
          {label:"Expenses",val:summary.fixed+summary.variable,color:T.rose},
          {label:"Transactions",val:monthTxns.length,color:T.muted,raw:true},
        ].map(k=>(
          <Card key={k.label} style={{padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
            <div style={{fontSize:16,fontWeight:800,color:k.color}}>{k.raw?k.val:fmt(k.val)}</div>
          </Card>
        ))}
      </div>

      {/* On mobile: two equal buttons side by side */}
      {isMobile&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Btn full onClick={()=>setShowForm(true)} style={{padding:"12px",fontSize:13}}>âž• Add</Btn>
          <Btn full variant="outline" color={T.purple} onClick={onOpenImport} style={{padding:"12px",fontSize:13}}>ðŸ“¥ Import</Btn>
        </div>
      )}
      {/* On desktop: import button sits above the form card */}
      {!isMobile&&(
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <Btn variant="outline" color={T.purple} onClick={onOpenImport} style={{marginBottom:4}}>ðŸ“¥ Import from Excel</Btn>
        </div>
      )}
      {!isMobile&&(
        <Card>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>âž• Add Transaction</div>
          <TxnForm state={s} value={form} onChange={setForm} onSubmit={()=>{addTxn(form);setForm(f=>({...f,spentOn:"",amount:"",note:"",tags:[]}));}}/>
        </Card>
      )}

      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ðŸ” Search description, category, note, tagsâ€¦" style={{...iSty,flex:1,minWidth:180,fontSize:13,padding:"9px 12px"}}/>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:2}}>
        {["ALL",...CATS].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?(CAT_CLR[f]||T.accent)+"33":"transparent",color:filter===f?(CAT_CLR[f]||T.accent):T.muted,border:`1px solid ${filter===f?(CAT_CLR[f]||T.accent)+"66":T.border}`,borderRadius:8,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",WebkitTapHighlightColor:"transparent"}}>{f==="ALL"?"All":f.replace(" EXPENSES","")}</button>
        ))}
      </div>

      {filtered.length===0?(
        <div style={{textAlign:"center",color:T.muted,padding:"48px 0"}}>No transactions yet</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(t=>{
            const catClr=CAT_CLR[t.category]||T.muted;
            return isMobile?(
              <div key={t.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:10,background:catClr+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{CAT_ICON[t.category]||"ðŸ“Œ"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.spentOn}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>{t.date.slice(5)} Â· <span style={{color:catClr}}>{t.subCat}</span> Â· <span style={{color:t.person===(s.members||[])[0]?T.accent:T.purple}}>{t.person}</span></div>
                  {(t.note||(t.tags||[]).length>0)&&<div style={{fontSize:11,color:T.muted,marginTop:2}}>{t.note}{t.note&&(t.tags||[]).length>0?" Â· ":""}{(t.tags||[]).join(", ")}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:15,fontWeight:800,color:t.category==="INCOME"?T.accent:T.text}}>{fmt(t.amount)}</div>
                  <div style={{display:"flex",gap:6,justifyContent:"flex-end",marginTop:4}}>
                    <button onClick={()=>setEditTxn({...t,amount:String(t.amount)})} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:16,padding:"2px",WebkitTapHighlightColor:"transparent"}}>âœï¸</button>
                    <button onClick={()=>delTxn(t.id)} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:16,padding:"2px",WebkitTapHighlightColor:"transparent"}}>ðŸ—‘</button>
                  </div>
                </div>
              </div>
            ):(
              <div key={t.id} style={{background:T.surface,borderRadius:10,padding:"10px 14px",display:"grid",gridTemplateColumns:"80px 1fr 150px 110px 70px 60px",gap:10,alignItems:"center"}}>
                <span style={{color:T.muted,fontSize:12}}>{t.date.slice(5)}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.spentOn}</div>
                  {(t.note||(t.tags||[]).length>0)&&<div style={{fontSize:11,color:T.muted}}>{t.note}{t.note&&(t.tags||[]).length>0?" Â· ":""}{(t.tags||[]).join(", ")}</div>}
                </div>
                <Badge color={catClr}>{t.subCat}</Badge>
                <span style={{fontWeight:700,color:t.category==="INCOME"?T.accent:T.text,textAlign:"right"}}>{fmt(t.amount)}</span>
                <Badge color={t.person===(s.members||[])[0]?T.accent:T.purple} small>{t.person}</Badge>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setEditTxn({...t,amount:String(t.amount)})} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:16,padding:"2px"}}>âœï¸</button>
                  <button onClick={()=>delTxn(t.id)} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:16,padding:"2px"}}>ðŸ—‘</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="âž• Add Transaction">
        <TxnForm state={s} value={form} onChange={setForm} onSubmit={()=>{addTxn(form);setForm(f=>({...f,spentOn:"",amount:"",note:"",tags:[]}));setShowForm(false);}}/>
      </Modal>
    </div>
  );
}
