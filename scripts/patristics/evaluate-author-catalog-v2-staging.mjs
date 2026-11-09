/** Protected staging, read-only independent holdout for catalogue author resolver v2. */
import pg from "pg";
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {resolveAuthorCatalogV2} from "./resolve-author-catalog-v2.mjs";
const BRANCH="br-spring-frost-assfzje6";
const {Client}=pg;
export async function evaluateCatalogAuthorHoldout(env=process.env,deps={}){
 if(env.LIBRARY_STAGING_BRANCH_ID!==BRANCH||!env.LIBRARY_STAGING_DB_URL)throw Error("Protected staging required");
 const url=new URL(env.LIBRARY_STAGING_DB_URL);
 if(!["postgres:","postgresql:"].includes(url.protocol)||!/\\.neon\\.tech$/i.test(url.hostname)||!url.username||url.pathname==="/")throw Error("Invalid staging endpoint");
 const fixture=deps.fixture??JSON.parse(readFileSync("tests/fixtures/patristic-author-catalog-v2-holdout.json","utf8"));
 if(fixture.schemaVersion!==2||fixture.purpose!=="INDEPENDENT_AUTHOR_SCOPE_HOLDOUT_NO_ANSWER_GENERATION"||
 fixture.stagingBranch!==BRANCH||fixture.cases.length!==18||new Set(fixture.cases.map(x=>x.id)).size!==18)throw Error("Wrong holdout fixture");
 const db=deps.db??new Client({connectionString:env.LIBRARY_STAGING_DB_URL,ssl:{rejectUnauthorized:true}});
 await db.connect();
 try{
  const guard=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
  if(guard.rows.length!==1||guard.rows[0].branchId!==BRANCH||guard.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")throw Error("Staging guard mismatch");
  const {rows}=await db.query('SELECT a."id",a."canonicalName",a."nameVariants",count(p.embedding)::int AS indexed FROM "LibraryAuthor" a LEFT JOIN "LibraryWork" w ON w."authorId"=a."id" LEFT JOIN "LibraryEdition" e ON e."workId"=w."id" LEFT JOIN "LibraryPassage" p ON p."editionId"=e."id" GROUP BY a."id",a."canonicalName",a."nameVariants" ORDER BY a."canonicalName",a."id"');
  const results=fixture.cases.map(c=>{
   const r=resolveAuthorCatalogV2(c.question,rows);
   const authorCorrect=!c.expectedAuthor || r.authors.includes(c.expectedAuthor);
   // A no-filter result for a known expected author is only correct if the system actually recognized that author.
   const correct=r.scope===c.expectedScope&&authorCorrect;
   return {id:c.id,expectedScope:c.expectedScope,actualScope:r.scope,expectedAuthor:c.expectedAuthor,authors:r.authors,reason:r.reason,correct};
  });
  const correctCount=results.filter(x=>x.correct).length;
  return {status:"CATALOG_AUTHOR_V2_STAGING_HOLDOUT",branchId:BRANCH,total:results.length,correctCount,
   accuracy:correctCount/results.length,
   missingVariantRows:rows.filter(x=>!Array.isArray(x.nameVariants)||x.nameVariants.length===0).length,
   indexedAuthorRows:rows.filter(x=>Number(x.indexed)>0).length,
   duplicateCanonicalNames:[...new Set(rows.map(x=>x.canonicalName))].filter(n=>rows.filter(x=>x.canonicalName===n&&Number(x.indexed)>0).length>1),
   databaseWrites:0,productionChanges:0,embeddingRequests:0,results,
   caveat:"Routing only. This does not measure source ranking, passage attribution, or answer accuracy."};
 }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 evaluateCatalogAuthorHoldout().then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
 .catch(e=>{process.stderr.write("CATALOG_HOLDOUT_FAILED: "+e.message+"\n");process.exitCode=1;});
