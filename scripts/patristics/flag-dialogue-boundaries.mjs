/**
 * Offline dialogue boundary candidate detector, for HUMAN REVIEW ONLY.
 * A source chunk can mix narrator and character. Pattern matches create
 * REVIEW FLAGS, NEVER speaker attribution, doctrinal claims or DB writes.
 * No live imports.
 */
import { pathToFileURL } from "node:url";

const MARKERS = [
  {name:"NARRATOR_SAID_I",regex:/\b(?:said I|I asked|I replied|I answered)\b/gi},
  {name:"TEACHER_REPLIED",regex:/\b(?:the Teacher (?:thus )?replied|she (?:said|replied|answered)|Macrina (?:said|replied|answered))\b/gi},
  {name:"REPORTED_OPPONENT",regex:/\b(?:they urge|objectors? (?:say|argue)|objections made by unbelievers)\b/gi},
  {name:"EMBEDDED_QUOTATION",regex:/\b(?:the Apostle (?:says|said)|Scripture (?:says|tells)|he quotes?)\b/gi},
];

export function detectBoundaryCandidates(chunks) {
  if (!Array.isArray(chunks)) throw new TypeError("Expected ordered source chunks");
  return chunks.flatMap(chunk => {
    if (!chunk || typeof chunk.content !== "string" ||
      typeof chunk.locator !== "string" || !Number.isInteger(chunk.ordinal)) {
      throw new Error("Each source chunk needs content, locator and ordinal");
    }
    const flags = [];
    for (const marker of MARKERS) {
      for (const match of chunk.content.matchAll(marker.regex)) {
        flags.push({
          marker:marker.name,
          offset:match.index,
          evidenceText:match[0],
          speaker:"UNDETERMINED",
          requiresHumanReview:true
        });
      }
    }
    flags.sort((a,b)=>a.offset-b.offset || a.marker.localeCompare(b.marker));
    if (!flags.length) return [];
    return [{
      locator:chunk.locator,
      ordinal:chunk.ordinal,
      flags,
      action:"REVIEW_MIXED_OR_QUOTED_SPEECH",
      status:"CANDIDATE_ONLY"
    }];
  });
}

// Local examples only, intentionally NO networking and NO database calls.
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const examples=[
    {locator:"Source paragraph 084",ordinal:0,content:"But that, said I, was not the point in question."},
    {locator:"Source paragraph 085",ordinal:0,content:"Let me say something else also from among the objections made by unbelievers. No part, they urge, of the body is made by nature without a function."},
    {locator:"Source paragraph 086",ordinal:0,content:"When I had finished, the Teacher thus replied, You have attacked the doctrines connected with the Resurrection."},
  ];
  process.stdout.write(JSON.stringify(detectBoundaryCandidates(examples),null,2)+"\n");
}
