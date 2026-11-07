/**
 * Exact, bounded 101-passage embedding batch for two editorially staged editions.
 * No production DB and no writes outside these exact edition ids.
 * Preflight rejects unexpected passages, already-indexed counts and any large inputs.
 * Capped to 1 USD using an intentionally very conservative input-byte bound.
 */
import pg from "pg";
import {pathToFileURL} from "node:url";
import {main as indexOneBatch} from "./index-staging.mjs";

const {Client}=pg;
const EDITIONS=[
  {id:"edition_b0cd850e255cf4bd4310094ce8625dec",passages:29},
  {id:"edition_55ef4de453f96a6f885f78a83e01edc0",passages:72}
];
const EXPECTED_TOTAL=101;
const MODEL_PRICE_PER_MILLION=0.02; // text-embedding-3-small, USD per 1M tokens
const APPROVED_MAX_USD=1.0;
const MAX_INPUT_BYTES=1_000_000; // much stricter than the financial budget
const SCOPE="PATRISTIC_LIBRARY_STAGING";

export async function indexApprovedBatch(env=process.env,deps={}){
  if(!env.LIBRARY_STAGING_DB_URL||!env.LIBRARY_STAGING_BRANCH_ID||!env.OPENAI_API_KEY)
    throw Error("Missing staging-only database or OpenAI API secret");
  const url=new URL(env.LIBRARY_STAGING_DB_URL);
  if(!["postgres:","postgresql:"].includes(url.protocol)||
    !/\.neon\.tech$/i.test(url.hostname)||
    !/^br-[a-z0-9-]+$/.test(env.LIBRARY_STAGING_BRANCH_ID))
    throw Error("Only a guarded Neon staging branch is accepted");
  const db=deps.db??new Client({connectionString:env.LIBRARY_STAGING_DB_URL,ssl:{rejectUnauthorized:true}});
  await db.connect();
  let expectedBytes=0;
  let dbClosed=false;
  try{
    const marker=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
    if(marker.rows.length!==1 || marker.rows[0].branchId!==env.LIBRARY_STAGING_BRANCH_ID ||
       marker.rows[0].purpose!==SCOPE)throw Error("Refusing non-staging branch");
    let total=0;
    for(const edition of EDITIONS){
      const {rows}=await db.query(
        'SELECT e."importStatus" AS status, count(p."id")::int AS total, '+
        'count(p.embedding)::int AS embedded, '+
        'coalesce(sum(octet_length(p."content")),0)::bigint AS bytes, '+
        'max(octet_length(p."content"))::int AS max_bytes '+
        'FROM "LibraryEdition" e LEFT JOIN "LibraryPassage" p ON p."editionId"=e."id" '+
        'WHERE e."id"=$1 GROUP BY e."importStatus"',[edition.id]);
      if(rows.length!==1||rows[0].status!=="STAGED"||
        Number(rows[0].total)!==edition.passages)
        throw Error("Unexpected source edition or passage count: "+edition.id);
      if(Number(rows[0].embedded)>edition.passages)
        throw Error("Invalid indexed passage count");
      if(Number(rows[0].max_bytes)>8000)
        throw Error("Unexpectedly long embedding input");
      expectedBytes+=Number(rows[0].bytes);
      total+=Number(rows[0].total);
    }
    if(total!==EXPECTED_TOTAL || expectedBytes<=0||expectedBytes>MAX_INPUT_BYTES)
      throw Error("Approved source batch size exceeded");
    // Even treating every UTF-8 byte as a full token, multiplied by 10 for
    // unexpected retries and tokenization, stays below the approved $1 cap.
    const maximumProjectedUSD=expectedBytes*10*MODEL_PRICE_PER_MILLION/1_000_000;
    if(maximumProjectedUSD>APPROVED_MAX_USD)
      throw Error("Hard preflight financial budget exceeded");
    if(env.PATRISTIC_INDEX_APPROVAL!=="INDEX_101_STAGING_ONLY")
      throw Error("Explicit approval gate missing");
    const existing=[];
    for(const edition of EDITIONS){
      const {rows}=await db.query('SELECT count(*)::int AS count FROM "LibraryPassage" WHERE "editionId"=$1 AND "embedding" IS NOT NULL',[edition.id]);
      existing.push(Number(rows[0].count));
    }
    // Close preflight connection before calling existing guarded per-batch indexer.
    await db.end();
    dbClosed=true;
    let indexed=0;
    const runBatch=deps.runBatch??indexOneBatch;
    for(let e=0;e<EDITIONS.length;e++){
      const edition=EDITIONS[e];
      let remaining=edition.passages-existing[e];
      while(remaining>0){
        const result=await runBatch(["--edition",edition.id,"--batch",String(Math.min(8,remaining))],env,deps.indexDeps??{});
        if(!result||!Number.isInteger(result.indexed)||result.indexed<=0||
           result.indexed>8||!Number.isInteger(result.remaining)||
           result.remaining>=remaining||result.remaining<0)
          throw Error("Unexpected embedding progress; stopped to protect budget");
        indexed+=result.indexed;
        if(indexed>EXPECTED_TOTAL)throw Error("Unexpected indexing count");
        remaining=result.remaining;
      }
    }
    return {status:"INDEXED_STAGING_ONLY",expectedPassages:EXPECTED_TOTAL,
      newlyIndexed:indexed,alreadyIndexed:existing.reduce((a,b)=>a+b,0),
      maxBudgetUSD:APPROVED_MAX_USD,conservativePreflightUSD:maximumProjectedUSD,
      sourceUtf8Bytes:expectedBytes};
  }finally{
    if(!dbClosed)await db.end();
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 indexApprovedBatch().then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
  .catch(e=>{process.stderr.write("INDEX_APPROVED_BATCH_FAILED: "+e.message+"\n");process.exitCode=1;});
}
