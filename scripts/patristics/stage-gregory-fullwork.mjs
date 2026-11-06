/**
 * Manual staging-only import of the New Advent Gregory source preview.
 * No OpenAI calls, no automatic launch, no production Prisma/chat changes.
 * This is a PRELIMINARY full-length source extraction, not a reviewed edition.
 *
 * Requires LIBRARY_STAGING_DB_URL and LIBRARY_STAGING_BRANCH_ID.
 * Usage: node scripts/patristics/stage-gregory-fullwork.mjs
 */
import pg from "pg";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
import {fetchSourceDocument} from "./prepare-gregory-source.mjs";
import {buildProvisionalManifest} from "./plan-gregory-sections.mjs";

const {Client}=pg;
const EXPECTED_SHA="3109b08a1a748037129cff95b199e11a06919d38cd0b932cdfd99ccdef2cdcdf";
const SOURCE="https://www.newadvent.org/fathers/2915.htm";
const digest=s=>createHash("sha256").update(s,"utf8").digest("hex");
const stable=(prefix,...parts)=>prefix+"_"+digest(JSON.stringify(parts)).slice(0,32);
const AUTHOR_ID=stable("author","gregory-of-nyssa");
const WORK_ID=stable("work",AUTHOR_ID,"on-the-soul-and-the-resurrection");
const EDITION_ID=stable("edition",WORK_ID,"newadvent-npnf-1893-paragraph-preview");
const LICENSE_NOTE="1893 NPNF English translation; preliminary staging copy; confirm rights/provenance and editorial boundaries before activation.";

function config(env){
  if(!env.LIBRARY_STAGING_DB_URL||!env.LIBRARY_STAGING_BRANCH_ID)
    throw new Error("Missing staging DB URL or expected branch ID");
  const url=new URL(env.LIBRARY_STAGING_DB_URL);
  if(!["postgres:","postgresql:"].includes(url.protocol)||
      !/\\.neon\\.tech$/i.test(url.hostname)||
      !/^br-[a-z0-9-]+$/.test(env.LIBRARY_STAGING_BRANCH_ID))
    throw new Error("Invalid staging DB configuration");
  return {url:env.LIBRARY_STAGING_DB_URL,branch:env.LIBRARY_STAGING_BRANCH_ID};
}
async function guard(db,branch){
  const r=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
  if(r.rows.length!==1||r.rows[0].branchId!==branch||
      r.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")
    throw new Error("Refusing to import: database is not the dedicated staging branch");
}
function records(manifest){
  return manifest.passages.map(p=>({
    id:stable("passage",EDITION_ID,p.locator,String(p.part)),
    editionId:EDITION_ID,locator:p.locator,
    ordinal:p.part, content:p.content, contentSha256:p.contentSha256
  }));
}
export async function stage(argv=process.argv.slice(2),env=process.env,deps={}){
  if(argv.length)throw new Error("No arguments permitted; this import is pinned to one source SHA");
  const cfg=config(env);
  const document=await (deps.fetchDocument ?? fetchSourceDocument)();
  const manifest=buildProvisionalManifest(document);
  if(manifest.sourceSha256!==EXPECTED_SHA||manifest.paragraphCount!==88||
      manifest.passageCount!==175||manifest.sourceUrl!==SOURCE||
      manifest.sourceValidation!=="UNVERIFIED_PREVIEW"||
      manifest.passages.some(x=>x.content.length>1500||x.contentSha256!==digest(x.content))){
    throw new Error("Source has changed since review; do not import");
  }
  const rows=records(manifest);
  if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error("Duplicate passage IDs");
  const db=deps.db ?? new Client({connectionString:cfg.url,ssl:{rejectUnauthorized:true}});
  await db.connect();
  try{
    await guard(db,cfg.branch);
    await db.query("BEGIN");
    try{
      await guard(db,cfg.branch);
      await db.query(
        'INSERT INTO "LibraryAuthor" ("id","canonicalName") VALUES ($1,$2) ON CONFLICT ("id") DO NOTHING',
        [AUTHOR_ID,"St. Gregory of Nyssa"]);
      await db.query(
        'INSERT INTO "LibraryWork" ("id","authorId","title") VALUES ($1,$2,$3) ON CONFLICT ("id") DO NOTHING',
        [WORK_ID,AUTHOR_ID,"On the Soul and the Resurrection"]);
      await db.query(
        'INSERT INTO "LibraryEdition" ("id","workId","corpus","editionTitle","originalLanguage","sourceUrl","licenseNote","importStatus") VALUES ($1,$2,$3,$4,$5,$6,$7,\'STAGED\') ON CONFLICT ("id") DO NOTHING',
        [EDITION_ID,WORK_ID,"CURATED_OTHER",document.metadata.edition,"English",SOURCE,LICENSE_NOTE]);
      const edition=await db.query(
        'SELECT e."workId",e."corpus",e."editionTitle",e."originalLanguage",e."sourceUrl",e."licenseNote",e."importStatus",a."canonicalName",w."title" FROM "LibraryEdition" e JOIN "LibraryWork" w ON w."id"=e."workId" JOIN "LibraryAuthor" a ON a."id"=w."authorId" WHERE e."id"=$1',
        [EDITION_ID]);
      const e=edition.rows[0];
      if(edition.rows.length!==1||e.workId!==WORK_ID||e.corpus!=="CURATED_OTHER"||
          e.editionTitle!==document.metadata.edition||e.originalLanguage!=="English"||
          e.sourceUrl!==SOURCE||e.licenseNote!==LICENSE_NOTE||e.importStatus!=="STAGED"||
          e.canonicalName!=="St. Gregory of Nyssa"||e.title!=="On the Soul and the Resurrection")
        throw new Error("Existing edition metadata mismatch; rolled back");
      for(const p of rows){
        await db.query(
          'INSERT INTO "LibraryPassage" ("id","editionId","locator","ordinal","content","contentSha256","language","ocrQuality") VALUES ($1,$2,$3,$4,$5,$6,$7,\'UNREVIEWED\') ON CONFLICT ("id") DO NOTHING',
          [p.id,p.editionId,p.locator,p.ordinal,p.content,p.contentSha256,"English"]);
      }
      const observed=await db.query(
        'SELECT "id","locator","ordinal","contentSha256","language", "content" FROM "LibraryPassage" WHERE "editionId"=$1',
        [EDITION_ID]);
      const expected=new Map(rows.map(p=>[p.id,p]));
      if(observed.rows.length!==rows.length)throw new Error("Passage count mismatch; rolled back");
      for(const stored of observed.rows){
        const original=expected.get(stored.id);
        if(!original||stored.locator!==original.locator||stored.ordinal!==original.ordinal||
            stored.contentSha256!==original.contentSha256||stored.language!=="English"||
            stored.content!==original.content)
          throw new Error("Passage content/hash collision; rolled back");
      }
      await db.query("COMMIT");
      return {status:"STAGED_UNREVIEWED",editionId:EDITION_ID,paragraphs:88,
        passages:rows.length,sourceSha256:EXPECTED_SHA,embedded:0};
    }catch(e){
      await db.query("ROLLBACK");
      throw e;
    }
  }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  stage().then(r=>process.stdout.write(JSON.stringify(r,null,2)+"\\n"))
    .catch(e=>{process.stderr.write("STAGING_FAILED: "+e.message+"\\n");process.exitCode=1;});
}
