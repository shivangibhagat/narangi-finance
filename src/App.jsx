import { useState, useEffect, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

const FIRESTORE_DOC = doc(db, "narangi-finance", "shared-data");

// ─── Theme ─────────────────────────────────────────────────────────────────────
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
const CAT_CLR = { INCOME:T.accent,"FIXED EXPENSES":T.blue,"VARIABLE EXPENSES":T.amber,SAVINGS:T.purple,"CC PAYMENT":T.rose };
const PIE_COLORS = [T.accent,T.blue,T.amber,T.purple,T.rose,"#34D399","#818CF8","#FB923C"];
const YEARS = [2025,2026,2027,2028,2029,2030];

// ─── Mobile Hook ───────────────────────────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(()=> typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(()=>{
    const h = ()=> setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return ()=> window.removeEventListener("resize", h);
  },[]);
  return m;
}

// ─── Default State ─────────────────────────────────────────────────────────────
const DEFAULTS = {
  members: ["NARR","SHIVU"],
  income: [
    {id:"i1",label:"NARR Salary",amount:68000},
    {id:"i2",label:"SHIVU Salary",amount:100000}
  ],
  fixedExpenses: [
    {id:"f1",label:"House Rent",budget:19500},{id:"f2",label:"Send to Home",budget:15000},
    {id:"f3",label:"Light Bill",budget:2000},{id:"f4",label:"Gas Bill",budget:1500},
    {id:"f5",label:"WiFi Bill",budget:500},{id:"f6",label:"Grocery",budget:10000},
    {id:"f7",label:"Monthly SIP",budget:10000},{id:"f8",label:"Misc",budget:5000},
    {id:"f9",label:"Mediclaim",budget:5000},{id:"f10",label:"RentMojo Items",budget:1700}
  ],
  variableBudget: 20000,
  variableSubCats: ["ENTERTAINMENT","CAFES/RESTAURANTS","SUBSCRIPTIONS","GIFTS","ONLINE FOOD","SHOPPING","BODY CARE","TRANSPORT"],
  savings: [
    {id:"s1",label:"Travel Fund",monthlyTarget:14950,goalTarget:300000},
    {id:"s2",label:"Emergency Fund",monthlyTarget:14950,goalTarget:500000},
    {id:"s3",label:"Home Fund",monthlyTarget:14950,goalTarget:1000000},
    {id:"s4",label:"Car Fund",monthlyTarget:14950,goalTarget:800000},
    {id:"s5",label:"Personal Savings",monthlyTarget:10000,goalTarget:200000}
  ],
  creditCards: [
    {id:"cc1",name:"NARR Credit Card",person:"NARR",outstanding:94572,limit:150000},
    {id:"cc2",name:"SHIVU Credit Card",person:"SHIVU",outstanding:67606,limit:150000}
  ],
  customTags: ["reimbursable","birthday","travel","emergency","work"],
  openingBalances: { "2026-05": { NARR:0, SHIVU:0, note:"First month" } }
};

const SEED = [
  {id:"t1",date:"2026-05-01",category:"INCOME",subCat:"NARR Salary",spentOn:"Narr May Salary",amount:68000,person:"NARR",note:"",tags:[]},
  {id:"t2",date:"2026-05-01",category:"CC PAYMENT",subCat:"NARR Credit Card",spentOn:"CC Payment Narr May",amount:59000,person:"NARR",note:"May payment",tags:[],ccId:"cc1"},
  {id:"t3",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",spentOn:"Breakfast on 30th April",amount:210,person:"NARR",note:"",tags:[]},
  {id:"t4",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",spentOn:"Coffee on 30th April",amount:289,person:"SHIVU",note:"",tags:[]},
  {id:"t5",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"ONLINE FOOD",spentOn:"Pizza on 30th April",amount:651,person:"SHIVU",note:"",tags:[]},
  {id:"t6",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"BODY CARE",spentOn:"Shopping Miniso",amount:390,person:"NARR",note:"",tags:[]},
  {id:"t7",date:"2026-05-01",category:"FIXED EXPENSES",subCat:"Gas Bill",spentOn:"Gas Bill April",amount:354,person:"SHIVU",note:"",tags:[]},
  {id:"t8",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"ENTERTAINMENT",spentOn:"Mall Parking",amount:20,person:"NARR",note:"",tags:[]},
  {id:"t9",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"BODY CARE",spentOn:"Hair Color Narr",amount:2572,person:"NARR",note:"",tags:[]},
  {id:"t10",date:"2026-05-01",category:"FIXED EXPENSES",subCat:"RentMojo Items",spentOn:"Rent Mojo Rent",amount:1613,person:"SHIVU",note:"",tags:[]},
  {id:"t11",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"ONLINE FOOD",spentOn:"Eatsure Lunch",amount:625,person:"SHIVU",note:"",tags:[]},
  {id:"t12",date:"2026-05-01",category:"VARIABLE EXPENSES",subCat:"SUBSCRIPTIONS",spentOn:"Hotstar Subscription",amount:1500,person:"SHIVU",note:"",tags:[]},
  {id:"t13",date:"2026-05-01",category:"FIXED EXPENSES",subCat:"Misc",spentOn:"Dinner for Mummy",amount:156,person:"NARR",note:"",tags:[]},
  {id:"t14",date:"2026-05-01",category:"FIXED EXPENSES",subCat:"Grocery",spentOn:"Blinkit groceries",amount:246,person:"SHIVU",note:"",tags:[]},
  {id:"t15",date:"2026-05-04",category:"FIXED EXPENSES",subCat:"Misc",spentOn:"Mummy Papa Train to Surat",amount:2363,person:"NARR",note:"",tags:[]},
  {id:"t16",date:"2026-05-07",category:"CC PAYMENT",subCat:"SHIVU Credit Card",spentOn:"CC Payment Shivu May",amount:59000,person:"SHIVU",note:"May payment",tags:[],ccId:"cc2"},
  {id:"t17",date:"2026-05-07",category:"VARIABLE EXPENSES",subCat:"TRANSPORT",spentOn:"Train Tickets to Vadodara",amount:1754,person:"SHIVU",note:"",tags:["travel"]},
  {id:"t18",date:"2026-05-07",category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",spentOn:"Evening Snack",amount:458,person:"NARR",note:"",tags:[]},
];

// ─── UI Primitives ─────────────────────────────────────────────────────────────
const Card = ({children,style={}}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"16px 18px",...style}}>{children}</div>
);
const Btn = ({children,onClick,color=T.accent,variant="solid",small,full,style={}}) => (
  <button onClick={onClick} style={{
    background:variant==="solid"?color:"transparent",color:variant==="solid"?T.bg:color,
    border:`1px solid ${color}`,borderRadius:10,
    padding:small?"8px 14px":"11px 20px",fontSize:small?12:14,fontWeight:700,
    cursor:"pointer",width:full?"100%":"auto",
    WebkitTapHighlightColor:"transparent",...style
  }}>{children}</button>
);
const Badge = ({color,children,small}) => (
  <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:999,padding:small?"1px 8px":"3px 10px",fontSize:small?10:11,fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>
);
const Label = ({children}) => (
  <label style={{color:T.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>{children}</label>
);
const FieldWrap = ({label,children}) => (
  <div style={{display:"flex",flexDirection:"column",gap:0}}>
    {label&&<Label>{label}</Label>}
    {children}
  </div>
);
const inputStyle = {background:T.surface,border:`1px solid ${T.border}`,color:T.text,borderRadius:10,padding:"11px 14px",fontSize:15,outline:"none",width:"100%",boxSizing:"border-box",WebkitAppearance:"none"};
const TextInput = ({label,value,onChange,type="text",placeholder=""}) => (
  <FieldWrap label={label}>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={inputStyle}/>
  </FieldWrap>
);
const Sel = ({label,value,onChange,options}) => (
  <FieldWrap label={label}>
    <select value={value} onChange={e=>onChange(e.target.value)} style={{...inputStyle,appearance:"none"}}>
      {options.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  </FieldWrap>
);

// ─── Bottom Sheet Modal (mobile-friendly) ─────────────────────────────────────
const Modal = ({open,onClose,title,children}) => {
  const isMobile = useIsMobile();
  if(!open) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"#00000088",zIndex:1000,display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{
        background:T.card,border:`1px solid ${T.border}`,
        borderRadius:isMobile?"20px 20px 0 0":"20px",
        padding:"24px 20px",
        width:isMobile?"100%":"480px",maxWidth:"100%",
        maxHeight:isMobile?"92vh":"90vh",overflowY:"auto"
      }} onClick={e=>e.stopPropagation()}>
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
  const subCatMap = {
    INCOME:state.income.map(i=>i.label),
    "FIXED EXPENSES":state.fixedExpenses.map(f=>f.label),
    "VARIABLE EXPENSES":state.variableSubCats,
    SAVINGS:state.savings.map(s=>s.label),
    "CC PAYMENT":state.creditCards.map(c=>c.name),
  };
  const upd = patch => onChange({...value,...patch});
  const subCats = subCatMap[value.category]||[];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <TextInput label="Date" type="date" value={value.date} onChange={v=>upd({date:v})}/>
        <Sel label="Person" value={value.person} onChange={v=>upd({person:v})} options={state.members}/>
      </div>
      <Sel label="Category" value={value.category} onChange={v=>{
        const subs=subCatMap[v]||[];
        upd({category:v,subCat:subs[0]||"",ccId:undefined});
      }} options={["INCOME","FIXED EXPENSES","VARIABLE EXPENSES","SAVINGS","CC PAYMENT"]}/>
      <Sel label="Sub-Category" value={value.subCat} onChange={v=>{
        const cc=value.category==="CC PAYMENT"?state.creditCards.find(c=>c.name===v):null;
        upd({subCat:v,ccId:cc?.id});
      }} options={subCats.length?subCats:["—"]}/>
      <TextInput label="Description" value={value.spentOn} onChange={v=>upd({spentOn:v})} placeholder="What was this for?"/>
      <TextInput label="Amount (₹)" type="number" value={value.amount} onChange={v=>upd({amount:v})} placeholder="0"/>
      <TextInput label="Note (optional)" value={value.note||""} onChange={v=>upd({note:v})} placeholder="Any details..."/>
      <FieldWrap label="Tags">
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {state.customTags.map(tag=>{
            const active=(value.tags||[]).includes(tag);
            return <button key={tag} onClick={()=>upd({tags:active?(value.tags||[]).filter(t=>t!==tag):[...(value.tags||[]),tag]})}
              style={{background:active?T.accent+"33":"transparent",color:active?T.accent:T.muted,border:`1px solid ${active?T.accent:T.border}`,borderRadius:999,padding:"6px 14px",fontSize:13,fontWeight:600,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>{tag}</button>;
          })}
        </div>
      </FieldWrap>
      <Btn full onClick={onSubmit} style={{marginTop:4,padding:"14px"}}>{submitLabel}</Btn>
    </div>
  );
}

// ─── Opening Balance Card ──────────────────────────────────────────────────────
function OpeningBalanceCard({state,upd,activeYear,activeMonth}) {
  const key = monthKey(activeYear,activeMonth);
  const bal = state.openingBalances?.[key]||{NARR:0,SHIVU:0,note:""};
  const [editing,setEditing] = useState(false);
  const [draft,setDraft] = useState(bal);
  useEffect(()=>{ setDraft(state.openingBalances?.[key]||{NARR:0,SHIVU:0,note:""}); setEditing(false); },[key]);
  const combined=(bal.NARR||0)+(bal.SHIVU||0);
  const save=()=>{ upd({openingBalances:{...state.openingBalances,[key]:{NARR:+draft.NARR||0,SHIVU:+draft.SHIVU||0,note:draft.note||""}}}); setEditing(false); };
  return (
    <Card style={{border:`1px solid ${T.accent}33`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:T.accent}}>🏦 Opening Bank Balance</div>
          <div style={{fontSize:11,color:T.muted}}>{activeMonth} {activeYear} · Start of month</div>
        </div>
        {!editing&&<Btn small variant="outline" color={T.accent} onClick={()=>{setDraft(bal);setEditing(true);}}>Edit</Btn>}
      </div>
      {editing?(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {state.members.map((m,i)=>(
            <div key={m} style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:13,fontWeight:700,color:[T.accent,T.purple][i],width:56,flexShrink:0}}>{m}</span>
              <input type="number" value={draft[m]||""} onChange={e=>setDraft(d=>({...d,[m]:e.target.value}))} placeholder="0" style={{...inputStyle,flex:1,fontSize:16,fontWeight:700}}/>
            </div>
          ))}
          <input value={draft.note||""} onChange={e=>setDraft(d=>({...d,note:e.target.value}))} placeholder="Note (e.g. SHIVU salary expected on 8th)" style={inputStyle}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <Btn full onClick={save}>Save</Btn>
            <Btn full variant="outline" color={T.muted} onClick={()=>setEditing(false)}>Cancel</Btn>
          </div>
        </div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {state.members.map((m,i)=>(
            <div key={m} style={{padding:"10px 12px",background:T.surface,borderRadius:10,border:`1px solid ${[T.accent,T.purple][i]}33`}}>
              <div style={{fontSize:10,color:[T.accent,T.purple][i],fontWeight:700,marginBottom:4}}>{m}</div>
              <div style={{fontSize:17,fontWeight:800}}>{fmt(bal[m]||0)}</div>
            </div>
          ))}
          <div style={{padding:"10px 12px",background:T.surface,borderRadius:10,border:`1px solid ${T.green}33`}}>
            <div style={{fontSize:10,color:T.green,fontWeight:700,marginBottom:4}}>TOTAL</div>
            <div style={{fontSize:17,fontWeight:800,color:T.green}}>{fmt(combined)}</div>
          </div>
        </div>
      )}
      {!editing&&bal.note&&<div style={{fontSize:11,color:T.muted,marginTop:8,fontStyle:"italic"}}>📝 {bal.note}</div>}
    </Card>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile = useIsMobile();
  const [s, setS] = useState({...DEFAULTS,transactions:SEED});
  const [syncStatus,setSyncStatus] = useState("connecting");
  const isRemote = useRef(false);
  const saveTimer = useRef(null);

  useEffect(()=>{
    const unsub = onSnapshot(FIRESTORE_DOC,(snap)=>{
      if(snap.exists()){ isRemote.current=true; setS(snap.data()); }
      else { setDoc(FIRESTORE_DOC,{...DEFAULTS,transactions:SEED}); }
      setSyncStatus("live");
    },()=>setSyncStatus("error"));
    return unsub;
  },[]);

  useEffect(()=>{
    if(isRemote.current){ isRemote.current=false; return; }
    if(syncStatus==="connecting") return;
    clearTimeout(saveTimer.current);
    setSyncStatus("saving");
    saveTimer.current = setTimeout(()=>{
      setDoc(FIRESTORE_DOC,s).then(()=>setSyncStatus("live")).catch(()=>setSyncStatus("error"));
    },800);
  },[s]);

  const upd = patch => setS(p=>({...p,...patch}));
  const [tab,setTab] = useState("dashboard");
  const [activeYear,setActiveYear] = useState(2026);
  const [activeMonth,setActiveMonth] = useState("May");
  const [showQuickAdd,setShowQuickAdd] = useState(false);
  const [showYearPicker,setShowYearPicker] = useState(false);
  const [quickForm,setQuickForm] = useState({date:`2026-${mNum("May")}-01`,category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",spentOn:"",amount:"",person:"NARR",note:"",tags:[]});

  const getTxns=(m,y=activeYear)=>s.transactions.filter(t=>t.date.startsWith(`${y}-${mNum(m)}`));
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
  const prevSummary=useMemo(()=>summarize(prevIdx>=0?getTxns(MONTHS[prevIdx],activeYear):getTxns("Dec",activeYear-1)),[s.transactions,activeMonth,activeYear]);

  const ob=s.openingBalances?.[monthKey(activeYear,activeMonth)]||{NARR:0,SHIVU:0};
  const openingTotal=(ob.NARR||0)+(ob.SHIVU||0);
  const currentBalance=openingTotal+summary.income-summary.fixed-summary.variable-summary.ccPaid;
  const totalIncome=s.income.reduce((a,i)=>a+i.amount,0);
  const totalFixed=s.fixedExpenses.reduce((a,f)=>a+f.budget,0);
  const totalSavings=s.savings.reduce((a,sv)=>a+sv.monthlyTarget,0);
  const varPct=s.variableBudget>0?Math.round((summary.variable/s.variableBudget)*100):0;
  const varStatus=varPct>=100?T.rose:varPct>=80?T.amber:T.green;

  const addTxn=form=>{
    if(!form.spentOn||!form.amount) return;
    upd({transactions:[...s.transactions,{...form,id:uid(),amount:parseFloat(form.amount),tags:form.tags||[]}]});
  };
  const delTxn=id=>upd({transactions:s.transactions.filter(t=>t.id!==id)});

  const annualData=useMemo(()=>MONTHS.map(m=>{
    const t=summarize(getTxns(m,activeYear));
    const ob2=s.openingBalances?.[monthKey(activeYear,m)]||{NARR:0,SHIVU:0};
    return {month:m,income:t.income,expenses:t.fixed+t.variable,opening:(ob2.NARR||0)+(ob2.SHIVU||0)};
  }),[s.transactions,s.openingBalances,activeYear]);

  const catBreakdown=useMemo(()=>{
    const grp={};
    monthTxns.filter(t=>t.category!=="INCOME").forEach(t=>{grp[t.subCat]=(grp[t.subCat]||0)+t.amount;});
    return Object.entries(grp).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  },[monthTxns]);

  const syncDot = {live:T.green,saving:T.amber,connecting:T.muted,error:T.rose}[syncStatus];
  const syncLabel = {live:"Synced",saving:"Saving…",connecting:"Connecting…",error:"Sync error"}[syncStatus];

  const TABS = [
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"transactions",icon:"📋",label:"Transactions"},
    {id:"plan",icon:"🎯",label:"Plan"},
    {id:"credit cards",icon:"💳",label:"Cards"},
  ];

  const p = isMobile ? 12 : 24; // padding
  const gap = isMobile ? 10 : 16;

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'DM Sans','Segoe UI',sans-serif",paddingBottom:isMobile?76:80}}>

      {/* ── Header ── */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:`0 ${p}px`,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1280,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:isMobile?56:64}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🪙</div>
            <div>
              <div style={{fontWeight:800,fontSize:isMobile?14:16}}>Narangi Finance</div>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:syncDot}}/>
                <span style={{color:T.muted,fontSize:10}}>{syncLabel}</span>
              </div>
            </div>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {/* Year picker */}
            <button onClick={()=>setShowYearPicker(v=>!v)} style={{background:T.card,border:`1px solid ${T.border}`,color:T.accent,borderRadius:8,padding:"6px 12px",fontSize:13,fontWeight:700,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
              {activeYear} ▾
            </button>
            {showYearPicker&&(
              <div style={{position:"absolute",top:isMobile?56:64,right:p,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:8,zIndex:200,boxShadow:"0 8px 32px #00000066"}}>
                {YEARS.map(y=>(
                  <button key={y} onClick={()=>{setActiveYear(y);setShowYearPicker(false);}} style={{display:"block",width:"100%",background:activeYear===y?T.accent:"transparent",color:activeYear===y?T.bg:T.text,border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,fontWeight:600,cursor:"pointer",textAlign:"left"}}>{y}</button>
                ))}
              </div>
            )}
            {/* Desktop tabs in header */}
            {!isMobile&&TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?T.accent:"transparent",color:tab===t.id?T.bg:T.muted,border:`1px solid ${tab===t.id?T.accent:T.border}`,borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Month Selector (mobile: horizontal scroll) ── */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{display:"flex",gap:6,padding:`8px ${p}px`,minWidth:"max-content"}}>
          {MONTHS.map(m=>{
            const has=getTxns(m,activeYear).length>0;
            return <button key={m} onClick={()=>setActiveMonth(m)} style={{
              background:activeMonth===m?T.accent:has?T.accentDim:"transparent",
              color:activeMonth===m?T.bg:has?T.accent:T.muted,
              border:`1px solid ${activeMonth===m?T.accent:has?T.accent+"55":T.border}`,
              borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",
              whiteSpace:"nowrap",WebkitTapHighlightColor:"transparent"
            }}>{m}</button>;
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{maxWidth:1280,margin:"0 auto",padding:`${p}px ${p}px`}}>

        {/* ══ DASHBOARD ══════════════════════════════════════════════════════════ */}
        {tab==="dashboard"&&(
          <div style={{display:"flex",flexDirection:"column",gap}}>

            {/* Opening Balance */}
            <OpeningBalanceCard state={s} upd={upd} activeYear={activeYear} activeMonth={activeMonth}/>

            {/* Budget Alert */}
            {summary.variable>0&&(
              <div style={{background:varStatus+"15",border:`1px solid ${varStatus}44`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:varStatus,flexShrink:0}}/>
                <span style={{fontSize:13,fontWeight:600,color:varStatus}}>
                  Variable: {fmt(summary.variable)} / {fmt(s.variableBudget)} ({varPct}%)
                  {varPct>=100?" 🔴 Over!":varPct>=80?" ⚠️ Near limit":" ✅ On track"}
                </span>
              </div>
            )}

            {/* KPI Grid — 2x3 on mobile, 5 across on desktop */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap}}>
              {[
                {label:"Opening",val:openingTotal,color:T.blue,icon:"🏦"},
                {label:"Income",val:summary.income,color:T.accent,icon:"↑"},
                {label:"Fixed",val:summary.fixed,color:T.blue,icon:"🔒"},
                {label:"Variable",val:summary.variable,color:varStatus,icon:"📊"},
                {label:"Balance",val:currentBalance,color:currentBalance>=0?T.green:T.rose,icon:"💰"},
              ].map((k,i)=>(
                <Card key={k.label} style={{padding:"14px 14px",gridColumn:isMobile&&i===4?"span 2":"auto"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{k.label}</span>
                    <span style={{fontSize:12}}>{k.icon}</span>
                  </div>
                  <div style={{fontSize:isMobile?17:20,fontWeight:800,color:k.color}}>{fmt(k.val)}</div>
                  {i>0&&i<4&&(
                    <div style={{fontSize:10,color:T.muted,marginTop:3}}>
                      {prevIdx>=0?`vs ${MONTHS[prevIdx]}`:""}
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {/* Annual Chart */}
            <Card>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>{activeYear} — Annual Overview</div>
              <ResponsiveContainer width="100%" height={isMobile?160:200}>
                <BarChart data={annualData} barSize={isMobile?8:12}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                  <XAxis dataKey="month" stroke={T.muted} tick={{fontSize:9}}/>
                  <YAxis stroke={T.muted} tick={{fontSize:9}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} width={30}/>
                  <Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,fontSize:12}}/>
                  <Bar dataKey="opening" fill={T.blue} radius={[3,3,0,0]} name="Opening"/>
                  <Bar dataKey="income" fill={T.accent} radius={[3,3,0,0]} name="Income"/>
                  <Bar dataKey="expenses" fill={T.amber} radius={[3,3,0,0]} name="Expenses"/>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Spend by Category — {activeMonth}</div>
              {catBreakdown.length===0?<div style={{color:T.muted,textAlign:"center",padding:"24px 0"}}>No data yet</div>:(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {catBreakdown.map((c,i)=>(
                    <div key={c.name} style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                          <span style={{fontSize:13,fontWeight:700,color:PIE_COLORS[i%PIE_COLORS.length],marginLeft:8,flexShrink:0}}>{fmt(c.value)}</span>
                        </div>
                        <div style={{height:4,background:T.border,borderRadius:99}}>
                          <div style={{height:"100%",width:`${Math.min(100,(c.value/catBreakdown[0].value)*100)}%`,background:PIE_COLORS[i%PIE_COLORS.length],borderRadius:99}}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Per-person */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(2,1fr)",gap}}>
              {s.members.map((m,i)=>{
                const spent=monthTxns.filter(t=>t.person===m&&t.category!=="INCOME"&&t.category!=="CC PAYMENT").reduce((a,t)=>a+t.amount,0);
                const earned=monthTxns.filter(t=>t.person===m&&t.category==="INCOME").reduce((a,t)=>a+t.amount,0);
                const personOb=ob[m]||0;
                const clr=[T.accent,T.purple][i];
                return(
                  <Card key={m}>
                    <div style={{fontWeight:700,color:clr,marginBottom:8,fontSize:15}}>{m}</div>
                    <div style={{fontSize:12,color:T.muted,marginBottom:3}}>Opening <span style={{color:T.blue,fontWeight:700}}>{fmt(personOb)}</span></div>
                    <div style={{fontSize:12,color:T.muted,marginBottom:3}}>Earned <span style={{color:T.accent,fontWeight:700}}>{fmt(earned)}</span></div>
                    <div style={{fontSize:12,color:T.muted,marginBottom:8}}>Spent <span style={{color:T.rose,fontWeight:700}}>{fmt(spent)}</span></div>
                    <div style={{fontSize:16,fontWeight:800,color:personOb+earned-spent>=0?T.green:T.rose}}>{fmt(personOb+earned-spent)}</div>
                    <div style={{marginTop:8,height:4,background:T.border,borderRadius:99}}>
                      <div style={{height:"100%",width:personOb+earned>0?`${Math.min(100,(spent/(personOb+earned))*100)}%`:"0%",background:clr,borderRadius:99}}/>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ TRANSACTIONS ════════════════════════════════════════════════════════ */}
        {tab==="transactions"&&<TransactionsTab s={s} addTxn={addTxn} delTxn={delTxn} activeMonth={activeMonth} setActiveMonth={setActiveMonth} activeYear={activeYear} getTxns={getTxns} summarize={summarize} isMobile={isMobile}/>}

        {/* ══ PLAN ════════════════════════════════════════════════════════════════ */}
        {tab==="plan"&&<PlanTab s={s} upd={upd} totalIncome={totalIncome} totalFixed={totalFixed} totalSavings={totalSavings} transactions={s.transactions} isMobile={isMobile}/>}

        {/* ══ CREDIT CARDS ════════════════════════════════════════════════════════ */}
        {tab==="credit cards"&&<CreditCardsTab s={s} upd={upd} transactions={s.transactions} getTxns={getTxns} activeMonth={activeMonth} setActiveMonth={setActiveMonth} activeYear={activeYear} addTxn={addTxn} isMobile={isMobile}/>}
      </div>

      {/* ── Floating + Button ── */}
      <button onClick={()=>{setQuickForm(f=>({...f,date:`${activeYear}-${mNum(activeMonth)}-01`}));setShowQuickAdd(true);}}
        style={{position:"fixed",bottom:isMobile?80:28,right:20,width:56,height:56,borderRadius:"50%",background:`linear-gradient(135deg,${T.accent},${T.purple})`,border:"none",color:"white",fontSize:28,cursor:"pointer",boxShadow:`0 4px 20px ${T.accent}66`,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>+</button>

      {/* ── Quick Add Modal ── */}
      <Modal open={showQuickAdd} onClose={()=>setShowQuickAdd(false)} title="⚡ Quick Add">
        <TxnForm state={s} value={quickForm} onChange={setQuickForm} onSubmit={()=>{
          addTxn(quickForm);
          setQuickForm(f=>({...f,spentOn:"",amount:"",note:"",tags:[]}));
          setShowQuickAdd(false);
        }}/>
      </Modal>

      {/* ── Bottom Nav (mobile only) ── */}
      {isMobile&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.surface,borderTop:`1px solid ${T.border}`,display:"flex",zIndex:300,paddingBottom:"env(safe-area-inset-bottom)"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              gap:3,padding:"10px 4px",background:"transparent",border:"none",
              color:tab===t.id?T.accent:T.muted,cursor:"pointer",
              WebkitTapHighlightColor:"transparent",minHeight:56
            }}>
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
function TransactionsTab({s,addTxn,delTxn,activeMonth,setActiveMonth,activeYear,getTxns,summarize,isMobile}) {
  const [showForm,setShowForm] = useState(false);
  const [form,setForm] = useState({date:`${activeYear}-${mNum(activeMonth)}-01`,category:"VARIABLE EXPENSES",subCat:s.variableSubCats[0]||"",spentOn:"",amount:"",person:s.members[0]||"NARR",note:"",tags:[]});
  const [filter,setFilter] = useState("ALL");
  const [search,setSearch] = useState("");
  const monthTxns=getTxns(activeMonth,activeYear);
  const summary=summarize(monthTxns);
  const filtered=monthTxns.filter(t=>{
    if(filter!=="ALL"&&t.category!==filter) return false;
    if(search&&!t.spentOn.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        {[
          {label:"In",val:summary.income,color:T.accent},
          {label:"Out",val:summary.fixed+summary.variable+summary.ccPaid,color:T.rose},
          {label:"Count",val:monthTxns.length,color:T.muted,isNum:true},
        ].map(k=>(
          <Card key={k.label} style={{padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
            <div style={{fontSize:16,fontWeight:800,color:k.color}}>{k.isNum?k.val:fmt(k.val)}</div>
          </Card>
        ))}
      </div>

      {/* Add button (mobile: opens modal) */}
      {isMobile?(
        <Btn full onClick={()=>setShowForm(true)} style={{padding:"14px"}}>➕ Add Transaction</Btn>
      ):(
        <Card>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>➕ Add Transaction</div>
          <TxnForm state={s} value={form} onChange={setForm} onSubmit={()=>{addTxn(form);setForm(f=>({...f,spentOn:"",amount:"",note:"",tags:[]}));}}/>
        </Card>
      )}

      {/* Filters */}
      <div style={{display:"flex",gap:8,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:2}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search..." style={{...inputStyle,minWidth:140,flex:1,fontSize:13,padding:"9px 12px"}}/>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:2}}>
        {["ALL","INCOME","FIXED EXPENSES","VARIABLE EXPENSES","SAVINGS","CC PAYMENT"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?(CAT_CLR[f]||T.accent)+"33":"transparent",color:filter===f?(CAT_CLR[f]||T.accent):T.muted,border:`1px solid ${filter===f?(CAT_CLR[f]||T.accent)+"66":T.border}`,borderRadius:8,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",WebkitTapHighlightColor:"transparent"}}>{f==="ALL"?"All":f.split(" ")[0]}</button>
        ))}
      </div>

      {/* Transaction List — card style on mobile */}
      {filtered.length===0?(
        <div style={{textAlign:"center",color:T.muted,padding:"48px 0"}}>No transactions yet</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(t=>{
            const catClr=CAT_CLR[t.category]||T.muted;
            return isMobile?(
              <div key={t.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:10,background:catClr+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                  {{INCOME:"💰","FIXED EXPENSES":"🔒","VARIABLE EXPENSES":"📊",SAVINGS:"🎯","CC PAYMENT":"💳"}[t.category]||"📌"}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.spentOn}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>{t.date.slice(5)} · {t.subCat} · <span style={{color:t.person===s.members[0]?T.accent:T.purple}}>{t.person}</span></div>
                  {t.note&&<div style={{fontSize:11,color:T.muted,fontStyle:"italic"}}>{t.note}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:15,fontWeight:800,color:t.category==="INCOME"?T.accent:T.text}}>{fmt(t.amount)}</div>
                  <button onClick={()=>delTxn(t.id)} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:18,padding:"4px 0 0",WebkitTapHighlightColor:"transparent"}}>×</button>
                </div>
              </div>
            ):(
              <div key={t.id} style={{background:T.surface,borderRadius:10,padding:"10px 14px",display:"grid",gridTemplateColumns:"80px 1fr 150px 110px 70px 32px",gap:10,alignItems:"center"}}>
                <span style={{color:T.muted,fontSize:12}}>{t.date.slice(5)}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.spentOn}</div>
                  {t.note&&<div style={{fontSize:11,color:T.muted}}>{t.note}</div>}
                </div>
                <Badge color={catClr}>{t.subCat}</Badge>
                <span style={{fontWeight:700,color:t.category==="INCOME"?T.accent:T.text,textAlign:"right"}}>{fmt(t.amount)}</span>
                <Badge color={t.person===s.members[0]?T.accent:T.purple} small>{t.person}</Badge>
                <button onClick={()=>delTxn(t.id)} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:18,padding:0}}>×</button>
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
function PlanTab({s,upd,totalIncome,totalFixed,totalSavings,transactions,isMobile}) {
  const [newIncome,setNewIncome]=useState({label:"",amount:""});
  const [newFixed,setNewFixed]=useState({label:"",budget:""});
  const [newVarCat,setNewVarCat]=useState("");
  const [newSaving,setNewSaving]=useState({label:"",monthlyTarget:"",goalTarget:""});
  const [editId,setEditId]=useState(null);
  const [editVal,setEditVal]=useState({});
  const stopEdit=()=>{setEditId(null);setEditVal({});};
  const planBalance=totalIncome-totalFixed-s.variableBudget-totalSavings;
  const iS={...inputStyle,fontSize:13,padding:"8px 10px"};

  const savingsProgress=useMemo(()=>{
    const mp={};
    transactions.filter(t=>t.category==="SAVINGS").forEach(t=>{mp[t.subCat]=(mp[t.subCat]||0)+t.amount;});
    return mp;
  },[transactions]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Summary */}
      <Card style={{background:`linear-gradient(135deg,${T.card},#1e2a44)`}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>📊 Monthly Plan</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            {label:"Income",val:totalIncome,color:T.accent},
            {label:"Fixed",val:totalFixed,color:T.blue},
            {label:"Variable",val:s.variableBudget,color:T.amber},
            {label:"Savings",val:totalSavings,color:T.purple},
          ].map(k=>(
            <div key={k.label} style={{padding:"10px 12px",background:T.surface,borderRadius:10,textAlign:"center"}}>
              <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
              <div style={{fontSize:16,fontWeight:800,color:k.color}}>{fmt(k.val)}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:10,padding:"10px 14px",background:planBalance>=0?T.green+"18":T.rose+"18",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,color:T.muted,fontWeight:600}}>Remaining after plan</span>
          <span style={{fontSize:18,fontWeight:800,color:planBalance>=0?T.green:T.rose}}>{fmt(planBalance)}</span>
        </div>
      </Card>

      {/* Income */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,color:T.accent,marginBottom:12}}>💰 Income Sources</div>
        {s.income.map(inc=>(
          <div key={inc.id} style={{marginBottom:10}}>
            {editId===inc.id?(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input value={editVal.label||""} onChange={e=>setEditVal(v=>({...v,label:e.target.value}))} style={{...iS,flex:1}}/>
                <input type="number" value={editVal.amount||""} onChange={e=>setEditVal(v=>({...v,amount:+e.target.value}))} style={{...iS,width:100,textAlign:"right",color:T.accent,fontWeight:700}}/>
                <button onClick={()=>{upd({income:s.income.map(i=>i.id===inc.id?{...i,...editVal}:i)});stopEdit();}} style={{background:T.accent,border:"none",color:T.bg,borderRadius:8,padding:"8px 12px",fontWeight:700,cursor:"pointer",fontSize:14}}>✓</button>
                <button onClick={stopEdit} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"8px 12px",fontWeight:700,cursor:"pointer",fontSize:14}}>×</button>
              </div>
            ):(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:14}}>{inc.label}</span>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontWeight:700,color:T.accent,fontSize:15}}>{fmt(inc.amount)}</span>
                  <button onClick={()=>{setEditId(inc.id);setEditVal({label:inc.label,amount:inc.amount});}} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:18,padding:"4px",WebkitTapHighlightColor:"transparent"}}>✏️</button>
                  <button onClick={()=>upd({income:s.income.filter(i=>i.id!==inc.id)})} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:18,padding:"4px",WebkitTapHighlightColor:"transparent"}}>🗑</button>
                </div>
              </div>
            )}
          </div>
        ))}
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <input value={newIncome.label} onChange={e=>setNewIncome(v=>({...v,label:e.target.value}))} placeholder="Source name" style={{...iS,flex:1}}/>
          <input type="number" value={newIncome.amount} onChange={e=>setNewIncome(v=>({...v,amount:e.target.value}))} placeholder="₹" style={{...iS,width:90,textAlign:"right"}}/>
          <button onClick={()=>{if(!newIncome.label||!newIncome.amount)return;upd({income:[...s.income,{id:uid(),label:newIncome.label,amount:+newIncome.amount}]});setNewIncome({label:"",amount:""}); }} style={{background:T.accent,border:"none",color:T.bg,borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>+ Add</button>
        </div>
      </Card>

      {/* Fixed Expenses */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,color:T.blue,marginBottom:12}}>🔒 Fixed Expenses</div>
        {s.fixedExpenses.map(fe=>(
          <div key={fe.id} style={{marginBottom:10}}>
            {editId===fe.id?(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input value={editVal.label||""} onChange={e=>setEditVal(v=>({...v,label:e.target.value}))} style={{...iS,flex:1}}/>
                <input type="number" value={editVal.budget||""} onChange={e=>setEditVal(v=>({...v,budget:+e.target.value}))} style={{...iS,width:100,textAlign:"right",color:T.blue,fontWeight:700}}/>
                <button onClick={()=>{upd({fixedExpenses:s.fixedExpenses.map(f=>f.id===fe.id?{...f,...editVal}:f)});stopEdit();}} style={{background:T.accent,border:"none",color:T.bg,borderRadius:8,padding:"8px 12px",fontWeight:700,cursor:"pointer",fontSize:14}}>✓</button>
                <button onClick={stopEdit} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"8px 12px",fontWeight:700,cursor:"pointer",fontSize:14}}>×</button>
              </div>
            ):(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:14}}>{fe.label}</span>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontWeight:700,color:T.blue}}>{fmt(fe.budget)}</span>
                  <button onClick={()=>{setEditId(fe.id);setEditVal({label:fe.label,budget:fe.budget});}} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:18,padding:"4px",WebkitTapHighlightColor:"transparent"}}>✏️</button>
                  <button onClick={()=>upd({fixedExpenses:s.fixedExpenses.filter(f=>f.id!==fe.id)})} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:18,padding:"4px",WebkitTapHighlightColor:"transparent"}}>🗑</button>
                </div>
              </div>
            )}
          </div>
        ))}
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <input value={newFixed.label} onChange={e=>setNewFixed(v=>({...v,label:e.target.value}))} placeholder="Expense name" style={{...iS,flex:1}}/>
          <input type="number" value={newFixed.budget} onChange={e=>setNewFixed(v=>({...v,budget:e.target.value}))} placeholder="₹" style={{...iS,width:90,textAlign:"right"}}/>
          <button onClick={()=>{if(!newFixed.label||!newFixed.budget)return;upd({fixedExpenses:[...s.fixedExpenses,{id:uid(),label:newFixed.label,budget:+newFixed.budget}]});setNewFixed({label:"",budget:""}); }} style={{background:T.blue,border:"none",color:T.bg,borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>+ Add</button>
        </div>
        <div style={{paddingTop:12,marginTop:8,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",fontWeight:800}}>
          <span>Total Fixed</span><span style={{color:T.blue}}>{fmt(totalFixed)}</span>
        </div>
      </Card>

      {/* Variable */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,color:T.amber,marginBottom:12}}>📊 Variable Expenses</div>
        <div style={{marginBottom:14}}>
          <Label>Monthly Budget</Label>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:T.muted,fontSize:16}}>₹</span>
            <input type="number" value={s.variableBudget} onChange={e=>upd({variableBudget:+e.target.value})} style={{...iS,width:160,color:T.amber,fontWeight:800,fontSize:18,textAlign:"right"}}/>
          </div>
        </div>
        <Label>Sub-Categories</Label>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
          {s.variableSubCats.map(cat=>(
            <div key={cat} style={{display:"flex",alignItems:"center",gap:4,background:T.amber+"18",border:`1px solid ${T.amber}44`,borderRadius:999,padding:"5px 12px 5px 14px"}}>
              <span style={{fontSize:13,color:T.amber,fontWeight:600}}>{cat}</span>
              <button onClick={()=>upd({variableSubCats:s.variableSubCats.filter(c=>c!==cat)})} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:16,padding:0,lineHeight:1,marginLeft:4,WebkitTapHighlightColor:"transparent"}}>×</button>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={newVarCat} onChange={e=>setNewVarCat(e.target.value.toUpperCase())} placeholder="NEW CATEGORY" onKeyDown={e=>{if(e.key==="Enter"&&newVarCat.trim()){upd({variableSubCats:[...s.variableSubCats,newVarCat.trim()]});setNewVarCat("");}}} style={{...iS,flex:1}}/>
          <button onClick={()=>{if(!newVarCat.trim())return;upd({variableSubCats:[...s.variableSubCats,newVarCat.trim()]});setNewVarCat("");}} style={{background:T.amber,border:"none",color:T.bg,borderRadius:8,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>+ Add</button>
        </div>
      </Card>

      {/* Savings Goals */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,color:T.purple,marginBottom:12}}>🎯 Savings Goals</div>
        {s.savings.map((sv,i)=>{
          const contributed=savingsProgress[sv.label]||0;
          const pct=sv.goalTarget>0?Math.min(100,(contributed/sv.goalTarget)*100):0;
          const monthsLeft=sv.monthlyTarget>0&&sv.goalTarget>0?Math.ceil((sv.goalTarget-contributed)/sv.monthlyTarget):null;
          const clr=PIE_COLORS[i%PIE_COLORS.length];
          return(
            <div key={sv.id} style={{marginBottom:14,padding:"14px",background:T.surface,borderRadius:12,border:`1px solid ${T.border}`}}>
              {editId===sv.id?(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <input value={editVal.label||""} onChange={e=>setEditVal(v=>({...v,label:e.target.value}))} style={iS}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <input type="number" value={editVal.monthlyTarget||""} onChange={e=>setEditVal(v=>({...v,monthlyTarget:+e.target.value}))} placeholder="Monthly ₹" style={iS}/>
                    <input type="number" value={editVal.goalTarget||""} onChange={e=>setEditVal(v=>({...v,goalTarget:+e.target.value}))} placeholder="Goal ₹" style={iS}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <button onClick={()=>{upd({savings:s.savings.map(s2=>s2.id===sv.id?{...s2,...editVal}:s2)});stopEdit();}} style={{background:T.accent,border:"none",color:T.bg,borderRadius:8,padding:"10px",fontWeight:700,cursor:"pointer"}}>Save</button>
                    <button onClick={stopEdit} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"10px",fontWeight:700,cursor:"pointer"}}>Cancel</button>
                  </div>
                </div>
              ):(
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:clr}}>{sv.label}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:3}}>{fmt(contributed)} of {fmt(sv.goalTarget)}{monthsLeft?<span style={{color:T.amber}}> · {monthsLeft}mo left</span>:null}</div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:16,fontWeight:800,color:clr}}>{pct.toFixed(0)}%</span>
                      <button onClick={()=>{setEditId(sv.id);setEditVal({label:sv.label,monthlyTarget:sv.monthlyTarget,goalTarget:sv.goalTarget});}} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:18,padding:"4px",WebkitTapHighlightColor:"transparent"}}>✏️</button>
                      <button onClick={()=>upd({savings:s.savings.filter(s2=>s2.id!==sv.id)})} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:18,padding:"4px",WebkitTapHighlightColor:"transparent"}}>🗑</button>
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
          <div style={{fontSize:11,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Add Goal</div>
          <input value={newSaving.label} onChange={e=>setNewSaving(v=>({...v,label:e.target.value}))} placeholder="Goal name" style={{...iS,marginBottom:8}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input type="number" value={newSaving.monthlyTarget} onChange={e=>setNewSaving(v=>({...v,monthlyTarget:e.target.value}))} placeholder="Monthly ₹" style={iS}/>
            <input type="number" value={newSaving.goalTarget} onChange={e=>setNewSaving(v=>({...v,goalTarget:e.target.value}))} placeholder="Total goal ₹" style={iS}/>
          </div>
          <button onClick={()=>{if(!newSaving.label||!newSaving.monthlyTarget)return;upd({savings:[...s.savings,{id:uid(),label:newSaving.label,monthlyTarget:+newSaving.monthlyTarget,goalTarget:+newSaving.goalTarget||0}]});setNewSaving({label:"",monthlyTarget:"",goalTarget:""});}} style={{background:T.purple,border:"none",color:T.bg,borderRadius:8,padding:"10px 20px",fontWeight:700,cursor:"pointer",fontSize:13,width:"100%"}}>+ Add Goal</button>
        </div>
      </Card>
    </div>
  );
}

// ─── Credit Cards Tab ──────────────────────────────────────────────────────────
function CreditCardsTab({s,upd,transactions,getTxns,activeMonth,activeYear,addTxn,isMobile}) {
  const [showAddCard,setShowAddCard]=useState(false);
  const [newCard,setNewCard]=useState({name:"",person:s.members[0]||"NARR",outstanding:"",limit:""});
  const [payForm,setPayForm]=useState({ccId:null,amount:"",date:`${activeYear}-${mNum(activeMonth)}-01`,note:""});
  const [editCardId,setEditCardId]=useState(null);
  const [editCardVal,setEditCardVal]=useState({});
  const iS={...inputStyle,fontSize:13,padding:"8px 10px"};

  const ccStats=useMemo(()=>s.creditCards.map(cc=>{
    const allPaid=transactions.filter(t=>t.category==="CC PAYMENT"&&t.ccId===cc.id).reduce((a,t)=>a+t.amount,0);
    const monthPaid=getTxns(activeMonth,activeYear).filter(t=>t.category==="CC PAYMENT"&&t.ccId===cc.id).reduce((a,t)=>a+t.amount,0);
    const recentPmts=transactions.filter(t=>t.category==="CC PAYMENT"&&t.ccId===cc.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
    return {...cc,allPaid,monthPaid,balance:cc.outstanding-allPaid,recentPmts};
  }),[s.creditCards,transactions,activeMonth,activeYear]);

  const CC_COLORS=[T.accent,T.purple,T.blue,T.amber,T.green];
  const logPayment=ccId=>{
    if(!payForm.amount) return;
    const cc=s.creditCards.find(c=>c.id===ccId);
    addTxn({date:payForm.date,category:"CC PAYMENT",subCat:cc.name,spentOn:`CC Payment - ${cc.name}`,amount:parseFloat(payForm.amount),person:cc.person,note:payForm.note,tags:[],ccId});
    setPayForm(f=>({...f,ccId:null,amount:"",note:""}));
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Summary */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        {[
          {label:"Outstanding",val:s.creditCards.reduce((a,c)=>a+c.outstanding,0),color:T.rose},
          {label:"Total Paid",val:ccStats.reduce((a,c)=>a+c.allPaid,0),color:T.accent},
          {label:"Remaining",val:ccStats.reduce((a,c)=>a+c.balance,0),color:T.amber},
        ].map(k=>(
          <Card key={k.label} style={{padding:"12px 10px",textAlign:"center"}}>
            <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{k.label}</div>
            <div style={{fontSize:isMobile?14:18,fontWeight:800,color:k.color}}>{fmt(k.val)}</div>
          </Card>
        ))}
      </div>

      {/* Cards */}
      {ccStats.map((cc,i)=>{
        const clr=CC_COLORS[i%CC_COLORS.length];
        const repayPct=cc.outstanding>0?Math.min(100,(cc.allPaid/cc.outstanding)*100):0;
        return(
          <Card key={cc.id}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div>
                <div style={{fontSize:11,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Credit Card</div>
                {editCardId===cc.id?(
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
                    <input value={editCardVal.name||""} onChange={e=>setEditCardVal(v=>({...v,name:e.target.value}))} style={{...iS,fontSize:15,fontWeight:700}}/>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <input type="number" value={editCardVal.outstanding||""} onChange={e=>setEditCardVal(v=>({...v,outstanding:+e.target.value}))} placeholder="Outstanding ₹" style={iS}/>
                      <input type="number" value={editCardVal.limit||""} onChange={e=>setEditCardVal(v=>({...v,limit:+e.target.value}))} placeholder="Limit ₹" style={iS}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <button onClick={()=>{upd({creditCards:s.creditCards.map(c=>c.id===cc.id?{...c,...editCardVal}:c)});setEditCardId(null);}} style={{background:T.accent,border:"none",color:T.bg,borderRadius:8,padding:"10px",fontWeight:700,cursor:"pointer"}}>Save</button>
                      <button onClick={()=>setEditCardId(null)} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"10px",fontWeight:700,cursor:"pointer"}}>Cancel</button>
                    </div>
                  </div>
                ):(
                  <div style={{fontSize:18,fontWeight:800,color:clr,marginTop:4}}>{cc.name}</div>
                )}
                <div style={{marginTop:6}}><Badge color={cc.person===s.members[0]?T.accent:T.purple}>{cc.person}</Badge></div>
              </div>
              {editCardId!==cc.id&&(
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{setEditCardId(cc.id);setEditCardVal({name:cc.name,outstanding:cc.outstanding,limit:cc.limit});}} style={{background:"transparent",border:"none",color:T.blue,cursor:"pointer",fontSize:20,padding:"4px",WebkitTapHighlightColor:"transparent"}}>✏️</button>
                  <button onClick={()=>upd({creditCards:s.creditCards.filter(c=>c.id!==cc.id)})} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:20,padding:"4px",WebkitTapHighlightColor:"transparent"}}>🗑</button>
                </div>
              )}
            </div>

            {[
              {label:"Outstanding (Start)",val:cc.outstanding,color:T.rose},
              {label:`Paid in ${activeMonth} ${activeYear}`,val:cc.monthPaid,color:clr},
              {label:"Total Paid",val:cc.allPaid,color:T.accent},
              {label:"Balance Remaining",val:cc.balance,color:cc.balance>0?T.amber:T.green},
              ...(cc.limit?[{label:"Credit Limit",val:cc.limit,color:T.muted}]:[]),
            ].map(row=>(
              <div key={row.label} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:13,color:T.muted}}>{row.label}</span>
                <span style={{fontSize:14,fontWeight:700,color:row.color}}>{fmt(row.val)}</span>
              </div>
            ))}

            <div style={{margin:"14px 0"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:12,color:T.muted}}>Repayment Progress</span>
                <span style={{fontSize:12,fontWeight:700,color:clr}}>{repayPct.toFixed(1)}%</span>
              </div>
              <div style={{height:8,background:T.border,borderRadius:99}}><div style={{height:"100%",width:`${repayPct}%`,background:`linear-gradient(90deg,${clr},${clr}99)`,borderRadius:99}}/></div>
            </div>

            {payForm.ccId===cc.id?(
              <div style={{padding:14,background:T.surface,borderRadius:12,border:`1px solid ${clr}44`,marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:13,color:clr,marginBottom:10}}>Log Payment</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <input type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))} style={iS}/>
                  <input type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} placeholder="Amount ₹" style={iS}/>
                </div>
                <input value={payForm.note} onChange={e=>setPayForm(f=>({...f,note:e.target.value}))} placeholder="Note" style={{...iS,marginBottom:10}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <button onClick={()=>logPayment(cc.id)} style={{background:clr,border:"none",color:T.bg,borderRadius:8,padding:"11px",fontWeight:700,cursor:"pointer"}}>Submit</button>
                  <button onClick={()=>setPayForm(f=>({...f,ccId:null}))} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"11px",fontWeight:700,cursor:"pointer"}}>Cancel</button>
                </div>
              </div>
            ):(
              <button onClick={()=>setPayForm(f=>({...f,ccId:cc.id,date:`${activeYear}-${mNum(activeMonth)}-01`,amount:""}))} style={{background:clr,border:"none",color:T.bg,borderRadius:10,padding:"12px",fontWeight:700,cursor:"pointer",fontSize:14,width:"100%",marginBottom:12,WebkitTapHighlightColor:"transparent"}}>+ Log Payment</button>
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

      {/* Add Card */}
      {showAddCard?(
        <Card style={{border:`1px dashed ${T.accent}55`}}>
          <div style={{fontWeight:700,fontSize:14,color:T.accent,marginBottom:14}}>+ New Credit Card</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <TextInput label="Card Name" value={newCard.name} onChange={v=>setNewCard(c=>({...c,name:v}))} placeholder="e.g. HDFC Millennium"/>
            <Sel label="Assigned To" value={newCard.person} onChange={v=>setNewCard(c=>({...c,person:v}))} options={s.members}/>
            <TextInput label="Outstanding ₹" type="number" value={newCard.outstanding} onChange={v=>setNewCard(c=>({...c,outstanding:v}))} placeholder="0"/>
            <TextInput label="Credit Limit ₹" type="number" value={newCard.limit} onChange={v=>setNewCard(c=>({...c,limit:v}))} placeholder="0"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
              <button onClick={()=>{if(!newCard.name)return;upd({creditCards:[...s.creditCards,{id:uid(),name:newCard.name,person:newCard.person,outstanding:+newCard.outstanding||0,limit:+newCard.limit||0}]});setNewCard({name:"",person:s.members[0]||"NARR",outstanding:"",limit:""});setShowAddCard(false);}} style={{background:T.accent,border:"none",color:T.bg,borderRadius:10,padding:"12px",fontWeight:700,cursor:"pointer"}}>Add Card</button>
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
