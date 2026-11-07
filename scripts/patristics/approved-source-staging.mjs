/**
 * Explicitly approved, staging-only source import.
 * Re-fetching source preview in CI requires a previously reviewed content hash.
 * No production app path and no embeddings are triggered here.
 *
 * node scripts/patristics/approved-source-staging.mjs manifest.json <reviewed-manifest-sha256>
 */
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {auditFirstSourceBatch} from "./audit-first-source-batch.mjs";
import {stageSourceBatch} from "./stage-source-batch.mjs";

const hash=x=>createHash("sha256").update(JSON.stringify(x),"utf8").digest("hex");
export async function approvedSourceStaging(manifest,expectedHash,env=process.env,deps={}){
  if(typeof expectedHash!=="string" || !/^[a-f0-9]{64}$/.test(expectedHash))
    throw Error("A reviewed 64-hex manifest SHA256 is required");
  const actualHash=hash(manifest);
  if(actualHash!==expectedHash)
    throw Error("Source changed since editorial review; refusing staging");
  const audit=auditFirstSourceBatch(manifest);
  if(audit.manifestSha256!==actualHash)
    throw Error("Source audit hash mismatch");
  if(env.PATRISTIC_STAGING_APPROVAL!=="STAGE_REVIEWED_SOURCE_ONLY")
    throw Error("Manual staging approval missing");
  const stage=deps.stage??stageSourceBatch;
  const result=await stage(manifest,env,deps.stageDeps??{});
  return {auditStatus:audit.status,reviewedManifestSha256:actualHash,...result};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4){
    process.stderr.write("Usage: node scripts/patristics/approved-source-staging.mjs <manifest.json> <reviewed-manifest-sha256>\n");process.exitCode=1;
  }else{
    readFile(process.argv[2],"utf8").then(JSON.parse)
      .then(m=>approvedSourceStaging(m,process.argv[3]))
      .then(r=>process.stdout.write(JSON.stringify(r,null,2)+"\n"))
      .catch(e=>{process.stderr.write("APPROVED_STAGE_FAILED: "+e.message+"\n");process.exitCode=1;});
  }
}
