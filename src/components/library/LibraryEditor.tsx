"use client";
import { useEffect,useState } from "react";
type Item={id:string;name?:string;title?:string;status?:string;evidence?:{id:string;sourceTitle:string;reviewed:boolean}[];attributions?:{id:string;role:string;authenticity:string;author:{name:string}}[];editions?:{id:string;title:string;textStatus:string}[]};
type Option={key:string;label:string;type?:"select"|"number"|"url"|"textarea";values?:string[]};
const ops:Record<string,Option[]>={
 IMPORT_CHRYSOSTOM_PILOT:[],
 AUTHOR_CREATE:[{key:"slug",label:"Unique Latin slug"},{key:"name",label:"Name"},{key:"originalName",label:"Original name"},{key:"period",label:"Period"},{key:"language",label:"Language"}],
 WORK_CREATE:[{key:"slug",label:"Unique Latin slug"},{key:"title",label:"Title"},{key:"originalTitle",label:"Original title"},{key:"language",label:"Original language"},{key:"genre",label:"Genre"},{key:"survivalStatus",label:"Survival",type:"select",values:["UNKNOWN","COMPLETE","PARTIAL","FRAGMENTS","LOST"]},{key:"parentWorkId",label:"Parent work ID"}],
 ATTRIBUTION_CREATE:[{key:"authorId",label:"Author",type:"select"},{key:"workId",label:"Work",type:"select"},{key:"role",label:"Role",type:"select",values:["AUTHOR","EDITOR","COMPILER","TRANSLATOR","ADAPTOR","COMMENTATOR","SOURCE_AUTHOR","UNKNOWN"]},{key:"authenticity",label:"Authenticity",type:"select",values:["UNDETERMINED","AUTHENTIC","PROBABLY_AUTHENTIC","DISPUTED","PSEUDEPIGRAPHIC","MISATTRIBUTED"]},{key:"note",label:"Explanation",type:"textarea"}],
 EDITION_CREATE:[{key:"workId",label:"Work",type:"select"},{key:"title",label:"Edition title"},{key:"editor",label:"Editor"},{key:"publisher",label:"Publisher"},{key:"year",label:"Year",type:"number"},{key:"language",label:"Language"},{key:"url",label:"Edition HTTPS URL",type:"url"},{key:"citation",label:"Citation"},{key:"textStatus",label:"Text extent",type:"select",values:["METADATA_ONLY","FULL_TEXT","PARTIAL_TEXT","FRAGMENTS","LOST_WORK"]},{key:"rightsStatus",label:"Rights",type:"select",values:["UNKNOWN","PUBLIC_DOMAIN","LICENSED","LINK_ONLY"]},{key:"expectedUnits",label:"Expected units",type:"number"},{key:"availableUnits",label:"Available units",type:"number"}],
 EVIDENCE_CREATE:[{key:"workId",label:"Work",type:"select"},{key:"attributionId",label:"Attribution ID (optional)"},{key:"editionId",label:"Edition ID (optional)"},{key:"sourceTitle",label:"Source title"},{key:"sourceUrl",label:"Source HTTPS URL",type:"url"},{key:"reference",label:"Page/column/catalogue reference"},{key:"note",label:"Description",type:"textarea"}],
 ATTRIBUTION_UPDATE:[{key:"attributionId",label:"Attribution ID"},{key:"authenticity",label:"Authorship judgement",type:"select",values:["UNDETERMINED","AUTHENTIC","PROBABLY_AUTHENTIC","DISPUTED","PSEUDEPIGRAPHIC","MISATTRIBUTED"]},{key:"note",label:"Review justification",type:"textarea"}],
 EDITION_UPDATE:[{key:"editionId",label:"Edition ID"},{key:"textStatus",label:"Text completeness",type:"select",values:["METADATA_ONLY","FULL_TEXT","PARTIAL_TEXT","FRAGMENTS","LOST_WORK"]},{key:"rightsStatus",label:"Rights",type:"select",values:["UNKNOWN","PUBLIC_DOMAIN","LICENSED","LINK_ONLY"]},{key:"expectedUnits",label:"Expected units",type:"number"},{key:"availableUnits",label:"Available units",type:"number"},{key:"note",label:"Review justification",type:"textarea"}],
 EVIDENCE_REVIEW:[{key:"workId",label:"Work",type:"select"},{key:"evidenceId",label:"Evidence ID"},{key:"note",label:"Reason for review",type:"textarea"}],
 PUBLISH_WORK:[{key:"workId",label:"Work",type:"select"},{key:"note",label:"Publication justification",type:"textarea"}],
 PUBLISH_AUTHOR:[{key:"authorId",label:"Author",type:"select"}],
};
export function LibraryEditor(){
 const [authors,setAuthors]=useState<Item[]>([]);
 const [works,setWorks]=useState<Item[]>([]);
 const [action,setAction]=useState("AUTHOR_CREATE");
 const [values,setValues]=useState<Record<string,string>>({});
 const [error,setError]=useState("");
 const [result,setResult]=useState("");
 const [busy,setBusy]=useState(false);
 async function reload(){
  const res=await fetch("/api/library/admin",{cache:"no-store"});
  const data=await res.json();
  if(!res.ok)throw new Error(data.error??"Unable to load catalogue");
  setAuthors(data.authors??[]);setWorks(data.works??[]);
 }
 useEffect(()=>{
  let active=true;
  fetch("/api/library/admin",{cache:"no-store"})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error??"Unable to load catalogue");return data;})
   .then(data=>{if(active){setAuthors(data.authors??[]);setWorks(data.works??[]);}})
   .catch(error=>{if(active)setError(String(error));});
  return ()=>{active=false;};
 },[]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");setResult("");
  try{
   const payload:Record<string,unknown>={action};
   for(const opt of ops[action]){
    const value=(values[opt.key]??"").trim();
    if(value)payload[opt.key]=opt.type==="number"?Number(value):value;
   }
   const res=await fetch("/api/library/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const data=await res.json();if(!res.ok)throw new Error(data.error??"Operation failed");
   setResult(`Saved: ${data.result?.id??"OK"}`);setValues({});await reload();
  }catch(e){setError(e instanceof Error?e.message:"Request failed");}
  finally{setBusy(false);}
 }
 return <section className="space-y-6">
  <p className="text-sm text-gray-600">Entries begin as drafts. Review evidence and check attribution before publishing. Each action is recorded; publication requires a reviewed source and attribution.</p>
  <form onSubmit={e=>void submit(e)} className="rounded-lg border bg-white p-5 space-y-4">
   <label className="block font-semibold">Action
    <select className="mt-1 block w-full rounded border p-2" value={action} onChange={e=>{setAction(e.target.value);setValues({});}}>
     {Object.keys(ops).map(a=><option key={a} value={a}>{a.replaceAll("_"," ")}</option>)}
    </select>
   </label>
   {ops[action].map(opt=><label className="block text-sm" key={opt.key}>{opt.label}
    {opt.type==="textarea"?<textarea className="mt-1 block w-full rounded border p-2" value={values[opt.key]??""} onChange={e=>setValues(s=>({...s,[opt.key]:e.target.value}))}/>:opt.type==="select"?
    <select className="mt-1 block w-full rounded border p-2" value={values[opt.key]??""} onChange={e=>setValues(s=>({...s,[opt.key]:e.target.value}))}>
     <option value="">Select...</option>
     {(opt.key==="authorId"?authors.map(a=>({id:a.id,label:a.name??a.id})):opt.key==="workId"?works.map(w=>({id:w.id,label:w.title??w.id})):(opt.values??[]).map(v=>({id:v,label:v}))).map(item=><option value={item.id} key={item.id}>{item.label}</option>)}
    </select>:
    <input className="mt-1 block w-full rounded border p-2" type={opt.type==="url"?"url":opt.type==="number"?"number":"text"} value={values[opt.key]??""} onChange={e=>setValues(s=>({...s,[opt.key]:e.target.value}))} maxLength={opt.type==="number"?undefined:2000}/>
    }
   </label>)}
   <button disabled={busy} className="rounded bg-gray-950 px-5 py-3 text-white disabled:opacity-50">{busy?"Saving...":"Save action"}</button>
   {error&&<p role="alert" className="text-red-700">{error}</p>}
   {result&&<p role="status" className="text-green-800">{result}</p>}
  </form>
  <section><h2 className="text-xl font-semibold">Authors</h2><ul className="mt-2 space-y-2">{authors.map(a=><li key={a.id} className="rounded border p-2 text-sm">{a.name} · {a.status} · <code>{a.id}</code></li>)}</ul></section>
  <section><h2 className="text-xl font-semibold">Works and evidence</h2><ul className="mt-2 space-y-3">{works.map(w=><li key={w.id} className="rounded border p-3 text-sm">
   <strong>{w.title}</strong> · {w.status}<p className="text-xs text-gray-600">{w.id}</p>
   {(w.attributions??[]).map(a=><p key={a.id} className="mt-1 text-xs">Attribution: {a.author.name} / {a.role} / {a.authenticity} — <code>{a.id}</code></p>)}
   {(w.editions??[]).map(e=><p key={e.id} className="mt-1 text-xs">Edition: {e.title} / {e.textStatus} — <code>{e.id}</code></p>)}
   {(w.evidence??[]).map(e=><p key={e.id} className="mt-1 text-xs">{e.reviewed?"Reviewed":"Pending"}: {e.sourceTitle} — <code>{e.id}</code></p>)}
  </li>)}</ul></section>
 </section>;
}
