/** Staging-only integration of question -> author scope -> actual passages -> evidence envelope.
 * No OpenAI calls, no chat login, no mutations. Never confuse this with an LLM answer E2E test.
 */
import pg from "pg";
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {resolveAuthorCatalogV2} from "./resolve-author-catalog-v2.mjs";
import {assessPassageAttribution} from "./assess-passage-attribution.mjs";
import {rankSourcePassage} from "./rank-staging-source-evidence.mjs";
const BRANCH="br-spring-frost-assfzje6";
const sqlAuthors='SELECT a."id",a."canonicalName",a."nameVariants",count(p.embedding)::int AS indexed FROM "LibraryAuthor" a LEFT JOIN "LibraryWork" w ON w."authorId"=a."id" LEFT JOIN "LibraryEdition" e ON e."workId"=w."id" LEFT JOIN "LibraryPassage" p ON p."editionId"=e."id" GROUP BY a."id",a."canonicalName",a."nameVariants" ORDER BY a."canonicalName",a."id"';
const sqlPassages='SELECT a."id" AS "authorId",a."canonicalName",w."title",w."authenticity",e."sourceUrl",e."editionTitle",e."importStatus",p."id" AS "passageId",p."locator",p."content" FROM "LibraryPassage" p JOIN "LibraryEdition" e ON e."id"=p."editionId" JOIN "LibraryWork" w ON w."id"=e."workId" JOIN "LibraryAuthor" a ON a."id"=w."authorId" WHERE p.embedding IS NOT NULL AND a."id"=ANY($1::text[]) AND length(trim(p."content")) >= 30 ORDER BY w."title",p."ordinal" LIMIT 600';
export async function runStagingEvidenceIntegration(env=process.env,deps={}){
 if(env.LIBRARY_STAGING_BRANCH_ID!==BRANCH||!env.LIBRARY_STAGING_DB_URL)throw Error("Protected staging required");
 const url=new URL(env.LIBRARY_STAGING_DB_URL);
 if(!["postgres:","postgresql:"].includes(url.protocol)||!url.hostname.toLowerCase().endsWith(".neon.tech")||!url.username||url.pathname==="/")throw Error("Refusing non-Neon endpoint");
 const fixture=deps.fixture??JSON.parse(readFileSync("tests/fixtures/patristic-chat-staging-integration.json","utf8"));
 if(fixture.schemaVersion!==1||fixture.stagingBranch!==BRANCH||fixture.cases?.length!==8||new Set(fixture.cases.map(c=>c.id)).size!==8)throw Error("Unexpected integration fixture");
 const db=deps.db??new pg.Client({connectionString:env.LIBRARY_STAGING_DB_URL,ssl:{rejectUnauthorized:true}});
 await db.connect();
 try{
  const guard=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
  if(guard.rows.length!==1||guard.rows[0].branchId!==BRANCH||guard.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")throw Error("Staging guard mismatch");
  const {rows:catalog}=await db.query(sqlAuthors);
  const results=[];
  for(const item of fixture.cases){
   const route=resolveAuthorCatalogV2(item.question,catalog);
   const scoped=route.status==="EXACT_CATALOG_MATCH"&&Array.isArray(route.authorIds);
   let passages=[];
   if(scoped){
    const response=await db.query(sqlPassages,[route.authorIds]);
    passages=response.rows.filter(p=>route.authorIds.includes(p.authorId));
   }
   // The passages are only source candidates. Never auto-certify truth, relevance, or speaker.
   const scored=passages.map(p=>{
    const ranking=rankSourcePassage({content:p.content,topicTerms:item.topicTerms??item.question});
    return {...p,...ranking};
   }).sort((a,b)=>b.score-a.score);
   const candidates=scored.filter(p=>p.score>0).slice(0,3);
   const evidence=candidates.map(p=>{
    const attribution=assessPassageAttribution({workAuthor:p.canonicalName,passage:p.content,sourceLocator:p.locator});
    return {authorName:p.canonicalName,workTitle:p.title,locator:p.locator,
      sourceUrl:p.sourceUrl,passageId:p.passageId,sourceAuthenticity:p.authenticity,
      importStatus:p.importStatus,lexicalOverlap:p.matchedTerms,matchedCues:p.matchedCues,
      speakerVerified:attribution.attributionAllowed,exactQuoteAllowed:false,
      excerpt:p.content.slice(0,1000)};
   });
   const allAuthorEvidence=!item.requireAllAuthors ||
    (route.authorIds??[]).every(id=>evidence.some(e=>
      passages.some(p=>p.authorId===id&&p.passageId===e.passageId)));
   const accepted=route.scope===item.expectedScope &&
    (item.expectedAuthor==null||route.authors.includes(item.expectedAuthor)) &&
    Boolean(evidence.length)===item.expectCandidate && allAuthorEvidence &&
    evidence.every(e=>route.authors.includes(e.authorName)&&
      /^https:\/\//.test(e.sourceUrl)&&e.passageId&&e.excerpt&&e.speakerVerified===false&&e.exactQuoteAllowed===false);
   const gaps=[];
   if(item.expectCandidate&&!evidence.length)gaps.push("NO_TOPIC_MATCHED_PASSAGE");
   if(!allAuthorEvidence)gaps.push("MISSING_COMPARISON_AUTHOR_EVIDENCE");
   if(evidence.some(e=>e.sourceAuthenticity!=="AUTHENTIC"||e.importStatus!=="ACTIVE"))
    gaps.push("EDITORIAL_SOURCE_REVIEW_PENDING");
   results.push({id:item.id,expectedScope:item.expectedScope,actualScope:route.scope,reason:route.reason,
    indexedCandidates:passages.length,evidenceCount:evidence.length,allAuthorEvidence,evidence,
    evidenceGaps:gaps,accepted:Boolean(accepted)});
  }
  return {status:"STAGING_EVIDENCE_INTEGRATION_NO_LLM",branchId:BRANCH,
   passed:results.filter(r=>r.accepted).length,total:results.length,results,
   databaseWrites:0,aiCalls:0,chatWrites:0,productionChanges:0,
   disclaimer:"Real staging database retrieval only; not generative AI, exact citation verification, or HTTP Chat E2E."};
 }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 runStagingEvidenceIntegration().then(r=>process.stdout.write(JSON.stringify(r,null,2)+"\n"))
 .catch(e=>{process.stderr.write("STAGING_INTEGRATION_FAILED: "+e.message+"\n");process.exitCode=1;});
