/**
 * OFFLINE, read-only preliminary chunk manifest for the New Advent
 * Gregory edition. Does not claim complete work authentication, license
 * review, dialogue speaker attribution, or full source verification.
 * No DB writes, no OpenAI calls, no production application changes.
 * Usage: node scripts/patristics/plan-gregory-sections.mjs
 */
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
import {fetchSourceDocument} from "./prepare-gregory-source.mjs";

const LIMIT=1500;
const sha=s=>createHash("sha256").update(s,"utf8").digest("hex");

export function buildProvisionalManifest({metadata,paragraphs}) {
  if (metadata?.extraction?.coverage!=="UNVERIFIED_PREVIEW" ||
      !Array.isArray(paragraphs) || paragraphs.length!==metadata.extraction.paragraphCount ||
      sha(paragraphs.join("\n\n"))!==metadata.extraction.sha256) {
    throw new Error("Preview/paragraph hash mismatch; no manifest created");
  }
  const passages=[];
  for(let i=0;i<paragraphs.length;i++){
    const original=paragraphs[i];
    if(!original||/\s{2,}/.test(original))throw new Error("Malformed source paragraph");
    const tokens=original.split(/\s+/);
    let chunk="",part=0;
    const emit=()=>{
      if(!chunk)return;
      passages.push({
        locator:"Source paragraph "+String(i+1).padStart(3,"0"),
        part:part++,
        contentSha256:sha(chunk),
        content:chunk
      });
      chunk="";
    };
    for(const token of tokens){
      if(token.length>LIMIT)throw new Error("Single word exceeds chunk size");
      if(chunk.length+token.length+(chunk?1:0)>LIMIT)emit();
      chunk+=(chunk?" ":"")+token;
    }
    emit();
  }
  // Verify that every original paragraph can be reconstructed from its chunks.
  for(let i=0;i<paragraphs.length;i++){
    const locator="Source paragraph "+String(i+1).padStart(3,"0");
    const fragments=passages.filter(p=>p.locator===locator);
    if(!fragments.length||fragments.map(x=>x.content).join(" ")!==paragraphs[i]){
      throw new Error("Loss of text while chunking "+locator);
    }
  }
  return {
    status:"PREVIEW_ONLY_NOT_IMPORTED",
    sourceUrl:metadata.sourceUrl,
    author:metadata.author,
    work:metadata.work,
    edition:metadata.edition,
    sourceSha256:metadata.extraction.sha256,
    paragraphCount:paragraphs.length,
    passageCount:passages.length,
    maxChunkChars:LIMIT,
    allChunksWithinLimit:passages.every(p=>p.content.length<=LIMIT),
    firstLocator:passages[0]?.locator,
    lastLocator:passages.at(-1)?.locator,
    sourceValidation:"UNVERIFIED_PREVIEW",
    note:"Temporary paragraph locators; attribution, editorial boundaries and work completeness must be reviewed before staging.",
    passages
  };
}

export async function planGregory(fetcher){
  const document=await fetchSourceDocument(fetcher);
  const plan=buildProvisionalManifest(document);
  const {passages,...summary}=plan;
  return {...summary,firstChunk:passages[0].content.slice(0,220),lastChunk:passages.at(-1).content.slice(-220)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  planGregory().then(result=>process.stdout.write(JSON.stringify(result,null,2)+"\n"))
    .catch(e=>{process.stderr.write("MANIFEST_FAILED: "+e.message+"\n");process.exitCode=1;});
}
