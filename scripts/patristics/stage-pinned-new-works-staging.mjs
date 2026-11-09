/**
 * One-time, guarded import of exactly two pinned new sources into the
 * patristic STAGING branch as STAGED/UNREVIEWED. No embeddings generated.
 */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {buildPinnedNewWorksManifest} from "./prepare-pinned-new-works-staging.mjs";
import {stageSourceBatch} from "./stage-source-batch.mjs";
const BRANCH="br-spring-frost-assfzje6";
export async function stagePinnedNewWorks(clean,env=process.env,deps={}){
 if(env.PATRISTIC_NEW_WORKS_STAGE_APPROVAL!=="STAGE_TWO_NEW_WORKS_UNREVIEWED"||
    env.LIBRARY_STAGING_BRANCH_ID!==BRANCH)
  throw Error("Source staging requires exact protected-branch approval");
 const {manifest,prepared}=buildPinnedNewWorksManifest(clean);
 const stage=deps.stage??stageSourceBatch;
 const result=await stage(manifest,env,deps.stageDeps??{});
 if(result.status!=="STAGED_UNREVIEWED"||
    result.counts?.passages!==10||
    result.editionIds?.length!==2||
    result.editionIds.some(id=>!prepared.works.some(w=>w.editionId===id)))
  throw Error("Unexpected staging result; inspect before indexing");
 return {status:"TWO_NEW_WORKS_STAGED_UNREVIEWED",
   branchId:BRANCH,editionIds:result.editionIds,counts:result.counts,
   embeddingRequests:0,productionChanges:0,
   caution:"Source passages are staged only. Do not use in live chat; speaker and theological review remain pending."};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const path=process.argv[2];
  if(!path)throw Error("Usage: stage-pinned-new-works-staging.mjs <clean-candidate.json>");
  stagePinnedNewWorks(JSON.parse(readFileSync(path,"utf8")))
   .then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
   .catch(e=>{process.stderr.write("STAGING_FAILED: "+e.message+"\n");process.exitCode=1;});
 }catch(e){process.stderr.write("STAGING_FAILED: "+e.message+"\n");process.exitCode=1;}
}
