/** Read-only edition transcription audit: staging DB excerpts against primary public pages.
 * This verifies only source-text correspondence, not speaker, theology, or authenticity.
 */
import pg from "pg";
import {load} from "cheerio";
import {pathToFileURL} from "node:url";
const BRANCH="br-spring-frost-assfzje6";
const normalize=s=>String(s??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim();
const matches=(excerpt,page)=>{
 const snippet=normalize(excerpt);
 if(snippet.length<45)return {status:"TOO_SHORT_FOR_TEXT_AUDIT",anchors:0,full:false};
 if(page.includes(snippet))return {status:"FULL_NORMALIZED_MATCH",anchors:3,full:true};
 const size=Math.min(100,Math.max(45,Math.floor(snippet.length/5)));
 const starts=[0,Math.floor((snippet.length-size)/2),snippet.length-size];
 const anchors=starts.map(i=>snippet.slice(i,i+size))
  .filter(x=>page.includes(x)).length;
 return {status:anchors===3?"THREE_ANCHORS_MATCH":anchors>=1?"PARTIAL_TEXT_MATCH":"NO_TEXT_MATCH",
  anchors,full:false};
};
async function downloadText(url,request=fetch){
 const u=new URL(url);
 if(u.protocol!=="https:"||![
  "www.newadvent.org","en.wikisource.org","www.stninaorlando.org","patrologia-lib.ru"
 ].includes(u.hostname))throw Error("Unapproved public source host");
 const response=await request(url,{signal:AbortSignal.timeout(16000),headers:{"User-Agent":"OrthodoxAI-Staging-Editorial-Audit/1.0"}});
 if(!response.ok)throw Error("Source HTTP "+response.status);
 const body=await response.text();
 if(body.length>7000000)throw Error("Oversize source page");
 const $=load(body);
 $("script,style,nav,footer,header,form").remove();
 const root=$(".mw-parser-output").first().length?$(".mw-parser-output").first()
  :$("article").first().length?$("article").first():$("main").first().length?$("main").first():$("body");
 return normalize(root.text());
}
export async function auditStagingTranscriptions(env=process.env,deps={}){
 if(env.LIBRARY_STAGING_BRANCH_ID!==BRANCH||!env.LIBRARY_STAGING_DB_URL)throw Error("Protected staging only");
 const u=new URL(env.LIBRARY_STAGING_DB_URL);
 if(!["postgres:","postgresql:"].includes(u.protocol)||!u.hostname.toLowerCase().endsWith(".neon.tech")||!u.username||u.pathname==="/")throw Error("Invalid Neon staging endpoint");
 const db=deps.db??new pg.Client({connectionString:env.LIBRARY_STAGING_DB_URL,ssl:{rejectUnauthorized:true}});
 await db.connect();
 try{
  const guard=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
  if(guard.rows.length!==1||guard.rows[0].branchId!==BRANCH||guard.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")throw Error("Staging guard mismatch");
  const {rows}=await db.query(`SELECT e."id" "editionId",e."sourceUrl",e."editionTitle",
  p."id" "passageId",p."locator",p."content",
  p."contentSha256" "storedHash",encode(sha256(convert_to(p."content",'UTF8')),'hex') "computedHash"
  FROM "LibraryPassage" p JOIN "LibraryEdition" e ON e."id"=p."editionId"
  ORDER BY e."id",p."ordinal",p."id"`);
  const pages=new Map(), results=[];
  for(const entry of rows){
   if(!pages.has(entry.sourceUrl)){
    try{pages.set(entry.sourceUrl,{text:await downloadText(entry.sourceUrl,deps.fetch??fetch)});}
    catch(e){pages.set(entry.sourceUrl,{error:String(e.message??e)});}
   }
   const page=pages.get(entry.sourceUrl);
   const v=page.error?{status:"SOURCE_UNAVAILABLE",anchors:0,full:false}:matches(entry.content,page.text);
   const hashOk=entry.storedHash===entry.computedHash;
   results.push({editionId:entry.editionId,passageId:entry.passageId,locator:entry.locator,
    sourceUrl:entry.sourceUrl,hashOk,...v});
  }
  const stats={};
  for(const row of results)stats[row.status]=(stats[row.status]??0)+1;
  return {status:"STAGING_SOURCE_TEXT_AUDIT",branchId:BRANCH,total:results.length,
   sourceUrls:pages.size,sourceFailures:[...pages].filter(([,v])=>v.error).map(([u,v])=>({url:u,error:v.error})),
   badHashes:results.filter(x=>!x.hashOk).length,stats,results,
   databaseWrites:0,productionChanges:0,
   caveat:"Only normalized text-match; attribution, editorial boundary, legal assessment and theological content are not automatically certified."};
 }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 auditStagingTranscriptions().then(r=>process.stdout.write(JSON.stringify(r,null,2)+"\n"))
 .catch(e=>{process.stderr.write("STAGING_SOURCE_AUDIT_FAILED: "+e.message+"\n");process.exitCode=1;});
