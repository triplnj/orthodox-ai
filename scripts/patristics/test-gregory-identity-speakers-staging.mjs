/** Read-only protected Neon rehearsal for Gregory of Nyssa duplicate and voices.
 * No SQL mutation; no Chat writes; no production release.
 */
import pg from "pg";
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {resolveReviewedLogicalAuthor} from "./resolve-reviewed-logical-author.mjs";
import {assessPassageAttribution} from "./assess-passage-attribution.mjs";
const BRANCH="br-spring-frost-assfzje6";
const readJSON=p=>JSON.parse(readFileSync(p,"utf8"));
export async function runGregorySpeakerStaging(env=process.env,deps={}){
 if(env.LIBRARY_STAGING_BRANCH_ID!==BRANCH||!env.LIBRARY_STAGING_DB_URL)
  throw Error("Protected staging only");
 const url=new URL(env.LIBRARY_STAGING_DB_URL);
 if(!["postgres:","postgresql:"].includes(url.protocol)||
  !url.hostname.toLowerCase().endsWith(".neon.tech")||!url.username||url.pathname==="/")
  throw Error("Invalid staging connection");
 const manifest=deps.identity??readJSON("tests/fixtures/patristic-gregory-logical-identity-review.json");
 const speakers=deps.speakers??readJSON("tests/fixtures/patristic-gregory-speaker-evidence-review.json");
 if(speakers.schemaVersion!==1||speakers.stagingBranch!==BRANCH||
  speakers.purpose!=="GREGORY_NYSSA_DIALOGUE_SPEAKER_REVIEW"||
  speakers.reviewedPassages.length!==2||
  new Set(speakers.reviewedPassages.map(x=>x.passageId)).size!==2)
  throw Error("Unapproved speaker registry");
 const db=deps.db??new pg.Client({connectionString:env.LIBRARY_STAGING_DB_URL,ssl:{rejectUnauthorized:true}});
 await db.connect();
 try{
  const guard=await db.query('SELECT "branchId","purpose" FROM "LibraryStagingGuard"');
  if(guard.rows.length!==1||guard.rows[0].branchId!==BRANCH||guard.rows[0].purpose!=="PATRISTIC_LIBRARY_STAGING")
   throw Error("Staging guard mismatch");
  const {rows:catalog}=await db.query(`SELECT a."id",a."canonicalName",a."nameVariants",
   count(p.embedding)::int AS indexed
   FROM "LibraryAuthor" a LEFT JOIN "LibraryWork" w ON w."authorId"=a."id"
   LEFT JOIN "LibraryEdition" e ON e."workId"=w."id"
   LEFT JOIN "LibraryPassage" p ON p."editionId"=e."id"
   GROUP BY a."id",a."canonicalName",a."nameVariants"`);
  const {rows:editions}=await db.query(`SELECT a."id" "authorId",w."id" "workId",w."title",e."id" "editionId",
   e."sourceUrl",count(p."id")::int "passageCount"
   FROM "LibraryAuthor" a JOIN "LibraryWork" w ON w."authorId"=a."id"
   JOIN "LibraryEdition" e ON e."workId"=w."id"
   LEFT JOIN "LibraryPassage" p ON p."editionId"=e."id"
   WHERE a."canonicalName"='St. Gregory of Nyssa'
   GROUP BY a."id",w."id",w."title",e."id",e."sourceUrl"`);
  const matchingEdition=manifest.editions.every(expected=>editions.some(actual=>
   actual.authorId===expected.authorId&&actual.workId===expected.workId&&
   actual.editionId===expected.editionId&&actual.sourceUrl===expected.sourceUrl&&
   actual.title===manifest.historicalWork&&Number(actual.passageCount)===expected.passageCount));
  if(editions.length!==2||!matchingEdition)throw Error("Gregory edition provenance changed; no logical merge");
  const questionCases=[
   ["Gregory of Nyssa on the soul","SINGLE_AUTHOR",2],
   ["Свети Григорије Ниски о души","SINGLE_AUTHOR",2],
   ["Compare St. Basil the Great and St. Gregory of Nyssa on the soul","MULTI_AUTHOR",3],
   ["What does Cyril of Jerusalem teach about baptism?","SINGLE_AUTHOR",1]
  ];
  const routing=questionCases.map(([question,scope,expectedIdCount])=>{
   const r=resolveReviewedLogicalAuthor(question,catalog,manifest);
   return {question,scope:r.scope,reason:r.reason,authorIds:r.authorIds??[],
    pass:r.scope===scope&&r.authorIds?.length===expectedIdCount};
  });
  const ids=speakers.reviewedPassages.map(r=>r.passageId)
   .concat(speakers.unapprovedPassages.map(r=>r.passageId));
  const {rows:passages}=await db.query(`SELECT p."id" "passageId",p."content",p."contentSha256",
   p."locator",e."id" "editionId",a."canonicalName" "workAuthor"
   FROM "LibraryPassage" p JOIN "LibraryEdition" e ON e."id"=p."editionId"
   JOIN "LibraryWork" w ON w."id"=e."workId"
   JOIN "LibraryAuthor" a ON a."id"=w."authorId"
   WHERE p."id"=ANY($1::text[])`,[ids]);
  const review=speakers.reviewedPassages.map(item=>{
   const passage=passages.find(p=>p.passageId===item.passageId);
   const attribution=passage?assessPassageAttribution({
    workAuthor:passage.workAuthor,passage:passage.content,sourceLocator:passage.locator,
    passageId:passage.passageId,contentSha256:passage.contentSha256,
    editionId:passage.editionId,sourceMatchStatus:item.sourceMatchStatus,
    reviewRecordId:item.reviewRecordId,trustedReviews:speakers.reviewedPassages
   }):{attributionAllowed:false};
   return {passageId:item.passageId,speaker:attribution.speaker??null,
    pass:attribution.attributionAllowed===true&&attribution.speaker===item.speaker&&
     attribution.mayQuoteDirectly===false,mayQuoteDirectly:false};
  });
  const unapproved=speakers.unapprovedPassages.map(item=>{
   const passage=passages.find(p=>p.passageId===item.passageId);
   const a=passage?assessPassageAttribution({
    workAuthor:passage.workAuthor,passage:passage.content,sourceLocator:passage.locator,
    passageId:passage.passageId,contentSha256:passage.contentSha256,
    editionId:passage.editionId,sourceMatchStatus:"PARTIAL_TEXT_MATCH",
    reviewRecordId:"unapproved",trustedReviews:speakers.reviewedPassages
   }):{attributionAllowed:false};
   return {passageId:item.passageId,pass:a.attributionAllowed===false,
    reason:item.reason};
  });
  const results=[...routing,...review,...unapproved];
  return {status:"GREGORY_LOGICAL_IDENTITY_SPEAKER_STAGING",branchId:BRANCH,
   total:results.length,passed:results.filter(x=>x.pass).length,
   editionsPreserved:editions.length,distinctAuthorIds:new Set(editions.map(x=>x.authorId)).size,
   reviewedSpeakers:review.length,unapprovedSpeakerPassages:unapproved.length,
   databaseWrites:0,productionChanges:0,quoteApprovals:0,results};
 }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 runGregorySpeakerStaging().then(r=>process.stdout.write(JSON.stringify(r,null,2)+"\n"))
 .catch(e=>{process.stderr.write("GREGORY_STAGING_FAILED: "+e.message+"\n");process.exitCode=1;});
