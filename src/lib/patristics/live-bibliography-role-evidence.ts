/**
 * Conservative deterministic evidence check for live bibliography claims.
 * An LLM proposal is not proof of authorship. Only explicit, adjacent
 * English author-work-role statements can provisionally certify a role.
 * Multilingual/implicit assertions retain UNKNOWN pending reviewed evidence.
 */
export type LiveBibliographyRole = "AUTHOR"|"EDITOR"|"COMPILER"|"TRANSLATOR"|"ADAPTOR"|"COMMENTATOR"|"SOURCE_AUTHOR"|"UNKNOWN";
const compact = (value: string) => value.normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu," ").trim().toLowerCase().replace(/\s+/g," ");
const escapeRe = (value: string) => value.replace(/[.*+?^$()|[\]{}\\]/g,"\\$&");
const nameVariants = (person: string) => {
  const value=compact(person).replace(/^(?:saint|st|sveti|свети)\s+/u,"");
  const sansArticles=value.replace(/\b(?:the|of|von|de)\b/gu," ").replace(/\s+/g," ").trim();
  return [...new Set([value,sansArticles].filter(v=>v.length>=6))];
};
export function namedAuthorFromEnglishQuestion(query: string): string | null {
  const m=query.match(/\b(?:saint|st\.?)\s+([A-Z][\p{L}]+(?:\s+(?:of|the|[A-Z][\p{L}]+)){0,5})/u);
  return m ? "Saint "+m[1] : null;
}
export function explicitRoleAttested(input:{
  quote:string; work:string; role:LiveBibliographyRole; authorNames:string[];
}):boolean {
  if(input.role==="UNKNOWN")return false;
  const quote=compact(input.quote),work=compact(input.work);
  if(work.length<4 || !quote.includes(work))return false;
  const people=[...new Set(input.authorNames.flatMap(nameVariants))];
  if(!people.length)return false;
  const verbs:Record<Exclude<LiveBibliographyRole,"UNKNOWN">,string>={
    AUTHOR:"(?:wrote|authored|composed|is the author of|was the author of|is identified as author of|was identified as author of|written by)",
    EDITOR:"(?:edited|is the editor of|was the editor of)",
    COMPILER:"(?:compiled|is the compiler of|was the compiler of)",
    TRANSLATOR:"(?:translated|is the translator of|was the translator of)",
    ADAPTOR:"(?:adapted|is the adaptor of|was the adaptor of|is the adapter of|is identified as adaptor of)",
    COMMENTATOR:"(?:commented on|wrote commentary on|is the commentator of)",
    SOURCE_AUTHOR:"(?:originally wrote|original author of|was originally written by)"
  };
  const verb=verbs[input.role];
  const segments=input.quote.split(/(?:[.!?;]|\n)+/u).map(compact);
  const title=escapeRe(work);
  for(const statement of segments) {
    if(!statement.includes(work))continue;
    // Explicit negation is a counterexample, never affirmative evidence.
    if(/\b(?:not|never|nor|neither|falsely|misattributed|incorrectly)\b/u.test(statement))continue;
    for(const person of people){
      const author=escapeRe(person);
      const middle=String.raw`[\p{L}\p{N}\s,:'"()-]{0,65}`;
      const forward=new RegExp("\\b"+author+"\\b"+middle+"\\b"+verb+"\\b"+middle+"\\b"+title+"\\b","u");
      const reverse=new RegExp("\\b"+title+"\\b"+middle+"\\b"+verb+"\\b"+middle+"\\b"+author+"\\b","u");
      if(forward.test(statement)||reverse.test(statement))return true;
    }
  }
  return false;
}
