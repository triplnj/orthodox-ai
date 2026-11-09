/**
 * V2 read-only catalogue-driven author resolver shadow evaluation.
 * Uses live staging canonicalName/nameVariants and an external reviewed
 * alias registry, not any source-author code hardcoding.
 */
import pg from "pg";
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {resolveAuthorScopeFromCatalog,canonicalNameFilter} from "./catalog-author-resolver.mjs";
const {Client}=pg;
const BRANCH="br-spring-frost-assfzje6";
export async function runCatalogRouterShadow(env=process.env,deps={}){
 const raw=env.LIBRARY_STAGING_DB_URL;
 if(!raw||env.LIBRARY_STAGING_BRANCH_ID!==BRANCH)throw Error("Exact protected staging configuration required");
 const u=new URL(raw);
 if(!["postgres:","postgresql:"].includes(u.protocol)||!/\.neon\.tech$/i.test(u.hostname)||!u.username||u.pathname==="/")
  throw Error("Refusing non-staging endpoint");
 const fixture=deps.fixture??JSON.parse(readFileSync("tests/fixtures/patristic-catalog-author-router-16-shadow.json","utf8"));
 const registry=deps.registry??JSON.parse(readFileSync("tests/fixtures/patristic-reviewed-author-aliases-v1.json","utf8"));
 if(fixture.schemaVersion!==1||fixture.purpose!=="CATALOG_DRIVEN_AUTHOR_ROUTER_V2_SHADOW"||
    fixture.branchId!==BRANCH||fixture.caseCount!==16||fixture.cases?.length!==16||
    new Set(fixture.cases.map(x=>x.id)).size!==16)throw Error("Wrong frozen shadow fixture");
 const db=deps.db??new Client({connectionString:raw,ssl:{rejectUnauthorized:true}});
 await db.connect();
 try{
  const guard=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
  if(guard.rows.length!==1||guard.rows[0].branchId!==BRANCH||guard.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")
   throw Error("Guarded staging branch not verified");
  const {rows}=await db.query('SELECT a."id",a."canonicalName",a."nameVariants",'+
    'count(p.embedding)::int AS indexed FROM "LibraryAuthor" a '+
    'LEFT JOIN "LibraryWork" w ON w."authorId"=a."id" '+
    'LEFT JOIN "LibraryEdition" e ON e."workId"=w."id" '+
    'LEFT JOIN "LibraryPassage" p ON p."editionId"=e."id" '+
    'GROUP BY a."id",a."canonicalName",a."nameVariants" ORDER BY a."canonicalName",a."id"');
  const results=fixture.cases.map(c=>{
   const route=resolveAuthorScopeFromCatalog(c.question,rows,registry);
   const decision=canonicalNameFilter(route);
   const scopeCorrect=route.scope===c.expectedScope;
   const authorCorrect=c.expectedAuthor===null||
     (route.authors.length===1&&route.authors[0]===c.expectedAuthor);
   return {id:c.id,expectedScope:c.expectedScope,actualScope:route.scope,
    scopeCorrect,authorCorrect,status:route.status,reason:route.reason,
    canonicalNames:route.authors,authorGroups:route.authorGroups??[],
    wouldFilter:decision.allowed};
  });
  const groups=[...new Set(rows.filter(x=>Number(x.indexed)>0).map(x=>x.canonicalName))]
   .map(canonicalName=>({canonicalName,ids:rows.filter(x=>x.canonicalName===canonicalName&&Number(x.indexed)>0).map(x=>x.id)}))
   .filter(x=>x.ids.length>1);
  return {status:"CATALOG_AUTHOR_ROUTER_V2_SHADOW_ONLY",
   branchId:BRANCH,questionCount:16,passCount:results.filter(x=>x.scopeCorrect&&x.authorCorrect).length,
   duplicateGroups:groups,results,databaseWrites:0,embeddingRequests:0,productionChanges:0,
   note:"Alias registry and name variants are data. Grouped canonical names do not merge underlying author rows. No citation/doctrinal certification."};
 }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 runCatalogRouterShadow().then(r=>process.stdout.write(JSON.stringify(r,null,2)+"\n"))
 .catch(e=>{process.stderr.write("CATALOG_ROUTER_SHADOW_FAILED: "+e.message+"\n");process.exitCode=1;});
