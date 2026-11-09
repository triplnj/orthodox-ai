/**
 * Read-only shadow evaluation of explicit author routing on guarded Neon.
 * Only measures source/corpus routing; NO answer generation, writes or API billing.
 */
import pg from "pg";
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {resolveAuthorScope,stagingAuthorFilterDecision} from "./resolve-author-scope.mjs";
const {Client}=pg;
const BRANCH="br-spring-frost-assfzje6";
export async function shadowAuthorRouting(env=process.env,deps={}){
 const u=env.LIBRARY_STAGING_DB_URL;
 if(env.LIBRARY_STAGING_BRANCH_ID!==BRANCH||!u)
  throw Error("Protected staging environment required");
 const url=new URL(u);
 if(!["postgres:","postgresql:"].includes(url.protocol)||
    !/\.neon\.tech$/i.test(url.hostname)||!url.username||url.pathname==="/")
  throw Error("Refusing non-Neon staging endpoint");
 const fixture=deps.fixture??JSON.parse(readFileSync("tests/fixtures/patristic-author-router-12-shadow.json","utf8"));
 if(fixture?.schemaVersion!==1||fixture.purpose!=="EXPLICIT_AUTHOR_SHADOW_ROUTING_NOT_ANSWER_EVALUATION"||
    fixture.stagingBranch!==BRANCH||fixture.cases?.length!==12||
    new Set(fixture.cases.map(x=>x.id)).size!==12)
  throw Error("Wrong routing shadow fixture");
 const db=deps.db??new Client({connectionString:u,ssl:{rejectUnauthorized:true}});
 await db.connect();
 try{
  const g=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
  if(g.rows.length!==1||g.rows[0].branchId!==BRANCH||g.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")
   throw Error("Staging guard mismatch");
  const {rows}=await db.query(
    'SELECT a."id",a."canonicalName",count(p.embedding)::int AS indexed '+
    'FROM "LibraryAuthor" a LEFT JOIN "LibraryWork" w ON w."authorId"=a."id" '+
    'LEFT JOIN "LibraryEdition" e ON e."workId"=w."id" '+
    'LEFT JOIN "LibraryPassage" p ON p."editionId"=e."id" '+
    'GROUP BY a."id",a."canonicalName" ORDER BY a."canonicalName",a."id"'
  );
  const results=fixture.cases.map(item=>{
   const route=resolveAuthorScope(item.question,rows);
   const permitted=stagingAuthorFilterDecision(route);
   const scopeCorrect=route.scope===item.expectedScope;
   const authorCorrect=item.expectedAuthor===null||(
     route.scope==="SINGLE_AUTHOR"&&route.authors.length===1&&route.authors[0]===item.expectedAuthor);
   return {id:item.id,question:item.question,expectedScope:item.expectedScope,
    actualScope:route.scope,scopeCorrect,authorCorrect,
    reason:route.reason,authors:route.authors,allowedToFilter:permitted.allowed};
  });
  const passing=results.filter(x=>x.scopeCorrect&&x.authorCorrect).length;
  return {status:"AUTHOR_ROUTER_SHADOW_ONLY",branchId:BRANCH,questionCount:results.length,
   passCount:passing,passRate:passing/results.length,
   duplicateNames:[...new Set(rows.map(x=>x.canonicalName))].filter(n=>rows.filter(x=>x.canonicalName===n&&Number(x.indexed)>0).length>1),
   results,databaseWrites:0,embeddingRequests:0,productionRouteChanges:0,
   caveat:"Explicit author mention recognition is not attribution of a quotation or doctrinal accuracy."};
 }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 shadowAuthorRouting().then(r=>process.stdout.write(JSON.stringify(r,null,2)+"\n"))
  .catch(e=>{process.stderr.write("AUTHOR_SHADOW_FAILED: "+e.message+"\n");process.exitCode=1;});
}
