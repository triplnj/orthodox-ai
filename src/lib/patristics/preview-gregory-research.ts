/** Preview-only, fail-closed primary-text pilot for Gregory of Nyssa.
 * Exact source-text matches are NOT approved direct quotations or doctrine.
 * Never execute on production or a generic Preview branch.
 */
import {prisma} from "@/lib/prisma";
import {assertIsolatedPreviewConfig} from "@/lib/preview/chat-isolation";
import type {PatristicResearchContext,PatristicResearchSource} from "./build-patristic-research-context";
import identity from "../../../tests/fixtures/patristic-gregory-logical-identity-review.json";
import {resolveReviewedLogicalAuthor} from "../../../scripts/patristics/resolve-reviewed-logical-author.mjs";
import {classifyGregoryOpeningQuestion} from "../../../scripts/patristics/classify-gregory-opening-question.mjs";
type PassageRow={passageId:string;contentSha256:string;content:string;locator:string;
 sourceUrl:string;authorName:string;workTitle:string;editionId:string};
const GREGORY_NAMED=/(?:\b(?:gregory\s+of\s+nyssa|gregorius\s+nyssenus|grigorije\s+niski|grigorija\s+niskog)\b|григориј(?:е|а|у|ем)?\s+ниск(?:и|ог|ом|оме))/iu;
function candidates(q:string,rows:PassageRow[]){
 const terms=q.toLowerCase().split(/[^\p{L}]+/u).filter(s=>s.length>=4&&!["gregory","nyssa","григорије","ниски","what","does","about"].includes(s));
 return rows.map(r=>({row:r,score:terms.filter(t=>r.content.toLowerCase().includes(t)).length}))
 .sort((a,b)=>b.score-a.score||a.row.passageId.localeCompare(b.row.passageId)).slice(0,3).map(x=>x.row);
}
export async function buildIsolatedGregoryResearch(
 query:string, env:NodeJS.ProcessEnv=process.env
):Promise<PatristicResearchContext|null>{
 if(!assertIsolatedPreviewConfig(env)||!GREGORY_NAMED.test(query))return null;
 // A named author is not permission to answer every question from a few introductory excerpts.
 // Return a non-null, source-empty response: the Chat route must refuse to fabricate an answer,
 // and must NOT silently fall back to legacy providers with different attribution standards.
 const coverage=classifyGregoryOpeningQuestion(query);
 if(!coverage.eligible){
  return {context:"The six fully matched opening excerpts do not establish the requested Gregory of Nyssa claim. No direct quotation or further patristic claim is authorized from this pilot. Coverage: "+coverage.reason,
   sources:[],providersAttempted:["PROTECTED_STAGING_GREGORY"],providersSucceeded:[]};
 }
 const catalog=await prisma.$queryRaw<Array<{id:string;canonicalName:string;nameVariants:string[];indexed:number}>>`
  SELECT a."id",a."canonicalName",a."nameVariants",count(p.embedding)::int AS indexed
  FROM "LibraryAuthor" a LEFT JOIN "LibraryWork" w ON w."authorId"=a."id"
  LEFT JOIN "LibraryEdition" e ON e."workId"=w."id"
  LEFT JOIN "LibraryPassage" p ON p."editionId"=e."id"
  GROUP BY a."id",a."canonicalName",a."nameVariants"`;
 const route=resolveReviewedLogicalAuthor(query,catalog,identity);
 const resolvedIds=("authorIds" in route&&Array.isArray(route.authorIds))?route.authorIds:[];
 if(route.status!=="EXACT_CATALOG_MATCH"||route.scope!=="SINGLE_AUTHOR"||
   route.authors.length!==1||route.authors[0]!=="St. Gregory of Nyssa"||
   resolvedIds.length!==2)
  throw Error("Isolated Gregory pilot rejected an unresolved or multi-author scope");
 const pins=identity.sourceMatchedPassageFingerprints;
 if(pins.length!==6||new Set(pins.map(p=>p.passageId)).size!==6)throw Error("Untrusted Gregory source manifest");
 const ids=pins.map(p=>p.passageId);
 const rows=await prisma.$queryRaw<PassageRow[]>`
 SELECT p."id" AS "passageId",p."contentSha256",p."content",p."locator",
 e."sourceUrl",a."canonicalName" AS "authorName",w."title" AS "workTitle",
 e."id" AS "editionId"
 FROM "LibraryPassage" p JOIN "LibraryEdition" e ON e."id"=p."editionId"
 JOIN "LibraryWork" w ON w."id"=e."workId"
 JOIN "LibraryAuthor" a ON a."id"=w."authorId"
 WHERE p."id"=ANY(${ids}::text[]) AND a."canonicalName"='St. Gregory of Nyssa'
 AND w."title"='On the Soul and the Resurrection'
 ORDER BY p."id"`;
 const expected=new Map(pins.map(p=>[p.passageId,p.contentSha256]));
 const safe=rows.filter(r=>expected.get(r.passageId)===r.contentSha256);
 if(safe.length!==6||new Set(safe.map(r=>r.passageId)).size!==6)
  throw Error("Preview source corpus integrity check failed");
 const selected=candidates(query,safe);
 const sources:PatristicResearchSource[]=selected.map(r=>({
  provider:"CURATED_TEXT",authorName:r.authorName,workTitle:r.workTitle,
  reference:r.locator,originalLanguage:"English",sourceUrl:r.sourceUrl,
  scanUrl:null,verificationStatus:"STAGING_TEXT_MATCH_ONLY",
  metadata:{passageId:r.passageId,sourceTextMatch:true,exactQuoteAllowed:false,
   speakerVerified:false,excerpt:r.content.slice(0,1250),sourceEditionId:r.editionId}
 }));
 const context=[
 "PROTECTED PREVIEW PILOT — GREGORY OF NYSSA, ON THE SOUL AND THE RESURRECTION.",
 "The author of this book is St. Gregory of Nyssa. It is a dialogue with St. Macrina.",
 "Each passage below is an independently source-text-matched English translation snippet.",
 "CRITICAL: Text matches alone do not verify the speaker, theological claim or permission for verbatim quotation.",
 "Do NOT quote these passages verbatim. Paraphrase only what they clearly support.",
 "Do NOT attribute any utterance to Gregory or Macrina unless the passage explicitly identifies its speaker; otherwise describe the work as a dialogue.",
 "Do not infer wider doctrine from a short opening passage. No other works have been certified by this pilot.",
 ...selected.map((r,i)=>[
  '[STAGING_PASSAGE_'+(i+1)+']',
  'AUTHOR OF WORK: '+r.authorName,
  'WORK: '+r.workTitle,'LOCATION: '+r.locator,'URL: '+r.sourceUrl,
  'SOURCE STATUS: FULL TEXT CORRESPONDENCE ONLY; SPEAKER UNVERIFIED; NO DIRECT QUOTES',
  'EXCERPT: '+r.content.slice(0,1250),
  '[/STAGING_PASSAGE_'+(i+1)+']'].join("\n"))
 ].join("\n\n");
 return {context,sources,providersAttempted:["PROTECTED_STAGING_GREGORY"],
  providersSucceeded:["PROTECTED_STAGING_GREGORY"]};
}
