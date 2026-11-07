/**
 * Read-only, generic QA gate for the first TWO source previews.
 * Verifies source provenance, minimum observed coverage and lossless chunking.
 * Never approves a source for production and does not connect to Neon/OpenAI.
 *
 * Usage: node scripts/patristics/audit-first-source-batch.mjs <preview.json>
 */
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {prepareSourceBatch} from "./prepare-source-batch.mjs";

const EXPECTED = new Map([
  ["St. Basil the Great|Hexaemeron, Homily I",{paragraphs:18, source:"en.wikisource.org"}],
  ["St. John Chrysostom|Homilies on Matthew, Homily I",{paragraphs:70, source:"en.wikisource.org"}]
]);
const sha256=s=>createHash("sha256").update(s,"utf8").digest("hex");

export function auditFirstSourceBatch(manifest){
  const prepared=prepareSourceBatch(manifest);
  if(prepared.works.length!==EXPECTED.size)throw Error("Expected exactly two historic source editions");
  const results=[];
  for(const edition of prepared.works){
    const key=edition.author+"|"+edition.title;
    const expected=EXPECTED.get(key);
    if(!expected)throw Error("Unknown edition in first import review: "+key);
    const source=new URL(edition.sourceUrl);
    if(source.protocol!=="https:" || source.hostname!==expected.source)
      throw Error("Unexpected source domain for "+key);
    const input=manifest.works.find(w=>w.author===edition.author&&w.title===edition.title);
    if(input.paragraphs.length<expected.paragraphs)
      throw Error("Regression: fewer extracted paragraphs than previously seen for "+key);
    const chunks=prepared.passages.filter(p=>p.editionId===edition.editionId);
    for(const para of input.paragraphs){
      const originals=chunks.filter(c=>c.locator===para.locator).sort((a,b)=>a.ordinal-b.ordinal);
      if(originals.map(c=>c.content).join("")!==para.text)
        throw Error("Source-to-chunk reconstruction failed: "+key+" "+para.locator);
    }
    const fullText=input.paragraphs.map(p=>p.text).join("\n\n");
    results.push({
      author:edition.author, title:edition.title,
      sourceUrl:edition.sourceUrl,editionId:edition.editionId,
      paragraphs:input.paragraphs.length,chunks:chunks.length,
      characters:fullText.length,sha256:sha256(fullText),
      firstTextPreview:input.paragraphs[0].text.slice(0,160),
      lastTextPreview:input.paragraphs.at(-1).text.slice(-160),
      status:"REQUIRES_EDITORIAL_REVIEW"
    });
  }
  return {
    status:"AUTOMATED_PREVIEW_QA_PASSED_NOT_IMPORTED",
    results, totalChunks:prepared.passages.length,
    reviewerRequired:true, databaseWrites:0,embeddingRequests:0,
    caveat:"Count/hash validation does not prove edition completeness, text accuracy or permission for each use."
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const path=process.argv[2];
  if(!path||process.argv.length!==3){process.stderr.write("Usage: node scripts/patristics/audit-first-source-batch.mjs <preview.json>\n");process.exitCode=1;}
  else readFile(path,"utf8").then(JSON.parse).then(auditFirstSourceBatch)
    .then(report=>process.stdout.write(JSON.stringify(report,null,2)+"\n"))
    .catch(e=>{process.stderr.write("SOURCE_AUDIT_FAILED: "+e.message+"\n");process.exitCode=1;});
}
