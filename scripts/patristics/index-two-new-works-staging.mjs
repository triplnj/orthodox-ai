/**
 * Strictly bounded embedding index for two new, byte-pinned, STAGED editions.
 * Source texts remain editorially UNREVIEWED and never affect live chat.
 */
import pg from "pg";
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {main as indexOneBatch} from "./index-staging.mjs";
const {Client}=pg;
const BRANCH="br-spring-frost-assfzje6";
export async function indexTwoNewWorks(report,env=process.env,deps={}){
 if(report?.status!=="TWO_NEW_WORKS_STAGED_UNREVIEWED"||
   report.branchId!==BRANCH||report.counts?.passages!==10||
   !Array.isArray(report.editionIds)||new Set(report.editionIds).size!==2)
  throw Error("Missing verified new-work staging report");
 if(env.LIBRARY_STAGING_BRANCH_ID!==BRANCH||
    env.PATRISTIC_NEW_WORKS_INDEX_APPROVAL!=="INDEX_TWO_NEW_WORKS_STAGING_ONLY"||
    !env.OPENAI_API_KEY)throw Error("Exact staging indexing approval missing");
 const raw=env.LIBRARY_STAGING_DB_URL;
 if(!raw)throw Error("Staging URL missing");
 const u=new URL(raw);
 if(!["postgres:","postgresql:"].includes(u.protocol)||
    !/\.neon\.tech$/i.test(u.hostname)||!u.username||!u.pathname||u.pathname==="/")
  throw Error("Refusing non-Neon staging database");
 const db=deps.db??new Client({connectionString:raw,ssl:{rejectUnauthorized:true}});
 let closed=false;
 await db.connect();
 try{
  const marker=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
  if(marker.rows.length!==1||marker.rows[0].branchId!==BRANCH||
     marker.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")
   throw Error("Wrong guarded branch");
  const {rows}=await db.query(String.raw`
   SELECT e."id",e."importStatus",a."canonicalName" AS author,w."title",
     count(p."id")::int AS passages,count(p.embedding)::int AS embedded,
     coalesce(sum(octet_length(p."content")),0)::bigint AS bytes,
     max(octet_length(p."content"))::int AS max_bytes
   FROM "LibraryEdition" e
   JOIN "LibraryWork" w ON w."id"=e."workId"
   JOIN "LibraryAuthor" a ON a."id"=w."authorId"
   LEFT JOIN "LibraryPassage" p ON p."editionId"=e."id"
   WHERE e."id"=ANY($1::text[])
   GROUP BY e."id",e."importStatus",a."canonicalName",w."title"
  `,[report.editionIds]);
  if(rows.length!==2)throw Error("Expected exactly two staged editions");
  const expected=new Map([
   ["St. Athanasius of Alexandria|On the Incarnation of the Word, Chapter 1",4],
   ["St. Cyril of Jerusalem|Catechetical Lecture 1",6]
  ]);
  let total=0,already=0,bytes=0;
  for(const r of rows){
   const expectedCount=expected.get(r.author+"|"+r.title);
   if(!expectedCount||r.importStatus!=="STAGED"||
      Number(r.passages)!==expectedCount||Number(r.embedded)>expectedCount||
      Number(r.max_bytes)>6000)
    throw Error("Unexpected indexed edition identity or passage count");
   total+=Number(r.passages);already+=Number(r.embedded);bytes+=Number(r.bytes);
  }
  if(total!==10||bytes<5000||bytes>18000||
     bytes*10*0.02/1_000_000>0.05)
   throw Error("Staging embedding preflight exceeded 5-cent upper budget");
  await db.end();closed=true;
  const run=deps.runBatch??indexOneBatch;
  let newlyIndexed=0;
  for(const row of rows){
   let remaining=Number(row.passages)-Number(row.embedded);
   while(remaining>0){
    const x=await run(["--edition",row.id,"--batch",String(Math.min(8,remaining))],env,deps.indexDeps??{});
    if(!x||!Number.isInteger(x.indexed)||x.indexed<1||x.indexed>remaining||
       !Number.isInteger(x.remaining)||x.remaining<0||x.remaining>=remaining)
     throw Error("Staging index progress is invalid; abort");
    newlyIndexed+=x.indexed;remaining=x.remaining;
    if(newlyIndexed>10)throw Error("Index count guard breached");
   }
  }
  return {status:"TWO_NEW_WORKS_INDEXED_STAGING_ONLY",branchId:BRANCH,
    expected:10,alreadyIndexed:already,newlyIndexed,
    maxBudgetUSD:0.05,productionChanges:0,
    note:"Embeddings are staging-only; primary source speaker/citation and theological approval remains pending."};
 }finally{if(!closed)await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const name=process.argv[2];
  if(!name)throw Error("Provide staging report json");
  indexTwoNewWorks(JSON.parse(readFileSync(name,"utf8")))
   .then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
   .catch(e=>{process.stderr.write("TWO_NEW_WORKS_INDEX_FAILED: "+e.message+"\n");process.exitCode=1;});
 }catch(e){process.stderr.write("TWO_NEW_WORKS_INDEX_FAILED: "+e.message+"\n");process.exitCode=1;}
}
