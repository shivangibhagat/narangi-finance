import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { fmtDateCell as _fmtDateCell } from "../utils/dateParser";
import { T } from "../constants/theme";
import { resolveCcId } from "../utils/finance";
import { uid } from "../utils/format";
import { Modal, iSty } from "./ui/primitives";

export function ImportModal({open,onClose,s,onImport}) {
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
  const [importErr,setImportErr]=useState("");
  const fileRef=useRef();

  const reset=()=>{setStep("upload");setWb(null);setSheetName("");setHeaders([]);setRows([]);setPreview([]);setImportDone(null);setImportErr("");setMapping({date:-1,category:-1,subCat:-1,spentOn:-1,amount:-1,person:-1,note:-1});};

  const parseFile=file=>{
    setImportErr("");
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const workbook=XLSX.read(e.target.result,{type:"array"});
        setWb(workbook);
        loadSheet(workbook,workbook.SheetNames[0]);
        setSheetName(workbook.SheetNames[0]);
        setStep("map");
      }catch{ setImportErr("Could not read file. Please use .xlsx or .csv format."); }
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

  // Delegate to dateParser utility (timezone-safe, testable without XLSX)
  const fmtDateCell = (val) => _fmtDateCell(val, XLSX.SSF.parse_date_code);

  const buildPreview=()=>{
    const get=(row,idx)=>idx>=0&&idx<row.length?row[idx]:"";
    const members=s.members||["NARR","SHIVU"];
    return rows.map((row,ri)=>{
      const dateStr=fmtDateCell(get(row,mapping.date));
      const rawAmt=get(row,mapping.amount);
      const amt=parseFloat(String(rawAmt).replace(/[₹,\s]/g,""))||0;
      const rawCat=String(get(row,mapping.category)||"").trim().toUpperCase();
      // Normalize category
      const catNorm=rawCat.replace(/\s+/g," ").trim();
      const catMap={"INCOME":"INCOME","FIXED":"FIXED EXPENSES","FIXED EXPENSES":"FIXED EXPENSES","VARIABLE":"VARIABLE EXPENSES","VARIABLE EXPENSES":"VARIABLE EXPENSES","SAVING":"SAVINGS","SAVINGS":"SAVINGS","CC":"CC PAYMENT","CC PAYMENT":"CC PAYMENT"};
      let category=catMap[catNorm]||catMap[catNorm.split(" ")[0]]||"VARIABLE EXPENSES";
      // Convert CC bill entries: Excel stores CC payments as VARIABLE EXPENSES / CREDIT CARD BILLS
      const rawSubCatUpper=String(get(row,mapping.subCat)||"").trim().toUpperCase();
      if(category==="VARIABLE EXPENSES"&&(rawSubCatUpper.includes("CREDIT CARD")||rawSubCatUpper.includes("CC BILL"))){
        category="CC PAYMENT";
      }
      const rawPerson=String(get(row,mapping.person)||"").trim().toUpperCase();
      const person=members.find(m=>m.toUpperCase()===rawPerson)||members[0];
      const subCat=rawSubCatUpper||String(get(row,mapping.subCat)||"").trim();
      const spentOn=String(get(row,mapping.spentOn)||"").trim();
      const ccId=category==="CC PAYMENT"?resolveCcId(subCat,spentOn,s.creditCards||[]):null;
      return {
        _row:ri+2,
        id:uid(),
        date:dateStr,
        category,
        subCat,
        spentOn,
        amount:amt,
        person,
        note:String(get(row,mapping.note)||"").trim(),
        tags:[],
        ccId,
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
          {importErr&&<div style={{marginTop:12,color:T.rose,fontSize:13,fontWeight:600}}>{importErr}</div>}
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
            <button onClick={()=>{reset();}} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer"}}>â† Back</button>
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
            <button onClick={()=>setStep("map")} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer"}}>â† Back</button>
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
