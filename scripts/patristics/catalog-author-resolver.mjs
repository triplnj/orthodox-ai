/**
 * Catalogue-driven, shadow-only resolver: no per-saint code or DB writes.
 * Exact word-boundary names, collision rejection, multi-record canonical groups.
 * Variants must be curated externally or stored in LibraryAuthor.nameVariants.
 */
const fold=s=>String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
const has=(input,alias)=>(" "+input+" ").includes(" "+alias+" ");
const compare=/(?:\bcompare\b|\bcompared\b|\bversus\b|\bvs\.?\b|\bdifference(?:s)? between\b|\bcontrast\b|\bboth\b|\bbetween\b|упореди|пореди|упоред|разлика|поређ|између)/iu;
const honorific=/(?:\b(?:saint|st\.?|holy father)\s+[a-z]|(?:свети|светог|светом|св\.)\s+\p{L}|\bsveti\s+[a-z])/iu;
const namedSlot=/(?:\b(?:What (?:does|did)|Why does|How does|According to|About)\s+[A-Z][a-z]{2,}\b)/;
export function buildAuthorAliasIndex(catalog,registry){
 if(!Array.isArray(catalog)||catalog.length===0||!registry||registry.schemaVersion!==1||
    registry.status!=="REVIEWED_ALIAS_CANDIDATES_SHADOW_ONLY"||!Array.isArray(registry.entries))
  throw Error("Reviewed author catalog and alias registry required");
 const entries=new Map(), owner=new Map(), conflicts=new Set();
 for(const r of catalog){
  if(typeof r.id!=="string"||typeof r.canonicalName!=="string"||!Number.isFinite(Number(r.indexed))||Number(r.indexed)<0)
   throw Error("Invalid author record");
  if(Number(r.indexed)===0)continue;
  if(!entries.has(r.canonicalName))entries.set(r.canonicalName,{name:r.canonicalName,ids:new Set(),aliases:new Set()});
  const x=entries.get(r.canonicalName);
  x.ids.add(r.id); x.aliases.add(fold(r.canonicalName));
  for(const v of r.nameVariants??[]){
   if(typeof v!=="string"||!v.trim())throw Error("Malformed persisted author variant");
   x.aliases.add(fold(v));
  }
 }
 for(const r of registry.entries){
  if(typeof r.canonicalName!=="string"||!Array.isArray(r.variants))throw Error("Malformed reviewed alias");
  const x=entries.get(r.canonicalName);
  if(!x)continue;
  for(const alias of r.variants){
   if(typeof alias!=="string"||!alias.trim())throw Error("Malformed reviewed variant");
   x.aliases.add(fold(alias));
  }
 }
 for(const x of entries.values())for(const alias of x.aliases){
  if(alias.length<4)throw Error("Alias too short for safe routing");
  if(owner.has(alias)&&owner.get(alias)!==x.name)conflicts.add(alias);
  else owner.set(alias,x.name);
 }
 return {entries,owner,conflicts};
}
export function resolveAuthorScopeFromCatalog(question,catalog,registry){
 if(typeof question!=="string"||!question.trim()||question.length>2000)throw Error("Invalid question");
 const index=buildAuthorAliasIndex(catalog,registry);
 const text=fold(question);
 const matches=new Set(),collisions=[];
 for(const [alias,name] of index.owner){
  if(has(text,alias)){
   if(index.conflicts.has(alias))collisions.push(alias);
   else matches.add(name);
  }
 }
 const comparison=compare.test(question),named=honorific.test(question)||namedSlot.test(question);
 const authors=[...matches].sort();
 const reject=(reason)=>({status:"REVIEW_REQUIRED",scope:"NO_AUTOMATIC_FILTER",authors,reason,comparison});
 if(collisions.length)return reject("ALIAS_COLLISION");
 if(comparison&&authors.length!==2)return reject("COMPARISON_REQUIRES_TWO_VERIFIED_AUTHORS");
 if(authors.length>2)return reject("TOO_MANY_NAMED_AUTHORS");
 if(authors.length===0)return {status:named?"UNRESOLVED_NAMED_AUTHOR":"NO_EXPLICIT_AUTHOR",
  scope:named?"NO_AUTOMATIC_FILTER":"GLOBAL",authors:[],
  reason:named?"NO_VERIFIED_CATALOG_NAME_MATCH":"AUTHOR_NOT_SPECIFIED",comparison};
 const authorGroups=authors.map(name=>({canonicalName:name,authorIds:[...index.entries.get(name).ids].sort()}));
 return {status:"EXACT_CATALOG_GROUP_MATCH",scope:comparison?"MULTI_AUTHOR":"SINGLE_AUTHOR",
  authors,authorGroups,reason:"VERIFIED_WHOLE_PHRASE_ALIAS",comparison};
}
export function canonicalNameFilter(route){
 if(route?.status!=="EXACT_CATALOG_GROUP_MATCH")return {allowed:false,reason:route?.reason??"INVALID_ROUTE"};
 return {allowed:true,canonicalNames:route.authors,scope:route.scope,
  note:"Filter by canonical name (or all IDs in each canonical group), never select one arbitrary duplicate author ID"};
}
