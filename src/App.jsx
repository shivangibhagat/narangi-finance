import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const T = {
  bg:"#0A0E1A", surface:"#111827", card:"#1A2236", border:"#1E2D45",
  accent:"#00D4AA", accentDim:"#00D4AA18", amber:"#F59E0B", rose:"#F43F5E",
  blue:"#60A5FA", purple:"#A78BFA", green:"#22C55E", text:"#E2E8F0", muted:"#64748B",
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = n => "₹" + Number(n||0).toLocaleString("en-IN");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,5);
const mNum = m => String(MONTHS.indexOf(m)+1).padStart(2,"0");
const CAT_CLR = { INCOME:T.accent, "FIXED EXPENSES":T.blue, "VARIABLE EXPENSES":T.amber, SAVINGS:T.purple, "CC PAYMENT":T.rose };
const PIE_COLORS = [T.accent,T.blue,T.amber,T.purple,T.rose,"#34D399","#818CF8","#FB923C"];

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
  customTags: ["reimbursable","birthday","travel","emergency","work"]
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
  {id:"t15",date:"2026-05-01",category:"FIXED EXPENSES",subCat:"Misc",spentOn:"Dinner for mummy papa",amount:297,person:"NARR",note:"",tags:[]},
  {id:"t16",date:"2026-05-02",category:"VARIABLE EXPENSES",subCat:"TRANSPORT",spentOn:"Cab DSK to Babu Home",amount:477,person:"SHIVU",note:"",tags:[]},
  {id:"t17",date:"2026-05-02",category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",spentOn:"Lunch with Babu & Abhishek",amount:525,person:"SHIVU",note:"",tags:[]},
  {id:"t18",date:"2026-05-03",category:"VARIABLE EXPENSES",subCat:"TRANSPORT",spentOn:"Cab Babu Home to DSK",amount:458,person:"NARR",note:"",tags:[]},
  {id:"t19",date:"2026-05-03",category:"FIXED EXPENSES",subCat:"Grocery",spentOn:"Vegetables",amount:350,person:"NARR",note:"",tags:[]},
  {id:"t20",date:"2026-05-03",category:"FIXED EXPENSES",subCat:"Grocery",spentOn:"Blinkit - Paneer + Chaas",amount:349,person:"SHIVU",note:"",tags:[]},
  {id:"t21",date:"2026-05-03",category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",spentOn:"Coffee with Didi Jiju",amount:1103,person:"SHIVU",note:"",tags:[]},
  {id:"t22",date:"2026-05-04",category:"FIXED EXPENSES",subCat:"Grocery",spentOn:"Zepto Groceries",amount:301,person:"SHIVU",note:"",tags:[]},
  {id:"t23",date:"2026-05-04",category:"VARIABLE EXPENSES",subCat:"TRANSPORT",spentOn:"Petrol for Activa",amount:465,person:"NARR",note:"",tags:[]},
  {id:"t24",date:"2026-05-04",category:"FIXED EXPENSES",subCat:"Grocery",spentOn:"Idli Chutney",amount:54,person:"NARR",note:"",tags:[]},
  {id:"t25",date:"2026-05-04",category:"VARIABLE EXPENSES",subCat:"TRANSPORT",spentOn:"Porter Clothes",amount:326,person:"SHIVU",note:"",tags:[]},
  {id:"t26",date:"2026-05-04",category:"VARIABLE EXPENSES",subCat:"ENTERTAINMENT",spentOn:"Tea",amount:40,person:"NARR",note:"",tags:[]},
  {id:"t27",date:"2026-05-04",category:"FIXED EXPENSES",subCat:"Misc",spentOn:"Mummy Papa Train to Surat",amount:2363,person:"NARR",note:"",tags:[]},
  {id:"t28",date:"2026-05-07",category:"CC PAYMENT",subCat:"SHIVU Credit Card",spentOn:"CC Payment Shivu May",amount:59000,person:"SHIVU",note:"May payment",tags:[],ccId:"cc2"},
  {id:"t29",date:"2026-05-07",category:"VARIABLE EXPENSES",subCat:"TRANSPORT",spentOn:"Train Tickets to Vadodara",amount:1754,person:"SHIVU",note:"",tags:["travel"]},
  {id:"t30",date:"2026-05-07",category:"FIXED EXPENSES",subCat:"Grocery",spentOn:"Milk Zepto",amount:58,person:"SHIVU",note:"",tags:[]},
  {id:"t31",date:"2026-05-07",category:"FIXED EXPENSES",subCat:"Grocery",spentOn:"Face Wash Shivu",amount:398,person:"SHIVU",note:"",tags:[]},
  {id:"t32",date:"2026-05-07",category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",spentOn:"Evening Snack",amount:458,person:"NARR",note:"",tags:[]},
  {id:"t33",date:"2026-05-07",category:"FIXED EXPENSES",subCat:"Misc",spentOn:"Water and soda in Surat",amount:168,person:"NARR",note:"",tags:[]}
];

function loadState() {
  try { const s = localStorage.getItem("narangi_v3"); return s ? JSON.parse(s) : null; } catch { return null; }
}

// ─── UI Primitives ─────────────────────────────────────────────────────────────
const Card = ({children,style={}}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"20px 24px",...style}}>{children}</div>
);
const Btn = ({children,onClick,color=T.accent,variant="solid",small,style={}}) => (
  <button onClick={onClick} style={{background:variant==="solid"?color:"transparent",color:variant==="solid"?T.bg:color,border:`1px solid ${color}`,borderRadius:8,padding:small?"5px 12px":"9px 18px",fontSize:small?11:13,fontWeight:700,cursor:"pointer",transition:"all 0.15s",...style}}>{children}</button>
);
const TextInput = ({label,value,onChange,type="text",placeholder=""}) => (
  <div style={{display:"flex",flexDirection:"column",gap:5}}>
    {label&&<label style={{color:T.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{background:T.surface,border:`1px solid ${T.border}`,color:T.text,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}/>
  </div>
);
const Sel = ({label,value,onChange,options}) => (
  <div style={{display:"flex",flexDirection:"column",gap:5}}>
    {label&&<label style={{color:T.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{background:T.surface,border:`1px solid ${T.border}`,color:T.text,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",width:"100%"}}>
      {options.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);
const Badge = ({color,children,small}) => (
  <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:999,padding:small?"1px 8px":"2px 10px",fontSize:small?10:11,fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>
);
const Modal = ({open,onClose,title,children,width=480}) => {
  if(!open) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"#00000088",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:"24px 28px",width,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:16}}>{title}</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:T.muted,fontSize:24,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
};
const Delta = ({curr,prev}) => {
  if(!prev||prev===0) return null;
  const d=curr-prev; const pct=Math.abs(Math.round((d/prev)*100));
  const up=d>=0;
  return <span style={{fontSize:11,fontWeight:700,color:up?T.green:T.rose,background:(up?T.green:T.rose)+"18",borderRadius:999,padding:"2px 7px",marginLeft:6}}>{up?"↑":"↓"}{pct}%</span>;
};

function TxnForm({state,value,onChange,onSubmit,submitLabel="Add Transaction"}) {
  const subCatMap = {
    INCOME: state.income.map(i=>i.label),
    "FIXED EXPENSES": state.fixedExpenses.map(f=>f.label),
    "VARIABLE EXPENSES": state.variableSubCats,
    SAVINGS: state.savings.map(s=>s.label),
    "CC PAYMENT": state.creditCards.map(c=>c.name),
  };
  const subCats = subCatMap[value.category]||[];
  const upd = patch => onChange({...value,...patch});
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
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
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        <label style={{color:T.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Tags</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {state.customTags.map(tag=>{
            const active=(value.tags||[]).includes(tag);
            return <button key={tag} onClick={()=>upd({tags:active?(value.tags||[]).filter(t=>t!==tag):[...(value.tags||[]),tag]})}
              style={{background:active?T.accent+"33":"transparent",color:active?T.accent:T.muted,border:`1px solid ${active?T.accent:T.border}`,borderRadius:999,padding:"3px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{tag}</button>;
          })}
        </div>
      </div>
      <Btn onClick={onSubmit} style={{marginTop:4}}>{submitLabel}</Btn>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [s, setS] = useState(()=>loadState()||{...DEFAULTS,transactions:SEED});
  useEffect(()=>{ localStorage.setItem("narangi_v3",JSON.stringify(s)); },[s]);
  const upd = patch => setS(prev=>({...prev,...patch}));

  const [tab, setTab] = useState("dashboard");
  const [activeMonth, setActiveMonth] = useState("May");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickForm, setQuickForm] = useState({date:"2026-05-13",category:"VARIABLE EXPENSES",subCat:"CAFES/RESTAURANTS",spentOn:"",amount:"",person:"NARR",note:"",tags:[],ccId:undefined});

  const getTxns = m => s.transactions.filter(t=>t.date.startsWith(`2026-${mNum(m)}`));
  const summarize = txns => ({
    income:txns.filter(t=>t.category==="INCOME").reduce((a,t)=>a+t.amount,0),
    fixed:txns.filter(t=>t.category==="FIXED EXPENSES").reduce((a,t)=>a+t.amount,0),
    variable:txns.filter(t=>t.category==="VARIABLE EXPENSES").reduce((a,t)=>a+t.amount,0),
    savings:txns.filter(t=>t.category==="SAVINGS").reduce((a,t)=>a+t.amount,0),
    ccPaid:txns.filter(t=>t.category==="CC PAYMENT").reduce((a,t)=>a+t.amount,0),
  });

  const monthTxns = useMemo(()=>getTxns(activeMonth),[s.transactions,activeMonth]);
  const summary = useMemo(()=>summarize(monthTxns),[monthTxns]);
  const prevIdx = MONTHS.indexOf(activeMonth)-1;
  const prevSummary = useMemo(()=>summarize(prevIdx>=0?getTxns(MONTHS[prevIdx]):[]),[s.transactions,activeMonth]);

  const totalIncome = s.income.reduce((a,i)=>a+i.amount,0);
  const totalFixed = s.fixedExpenses.reduce((a,f)=>a+f.budget,0);
  const totalSavings = s.savings.reduce((a,sv)=>a+sv.monthlyTarget,0);
  const varPct = s.variableBudget>0?Math.round((summary.variable/s.variableBudget)*100):0;
  const varStatus = varPct>=100?T.rose:varPct>=80?T.amber:T.green;

  const addTxn = form => {
    if(!form.spentOn||!form.amount) return;
    upd({transactions:[...s.transactions,{...form,id:uid(),amount:parseFloat(form.amount),tags:form.tags||[]}]});
  };
  const delTxn = id => upd({transactions:s.transactions.filter(t=>t.id!==id)});

  const annualData = useMemo(()=>MONTHS.map(m=>{
    const t=summarize(getTxns(m));
    return {month:m,income:t.income,expenses:t.fixed+t.variable,savings:t.savings};
  }),[s.transactions]);

  const catBreakdown = useMemo(()=>{
    const grp={};
    monthTxns.filter(t=>t.category!=="INCOME").forEach(t=>{grp[t.subCat]=(grp[t.subCat]||0)+t.amount;});
    return Object.entries(grp).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  },[monthTxns]);

  const TABS = ["dashboard","transactions","plan","credit cards"];

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'DM Sans','Segoe UI',sans-serif",paddingBottom:80}}>
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"0 28px",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1280,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🪙</div>
            <div>
              <div style={{fontWeight:800,fontSize:16,letterSpacing:"-0.02em"}}>Narangi Finance</div>
              <div style={{color:T.muted,fontSize:11}}>2026 · {activeMonth}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            {TABS.map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?T.accent:"transparent",color:tab===t?T.bg:T.muted,border:`1px solid ${tab===t?T.accent:T.border}`,borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1280,margin:"0 auto",padding:"24px 28px"}}>

        {tab==="dashboard"&&(
          <div>
            <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
              {MONTHS.map(m=>{const has=getTxns(m).length>0;return(
                <button key={m} onClick={()=>setActiveMonth(m)} style={{background:activeMonth===m?T.accent:has?T.accentDim:"transparent",color:activeMonth===m?T.bg:has?T.accent:T.muted,border:`1px solid ${activeMonth===m?T.accent:has?T.accent+"55":T.border}`,borderRadius:7,padding:"5px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{m}</button>
              );})}
            </div>
            {summary.variable>0&&(
              <div style={{background:varStatus+"15",border:`1px solid ${varStatus}44`,borderRadius:12,padding:"10px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:varStatus,flexShrink:0}}/>
                <span style={{fontSize:13,fontWeight:600,color:varStatus}}>
                  Variable spend: {fmt(summary.variable)} of {fmt(s.variableBudget)} budget ({varPct}%)
                  {varPct>=100?" — Over budget! 🔴":varPct>=80?" — Approaching limit ⚠️":" — On track ✅"}
                </span>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
              {[
                {label:"Income",val:summary.income,prev:prevSummary.income,color:T.accent,icon:"↑"},
                {label:"Fixed Spend",val:summary.fixed,prev:prevSummary.fixed,color:T.blue,icon:"🔒"},
                {label:"Variable Spend",val:summary.variable,prev:prevSummary.variable,color:varStatus,icon:"📊"},
                {label:"Balance",val:summary.income-summary.fixed-summary.variable-summary.savings-summary.ccPaid,prev:prevSummary.income-prevSummary.fixed-prevSummary.variable,color:T.green,icon:"="},
              ].map(k=>(
                <Card key={k.label}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                    <span style={{fontSize:11,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{k.label}</span>
                    <span style={{fontSize:16}}>{k.icon}</span>
                  </div>
                  <div style={{fontSize:24,fontWeight:800,color:k.color,letterSpacing:"-0.03em"}}>{fmt(k.val)}</div>
                  <div style={{marginTop:6,display:"flex",alignItems:"center"}}>
                    <span style={{fontSize:11,color:T.muted}}>{prevIdx>=0?`vs ${MONTHS[prevIdx]}`:"first month"}</span>
                    <Delta curr={k.val} prev={k.prev}/>
                  </div>
                </Card>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
              <Card>
                <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Annual Overview</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={annualData} barSize={12}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                    <XAxis dataKey="month" stroke={T.muted} tick={{fontSize:10}}/>
                    <YAxis stroke={T.muted} tick={{fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                    <Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,color:T.text}}/>
                    <Bar dataKey="income" fill={T.accent} radius={[3,3,0,0]} name="Income"/>
                    <Bar dataKey="expenses" fill={T.amber} radius={[3,3,0,0]} name="Expenses"/>
                    <Bar dataKey="savings" fill={T.purple} radius={[3,3,0,0]} name="Savings"/>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Spend by Category — {activeMonth}</div>
                {catBreakdown.length===0?<div style={{color:T.muted,textAlign:"center",paddingTop:60}}>No data yet</div>:(
                  <div style={{display:"flex",flexDirection:"column",gap:10,maxHeight:200,overflowY:"auto"}}>
                    {catBreakdown.map((c,i)=>(
                      <div key={c.name} style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                            <span style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                            <span style={{fontSize:12,fontWeight:700,color:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0,marginLeft:8}}>{fmt(c.value)}</span>
                          </div>
                          <div style={{height:3,background:T.border,borderRadius:99}}>
                            <div style={{height:"100%",width:`${Math.min(100,(c.value/catBreakdown[0].value)*100)}%`,background:PIE_COLORS[i%PIE_COLORS.length],borderRadius:99}}/>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
            <Card>
              <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Spend by Person — {activeMonth}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
                {s.members.map((m,i)=>{
                  const spent=monthTxns.filter(t=>t.person===m&&t.category!=="INCOME"&&t.category!=="CC PAYMENT").reduce((a,t)=>a+t.amount,0);
                  const earned=monthTxns.filter(t=>t.person===m&&t.category==="INCOME").reduce((a,t)=>a+t.amount,0);
                  const clr=[T.accent,T.purple][i%2];
                  return(
                    <div key={m} style={{padding:16,background:T.surface,borderRadius:12,border:`1px solid ${T.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                        <span style={{fontWeight:700,color:clr}}>{m}</span>
                        <Badge color={clr}>{fmt(spent)} spent</Badge>
                      </div>
                      <div style={{fontSize:12,color:T.muted}}>Earned: <span style={{color:T.accent,fontWeight:600}}>{fmt(earned)}</span></div>
                      <div style={{marginTop:10,height:4,background:T.border,borderRadius:99}}>
                        <div style={{height:"100%",width:earned>0?`${Math.min(100,(spent/earned)*100)}%`:"0%",background:clr,borderRadius:99}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {tab==="transactions"&&<TransactionsTab s={s} addTxn={addTxn} delTxn={delTxn} activeMonth={activeMonth} setActiveMonth={setActiveMonth} getTxns={getTxns} summarize={summarize}/>}
        {tab==="plan"&&<PlanTab s={s} upd={upd} totalIncome={totalIncome} totalFixed={totalFixed} totalSavings={totalSavings} transactions={s.transactions}/>}
        {tab==="credit cards"&&<CreditCardsTab s={s} upd={upd} transactions={s.transactions} getTxns={getTxns} activeMonth={activeMonth} setActiveMonth={setActiveMonth} addTxn={addTxn}/>}
      </div>

      <button onClick={()=>setShowQuickAdd(true)} style={{position:"fixed",bottom:28,right:28,width:56,height:56,borderRadius:"50%",background:`linear-gradient(135deg,${T.accent},${T.purple})`,border:"none",color:"white",fontSize:26,cursor:"pointer",boxShadow:`0 4px 24px ${T.accent}66`,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>

      <Modal open={showQuickAdd} onClose={()=>setShowQuickAdd(false)} title="⚡ Quick Add">
        <TxnForm state={s} value={quickForm} onChange={setQuickForm} onSubmit={()=>{
          addTxn(quickForm);
          setQuickForm(f=>({...f,spentOn:"",amount:"",note:"",tags:[]}));
          setShowQuickAdd(false);
        }}/>
      </Modal>
    </div>
  );
}

// ─── Transactions Tab ──────────────────────────────────────────────────────────
function TransactionsTab({s,addTxn,delTxn,activeMonth,setActiveMonth,getTxns,summarize}) {
  const [form,setForm] = useState({date:`2026-${mNum(activeMonth)}-01`,category:"VARIABLE EXPENSES",subCat:s.variableSubCats[0]||"",spentOn:"",amount:"",person:s.members[0]||"NARR",note:"",tags:[],ccId:undefined});
  const [filter,setFilter] = useState("ALL");
  const [search,setSearch] = useState("");
  const monthTxns = getTxns(activeMonth);
  const summary = summarize(monthTxns);
  const filtered = monthTxns.filter(t=>{
    if(filter!=="ALL"&&t.category!==filter) return false;
    if(search&&!t.spentOn.toLowerCase().includes(search.toLowerCase())&&!t.subCat.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date));

  return(
    <div style={{display:"grid",gridTemplateColumns:"360px 1fr",gap:20}}>
      <Card style={{alignSelf:"start",position:"sticky",top:84}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:16}}>➕ Add Transaction</div>
        <TxnForm state={s} value={form} onChange={setForm} onSubmit={()=>{addTxn(form);setForm(f=>({...f,spentOn:"",amount:"",note:"",tags:[]}));}}/>
      </Card>
      <div>
        <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
          {MONTHS.map(m=>{const txns=getTxns(m);return(
            <button key={m} onClick={()=>setActiveMonth(m)} style={{background:activeMonth===m?T.accent:"transparent",color:activeMonth===m?T.bg:txns.length?T.accent:T.muted,border:`1px solid ${activeMonth===m?T.accent:txns.length?T.accent+"44":T.border}`,borderRadius:7,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{m}{txns.length>0?` (${txns.length})`:""}</button>
          );})}
        </div>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
            <div style={{fontWeight:700,fontSize:14}}>{activeMonth} 2026 · {monthTxns.length} entries</div>
            <div style={{display:"flex",gap:12,fontSize:13}}>
              <span style={{color:T.accent}}>In: {fmt(summary.income)}</span>
              <span style={{color:T.rose}}>Out: {fmt(summary.fixed+summary.variable+summary.ccPaid)}</span>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{background:T.surface,border:`1px solid ${T.border}`,color:T.text,borderRadius:8,padding:"6px 12px",fontSize:12,outline:"none",flex:1,minWidth:140}}/>
            {["ALL","INCOME","FIXED EXPENSES","VARIABLE EXPENSES","SAVINGS","CC PAYMENT"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?(CAT_CLR[f]||T.accent)+"33":"transparent",color:filter===f?(CAT_CLR[f]||T.accent):T.muted,border:`1px solid ${filter===f?(CAT_CLR[f]||T.accent)+"66":T.border}`,borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{f==="ALL"?"ALL":f.split(" ")[0]}</button>
            ))}
          </div>
          {filtered.length===0?<div style={{textAlign:"center",color:T.muted,padding:"48px 0"}}>No transactions. Add one!</div>:(
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              <div style={{display:"grid",gridTemplateColumns:"80px 1fr 140px 100px 70px 32px",gap:10,padding:"6px 10px",color:T.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>
                <span>Date</span><span>Description</span><span>Category</span><span>Amount</span><span>Person</span><span></span>
              </div>
              {filtered.map(t=>(
                <div key={t.id} style={{display:"grid",gridTemplateColumns:"80px 1fr 140px 100px 70px 32px",gap:10,padding:"9px 10px",background:T.surface,borderRadius:8,alignItems:"center",marginBottom:2}}>
                  <span style={{color:T.muted,fontSize:11}}>{t.date.slice(5)}</span>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.spentOn}</div>
                    <div style={{display:"flex",gap:4,marginTop:2,flexWrap:"wrap"}}>
                      {t.note&&<span style={{fontSize:10,color:T.muted}}>{t.note}</span>}
                      {(t.tags||[]).map(tag=><Badge key={tag} color={T.purple} small>{tag}</Badge>)}
                    </div>
                  </div>
                  <Badge color={CAT_CLR[t.category]||T.muted}>{t.subCat}</Badge>
                  <span style={{fontWeight:700,color:t.category==="INCOME"?T.accent:T.text,textAlign:"right"}}>{fmt(t.amount)}</span>
                  <Badge color={t.person===s.members[0]?T.accent:T.purple} small>{t.person}</Badge>
                  <button onClick={()=>delTxn(t.id)} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:18,padding:0}}>×</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Plan Tab ──────────────────────────────────────────────────────────────────
function PlanTab({s,upd,totalIncome,totalFixed,totalSavings,transactions}) {
  const [newIncome,setNewIncome] = useState({label:"",amount:""});
  const [newFixed,setNewFixed] = useState({label:"",budget:""});
  const [newVariableCat,setNewVariableCat] = useState("");
  const [newSaving,setNewSaving] = useState({label:"",monthlyTarget:"",goalTarget:""});
  const [editId,setEditId] = useState(null);
  const [editVal,setEditVal] = useState({});

  const savingsProgress = useMemo(()=>{
    const mp={};
    transactions.filter(t=>t.category==="SAVINGS").forEach(t=>{mp[t.subCat]=(mp[t.subCat]||0)+t.amount;});
    return mp;
  },[transactions]);

  const startEdit=(id,val)=>{setEditId(id);setEditVal(val);};
  const stopEdit=()=>{setEditId(null);setEditVal({});};
  const planBalance=totalIncome-totalFixed-s.variableBudget-totalSavings;

  const iStyle={background:T.surface,border:`1px solid ${T.border}`,color:T.text,borderRadius:7,padding:"6px 9px",fontSize:12,outline:"none"};

  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <Card style={{gridColumn:"span 2",background:`linear-gradient(135deg,${T.card},#1e2a44)`}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>📊 Monthly Plan Summary</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
          {[
            {label:"Total Income",val:totalIncome,color:T.accent},
            {label:"Fixed Budget",val:totalFixed,color:T.blue},
            {label:"Variable Budget",val:s.variableBudget,color:T.amber},
            {label:"Savings Target",val:totalSavings,color:T.purple},
            {label:"Remaining",val:planBalance,color:planBalance>=0?T.green:T.rose},
          ].map(k=>(
            <div key={k.label} style={{textAlign:"center",padding:12,background:T.surface,borderRadius:10}}>
              <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>{k.label}</div>
              <div style={{fontSize:20,fontWeight:800,color:k.color}}>{fmt(k.val)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Income */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,color:T.accent,marginBottom:14}}>💰 Income Sources</div>
        {s.income.map(inc=>(
          <div key={inc.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            {editId===inc.id?(
              <>
                <input value={editVal.label||""} onChange={e=>setEditVal(v=>({...v,label:e.target.value}))} style={{...iStyle,flex:1}}/>
                <input type="number" value={editVal.amount||""} onChange={e=>setEditVal(v=>({...v,amount:+e.target.value}))} style={{...iStyle,width:110,color:T.accent,fontWeight:700,textAlign:"right"}}/>
                <Btn small onClick={()=>{upd({income:s.income.map(i=>i.id===inc.id?{...i,...editVal}:i)});stopEdit();}}>✓</Btn>
                <Btn small variant="outline" color={T.muted} onClick={stopEdit}>×</Btn>
              </>
            ):(
              <>
                <span style={{flex:1,fontSize:13}}>{inc.label}</span>
                <span style={{fontWeight:700,color:T.accent}}>{fmt(inc.amount)}</span>
                <Btn small variant="outline" color={T.blue} onClick={()=>startEdit(inc.id,{label:inc.label,amount:inc.amount})}>✏️</Btn>
                <Btn small variant="outline" color={T.rose} onClick={()=>upd({income:s.income.filter(i=>i.id!==inc.id)})}>🗑</Btn>
              </>
            )}
          </div>
        ))}
        <div style={{borderTop:`1px solid ${T.border}`,paddingTop:12,marginTop:8,display:"flex",gap:8}}>
          <input value={newIncome.label} onChange={e=>setNewIncome(v=>({...v,label:e.target.value}))} placeholder="Source name" style={{...iStyle,flex:1}}/>
          <input type="number" value={newIncome.amount} onChange={e=>setNewIncome(v=>({...v,amount:e.target.value}))} placeholder="₹" style={{...iStyle,width:90,textAlign:"right"}}/>
          <Btn small onClick={()=>{if(!newIncome.label||!newIncome.amount)return;upd({income:[...s.income,{id:uid(),label:newIncome.label,amount:+newIncome.amount}]});setNewIncome({label:"",amount:""});}}>+ Add</Btn>
        </div>
        <div style={{borderTop:`1px solid ${T.border}`,paddingTop:10,marginTop:8,display:"flex",justifyContent:"space-between",fontWeight:800}}>
          <span>Total</span><span style={{color:T.accent}}>{fmt(totalIncome)}</span>
        </div>
      </Card>

      {/* Savings Goals */}
      <Card style={{gridRow:"span 2"}}>
        <div style={{fontWeight:700,fontSize:14,color:T.purple,marginBottom:14}}>🎯 Savings Goals & Progress</div>
        {s.savings.map((sv,i)=>{
          const contributed=savingsProgress[sv.label]||0;
          const pct=sv.goalTarget>0?Math.min(100,(contributed/sv.goalTarget)*100):0;
          const monthsLeft=sv.monthlyTarget>0&&sv.goalTarget>0?Math.ceil((sv.goalTarget-contributed)/sv.monthlyTarget):null;
          const clr=PIE_COLORS[i%PIE_COLORS.length];
          return(
            <div key={sv.id} style={{marginBottom:14,padding:14,background:T.surface,borderRadius:12,border:`1px solid ${T.border}`}}>
              {editId===sv.id?(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <input value={editVal.label||""} onChange={e=>setEditVal(v=>({...v,label:e.target.value}))} placeholder="Goal name" style={{...iStyle}}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <input type="number" value={editVal.monthlyTarget||""} onChange={e=>setEditVal(v=>({...v,monthlyTarget:+e.target.value}))} placeholder="Monthly ₹" style={{...iStyle}}/>
                    <input type="number" value={editVal.goalTarget||""} onChange={e=>setEditVal(v=>({...v,goalTarget:+e.target.value}))} placeholder="Goal ₹" style={{...iStyle}}/>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <Btn small onClick={()=>{upd({savings:s.savings.map(s2=>s2.id===sv.id?{...s2,...editVal}:s2)});stopEdit();}}>Save</Btn>
                    <Btn small variant="outline" color={T.muted} onClick={stopEdit}>Cancel</Btn>
                  </div>
                </div>
              ):(
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:clr}}>{sv.label}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:2}}>
                        {fmt(contributed)} of {fmt(sv.goalTarget)}
                        {monthsLeft&&<span style={{color:T.amber}}> · {monthsLeft} months to go</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:15,fontWeight:800,color:clr}}>{pct.toFixed(0)}%</span>
                      <Btn small variant="outline" color={T.blue} onClick={()=>startEdit(sv.id,{label:sv.label,monthlyTarget:sv.monthlyTarget,goalTarget:sv.goalTarget})}>✏️</Btn>
                      <Btn small variant="outline" color={T.rose} onClick={()=>upd({savings:s.savings.filter(s2=>s2.id!==sv.id)})}>🗑</Btn>
                    </div>
                  </div>
                  <div style={{height:6,background:T.border,borderRadius:99,marginBottom:6}}>
                    <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${clr},${clr}99)`,borderRadius:99,transition:"width 0.5s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted}}>
                    <span>Monthly: <span style={{color:T.purple,fontWeight:600}}>{fmt(sv.monthlyTarget)}</span></span>
                    <span>Goal: <span style={{color:clr,fontWeight:600}}>{fmt(sv.goalTarget)}</span></span>
                  </div>
                </>
              )}
            </div>
          );
        })}
        <div style={{borderTop:`1px solid ${T.border}`,paddingTop:12}}>
          <div style={{fontWeight:600,fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Add Savings Goal</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <input value={newSaving.label} onChange={e=>setNewSaving(v=>({...v,label:e.target.value}))} placeholder="Goal name" style={{...iStyle}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <input type="number" value={newSaving.monthlyTarget} onChange={e=>setNewSaving(v=>({...v,monthlyTarget:e.target.value}))} placeholder="Monthly ₹" style={{...iStyle}}/>
              <input type="number" value={newSaving.goalTarget} onChange={e=>setNewSaving(v=>({...v,goalTarget:e.target.value}))} placeholder="Total goal ₹" style={{...iStyle}}/>
            </div>
            <Btn small onClick={()=>{if(!newSaving.label||!newSaving.monthlyTarget)return;upd({savings:[...s.savings,{id:uid(),label:newSaving.label,monthlyTarget:+newSaving.monthlyTarget,goalTarget:+newSaving.goalTarget||0}]});setNewSaving({label:"",monthlyTarget:"",goalTarget:""});}}>+ Add Goal</Btn>
          </div>
        </div>
      </Card>

      {/* Fixed Expenses */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,color:T.blue,marginBottom:14}}>🔒 Fixed Expenses</div>
        {s.fixedExpenses.map(fe=>(
          <div key={fe.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
            {editId===fe.id?(
              <>
                <input value={editVal.label||""} onChange={e=>setEditVal(v=>({...v,label:e.target.value}))} style={{...iStyle,flex:1}}/>
                <input type="number" value={editVal.budget||""} onChange={e=>setEditVal(v=>({...v,budget:+e.target.value}))} style={{...iStyle,width:100,color:T.blue,fontWeight:700,textAlign:"right"}}/>
                <Btn small onClick={()=>{upd({fixedExpenses:s.fixedExpenses.map(f=>f.id===fe.id?{...f,...editVal}:f)});stopEdit();}}>✓</Btn>
                <Btn small variant="outline" color={T.muted} onClick={stopEdit}>×</Btn>
              </>
            ):(
              <>
                <span style={{flex:1,fontSize:13}}>{fe.label}</span>
                <span style={{fontWeight:700,color:T.blue,fontSize:13}}>{fmt(fe.budget)}</span>
                <Btn small variant="outline" color={T.blue} onClick={()=>startEdit(fe.id,{label:fe.label,budget:fe.budget})}>✏️</Btn>
                <Btn small variant="outline" color={T.rose} onClick={()=>upd({fixedExpenses:s.fixedExpenses.filter(f=>f.id!==fe.id)})}>🗑</Btn>
              </>
            )}
          </div>
        ))}
        <div style={{borderTop:`1px solid ${T.border}`,paddingTop:12,marginTop:8,display:"flex",gap:8}}>
          <input value={newFixed.label} onChange={e=>setNewFixed(v=>({...v,label:e.target.value}))} placeholder="Expense name" style={{...iStyle,flex:1}}/>
          <input type="number" value={newFixed.budget} onChange={e=>setNewFixed(v=>({...v,budget:e.target.value}))} placeholder="₹" style={{...iStyle,width:80,textAlign:"right"}}/>
          <Btn small onClick={()=>{if(!newFixed.label||!newFixed.budget)return;upd({fixedExpenses:[...s.fixedExpenses,{id:uid(),label:newFixed.label,budget:+newFixed.budget}]});setNewFixed({label:"",budget:""});}}>+ Add</Btn>
        </div>
        <div style={{borderTop:`1px solid ${T.border}`,paddingTop:10,marginTop:8,display:"flex",justifyContent:"space-between",fontWeight:800}}>
          <span>Total Fixed</span><span style={{color:T.blue}}>{fmt(totalFixed)}</span>
        </div>
      </Card>

      {/* Variable Sub-Categories */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,color:T.amber,marginBottom:14}}>📊 Variable Expenses</div>
        <div style={{marginBottom:14}}>
          <label style={{color:T.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Monthly Budget</label>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
            <span style={{color:T.muted}}>₹</span>
            <input type="number" value={s.variableBudget} onChange={e=>upd({variableBudget:+e.target.value})}
              style={{background:T.surface,border:`1px solid ${T.border}`,color:T.amber,borderRadius:8,padding:"8px 12px",width:140,fontSize:15,fontWeight:800,textAlign:"right",outline:"none"}}/>
          </div>
        </div>
        <div style={{fontWeight:600,fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Sub-Categories</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          {s.variableSubCats.map(cat=>(
            <div key={cat} style={{display:"flex",alignItems:"center",gap:4,background:T.amber+"18",border:`1px solid ${T.amber}44`,borderRadius:999,padding:"3px 10px 3px 12px"}}>
              <span style={{fontSize:12,color:T.amber,fontWeight:600}}>{cat}</span>
              <button onClick={()=>upd({variableSubCats:s.variableSubCats.filter(c=>c!==cat)})} style={{background:"transparent",border:"none",color:T.rose,cursor:"pointer",fontSize:14,padding:0,lineHeight:1,marginLeft:2}}>×</button>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={newVariableCat} onChange={e=>setNewVariableCat(e.target.value.toUpperCase())} placeholder="NEW CATEGORY"
            onKeyDown={e=>{if(e.key==="Enter"&&newVariableCat.trim()){upd({variableSubCats:[...s.variableSubCats,newVariableCat.trim()]});setNewVariableCat("");}}}
            style={{flex:1,background:T.surface,border:`1px solid ${T.border}`,color:T.text,borderRadius:7,padding:"7px 10px",fontSize:12,outline:"none"}}/>
          <Btn small color={T.amber} onClick={()=>{if(!newVariableCat.trim())return;upd({variableSubCats:[...s.variableSubCats,newVariableCat.trim()]});setNewVariableCat("");}}>+ Add</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── Credit Cards Tab ──────────────────────────────────────────────────────────
function CreditCardsTab({s,upd,transactions,getTxns,activeMonth,setActiveMonth,addTxn}) {
  const [showAddCard,setShowAddCard] = useState(false);
  const [newCard,setNewCard] = useState({name:"",person:s.members[0]||"NARR",outstanding:"",limit:""});
  const [payForm,setPayForm] = useState({ccId:null,amount:"",date:`2026-${mNum(activeMonth)}-01`,note:""});
  const [editCardId,setEditCardId] = useState(null);
  const [editCardVal,setEditCardVal] = useState({});

  const ccStats = useMemo(()=>{
    return s.creditCards.map(cc=>{
      const allPaid=transactions.filter(t=>t.category==="CC PAYMENT"&&t.ccId===cc.id).reduce((a,t)=>a+t.amount,0);
      const monthPaid=getTxns(activeMonth).filter(t=>t.category==="CC PAYMENT"&&t.ccId===cc.id).reduce((a,t)=>a+t.amount,0);
      const balance=cc.outstanding-allPaid;
      const recentPmts=transactions.filter(t=>t.category==="CC PAYMENT"&&t.ccId===cc.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
      return {...cc,allPaid,monthPaid,balance,recentPmts};
    });
  },[s.creditCards,transactions,activeMonth]);

  const CC_COLORS=[T.accent,T.purple,T.blue,T.amber,T.green];
  const iStyle={background:T.surface,border:`1px solid ${T.border}`,color:T.text,borderRadius:7,padding:"6px 9px",fontSize:12,outline:"none"};

  const logPayment=ccId=>{
    if(!payForm.amount) return;
    const cc=s.creditCards.find(c=>c.id===ccId);
    addTxn({date:payForm.date,category:"CC PAYMENT",subCat:cc.name,spentOn:`CC Payment - ${cc.name}`,amount:parseFloat(payForm.amount),person:cc.person,note:payForm.note,tags:[],ccId});
    setPayForm(f=>({...f,ccId:null,amount:"",note:""}));
  };

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        {[
          {label:"Total Outstanding (Start)",val:s.creditCards.reduce((a,c)=>a+c.outstanding,0),color:T.rose},
          {label:"Total Paid (All Time)",val:ccStats.reduce((a,c)=>a+c.allPaid,0),color:T.accent},
          {label:"Balance Remaining",val:ccStats.reduce((a,c)=>a+c.balance,0),color:ccStats.reduce((a,c)=>a+c.balance,0)>0?T.amber:T.green},
        ].map(k=>(
          <Card key={k.label} style={{textAlign:"center"}}>
            <div style={{fontSize:11,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>{k.label}</div>
            <div style={{fontSize:26,fontWeight:800,color:k.color}}>{fmt(k.val)}</div>
          </Card>
        ))}
      </div>

      <div style={{display:"flex",gap:5,marginBottom:16,flexWrap:"wrap"}}>
        {MONTHS.map(m=>{
          const has=transactions.filter(t=>t.category==="CC PAYMENT"&&t.date.startsWith(`2026-${mNum(m)}`)).length>0;
          return <button key={m} onClick={()=>setActiveMonth(m)} style={{background:activeMonth===m?T.rose:"transparent",color:activeMonth===m?T.bg:has?T.rose:T.muted,border:`1px solid ${activeMonth===m?T.rose:has?T.rose+"55":T.border}`,borderRadius:7,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{m}</button>;
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(400px,1fr))",gap:18,marginBottom:20}}>
        {ccStats.map((cc,i)=>{
          const clr=CC_COLORS[i%CC_COLORS.length];
          const repayPct=cc.outstanding>0?Math.min(100,(cc.allPaid/cc.outstanding)*100):0;
          return(
            <Card key={cc.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <div style={{fontSize:11,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Credit Card</div>
                  {editCardId===cc.id?(
                    <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:6}}>
                      <input value={editCardVal.name||""} onChange={e=>setEditCardVal(v=>({...v,name:e.target.value}))} style={{...iStyle,fontSize:14,fontWeight:700}}/>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        <input type="number" value={editCardVal.outstanding||""} onChange={e=>setEditCardVal(v=>({...v,outstanding:+e.target.value}))} placeholder="Outstanding ₹" style={{...iStyle}}/>
                        <input type="number" value={editCardVal.limit||""} onChange={e=>setEditCardVal(v=>({...v,limit:+e.target.value}))} placeholder="Limit ₹" style={{...iStyle}}/>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <Btn small onClick={()=>{upd({creditCards:s.creditCards.map(c=>c.id===cc.id?{...c,...editCardVal}:c)});setEditCardId(null);}}>Save</Btn>
                        <Btn small variant="outline" color={T.muted} onClick={()=>setEditCardId(null)}>Cancel</Btn>
                      </div>
                    </div>
                  ):(
                    <div style={{fontSize:20,fontWeight:800,color:clr}}>{cc.name}</div>
                  )}
                  <div style={{marginTop:4}}><Badge color={cc.person===s.members[0]?T.accent:T.purple}>{cc.person}</Badge></div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn small variant="outline" color={T.blue} onClick={()=>{setEditCardId(cc.id);setEditCardVal({name:cc.name,outstanding:cc.outstanding,limit:cc.limit});}}>✏️</Btn>
                  <Btn small variant="outline" color={T.rose} onClick={()=>upd({creditCards:s.creditCards.filter(c=>c.id!==cc.id)})}>🗑</Btn>
                </div>
              </div>

              {[
                {label:"Outstanding Balance (Start)",val:cc.outstanding,color:T.rose},
                {label:`Paid in ${activeMonth}`,val:cc.monthPaid,color:clr},
                {label:"Total Paid (All Time)",val:cc.allPaid,color:T.accent},
                {label:"Remaining Balance",val:cc.balance,color:cc.balance>0?T.amber:T.green},
                ...(cc.limit?[{label:"Credit Limit",val:cc.limit,color:T.muted}]:[]),
              ].map(row=>(
                <div key={row.label} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
                  <span style={{fontSize:12,color:T.muted}}>{row.label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:row.color}}>{fmt(row.val)}</span>
                </div>
              ))}

              <div style={{margin:"14px 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:11,color:T.muted}}>Repayment Progress</span>
                  <span style={{fontSize:11,fontWeight:700,color:clr}}>{repayPct.toFixed(1)}%</span>
                </div>
                <div style={{height:6,background:T.border,borderRadius:99}}>
                  <div style={{height:"100%",width:`${repayPct}%`,background:`linear-gradient(90deg,${clr},${clr}99)`,borderRadius:99,transition:"width 0.5s"}}/>
                </div>
              </div>

              {payForm.ccId===cc.id?(
                <div style={{padding:12,background:T.surface,borderRadius:10,border:`1px solid ${clr}44`}}>
                  <div style={{fontWeight:700,fontSize:12,color:clr,marginBottom:8}}>Log Payment</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                    <input type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))} style={{...iStyle}}/>
                    <input type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} placeholder="Amount ₹" style={{...iStyle}}/>
                  </div>
                  <input value={payForm.note} onChange={e=>setPayForm(f=>({...f,note:e.target.value}))} placeholder="Note (optional)" style={{...iStyle,width:"100%",boxSizing:"border-box",marginBottom:8}}/>
                  <div style={{display:"flex",gap:8}}>
                    <Btn small color={clr} onClick={()=>logPayment(cc.id)}>Submit Payment</Btn>
                    <Btn small variant="outline" color={T.muted} onClick={()=>setPayForm(f=>({...f,ccId:null}))}>Cancel</Btn>
                  </div>
                </div>
              ):(
                <Btn color={clr} onClick={()=>setPayForm(f=>({...f,ccId:cc.id,date:`2026-${mNum(activeMonth)}-01`,amount:""}))}>+ Log Payment</Btn>
              )}

              {cc.recentPmts.length>0&&(
                <div style={{marginTop:12}}>
                  <div style={{fontSize:11,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Recent Payments</div>
                  {cc.recentPmts.map(t=>(
                    <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${T.border}22`}}>
                      <span style={{fontSize:11,color:T.muted}}>{t.date.slice(5)} — {t.note||"Payment"}</span>
                      <span style={{fontSize:11,fontWeight:700,color:clr}}>{fmt(t.amount)}</span>
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
              <TextInput label="Card Name" value={newCard.name} onChange={v=>setNewCard(c=>({...c,name:v}))} placeholder="e.g. HDFC Millennium"/>
              <Sel label="Assigned To" value={newCard.person} onChange={v=>setNewCard(c=>({...c,person:v}))} options={s.members}/>
              <TextInput label="Current Outstanding ₹" type="number" value={newCard.outstanding} onChange={v=>setNewCard(c=>({...c,outstanding:v}))} placeholder="0"/>
              <TextInput label="Credit Limit ₹" type="number" value={newCard.limit} onChange={v=>setNewCard(c=>({...c,limit:v}))} placeholder="0"/>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <Btn onClick={()=>{if(!newCard.name)return;upd({creditCards:[...s.creditCards,{id:uid(),name:newCard.name,person:newCard.person,outstanding:+newCard.outstanding||0,limit:+newCard.limit||0}]});setNewCard({name:"",person:s.members[0]||"NARR",outstanding:"",limit:""});setShowAddCard(false);}}>Add Card</Btn>
                <Btn variant="outline" color={T.muted} onClick={()=>setShowAddCard(false)}>Cancel</Btn>
              </div>
            </div>
          </Card>
        ):(
          <button onClick={()=>setShowAddCard(true)} style={{background:"transparent",border:`2px dashed ${T.border}`,borderRadius:16,color:T.muted,fontSize:14,fontWeight:600,cursor:"pointer",minHeight:140,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:24}}>+</span> Add Credit Card
          </button>
        )}
      </div>
    </div>
  );
}
