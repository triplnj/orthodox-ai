/**
 * Read-only, corpus-wide inventory for the isolated patristic library.
 * Reports source coverage and potentially duplicate authors; makes no edits.
 * Usage: node scripts/patristics/catalog-staging.mjs
 */
import pg from "pg";
import {pathToFileURL} from "node:url";
import {planUniversalQuery} from "./universal-query.mjs";

const {Client}=pg;
export async function catalog(env=process.env,deps={}){
  if(!env.LIBRARY_STAGING_DB_URL || !env.LIBRARY_STAGING_BRANCH_ID) throw Error("Staging Neon URL and branch ID required");
  const u=new URL(env.LIBRARY_STAGING_DB_URL);
  if(!["postgres:","postgresql:"].includes(u.protocol) || !/\.neon\.tech$/i.test(u.hostname) ||
     !u.username || !/^br-[a-z0-9-]+$/.test(env.LIBRARY_STAGING_BRANCH_ID)){
    throw Error("Invalid staging database configuration");
  }
  const db=deps.db ?? new Client({connectionString:env.LIBRARY_STAGING_DB_URL,ssl:{rejectUnauthorized:true}});
  await db.connect();
  try{
    const guard=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
    if(guard.rows.length!==1 || guard.rows[0].branchId!==env.LIBRARY_STAGING_BRANCH_ID ||
       guard.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING") throw Error("Refusing non-staging database");
    const {rows}=await db.query(`
      SELECT a."id" AS "authorId",a."canonicalName" AS "author",w."id" AS "workId",
        w."title" AS "work",e."id" AS "editionId",e."corpus",
        e."importStatus",e."sourceUrl",
        count(p."id")::int AS "passages",
        count(p."embedding")::int AS "embedded"
      FROM "LibraryAuthor" a
      LEFT JOIN "LibraryWork" w ON w."authorId"=a."id"
      LEFT JOIN "LibraryEdition" e ON e."workId"=w."id"
      LEFT JOIN "LibraryPassage" p ON p."editionId"=e."id"
      GROUP BY a."id",a."canonicalName",w."id",w."title",e."id",e."corpus",e."importStatus",e."sourceUrl"
      ORDER BY a."canonicalName",w."title",e."id"
    `);
    const normalize=name=>name?.toLowerCase().replace(/^(st\.?|saint|свети|св\.)\s+/u,"").trim() ?? "";
    const byName=new Map();
    for(const r of rows){
      const key=normalize(r.author);
      if(!byName.has(key))byName.set(key,new Set());
      byName.get(key).add(r.authorId);
    }
    return {
      status:"STAGING_READ_ONLY",
      totals:{
        distinctAuthorRecords:new Set(rows.map(r=>r.authorId)).size,
        workRecords:new Set(rows.map(r=>r.workId).filter(Boolean)).size,
        editionRecords:new Set(rows.map(r=>r.editionId).filter(Boolean)).size,
        passages:rows.reduce((n,r)=>n+Number(r.passages),0),
        embedded:rows.reduce((n,r)=>n+Number(r.embedded),0)
      },
      possibleDuplicateAuthorRecords:[...byName.entries()]
        .filter(([,ids])=>ids.size>1)
        .map(([canonicalName,ids])=>({canonicalName,authorIds:[...ids]})),
      editions:rows,
      supportedQuestionRoutes:[
        "BIBLIOGRAPHY","BIOGRAPHY","SCRIPTURE_COMMENTARY",
        "SOURCE_LOCATION","COMPARATIVE_TEACHING","DOCTRINAL_EXPLANATION",
        "ORTHODOX_TRADITION","GENERAL_SOURCE_RESEARCH"
      ],
      routeExample:planUniversalQuery("Шта Свети Максим Исповедник учи о вољи?"),
      caveat:"Question routes are classifiers, not a claim of source coverage. No texts beyond the listed editions are accessible to this staging catalog.",
      databaseWrites:0
    };
  }finally{await db.end();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  catalog().then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
    .catch(e=>{process.stderr.write("CATALOG_FAILED: "+e.message+"\n");process.exitCode=1;});
}
