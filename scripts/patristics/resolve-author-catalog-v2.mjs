/** Catalog-driven, shadow-only author recognition. Not connected to production chat. */
const norm = s => String(s??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
const includesPhrase = (text,alias)=>(" "+text+" ").includes(" "+alias+" ");
const comparisonRE=/\b(?:compare|compared|versus|vs|between|contrast)\b|упореди|упоред|пореди|разлик|између/iu;
const namedRE=/\b(?:saint|st|father|elder|bishop|metropolitan)\b|свети|светог|светом|светога|св\.|отац|оца|владика|епископ|митрополит/iu;
const blocked=(status,reason,authors=[],comparison=false,extra={})=>({status,scope:"NO_AUTOMATIC_FILTER",reason,authors,comparison,...extra});
/** Catalogue rows: {id,canonicalName,indexed,nameVariants?: string[]}.
 * Aliases must have editorial provenance. Never infer shortened names.
 * Duplicate indexed IDs block filtering, rather than choosing one arbitrarily.
 */
export function resolveAuthorCatalogV2(question,catalog){
 if(typeof question!=="string"||!question.trim()||question.length>2000)throw Error("Invalid question");
 if(!Array.isArray(catalog)||!catalog.length)throw Error("Missing author catalog");
 const q=norm(question),comparison=comparisonRE.test(question),groups=new Map();
 for(const row of catalog){
  if(!row||typeof row.id!=="string"||!row.id||typeof row.canonicalName!=="string"||!row.canonicalName.trim())continue;
  const key=norm(row.canonicalName);if(!key)continue;
  if(!groups.has(key))groups.set(key,{canonicalName:row.canonicalName,ids:new Set(),aliases:new Set()});
  const g=groups.get(key);
  if(Number(row.indexed)>0)g.ids.add(row.id);
  for(const v of [row.canonicalName,...(Array.isArray(row.nameVariants)?row.nameVariants:[])]){
   if(typeof v!=="string")continue;const a=norm(v);
   // Ambiguous bare given names (e.g. Cyril/Gregory) cannot select an author.
   if(a.length>=4&&a.includes(" "))g.aliases.add(a);
  }
 }
 const owners=new Map();
 for(const [key,g] of groups)for(const a of g.aliases){
  if(!owners.has(a))owners.set(a,new Set());owners.get(a).add(key);
 }
 const matched=[...owners].filter(([a])=>includesPhrase(q,a));
 // Do not allow a short alias embedded in a more specific name to match another author.
 const specific=matched.filter(([a])=>!matched.some(([b])=>b!==a&&b.length>a.length&&includesPhrase(b,a)));
 const found=new Set(),conflicts=[];
 for(const [a,keys] of specific){if(keys.size>1)conflicts.push(a);else found.add([...keys][0]);}
 const authors=[...found].map(k=>groups.get(k).canonicalName);
 if(conflicts.length)return blocked("REVIEW_REQUIRED","COLLIDING_CATALOG_ALIASES",authors,comparison,{conflicts});
 if(found.size>2)return blocked("REVIEW_REQUIRED","TOO_MANY_AUTHORS",authors,comparison);
 if(comparison&&found.size!==2)return blocked("REVIEW_REQUIRED","INCOMPLETE_COMPARISON",authors,comparison);
 if(!comparison&&found.size===2)return blocked("REVIEW_REQUIRED","MULTIPLE_AUTHORS_WITHOUT_COMPARISON",authors,comparison);
 // An unqualified given name that appears in any catalogue entry remains ambiguous.
 // Do not misclassify it as an authorless topic merely because the alias is incomplete.
 const givenNames=[...groups.keys()].flatMap(k=>k.split(" ").filter(w=>w.length>=4&&!["saint","the","great","of"].includes(w)));
 const ambiguousGivenName=givenNames.some(w=>includesPhrase(q,w));
 if(found.size===0&&ambiguousGivenName)return blocked("UNRESOLVED_NAMED_AUTHOR","INCOMPLETE_OR_AMBIGUOUS_AUTHOR_NAME",[],comparison);
 if(found.size===0)return namedRE.test(question)
  ?blocked("UNRESOLVED_NAMED_AUTHOR","NO_CATALOG_ALIAS_MATCH",[],comparison)
  :{status:"NO_EXPLICIT_AUTHOR",scope:"GLOBAL",reason:"AUTHOR_NOT_SPECIFIED",authors:[],comparison};
 // Detect additional explicitly titled saints left after recognized aliases are removed.
 // For example, "Basil the Great and St Maximus" must never silently scope to Basil.
 let unmatched=q;
 for(const [alias] of specific.sort((a,b)=>b[0].length-a[0].length)){
  unmatched=(" "+unmatched+" ").replace(" "+alias+" "," ").trim().replace(/\s+/g," ");
 }
 const unknownTitled=/(?:^| )(?:saint|st|sveti|svetog|svetom|свети|светог|светом|св)(?: +)(?:[\p{L}][\p{L}\p{N}]*)(?: |$)/u.test(" "+unmatched+" ");
 if(unknownTitled)return blocked("REVIEW_REQUIRED","ADDITIONAL_UNRESOLVED_TITLED_AUTHOR",authors,comparison);
 const selected=[...found].map(k=>groups.get(k));
 if(selected.some(g=>g.ids.size===0))return blocked("REVIEW_REQUIRED","AUTHOR_NOT_INDEXED",authors,comparison);
 if(selected.some(g=>g.ids.size>1))return blocked("REVIEW_REQUIRED","DUPLICATE_INDEXED_AUTHOR_IDS",authors,comparison,
  {duplicateAuthors:selected.filter(g=>g.ids.size>1).map(g=>g.canonicalName)});
 return {status:"EXACT_CATALOG_MATCH",scope:comparison?"MULTI_AUTHOR":"SINGLE_AUTHOR",
  reason:"REVIEWED_CATALOG_ALIAS",authors,authorIds:selected.map(g=>[...g.ids][0]),comparison};
}
