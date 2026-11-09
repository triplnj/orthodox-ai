/** Evidence-only retrieval cues, not doctrinal claims.
 * Phrases must occur in actual source passages before they can contribute to ranking.
 * Keep this map sparse: a title match alone never establishes a quotation or doctrine.
 */
export const CONCEPT_CUES = Object.freeze({
 incarnation: Object.freeze([
  "bodily appearing of the word",
  "manifested to us in a human body",
  "worn a body",
  "word was made flesh",
  "word became flesh"
 ]),
});
const normalize = text=>String(text??"").normalize("NFKD").toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
const words = value=>[...new Set(normalize(value).split(" ").filter(x=>x.length>=4))];
export function rankSourcePassage({content,topicTerms}){
 const body=normalize(content);
 const terms=words(topicTerms);
 const direct=terms.filter(term=>(" "+body+" ").includes(" "+term+" "));
 const conceptCues=[];
 for(const term of terms){
  for(const cue of CONCEPT_CUES[term]??[]){
   if((" "+body+" ").includes(" "+normalize(cue)+" "))conceptCues.push({concept:term,phrase:cue});
  }
 }
 return {score:direct.length+conceptCues.length*2,matchedTerms:direct,matchedCues:conceptCues};
}
