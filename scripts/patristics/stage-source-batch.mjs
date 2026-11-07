/**
 * Generic, rights-gated batch ingest for multiple fathers and texts.
 * Manual local JSON only, staging Neon guard, transaction, hashes verified.
 * Never runs in production or as an app route.
 *
 * node scripts/patristics/stage-source-batch.mjs path/to/manifest.json
 */
import pg from "pg";
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {prepareSourceBatch} from "./prepare-source-batch.mjs";
const {Client}=pg;
const SCOPE="PATRISTIC_LIBRARY_STAGING";

export async function stageSourceBatch(manifest, env=process.env, deps={}){
 const prepared=prepareSourceBatch(manifest);
 const uri=env.LIBRARY_STAGING_DB_URL,branch=env.LIBRARY_STAGING_BRANCH_ID;
 if(!uri || !branch) throw Error("Staging URL and expected branch ID required");
 const u=new URL(uri);
 if(!["postgres:","postgresql:"].includes(u.protocol)||
    !/\.neon\.tech$/i.test(u.hostname)||!u.username||
    !/^br-[a-z0-9-]+$/.test(branch))throw Error("Invalid staging configuration");
 const db=deps.db??new Client({connectionString:uri,ssl:{rejectUnauthorized:true}});
 await db.connect();
 async function guard(){
   const r=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
   if(r.rows.length!==1||r.rows[0].branchId!==branch||r.rows[0].purpose!==SCOPE)
     throw Error("Refusing non-staging database");
 }
 try{
  await guard();
  await db.query("BEGIN");
  try{
   await guard();
   for(const w of prepared.works){
    await db.query('INSERT INTO "LibraryAuthor" ("id","canonicalName") VALUES ($1,$2) ON CONFLICT ("id") DO NOTHING',[w.authorId,w.author]);
    await db.query('INSERT INTO "LibraryWork" ("id","authorId","title") VALUES ($1,$2,$3) ON CONFLICT ("id") DO NOTHING',[w.workId,w.authorId,w.title]);
    await db.query('INSERT INTO "LibraryEdition" ("id","workId","corpus","editionTitle","originalLanguage","sourceUrl","translator","licenseNote","importStatus") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,\'STAGED\') ON CONFLICT ("id") DO NOTHING',
      [w.editionId,w.workId,w.corpus,w.editionTitle,w.language,w.sourceUrl,w.translator,w.licenseNote]);
    const r=await db.query('SELECT e."workId",e."corpus",e."editionTitle",e."originalLanguage",e."sourceUrl",e."licenseNote",e."translator",e."importStatus",w."title",a."canonicalName" FROM "LibraryEdition" e JOIN "LibraryWork" w ON w."id"=e."workId" JOIN "LibraryAuthor" a ON a."id"=w."authorId" WHERE e."id"=$1',[w.editionId]);
    const e=r.rows[0];
    if(r.rows.length!==1||e.workId!==w.workId||e.corpus!==w.corpus||
       e.editionTitle!==w.editionTitle||e.originalLanguage!==w.language||
       e.sourceUrl!==w.sourceUrl||e.licenseNote!==w.licenseNote||
       e.translator!==w.translator||e.importStatus!=="STAGED"||
       e.title!==w.title||e.canonicalName!==w.author)
       throw Error("Edition metadata changed or collides; rolling back");
   }
   for(const p of prepared.passages){
    await db.query('INSERT INTO "LibraryPassage" ("id","editionId","locator","ordinal","content","contentSha256","language","ocrQuality") VALUES ($1,$2,$3,$4,$5,$6,$7,\'UNREVIEWED\') ON CONFLICT ("id") DO NOTHING',
      [p.id,p.editionId,p.locator,p.ordinal,p.content,p.sha256,p.language]);
   }
   for(const w of prepared.works){
    const expected=prepared.passages.filter(p=>p.editionId===w.editionId);
    const r=await db.query('SELECT "id","locator","ordinal","content","contentSha256","language" FROM "LibraryPassage" WHERE "editionId"=$1',[w.editionId]);
    if(r.rows.length!==expected.length) throw Error("Stored passage count mismatch; rolling back");
    const map=new Map(expected.map(p=>[p.id,p]));
    for(const stored of r.rows){
      const p=map.get(stored.id);
      if(!p || stored.locator!==p.locator||stored.ordinal!==p.ordinal||
        stored.content!==p.content||stored.contentSha256!==p.sha256||
        stored.language!==p.language) throw Error("Stored content mismatch; rolling back");
    }
   }
   await db.query("COMMIT");
   return {status:"STAGED_UNREVIEWED",counts:prepared.counts,
     editionIds:prepared.works.map(w=>w.editionId),embedded:0};
  }catch(err){await db.query("ROLLBACK");throw err;}
 }finally{await db.end();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const filename=process.argv[2];
 if(!filename||process.argv.length!==3){process.stderr.write("Usage: node scripts/patristics/stage-source-batch.mjs <local-manifest.json>\n");process.exitCode=1;}
 else readFile(filename,"utf8").then(JSON.parse).then(m=>stageSourceBatch(m))
  .then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
  .catch(e=>{process.stderr.write("BATCH_STAGE_FAILED: "+e.message+"\n");process.exitCode=1;});
}
