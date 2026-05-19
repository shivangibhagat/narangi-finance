import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import * as XLSX from "xlsx";
import { db, auth, googleProvider } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

const FIRESTORE_DOC = doc(db, "narangi-finance", "shared-data");

const T = {
  bg:"#0A0E1A", surface:"#111827", card:"#1A2236", border:"#1E2D45",
  accent:"#00D4AA", accentDim:"#00D4AA18", amber:"#F59E0B", rose:"#F43F5E",
  blue:"#60A5FA", purple:"#A78BFA", green:"#22C55E", text:"#E2E8F0", muted:"#64748B",
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = n => "₹" + Number(n||0).toLocaleString("en-IN");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,5);
const mNum = m => String(MONTHS.indexOf(m)+1).padStart(2,"0");
const monthKey = (y,m) => `${y}-${mNum(m)}`;
const ccKey = (ccId,y,m) => `${ccId}_${y}-${mNum(m)}`;
const CAT_CLR = { INCOME:T.accent,"FIXED EXPENSES":T.blue,"VARIABLE EXPENSES":T.amber,SAVINGS:T.purple,"CC PAYMENT":T.rose };
const PIE_COLORS = [T.accent,T.blue,T.amber,T.purple,T.rose,"#34D399","#818CF8","#FB923C"];
const YEARS = [2026,2027,2028,2029,2030];
const CATS = ["INCOME","FIXED EXPENSES","VARIABLE EXPENSES","SAVINGS","CC PAYMENT"];
// Tracking started May 2026 — hide earlier months for that year
const START_YEAR = 2026;
const START_MONTH = "May";
const START_MONTH_IDX = MONTHS.indexOf(START_MONTH); // 4
const getVisibleMonths = (year) => year === START_YEAR ? MONTHS.slice(START_MONTH_IDX) : MONTHS;
const CAT_ICON = { INCOME:"💰","FIXED EXPENSES":"🔒","VARIABLE EXPENSES":"📊",SAVINGS:"🎯","CC PAYMENT":"💳" };

// ─── Hooks ─────────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [m,setM] = useState(()=>typeof window!=="undefined"?window.innerWidth<768:false);
  useEffect(()=>{
    const h=()=>setM(window.innerWidth<768);
    window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h);
  },[]);
  return m;
}
function useOutsideClick(ref,handler) {
  useEffect(()=>{
    const l=e=>{ if(ref.current&&!ref.current.contains(e.target)) handler(); };
    document.addEventListener("mousedown",l); document.addEventListener("touchstart",l);
    return ()=>{ document.removeEventListener("mousedown",l); document.removeEventListener("touchstart",l); };
  },[ref,handler]);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const confirmDel = label => window.confirm(`Delete "${label}"?\nThis cannot be undone.`);

// Compute rolling CC balance up to (but NOT including) a given month
// FIX: correctly starts from initialOutstanding and rolls forward
function computeCCBalance(cc, upToYear, upToMonth, transactions, ccMonthlyCharges) {
  let bal = cc.initialOutstanding || cc.outstanding || 0; // FIX: fallback to old 'outstanding' field
  for(let y=START_YEAR; y<=upToYear; y++) {
    const maxMi = y===upToYear ? MONTHS.indexOf(upToMonth)-1 : 11;
    for(let mi=0; mi<=maxMi; mi++) {
      const m=MONTHS[mi];
      bal += (ccMonthlyCharges||{})[ccKey(cc.id,y,m)] || 0;
      bal -= transactions.filter(t=>t.category==="CC PAYMENT"&&t.ccId===cc.id&&t.date.startsWith(`${y}-${mNum(m)}`)).reduce((a,t)=>a+t.amount,0);
    }
  }
  return Math.max(0, bal); // FIX: balance can't go below 0 (overpaid = cleared)
}

// ─── Default State ─────────────────────────────────────────────────────────────
const DEFAULTS = {
  members:["NARR","SHIVU"],
  income:[{id:"i1",label:"NARR Salary",amount:68000},{id:"i2",label:"SHIVU Salary",amount:100000}],
  fixedExpenses:[
    {id:"f1",label:"House Rent",budget:19500},{id:"f2",label:"Send to Home",budget:15000},
    {id:"f3",label:"Light Bill",budget:2000},{id:"f4",label:"Gas Bill",budget:1500},
    {id:"f5",label:"WiFi Bill",budget:500},{id:"f6",label:"Grocery",budget:10000},
    {id:"f7",label:"Monthly SIP",budget:10000},{id:"f8",label:"Misc",budget:5000},
    {id:"f9",label:"Mediclaim",budget:5000},{id:"f10",label:"RentMojo Items",budget:1700}
  ],
  variableBudget:20000,
  variableSubCats:["ENTERTAINMENT","CAFES/RESTAURANTS","SUBSCRIPTIONS","GIFTS","ONLINE FOOD","SHOPPING","BODY CARE","TRANSPORT"],
  savings:[
    {id:"s1",label:"Travel Fund",monthlyTarget:14950,goalTarget:300000},
    {id:"s2",label:"Emergency Fund",monthlyTarget:14950,goalTarget:500000},
    {id:"s3",label:"Home Fund",monthlyTarget:14950,goalTarget:1000000},
    {id:"s4",label:"Car Fund",monthlyTarget:14950,goalTarget:800000},
    {id:"s5",label:"Personal Savings",monthlyTarget:10000,goalTarget:200000}
  ],
  // FIX: CC config global — use initialOutstanding (debt when tracking started)
  creditCards:[
    {id:"cc1",name:"NARR Credit Card",person:"NARR",limit:150000,initialOutstanding:94572},
    {id:"cc2",name:"SHIVU Credit Card",person:"SHIVU",limit:150000,initialOutstanding:67606}
  ],
  ccMonthlyCharges:{}, // keyed: "ccId_YYYY-MM" → number
  customTags:["reimbursable","birthday","travel","emergency","work"],
  openingBalances:{"2026-05":{NARR:0,SHIVU:0,note:"First month tracked"}}
};

const SEED = [
  {id:"t1",date:"2026-05-01",category:"INCOME",subCat:"NARR Salary",spentOn:"Narr May Salary",amount:68000,person:"NARR",note:"",tags:[]},
  {id:"t2",date:"2026-05-01",category:"CC PAYMENT",subCat:"NARR Credit Card",spentOn:"CC Payment Narr May",amount:59000,person:"NARR",note:"May bill",tags:[],ccId:"cc1"},
  {id:"t3",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",spentOn:"Breakfast 30 April",amount:210,person:"NARR",note:"",tags:[]},
  {id:"t4",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",spentOn:"Coffee 30 April",amount:289,person:"SHIVU",note:"",tags:[]},
  {id:"t5",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"ONLINE FOOD",spentOn:"Pizza 30 April",amount:651,person:"SHIVU",note:"",tags:[]},
  {id:"t6",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"BODY CARE",spentOn:"Shopping Miniso",amount:390,person:"NARR",note:"",tags:[]},
  {id:"t7",date:"2026-05-01",category:"FIXED EXPENSES",subCat:"Gas Bill",spentOn:"Gas Bill April",amount:354,person:"SHIVU",note:"",tags:[]},
  {id:"t8",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"BODY CARE",spentOn:"Hair Color Narr",amount:2572,person:"NARR",note:"",tags:[]},
  {id:"t9",date:"2026-05-01",category:"FIXED EXPENSES",subCat:"RentMojo Items",spentOn:"Rent Mojo",amount:1613,person:"SHIVU",note:"",tags:[]},
  {id:"t10",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"ONLINE FOOD",spentOn:"Eatsure Lunch",amount:625,person:"SHIVU",note:"",tags:[]},
  {id:"t11",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"SUBSCRIPTIONS",spentOn:"Hotstar",amount:1500,person:"SHIVU",note:"",tags:[]},
  {id:"t12",date:"2026-05-01",category:"FIXED EXPENSES",subCat:"Grocery",spentOn:"Blinkit groceries",amount:246,person:"SHIVU",note:"",tags:[]},
  {id:"t13",date:"2026-05-04",category:"FIXED EXPENSES",subCat:"Misc",spentOn:"Mummy Papa Train Surat",amount:2363,person:"NARR",note:"",tags:[]},
  {id:"t14",date:"2026-05-07",category:"CC PAYMENT",subCat:"SHIVU Credit Card",spentOn:"CC Payment Shivu May",amount:59000,person:"SHIVU",note:"May bill",tags:[],ccId:"cc2"},
  {id:"t15",date:"2026-05-07",category:"VARIABLE EXPENSES",subCat:"TRANSPORT",spentOn:"Train to Vadodara",amount:1754,person:"SHIVU",note:"",tags:["travel"]},
  {id:"t16",date:"2026-05-07",category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",spentOn:"Evening Snack",amount:458,person:"NARR",note:"",tags:[]},
];

// Merge Firebase data safely (handles old schema)
function mergeData(data) {
  return {
    ...DEFAULTS,
    ...data,
    // FIX: migrate old `outstanding` field to `initialOutstanding`
    creditCards: (data.creditCards||DEFAULTS.creditCards).map(cc=>({
      ...cc,
      initialOutstanding: cc.initialOutstanding ?? cc.outstanding ?? 0
    })),
    members: data.members||DEFAULTS.members,
    ccMonthlyCharges: data.ccMonthlyCharges||{},
    openingBalances: data.openingBalances||DEFAULTS.openingBalances,
    customTags: data.customTags||DEFAULTS.customTags,
    variableSubCats: data.variableSubCats||DEFAULTS.variableSubCats,
    savings: data.savings||DEFAULTS.savings,
    income: data.income||DEFAULTS.income,
    fixedExpenses: data.fixedExpenses||DEFAULTS.fixedExpenses,
  };
}

// Firestore rejects undefined values — strip them before every write (module-level, not recreated)
const cleanForDb = (obj) => JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v));

// ─── UI Primitives ─────────────────────────────────────────────────────────────
const Card = ({children,style={}}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"16px 18px",...style}}>{children}</div>
);
const Btn = ({children,onClick,color=T.accent,variant="solid",small,full,style={}}) => (
  <button onClick={onClick} style={{background:variant==="solid"?color:"transparent",color:variant==="solid"?T.bg:color,border:`1px solid ${color}`,borderRadius:10,padding:small?"8px 14px":"11px 20px",fontSize:small?12:14,fontWeight:700,cursor:"pointer",width:full?"100%":"auto",WebkitTapHighlightColor:"transparent",...style}}>{children}</button>
);
const Badge = ({color,children,small}) => (
  <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:999,padding:small?"1px 8px":"3px 10px",fontSize:small?10:11,fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>
);
const Lbl = ({children}) => <label style={{color:T.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>{children}</label>;
const iSty = {background:T.surface,border:`1px solid ${T.border}`,color:T.text,borderRadius:10,padding:"11px 14px",fontSize:15,outline:"none",width:"100%",boxSizing:"border-box",WebkitAppearance:"none"};
const TI = ({label,value,onChange,type="text",placeholder="",style={}}) => (
  <div style={{display:"flex",flexDirection:"column",gap:6}}>
    {label&&<Lbl>{label}</Lbl>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...iSty,...style}}/>
  </div>
);
const Sel = ({label,value,onChange,options}) => (
  <div style={{display:"flex",flexDirection:"column",gap:6}}>
    {label&&<Lbl>{label}</Lbl>}
    <select value={value} onChange={e=>onChange(e.target.value)} style={{...iSty,appearance:"none"}}>
      {options.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

// FIX: ActualBar handles zero budget gracefully
const ActualBar = ({budget,actual,color}) => {
  if(!budget||budget<=0) return <div style={{fontSize:11,color:T.muted,marginTop:4}}>Actual: {fmt(actual)}</div>;
  const pct=Math.min(100,Math.round((actual/budget)*100));
  const c=pct>=100?T.rose:pct>=80?T.amber:T.green;
  return(
    <div style={{marginTop:6}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
        <span style={{color:T.muted}}>Actual: <span style={{color:c,fontWeight:700}}>{fmt(actual)}</span></span>
        <span style={{color:c,fontWeight:700}}>{pct}%</span>
      </div>
      <div style={{height:4,background:T.border,borderRadius:99}}><div style={{height:"100%",width:`${pct}%`,background:c,borderRadius:99,transition:"width 0.4s"}}/></div>
    </div>
  );
};

// ─── Modal (bottom sheet on mobile) ───────────────────────────────────────────
const Modal = ({open,onClose,title,children}) => {
  const isMobile=useIsMobile();
  if(!open) return null;
  return(
    <div style={{position:"fixed",inset:0,background:"#00000099",zIndex:1000,display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:isMobile?"20px 20px 0 0":"20px",padding:"24px 20px",width:isMobile?"100%":"500px",maxWidth:"100%",maxHeight:isMobile?"92vh":"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        {isMobile&&<div style={{width:40,height:4,background:T.border,borderRadius:99,margin:"0 auto 20px"}}/>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:16}}>{title}</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:T.muted,fontSize:26,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ─── Transaction Form ──────────────────────────────────────────────────────────
function TxnForm({state,value,onChange,onSubmit,submitLabel="Add Transaction"}) {
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
      onChange({...value,subCat:subCats[0],ccId:cc?.id});
    }
  },[subCats.join("|")]);

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

// ─── Opening Balance Card ──────────────────────────────────────────────────────
function OpeningBalanceCard({state,upd,activeYear,activeMonth}) {
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
  const prevOut=prevTxns.filter(t=>["FIXED EXPENSES","VARIABLE EXPENSES","CC PAYMENT"].includes(t.category)).reduce((a,t)=>a+t.amount,0);
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


// ─── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen() {
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const login=async()=>{
    setLoading(true); setErr("");
    try{ await signInWithPopup(auth,googleProvider); }
    catch(e){ setErr("Sign-in failed. Please try again."); setLoading(false); }
  };
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans','Segoe UI',sans-serif",padding:24}}>
      <div style={{textAlign:"center",maxWidth:360,width:"100%"}}>
        <div style={{width:72,height:72,borderRadius:20,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 20px"}}>🪙</div>
        <div style={{fontWeight:800,fontSize:28,color:T.text,marginBottom:8}}>Narangi Finance</div>
        <div style={{color:T.muted,fontSize:14,marginBottom:36}}>Your private family finance tracker</div>
        <button onClick={login} disabled={loading} style={{
          display:"flex",alignItems:"center",justifyContent:"center",gap:12,
          width:"100%",padding:"14px 20px",background:T.card,
          border:`1px solid ${T.border}`,borderRadius:14,
          color:T.text,fontSize:15,fontWeight:700,cursor:"pointer",
          WebkitTapHighlightColor:"transparent",
          opacity:loading?0.6:1,
        }}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          {loading ? "Signing in…" : "Sign in with Google"}
        </button>
        {err&&<div style={{color:T.rose,fontSize:13,marginTop:12}}>{err}</div>}
        <div style={{color:T.muted,fontSize:12,marginTop:24}}>Your data is private and encrypted.<br/>Only your signed-in Google accounts can access it.</div>
      </div>
    </div>
  );
}

// ─── Excel Import Modal ────────────────────────────────────────────────────────
function ImportModal({open,onClose,s,onImport}) {
  const [step,setStep]=useState("upload"); // upload → map → preview
  const [wb,setWb]=useState(null);
  const [sheetName,setSheetName]=useState("");
  const [headers,setHeaders]=useState([]);
  const [rows,setRows]=useState([]);
  const [mapping,setMapping]=useState({date:-1,category:-1,subCat:-1,spentOn:-1,amount:-1,person:-1,note:-1});
  const [preview,setPreview]=useState([]);
  const [importing,setImporting]=useState(false);
  const [importDone,setImportDone]=useState(null);
  const [dragOver,setDragOver]=useState(false);
  const fileRef=useRef();

  const reset=()=>{setStep("upload");setWb(null);setSheetName("");setHeaders([]);setRows([]);setPreview([]);setImportDone(null);setMapping({date:-1,category:-1,subCat:-1,spentOn:-1,amount:-1,person:-1,note:-1});};

  const parseFile=file=>{
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const workbook=XLSX.read(e.target.result,{type:"array",cellDates:true});
        setWb(workbook);
        loadSheet(workbook,workbook.SheetNames[0]);
        setSheetName(workbook.SheetNames[0]);
        setStep("map");
      }catch(err){ alert("Could not read file. Please use .xlsx or .csv format."); }
    };
    reader.readAsArrayBuffer(file);
  };

  const loadSheet=(workbook,sName)=>{
    const ws=workbook.Sheets[sName];
    const data=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
    if(!data.length) return;
    const hdrs=(data[0]||[]).map(h=>String(h||"").trim());
    const dataRows=data.slice(1).filter(r=>r.some(c=>c!==null&&c!==""&&c!==undefined));
    setHeaders(hdrs);
    setRows(dataRows);
    autoDetect(hdrs);
  };

  const autoDetect=hdrs=>{
    const m={date:-1,category:-1,subCat:-1,spentOn:-1,amount:-1,person:-1,note:-1};
    hdrs.forEach((h,i)=>{
      const hl=h.toLowerCase().replace(/[^a-z]/g,"");
      if(/date/.test(hl) && m.date===-1) m.date=i;
      else if(/(category|cat)/.test(hl) && !/sub/.test(hl) && m.category===-1) m.category=i;
      else if(/(subcat|subcategory|sub)/.test(hl) && m.subCat===-1) m.subCat=i;
      else if(/(descr|spenton|spent|what|particular|detail|narrat|item)/.test(hl) && m.spentOn===-1) m.spentOn=i;
      else if(/(amount|amt|rs|inr|rupee|money|value)/.test(hl) && m.amount===-1) m.amount=i;
      else if(/(person|who|member|by|paid)/.test(hl) && m.person===-1) m.person=i;
      else if(/(note|remark|comment|desc)/.test(hl) && m.note===-1) m.note=i;
    });
    setMapping(m);
  };

  const fmtDateCell=val=>{
    if(!val && val!==0) return "";
    if(val instanceof Date) return val.toISOString().slice(0,10);
    if(typeof val==="string"){
      // try common formats: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
      const s=val.trim();
      const iso=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if(iso) return `${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}`;
      const dmy=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if(dmy){
        const y=dmy[3].length===2?`20${dmy[3]}`:dmy[3];
        return `${y}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
      }
      return s;
    }
    if(typeof val==="number"){
      // Excel serial date
      try{
        const d=XLSX.SSF.parse_date_code(val);
        return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
      }catch{ return ""; }
    }
    return String(val);
  };

  const buildPreview=()=>{
    const get=(row,idx)=>idx>=0&&idx<row.length?row[idx]:"";
    const members=s.members||["NARR","SHIVU"];
    return rows.map((row,ri)=>{
      const dateStr=fmtDateCell(get(row,mapping.date));
      const rawAmt=get(row,mapping.amount);
      const amt=parseFloat(String(rawAmt).replace(/[₹,\s]/g,""))||0;
      const rawCat=String(get(row,mapping.category)||"").trim().toUpperCase();
      // Normalize category
      const catMap={"INCOME":"INCOME","FIXED":"FIXED EXPENSES","FIXED EXPENSES":"FIXED EXPENSES","VARIABLE":"VARIABLE EXPENSES","VARIABLE EXPENSES":"VARIABLE EXPENSES","SAVING":"SAVINGS","SAVINGS":"SAVINGS","CC":"CC PAYMENT","CC PAYMENT":"CC PAYMENT"};
      const category=catMap[rawCat]||catMap[rawCat.split(" ")[0]]||"VARIABLE EXPENSES";
      const rawPerson=String(get(row,mapping.person)||"").trim().toUpperCase();
      const person=members.find(m=>m.toUpperCase()===rawPerson)||members[0];
      return {
        _row:ri+2,
        id:uid(),
        date:dateStr,
        category,
        subCat:String(get(row,mapping.subCat)||"").trim(),
        spentOn:String(get(row,mapping.spentOn)||"").trim(),
        amount:amt,
        person,
        note:String(get(row,mapping.note)||"").trim(),
        tags:[],
        ccId:null,
      };
    }).filter(t=>t.spentOn&&t.amount>0&&t.date&&t.date.length>=8);
  };

  const goPreview=()=>{ setPreview(buildPreview()); setStep("preview"); };

  const doImport=()=>{
    setImporting(true);
    // Deduplicate: skip transactions already in s.transactions (match on date+amount+spentOn)
    const existing=new Set((s.transactions||[]).map(t=>`${t.date}|${t.amount}|${t.spentOn}`));
    const newTxns=preview.filter(t=>!existing.has(`${t.date}|${t.amount}|${t.spentOn}`));
    onImport(newTxns);
    setImportDone({total:preview.length,added:newTxns.length,skipped:preview.length-newTxns.length});
    setImporting(false);
    setStep("done");
  };

  const FIELD_LABELS={date:"Date",category:"Category",subCat:"Sub-Category",spentOn:"Description",amount:"Amount",person:"Person",note:"Note"};
  const REQUIRED=["date","spentOn","amount"];
  const canPreview=REQUIRED.every(f=>mapping[f]>=0);

  return(
    <Modal open={open} onClose={()=>{reset();onClose();}} title="📥 Import from Excel">
      {step==="upload"&&(
        <div>
          <div
            onDragOver={e=>{e.preventDefault();setDragOver(true);}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)parseFile(f);}}
            onClick={()=>fileRef.current.click()}
            style={{border:`2px dashed ${dragOver?T.accent:T.border}`,borderRadius:14,padding:"40px 20px",textAlign:"center",cursor:"pointer",background:dragOver?T.accentDim:"transparent",transition:"all 0.2s"}}>
            <div style={{fontSize:40,marginBottom:12}}>📊</div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>Drop your Excel file here</div>
            <div style={{color:T.muted,fontSize:13}}>or click to browse</div>
            <div style={{color:T.muted,fontSize:11,marginTop:8}}>.xlsx or .csv supported</div>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={e=>{if(e.target.files[0])parseFile(e.target.files[0]);}}/>
          <div style={{marginTop:16,padding:"12px 14px",background:T.surface,borderRadius:10,fontSize:12,color:T.muted}}>
            💡 Your Excel should have columns for: Date, Description, Amount, Category, Sub-Category, Person. Column names don't have to match exactly — we'll auto-detect them.
          </div>
        </div>
      )}

      {step==="map"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {wb&&wb.SheetNames.length>1&&(
            <div>
              <label style={{color:T.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>Sheet</label>
              <select value={sheetName} onChange={e=>{setSheetName(e.target.value);loadSheet(wb,e.target.value);}} style={{...iSty,fontSize:13,padding:"8px 10px"}}>
                {wb.SheetNames.map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
          <div style={{fontSize:13,color:T.muted}}>Found <strong style={{color:T.text}}>{rows.length} rows</strong> and <strong style={{color:T.text}}>{headers.length} columns</strong>. Map your columns below:</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {Object.entries(FIELD_LABELS).map(([field,label])=>(
              <div key={field}>
                <label style={{color:REQUIRED.includes(field)?T.text:T.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:4}}>
                  {label}{REQUIRED.includes(field)&&<span style={{color:T.rose}}> *</span>}
                </label>
                <select value={mapping[field]} onChange={e=>setMapping(m=>({...m,[field]:+e.target.value}))} style={{...iSty,fontSize:13,padding:"7px 10px"}}>
                  <option value={-1}>— skip —</option>
                  {headers.map((h,i)=><option key={i} value={i}>{h||`Column ${i+1}`}</option>)}
                </select>
              </div>
            ))}
          </div>
          {/* Preview first 3 rows */}
          {rows.length>0&&(
            <div style={{background:T.surface,borderRadius:10,padding:12,overflowX:"auto"}}>
              <div style={{fontSize:11,color:T.muted,fontWeight:700,marginBottom:8}}>FIRST 3 ROWS PREVIEW</div>
              <table style={{fontSize:11,color:T.muted,width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>{headers.map((h,i)=><th key={i} style={{padding:"3px 8px",background:T.card,color:T.muted,textAlign:"left",whiteSpace:"nowrap"}}>{h||`Col ${i+1}`}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0,3).map((row,ri)=>(
                    <tr key={ri}>{headers.map((_,ci)=>(
                      <td key={ci} style={{padding:"3px 8px",borderTop:`1px solid ${T.border}`,whiteSpace:"nowrap",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",color:T.text}}>
                        {row[ci] instanceof Date ? row[ci].toLocaleDateString() : String(row[ci]||"")}
                      </td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:4}}>
            <button onClick={()=>{reset();}} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer"}}>← Back</button>
            <button onClick={goPreview} disabled={!canPreview} style={{background:canPreview?T.accent:T.border,color:canPreview?T.bg:T.muted,border:"none",borderRadius:10,padding:"11px",fontWeight:700,cursor:canPreview?"pointer":"default"}}>Preview Import →</button>
          </div>
          {!canPreview&&<div style={{fontSize:11,color:T.amber,textAlign:"center"}}>⚠️ Please map Date, Description, and Amount (marked with *)</div>}
        </div>
      )}

      {step==="preview"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              {label:"Transactions found",val:preview.length,color:T.accent},
              {label:"Date range",val:preview.length?`${preview[preview.length-1]?.date?.slice(0,7)} → ${preview[0]?.date?.slice(0,7)}`:"—",color:T.muted,text:true},
            ].map(k=>(
              <div key={k.label} style={{background:T.surface,borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
                <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
                <div style={{fontSize:k.text?13:22,fontWeight:800,color:k.color}}>{k.val}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:13,color:T.muted}}>First 5 transactions that will be imported:</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:240,overflowY:"auto"}}>
            {preview.slice(0,5).map((t,i)=>(
              <div key={i} style={{background:T.surface,borderRadius:8,padding:"10px 12px",display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.spentOn}</div>
                  <div style={{fontSize:11,color:T.muted}}>{t.date} · {t.subCat||t.category} · {t.person}</div>
                </div>
                <div style={{fontSize:14,fontWeight:800,color:t.category==="INCOME"?T.accent:T.text,flexShrink:0}}>₹{Number(t.amount).toLocaleString("en-IN")}</div>
              </div>
            ))}
            {preview.length>5&&<div style={{textAlign:"center",color:T.muted,fontSize:12}}>…and {preview.length-5} more</div>}
          </div>
          <div style={{padding:"10px 14px",background:T.accentDim,borderRadius:10,fontSize:12,color:T.accent}}>
            ✅ Duplicate transactions (same date + amount + description already in app) will be skipped automatically.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button onClick={()=>setStep("map")} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer"}}>← Back</button>
            <button onClick={doImport} disabled={importing||preview.length===0} style={{background:T.accent,color:T.bg,border:"none",borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer"}}>
              {importing?"Importing…":`Import ${preview.length} transactions`}
            </button>
          </div>
        </div>
      )}

      {step==="done"&&importDone&&(
        <div style={{textAlign:"center",padding:"20px 0"}}>
          <div style={{fontSize:48,marginBottom:16}}>🎉</div>
          <div style={{fontWeight:800,fontSize:18,color:T.accent,marginBottom:8}}>Import Complete!</div>
          <div style={{color:T.muted,fontSize:14,marginBottom:24}}>
            <div>✅ {importDone.added} transactions imported</div>
            {importDone.skipped>0&&<div>⏭ {importDone.skipped} duplicates skipped</div>}
          </div>
          <button onClick={()=>{reset();onClose();}} style={{background:T.accent,color:T.bg,border:"none",borderRadius:10,padding:"12px 32px",fontWeight:700,cursor:"pointer",fontSize:14}}>Done</button>
        </div>
      )}
    </Modal>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile=useIsMobile();
  // Auth state — must be before s so hooks always run in same order
  const [user,setUser]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  useEffect(()=>{ return onAuthStateChanged(auth,u=>{ setUser(u); setAuthLoading(false); }); },[]);
  // s starts as DEFAULTS so hooks always run — never null (fixes React error #310)
  const [s,setS]=useState({...DEFAULTS,transactions:SEED});
  const [loaded,setLoaded]=useState(false);
  const [syncStatus,setSyncStatus]=useState("connecting");
  const isRemote=useRef(false);
  const saveTimer=useRef(null);
  const yearPickerRef=useRef(null);
  const isSavingRef=useRef(false); // sync ref — beforeunload can read without React re-render
  const isManualSave=useRef(false); // prevents double-save: saveNow sets this, useEffect([s]) skips saveSoon

  useEffect(()=>{
    const unsub=onSnapshot(FIRESTORE_DOC,(snap)=>{
      isRemote.current=true;
      if(snap.exists()) setS(mergeData(snap.data()));
      else { const init={...DEFAULTS,transactions:SEED}; setDoc(FIRESTORE_DOC,cleanForDb(init)); setS(init); }
      setSyncStatus("live");
      setLoaded(true);
    },()=>{ setSyncStatus("error"); setLoaded(true); });
    return unsub;
  },[]);

  // ── Save helpers ──────────────────────────────────────────────────────────
  // saveNow: immediate write — use for ALL discrete user actions so refresh never loses data
  const saveNow = useCallback((newState) => {
    clearTimeout(saveTimer.current);
    isManualSave.current = true; // suppress the redundant saveSoon from useEffect([s])
    isSavingRef.current = true;
    setSyncStatus("saving");
    setDoc(FIRESTORE_DOC, cleanForDb(newState))
      .then(() => { isSavingRef.current = false; setSyncStatus("live"); })
      .catch((e) => { isSavingRef.current = false; setSyncStatus("error"); console.error("Save error:", e); });
  }, []);

  // saveSoon: debounced 400ms — use for rapid-typing fields (budget numbers, labels)
  const saveSoon = useCallback((newState) => {
    clearTimeout(saveTimer.current);
    isSavingRef.current = true;
    setSyncStatus("saving");
    saveTimer.current = setTimeout(() => {
      setDoc(FIRESTORE_DOC, cleanForDb(newState))
        .then(() => { isSavingRef.current = false; setSyncStatus("live"); })
        .catch((e) => { isSavingRef.current = false; setSyncStatus("error"); console.error("Save error:", e); });
    }, 400);
  }, []);

  // Debounced-save effect for plan/settings changes via upd()
  useEffect(()=>{
    if(!loaded) return;
    if(isRemote.current){ isRemote.current=false; return; }
    if(isManualSave.current){ isManualSave.current=false; return; } // saveNow already handled this
    if(syncStatus==="connecting") return;
    saveSoon(s);
  },[s]);

  // Warn user if they try to refresh/navigate away with unsaved changes
  useEffect(()=>{
    const handler = e => {
      if(isSavingRef.current){ // use ref — reads synchronously without waiting for React state
        e.preventDefault();
        e.returnValue="Saving your data — please wait a moment before refreshing.";
      }
    };
    window.addEventListener("beforeunload", handler);
    return ()=>window.removeEventListener("beforeunload", handler);
  },[]); // no deps — handler always reads latest ref value

  // upd: for plan/settings changes — goes through debounced path
  const upd=useCallback(patch=>setS(p=>({...p,...patch})),[]);

  const [tab,setTab]=useState("dashboard");
  const [activeYear,setActiveYear]=useState(2026);
  const [activeMonth,setActiveMonth]=useState("May");
  const [showQuickAdd,setShowQuickAdd]=useState(false);
  const [showYearPicker,setShowYearPicker]=useState(false);
  const [showImport,setShowImport]=useState(false);
  const [editTxn,setEditTxn]=useState(null);
  const defaultDate=`${activeYear}-${mNum(activeMonth)}-01`;
  const [quickForm,setQuickForm]=useState({date:defaultDate,category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",spentOn:"",amount:"",person:"NARR",note:"",tags:[]});

  useOutsideClick(yearPickerRef,useCallback(()=>setShowYearPicker(false),[]));
  useEffect(()=>{ setQuickForm(f=>({...f,date:`${activeYear}-${mNum(activeMonth)}-01`})); },[activeYear,activeMonth]);

  // ALL useMemo/derived values — after all hooks, before any conditional return
  const members=s.members||DEFAULTS.members;
  const getTxns=(m,y=activeYear)=>(s.transactions||[]).filter(t=>t.date.startsWith(`${y}-${mNum(m)}`));
  const summarize=txns=>({
    income:txns.filter(t=>t.category==="INCOME").reduce((a,t)=>a+t.amount,0),
    fixed:txns.filter(t=>t.category==="FIXED EXPENSES").reduce((a,t)=>a+t.amount,0),
    variable:txns.filter(t=>t.category==="VARIABLE EXPENSES").reduce((a,t)=>a+t.amount,0),
    savings:txns.filter(t=>t.category==="SAVINGS").reduce((a,t)=>a+t.amount,0),
    ccPaid:txns.filter(t=>t.category==="CC PAYMENT").reduce((a,t)=>a+t.amount,0),
  });

  const monthTxns=useMemo(()=>getTxns(activeMonth,activeYear),[s.transactions,activeMonth,activeYear]);
  const summary=useMemo(()=>summarize(monthTxns),[monthTxns]);
  const prevIdx=MONTHS.indexOf(activeMonth)-1;
  const isFirstTrackedMonth = activeYear===START_YEAR && activeMonth===START_MONTH;
  const prevSummary=useMemo(()=>{
    if(isFirstTrackedMonth) return {income:0,fixed:0,variable:0,savings:0,ccPaid:0};
    return summarize(prevIdx>=0?getTxns(MONTHS[prevIdx],activeYear):getTxns("Dec",activeYear-1));
  },[s.transactions,activeMonth,activeYear]);

  const ob=s.openingBalances?.[monthKey(activeYear,activeMonth)]||{};
  const openingTotal=members.reduce((a,m)=>a+(ob[m]||0),0);
  const currentBalance=openingTotal+summary.income-summary.fixed-summary.variable-summary.ccPaid;
  const totalIncome=(s.income||[]).reduce((a,i)=>a+i.amount,0);
  const totalFixed=(s.fixedExpenses||[]).reduce((a,f)=>a+f.budget,0);
  const totalSavings=(s.savings||[]).reduce((a,sv)=>a+sv.monthlyTarget,0);
  const varPct=s.variableBudget>0?Math.round((summary.variable/s.variableBudget)*100):0;
  const varStatus=varPct>=100?T.rose:varPct>=80?T.amber:T.green;

  // Transaction actions — saveNow() so refresh NEVER loses data
  const addTxn=useCallback(form=>{
    const amt=parseFloat(form.amount);
    if(!form.spentOn||!(amt>0)) return;
    const txn={
      ...form,
      id:uid(),
      amount:amt,
      tags:form.tags||[],
      ccId:form.ccId||null, // undefined → null so Firestore accepts it
      note:form.note||"",
    };
    const newS={...s,transactions:[...(s.transactions||[]),txn]};
    setS(newS);
    saveNow(newS);
  },[s,saveNow]);

  const delTxn=useCallback(id=>{
    const t=(s.transactions||[]).find(t=>t.id===id);
    if(!t||!confirmDel(t.spentOn||"this")) return;
    const newS={...s,transactions:(s.transactions||[]).filter(t=>t.id!==id)};
    setS(newS);
    saveNow(newS); // immediate
  },[s,saveNow]);

  const saveEditTxn=useCallback(form=>{
    const updated={...form,amount:parseFloat(form.amount)||0,ccId:form.ccId||null,note:form.note||""};
    const newS={...s,transactions:(s.transactions||[]).map(t=>t.id===form.id?updated:t)};
    setS(newS);
    setEditTxn(null);
    saveNow(newS);
  },[s,saveNow]);

  // Also save opening balances and CC charges immediately (discrete user actions)
  const updNow=useCallback(patch=>{
    const newS={...s,...patch};
    setS(newS);
    saveNow(newS);
  },[s,saveNow]);

  const annualData=useMemo(()=>getVisibleMonths(activeYear).map(m=>{
    const t=summarize(getTxns(m,activeYear));
    const ob2=s.openingBalances?.[monthKey(activeYear,m)]||{};
    return {month:m,income:t.income,expenses:t.fixed+t.variable,savings:t.savings,opening:members.reduce((a,mem)=>a+(ob2[mem]||0),0)};
  }),[s.transactions,s.openingBalances,activeYear,members]);

  const catBreakdown=useMemo(()=>{
    const grp={};
    monthTxns.filter(t=>t.category!=="INCOME").forEach(t=>{grp[t.subCat]=(grp[t.subCat]||0)+t.amount;});
    return Object.entries(grp).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  },[monthTxns]);

  const syncDot={live:T.green,saving:T.amber,connecting:T.muted,error:T.rose}[syncStatus];
  const syncLabel={live:"Synced",saving:"Saving…",connecting:"Connecting…",error:"Sync error"}[syncStatus];
  const TABS=[{id:"dashboard",icon:"📊",label:"Dashboard"},{id:"transactions",icon:"📋",label:"Txns"},{id:"plan",icon:"🎯",label:"Plan"},{id:"credit cards",icon:"💳",label:"Cards"}];
  const p=isMobile?12:24;

  // Auth screens — all hooks already called above
  if(authLoading) return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,color:T.muted}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:T.accent,animation:"pulse 1s infinite"}}/>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
        <span style={{fontSize:14}}>Loading…</span>
      </div>
    </div>
  );
  if(!user) return <LoginScreen/>;

  // Loading screen shown inside JSX — all hooks already called above
  if(!loaded) return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <div style={{width:48,height:48,borderRadius:14,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🪙</div>
      <div style={{color:T.text,fontWeight:700,fontSize:18}}>Narangi Finance</div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:T.accent,animation:"pulse 1s infinite"}}/>
        <span style={{color:T.muted,fontSize:13}}>Connecting to database…</span>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'DM Sans','Segoe UI',sans-serif",paddingBottom:isMobile?76:80}}>

      {/* Header */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:`0 ${p}px`,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1280,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:isMobile?56:64}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🪙</div>
            <div>
              <div style={{fontWeight:800,fontSize:isMobile?14:16}}>Narangi Finance</div>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:syncDot,flexShrink:0}}/>
                <span style={{color:T.muted,fontSize:10}}>{syncLabel} · {activeMonth} {activeYear}</span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}} ref={yearPickerRef}>
            <button onClick={()=>setShowYearPicker(v=>!v)} style={{background:T.card,border:`1px solid ${T.border}`,color:T.accent,borderRadius:8,padding:"6px 12px",fontSize:13,fontWeight:700,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>{activeYear} ▾</button>
            {showYearPicker&&(
              <div style={{position:"absolute",top:isMobile?56:64,right:p,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:8,zIndex:300,boxShadow:"0 8px 32px #00000088"}}>
                {YEARS.map(y=><button key={y} onClick={()=>{ setActiveYear(y); if(y===START_YEAR) setActiveMonth(m=>MONTHS.indexOf(m)<START_MONTH_IDX?START_MONTH:m); setShowYearPicker(false); }} style={{display:"block",width:"100%",background:activeYear===y?T.accent:"transparent",color:activeYear===y?T.bg:T.text,border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,fontWeight:600,cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent"}}>{y}</button>)}
              </div>
            )}
            {!isMobile&&TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?T.accent:"transparent",color:tab===t.id?T.bg:T.muted,border:`1px solid ${tab===t.id?T.accent:T.border}`,borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>{t.label}</button>
            ))}
            {/* Sign out */}
            <button onClick={()=>signOut(auth)} title={`Signed in as ${user?.email}`} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
              {isMobile?"👤":`👤 ${user?.displayName?.split(" ")[0]||"Sign out"}`}
            </button>
          </div>
        </div>
      </div>

      {/* Month strip */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{display:"flex",gap:6,padding:`8px ${p}px`,minWidth:"max-content"}}>
          {getVisibleMonths(activeYear).map(m=>{
            const has=getTxns(m,activeYear).length>0;
            return <button key={m} onClick={()=>setActiveMonth(m)} style={{background:activeMonth===m?T.accent:has?T.accentDim:"transparent",color:activeMonth===m?T.bg:has?T.accent:T.muted,border:`1px solid ${activeMonth===m?T.accent:has?T.accent+"55":T.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",WebkitTapHighlightColor:"transparent"}}>{m}</button>;
          })}
        </div>
      </div>

      <div style={{maxWidth:1280,margin:"0 auto",padding:`${p}px`}}>

        {/* DASHBOARD */}
        {tab==="dashboard"&&(
          <div style={{display:"flex",flexDirection:"column",gap:isMobile?10:14}}>
            <OpeningBalanceCard state={s} upd={updNow} activeYear={activeYear} activeMonth={activeMonth}/>
            {summary.variable>0&&(
              <div style={{background:varStatus+"15",border:`1px solid ${varStatus}44`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:varStatus,flexShrink:0}}/>
                <span style={{fontSize:13,fontWeight:600,color:varStatus}}>Variable: {fmt(summary.variable)} / {fmt(s.variableBudget)} ({varPct}%){varPct>=100?" 🔴 Over!":varPct>=80?" ⚠️ Near limit":" ✅ On track"}</span>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:isMobile?10:14}}>
              {[
                {label:"Opening",val:openingTotal,color:T.blue,icon:"🏦"},
                {label:"Income",val:summary.income,prev:prevSummary.income,color:T.accent,icon:"↑"},
                {label:"Fixed",val:summary.fixed,prev:prevSummary.fixed,color:T.blue,icon:"🔒"},
                {label:"Variable",val:summary.variable,prev:prevSummary.variable,color:varStatus,icon:"📊"},
                {label:"Balance",val:currentBalance,color:currentBalance>=0?T.green:T.rose,icon:"💰"},
              ].map((k,i)=>{
                const delta=(!isFirstTrackedMonth)&&k.prev!=null&&k.prev>0?Math.round(((k.val-k.prev)/k.prev)*100):null;
                return(
                  <Card key={k.label} style={{padding:"14px",gridColumn:isMobile&&i===4?"span 2":"auto"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{k.label}</span>
                      <span style={{fontSize:12}}>{k.icon}</span>
                    </div>
                    <div style={{fontSize:isMobile?17:20,fontWeight:800,color:k.color}}>{fmt(k.val)}</div>
                    {delta!=null&&<span style={{fontSize:10,fontWeight:700,color:delta>=0?T.green:T.rose,background:(delta>=0?T.green:T.rose)+"18",borderRadius:999,padding:"2px 6px",marginTop:4,display:"inline-block"}}>{delta>=0?"↑":"↓"}{Math.abs(delta)}% vs {prevIdx>=0?MONTHS[prevIdx]:MONTHS[11]}</span>}
                  </Card>
                );
              })}
            </div>
            <Card>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>{activeYear} Annual Overview</div>
              <ResponsiveContainer width="100%" height={isMobile?160:200}>
                <BarChart data={annualData} barSize={isMobile?8:12}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                  <XAxis dataKey="month" stroke={T.muted} tick={{fontSize:9}}/>
                  <YAxis stroke={T.muted} tick={{fontSize:9}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} width={28}/>
                  <Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,fontSize:12}}/>
                  <Bar dataKey="opening" fill={T.blue} radius={[3,3,0,0]} name="Opening"/>
                  <Bar dataKey="income" fill={T.accent} radius={[3,3,0,0]} name="Income"/>
                  <Bar dataKey="expenses" fill={T.amber} radius={[3,3,0,0]} name="Expenses"/>
                  <Bar dataKey="savings" fill={T.purple} radius={[3,3,0,0]} name="Savings"/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Spend by Category — {activeMonth}</div>
              {catBreakdown.length===0?<div style={{color:T.muted,textAlign:"center",padding:"24px 0"}}>No expense data yet</div>:(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {catBreakdown.map((c,i)=>(
                    <div key={c.name} style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                          <span style={{fontSize:13,fontWeight:700,color:PIE_COLORS[i%PIE_COLORS.length],marginLeft:8,flexShrink:0}}>{fmt(c.value)}</span>
                        </div>
                        <div style={{height:4,background:T.border,borderRadius:99}}><div style={{height:"100%",width:`${Math.min(100,(c.value/catBreakdown[0].value)*100)}%`,background:PIE_COLORS[i%PIE_COLORS.length],borderRadius:99}}/></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(2,1fr)",gap:isMobile?10:14}}>
              {members.map((m,i)=>{
                const spent=monthTxns.filter(t=>t.person===m&&!["INCOME","CC PAYMENT"].includes(t.category)).reduce((a,t)=>a+t.amount,0);
                const earned=monthTxns.filter(t=>t.person===m&&t.category==="INCOME").reduce((a,t)=>a+t.amount,0);
                const personOb=ob[m]||0;
                const clr=[T.accent,T.purple][i%2];
                return(
                  <Card key={m}>
                    <div style={{fontWeight:700,color:clr,fontSize:15,marginBottom:10}}>{m}</div>
                    <div style={{fontSize:12,color:T.muted,marginBottom:3}}>Opening <span style={{color:T.blue,fontWeight:700}}>{fmt(personOb)}</span></div>
                    <div style={{fontSize:12,color:T.muted,marginBottom:3}}>Earned <span style={{color:T.accent,fontWeight:700}}>{fmt(earned)}</span></div>
                    <div style={{fontSize:12,color:T.muted,marginBottom:8}}>Spent <span style={{color:T.rose,fontWeight:700}}>{fmt(spent)}</span></div>
                    <div style={{fontSize:18,fontWeight:800,color:personOb+earned-spent>=0?T.green:T.rose}}>{fmt(personOb+earned-spent)}</div>
                    <div style={{marginTop:8,height:4,background:T.border,borderRadius:99}}><div style={{height:"100%",width:personOb+earned>0?`${Math.min(100,(spent/(personOb+earned))*100)}%`:"0%",background:clr,borderRadius:99}}/></div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {tab==="transactions"&&<TransactionsTab s={s} addTxn={addTxn} delTxn={delTxn} editTxn={editTxn} setEditTxn={setEditTxn} saveEditTxn={saveEditTxn} activeMonth={activeMonth} setActiveMonth={setActiveMonth} activeYear={activeYear} getTxns={getTxns} summarize={summarize} isMobile={isMobile} onOpenImport={()=>setShowImport(true)}/>}
        {tab==="plan"&&<PlanTab s={s} upd={upd} updNow={updNow} totalIncome={totalIncome} totalFixed={totalFixed} totalSavings={totalSavings} transactions={s.transactions||[]} activeMonth={activeMonth} activeYear={activeYear} isMobile={isMobile}/>}
        {tab==="credit cards"&&<CreditCardsTab s={s} upd={upd} updNow={updNow} transactions={s.transactions||[]} getTxns={getTxns} activeMonth={activeMonth} setActiveMonth={setActiveMonth} activeYear={activeYear} addTxn={addTxn} isMobile={isMobile}/>}
      </div>

      <button onClick={()=>setShowQuickAdd(true)} style={{position:"fixed",bottom:isMobile?80:28,right:20,width:56,height:56,borderRadius:"50%",background:`linear-gradient(135deg,${T.accent},${T.purple})`,border:"none",color:"white",fontSize:28,cursor:"pointer",boxShadow:`0 4px 20px ${T.accent}66`,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>+</button>

      <Modal open={showQuickAdd} onClose={()=>setShowQuickAdd(false)} title="⚡ Quick Add">
        <TxnForm state={s} value={quickForm} onChange={setQuickForm} onSubmit={()=>{addTxn(quickForm);setQuickForm(f=>({...f,spentOn:"",amount:"",note:"",tags:[]}));setShowQuickAdd(false);}}/>
      </Modal>
      <Modal open={!!editTxn} onClose={()=>setEditTxn(null)} title="✏️ Edit Transaction">
        {editTxn&&<TxnForm state={s} value={editTxn} onChange={setEditTxn} onSubmit={()=>saveEditTxn(editTxn)} submitLabel="Save Changes"/>}
      </Modal>
      <ImportModal open={showImport} onClose={()=>setShowImport(false)} s={s} onImport={txns=>{
        const newS={...s,transactions:[...(s.transactions||[]),...txns]};
        setS(newS); saveNow(newS);
      }}/>

      {isMobile&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.surface,borderTop:`1px solid ${T.border}`,display:"flex",zIndex:300,paddingBottom:"env(safe-area-inset-bottom)"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"10px 4px",background:"transparent",border:"none",color:tab===t.id?T.accent:T.muted,cursor:"pointer",WebkitTapHighlightColor:"transparent",minHeight:56}}>
              <span style={{fontSize:20}}>{t.icon}</span>
              <span style={{fontSize:10,fontWeight:700}}>{t.label}</span>
              {tab===t.id&&<div style={{width:20,height:2,background:T.accent,borderRadius:99}}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Transactions Tab ──────────────────────────────────────────────────────────
function TransactionsTab({s,addTxn,delTxn,editTxn,setEditTxn,saveEditTxn,activeMonth,setActiveMonth,activeYear,getTxns,summarize,isMobile,onOpenImport}) {
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

      <div style={{display:"flex",gap:10}}>
        {isMobile&&<Btn full onClick={()=>setShowForm(true)} style={{padding:"14px",flex:1}}>➕ Add Transaction</Btn>}
        <Btn full={isMobile} variant="outline" color={T.purple} onClick={onOpenImport} style={{padding:isMobile?"14px":"11px 20px"}}>📥 Import Excel</Btn>
      </div>
      {!isMobile&&(
        <Card>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>➕ Add Transaction</div>
          <TxnForm state={s} value={form} onChange={setForm} onSubmit={()=>{addTxn(form);setForm(f=>({...f,spentOn:"",amount:"",note:"",tags:[]}));}}/>
        </Card>
      )}

      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search description, category, note, tags…" style={{...iSty,flex:1,minWidth:180,fontSize:13,padding:"9px 12px"}}/>
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
                <div style={{width:40,height:40,borderRadius:10,background:catClr+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{CAT_ICON[t.category]||"📌"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.spentOn}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>{t.date.slice(5)} · <span style={{color:catClr}}>{t.subCat}</span> · <span style={{color:t.person===(s.members||[])[0]?T.accent:T.purple}}>{t.person}</span></div>
                  {(t.note||(t.tags||[]).length>0)&&<div style={{fontSize:11,color:T.muted,marginTop:2}}>{t.note}{t.note&&(t.tags||[]).length>0?" · ":""}{(t.tags||[]).join(", ")}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:15,fontWeight:800,color:t.category==="INCOME"?T.accent:T.text}}>{fmt(t.amount)}</div>
                  <div style={{display:"flex",gap:6,justifyContent:"flex-end",marginTop:4}}>
                    <button onClick={()=>setEditTxn({...t,amount:String(t.amount)})} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:16,padding:"2px",WebkitTapHighlightColor:"transparent"}}>✏️</button>
                    <button onClick={()=>delTxn(t.id)} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:16,padding:"2px",WebkitTapHighlightColor:"transparent"}}>🗑</button>
                  </div>
                </div>
              </div>
            ):(
              <div key={t.id} style={{background:T.surface,borderRadius:10,padding:"10px 14px",display:"grid",gridTemplateColumns:"80px 1fr 150px 110px 70px 60px",gap:10,alignItems:"center"}}>
                <span style={{color:T.muted,fontSize:12}}>{t.date.slice(5)}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.spentOn}</div>
                  {(t.note||(t.tags||[]).length>0)&&<div style={{fontSize:11,color:T.muted}}>{t.note}{t.note&&(t.tags||[]).length>0?" · ":""}{(t.tags||[]).join(", ")}</div>}
                </div>
                <Badge color={catClr}>{t.subCat}</Badge>
                <span style={{fontWeight:700,color:t.category==="INCOME"?T.accent:T.text,textAlign:"right"}}>{fmt(t.amount)}</span>
                <Badge color={t.person===(s.members||[])[0]?T.accent:T.purple} small>{t.person}</Badge>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setEditTxn({...t,amount:String(t.amount)})} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:16,padding:"2px"}}>✏️</button>
                  <button onClick={()=>delTxn(t.id)} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:16,padding:"2px"}}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="➕ Add Transaction">
        <TxnForm state={s} value={form} onChange={setForm} onSubmit={()=>{addTxn(form);setForm(f=>({...f,spentOn:"",amount:"",note:"",tags:[]}));setShowForm(false);}}/>
      </Modal>
    </div>
  );
}

// ─── Plan Tab ──────────────────────────────────────────────────────────────────
function PlanTab({s,upd,updNow,totalIncome,totalFixed,totalSavings,transactions,activeMonth,activeYear,isMobile}) {
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
  const fixedActuals=useMemo(()=>{ const m={}; monthTxns.filter(t=>t.category==="FIXED EXPENSES").forEach(t=>{m[t.subCat]=(m[t.subCat]||0)+t.amount;}); return m; },[monthTxns]);
  const varActual=useMemo(()=>monthTxns.filter(t=>t.category==="VARIABLE EXPENSES").reduce((a,t)=>a+t.amount,0),[monthTxns]);
  const incomeActuals=useMemo(()=>{ const m={}; monthTxns.filter(t=>t.category==="INCOME").forEach(t=>{m[t.subCat]=(m[t.subCat]||0)+t.amount;}); return m; },[monthTxns]);
  const savingsProgress=useMemo(()=>{ const mp={}; transactions.filter(t=>t.category==="SAVINGS").forEach(t=>{mp[t.subCat]=(mp[t.subCat]||0)+t.amount;}); return mp; },[transactions]);

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
                <ActualBar budget={inc.amount} actual={incomeActuals[inc.label]||0} color={T.accent}/>
              </>
            )}
          </div>
        ))}
        <div style={{display:"flex",gap:8}}>
          <input value={newIncome.label} onChange={e=>setNewIncome(v=>({...v,label:e.target.value}))} placeholder="Source name" style={{...iSt,flex:1}}/>
          <input type="number" value={newIncome.amount} onChange={e=>setNewIncome(v=>({...v,amount:e.target.value}))} placeholder="₹" style={{...iSt,width:90,textAlign:"right"}}/>
          <button onClick={()=>{if(!newIncome.label||!newIncome.amount)return;updNow({income:[...(s.income||[]),{id:uid(),label:newIncome.label,amount:+newIncome.amount}]});setNewIncome({label:"",amount:""}); }} style={{background:T.accent,border:"none",color:T.bg,borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>+ Add</button>
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
                <ActualBar budget={fe.budget} actual={fixedActuals[fe.label]||0} color={T.blue}/>
              </>
            )}
          </div>
        ))}
        <div style={{display:"flex",gap:8}}>
          <input value={newFixed.label} onChange={e=>setNewFixed(v=>({...v,label:e.target.value}))} placeholder="Expense name" style={{...iSt,flex:1}}/>
          <input type="number" value={newFixed.budget} onChange={e=>setNewFixed(v=>({...v,budget:e.target.value}))} placeholder="₹" style={{...iSt,width:90,textAlign:"right"}}/>
          <button onClick={()=>{if(!newFixed.label||!newFixed.budget)return;updNow({fixedExpenses:[...(s.fixedExpenses||[]),{id:uid(),label:newFixed.label,budget:+newFixed.budget}]});setNewFixed({label:"",budget:""});}} style={{background:T.blue,border:"none",color:T.bg,borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>+ Add</button>
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
          const contributed=savingsProgress[sv.label]||0;
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
    </div>
  );
}

// ─── Credit Cards Tab ──────────────────────────────────────────────────────────
function CreditCardsTab({s,upd,updNow,transactions,getTxns,activeMonth,setActiveMonth,activeYear,addTxn,isMobile}) {
  const [showAddCard,setShowAddCard]=useState(false);
  const members=s.members||DEFAULTS.members;
  const [newCard,setNewCard]=useState({name:"",person:members[0],initialOutstanding:"",limit:""});
  const [payForm,setPayForm]=useState({ccId:null,amount:"",date:`${activeYear}-${mNum(activeMonth)}-01`,note:""});
  const [editCardId,setEditCardId]=useState(null);
  const [editCardVal,setEditCardVal]=useState({});
  const iSt={...iSty,fontSize:13,padding:"8px 10px"};

  useEffect(()=>setPayForm(f=>f.ccId?{...f,date:`${activeYear}-${mNum(activeMonth)}-01`}:f),[activeYear,activeMonth]);

  const ccStats=useMemo(()=>(s.creditCards||[]).map(cc=>{
    // Opening balance = balance at START of activeMonth
    // computeCCBalance(cc, y, m) loops up to but NOT including month m
    // so calling with activeMonth gives us: balance at end of (activeMonth-1) = opening of activeMonth ✅
    const openingBalance=computeCCBalance(cc,activeYear,activeMonth,transactions,s.ccMonthlyCharges);
    const newCharges=(s.ccMonthlyCharges||{})[ccKey(cc.id,activeYear,activeMonth)]||0;
    const monthPayments=getTxns(activeMonth,activeYear).filter(t=>t.category==="CC PAYMENT"&&t.ccId===cc.id).reduce((a,t)=>a+t.amount,0);
    // FIX: closing can't go below 0
    const closingBalance=Math.max(0,openingBalance+newCharges-monthPayments);
    const totalPaid=transactions.filter(t=>t.category==="CC PAYMENT"&&t.ccId===cc.id).reduce((a,t)=>a+t.amount,0);
    const totalCharges=Object.entries(s.ccMonthlyCharges||{}).filter(([k])=>k.startsWith(cc.id+"_")).reduce((a,[,v])=>a+v,0);
    const currentBalance=Math.max(0,(cc.initialOutstanding||cc.outstanding||0)+totalCharges-totalPaid);
    const recentPmts=transactions.filter(t=>t.category==="CC PAYMENT"&&t.ccId===cc.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
    return {...cc,openingBalance,newCharges,monthPayments,closingBalance,totalPaid,totalCharges,currentBalance,recentPmts};
  }),[s.creditCards,s.ccMonthlyCharges,transactions,activeMonth,activeYear]);

  const CC_COLORS=[T.accent,T.purple,T.blue,T.amber,T.green];

  const logPayment=ccId=>{
    const amt=parseFloat(payForm.amount);
    if(!(amt>0)) return; // FIX: validate positive amount
    const cc=(s.creditCards||[]).find(c=>c.id===ccId);
    addTxn({date:payForm.date,category:"CC PAYMENT",subCat:cc.name,spentOn:`CC Payment - ${cc.name}`,amount:amt,person:cc.person,note:payForm.note,tags:[],ccId});
    setPayForm(f=>({...f,ccId:null,amount:"",note:""}));
  };

  // Local debounce for CC charges — typing fires many times, debounce before saving
  const chargesTimer=useRef(null);
  const updateCharges=(ccId,value)=>{
    const k=ccKey(ccId,activeYear,activeMonth);
    // Update UI state immediately via upd, save to Firebase after 600ms of no typing
    upd({ccMonthlyCharges:{...(s.ccMonthlyCharges||{}),[k]:+value||0}});
    clearTimeout(chargesTimer.current);
    chargesTimer.current=setTimeout(()=>{
      updNow({ccMonthlyCharges:{...(s.ccMonthlyCharges||{}),[k]:+value||0}});
    },600);
  };

  // Empty state
  if((s.creditCards||[]).length===0&&!showAddCard) return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{textAlign:"center",padding:"48px 24px",color:T.muted}}>
        <div style={{fontSize:40,marginBottom:12}}>💳</div>
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
                      <input type="number" value={editCardVal.initialOutstanding||""} onChange={e=>setEditCardVal(v=>({...v,initialOutstanding:+e.target.value}))} placeholder="Starting debt ₹" style={iSt}/>
                      <input type="number" value={editCardVal.limit||""} onChange={e=>setEditCardVal(v=>({...v,limit:+e.target.value}))} placeholder="Credit limit ₹" style={iSt}/>
                    </div>
                    <div style={{fontSize:11,color:T.muted,background:T.surface,borderRadius:8,padding:"8px 12px"}}>💡 Starting debt = what you owed when you first started tracking this card</div>
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
                  {cc.limit>0&&<span style={{fontSize:11,color:T.muted}}>Limit {fmt(cc.limit)} · Used <span style={{color:utilPct>=90?T.rose:utilPct>=70?T.amber:T.green,fontWeight:700}}>{utilPct}%</span></span>}
                </div>
              </div>
              {editCardId!==cc.id&&(
                <div style={{display:"flex",gap:8,flexShrink:0}}>
                  <button onClick={()=>{setEditCardId(cc.id);setEditCardVal({name:cc.name,initialOutstanding:cc.initialOutstanding||cc.outstanding||0,limit:cc.limit});}} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:20,padding:"4px",WebkitTapHighlightColor:"transparent"}}>✏️</button>
                  <button onClick={()=>{if(confirmDel(cc.name)) updNow({creditCards:(s.creditCards||[]).filter(c=>c.id!==cc.id)});}} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:20,padding:"4px",WebkitTapHighlightColor:"transparent"}}>🗑</button>
                </div>
              )}
            </div>

            {/* Monthly Statement */}
            <div style={{background:T.surface,borderRadius:12,padding:"14px",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:clr,marginBottom:10}}>📋 {activeMonth} {activeYear} Statement</div>
              {[
                {label:"Opening Balance",val:cc.openingBalance,color:T.muted,editable:false},
                {label:"+ New Charges",val:cc.newCharges,color:T.rose,editable:true},
                {label:"− Payments Made",val:cc.monthPayments,color:T.green,editable:false},
                {label:"Closing Balance",val:cc.closingBalance,color:cc.closingBalance===0?T.green:T.amber,bold:true},
              ].map((row,ri)=>(
                <div key={ri} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}22`}}>
                  <span style={{fontSize:13,color:T.muted}}>{row.label}</span>
                  {row.editable?(
                    <input type="number" value={row.val||""} onChange={e=>updateCharges(cc.id,e.target.value)} placeholder="0" style={{...iSt,width:130,textAlign:"right",color:T.rose,fontWeight:700,padding:"5px 8px"}}/>
                  ):(
                    <span style={{fontSize:14,fontWeight:row.bold?800:700,color:row.color}}>{row.val===0?"✅ Cleared":fmt(row.val)}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Overall */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`,marginBottom:14}}>
              <span style={{fontSize:13,color:T.muted}}>Current Balance (Overall)</span>
              <span style={{fontSize:15,fontWeight:800,color:cc.currentBalance===0?T.green:T.amber}}>{cc.currentBalance===0?"✅ Cleared":fmt(cc.currentBalance)}</span>
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
                <div style={{fontWeight:700,fontSize:13,color:clr,marginBottom:10}}>Log Payment — {activeMonth} {activeYear}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <input type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))} style={iSt}/>
                  <input type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} placeholder="Amount ₹" style={iSt}/>
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
                    <span style={{fontSize:12,color:T.muted}}>{t.date} — {t.note||"Payment"}</span>
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
            <TI label="Current Debt ₹ (what you owe today)" type="number" value={newCard.initialOutstanding} onChange={v=>setNewCard(c=>({...c,initialOutstanding:v}))} placeholder="0"/>
            <TI label="Credit Limit ₹" type="number" value={newCard.limit} onChange={v=>setNewCard(c=>({...c,limit:v}))} placeholder="0"/>
            <div style={{fontSize:11,color:T.muted,padding:"8px 12px",background:T.surface,borderRadius:8}}>💡 Enter your current debt once. Then log new monthly charges and payments — the balance auto-calculates.</div>
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
