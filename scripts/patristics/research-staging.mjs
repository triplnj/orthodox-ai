/**
 * One entry point for isolated, corpus-wide research experiments.
 * Metadata questions report catalogued works without generating fake citations.
 * Text questions use vector retrieval against ALL staged editions, not one father.
 * Offline CLI only; NEVER imported into production chat.
 *
 * Usage:
 * node scripts/patristics/research-staging.mjs --question "..." [--author "St. Gregory of Nyssa"] [--limit 5]
 */
import {pathToFileURL} from "node:url";
import {planUniversalQuery} from "./universal-query.mjs";
import {catalog} from "./catalog-staging.mjs";
import {evaluate} from "./evaluate-staging.mjs";

export function parseResearchArgs(argv){
  const value=flag=>{const i=argv.indexOf(flag);return i<0?undefined:argv[i+1];};
  const question=value("--question");
  const author=value("--author");
  const limit=value("--limit")===undefined?5:Number(value("--limit"));
  if(typeof question!=="string" || !question.trim() || question.length>2000 ||
     (author!==undefined && (typeof author!=="string" || !author.trim() || author.length>120)) ||
     !Number.isInteger(limit)||limit<1||limit>10){
    throw Error('Usage: --question "..." [--author "canonical name"] [--limit 1..10]');
  }
  return {question:question.trim(),author:author?.trim()??null,limit};
}

export async function research(argv=process.argv.slice(2),env=process.env,deps={}){
  const params=parseResearchArgs(argv);
  const plan=planUniversalQuery(params.question);
  const catalogResult=await (deps.catalog??catalog)(env);
  const canonical=s=>s.toLocaleLowerCase().replace(/^(?:st\.?|saint|свети|св\.)\s+/u,"").trim();
  const rows=catalogResult.editions.filter(r=>r.editionId);
  const matches=params.author
    ? rows.filter(r=>canonical(r.author)===canonical(params.author))
    : rows;

  const coverage={
    matchedAuthors:[...new Set(matches.map(r=>r.author))],
    matchedWorks:[...new Set(matches.map(r=>r.work))],
    stagedEditionCount:matches.filter(r=>r.importStatus==="STAGED").length,
    indexedPassages:matches.reduce((n,r)=>n+Number(r.embedded),0),
  };
  // No source facts are invented: catalog metadata ONLY documents present titles.
  if(plan.intent==="BIBLIOGRAPHY" || plan.intent==="BIOGRAPHY"){
    return {
      plan,authorFilter:params.author,coverage,
      catalogRecords:matches.slice(0,100).map(r=>({
        author:r.author,work:r.work,corpus:r.corpus,
        edition:r.editionId,sourceUrl:r.sourceUrl,passages:r.passages
      })),
      textHits:[],
      status:coverage.matchedAuthors.length?"PARTIAL_CATALOG_ONLY":"NO_MATCHING_AUTHOR_IN_STAGING",
      caveat:"Catalogued titles do not constitute complete biographies or bibliographies. An absent author/work must not be presented as nonexistent."
    };
  }
  if(params.author && !matches.length){
    return {plan,authorFilter:params.author,coverage,textHits:[],
      status:"NO_MATCHING_AUTHOR_IN_STAGING",
      caveat:"No matching author is currently indexed. Retrieval was not run against unrelated authors."};
  }
  const authorIds=[...new Set(matches.map(r=>r.authorId))];
  // The existing evaluator uses ID filtering; duplicate author IDs are searched separately
  // to avoid silently losing editions. Without an author filter, search all.
  const evaluateFn=deps.evaluate??evaluate;
  const filters=params.author?authorIds:[null];
  const reports=[];
  for(const id of filters){
    const args=["--question",params.question,"--limit",String(params.limit)];
    if(id)args.push("--author-id",id);
    reports.push(await evaluateFn(args,env));
  }
  const all=reports.flatMap(r=>r.hits??[]);
  all.sort((a,b)=>b.similarity-a.similarity);
  return {
    plan,authorFilter:params.author,coverage,
    textHits:all.slice(0,params.limit),
    status:all.length?"STAGING_EVIDENCE_FOUND":"NO_INDEXED_PASSAGES",
    caveat:"Staging results are unreviewed evidence, NOT a generated Orthodox teaching. Similarity is not doctrinal verification."
  };
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  research().then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
    .catch(err=>{process.stderr.write("RESEARCH_FAILED: "+err.message+"\n");process.exitCode=1;});
}
