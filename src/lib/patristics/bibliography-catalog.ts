/**
 * Bibliographic catalogue v1 (editorial data, NOT a live answer provider).
 *
 * Stage 2/6 only: deterministic, versioned and extensible evidence graph.
 * Never promote an imported title into an asserted work without a reviewed
 * source link and attribution. No runtime DB migrations or user-data access.
 */
export type BibliographicRole =
  | "AUTHOR" | "CO_AUTHOR" | "EDITOR" | "CO_EDITOR"
  | "COMPILER" | "TRANSLATOR" | "ADAPTOR" | "COMMENTATOR"
  | "SOURCE_AUTHOR";
export type AttributionStatus =
  | "REVIEW_REQUIRED" | "SOURCE_ATTESTED" | "DISPUTED" | "REJECTED";
export type SourceKind =
  | "PRIMARY_EDITION" | "OFFICIAL_CHURCH" | "SCHOLARLY_BIBLIOGRAPHY"
  | "PUBLISHER_CATALOG" | "COMMUNITY_REFERENCE";
export type BibliographicCompleteness = "UNKNOWN" | "SELECTED" | "REVIEWED_FULL";
export type CatalogAuthor = {
  id: string;
  canonicalName: string;
  nameVariants: string[];
  completeness: BibliographicCompleteness;
};
export type CatalogWork = {
  id: string;
  canonicalTitle: string;
  originalTitle: string | null;
  titleVariants: string[];
  originalLanguage: string | null;
  workKind: "ORIGINAL" | "ANTHOLOGY" | "TRANSLATION" | "ADAPTATION" | "COMMENTARY" | "COMPILATION" | "UNCERTAIN";
  completenessNote: string | null;
};
export type CatalogContribution = {
  authorId: string;
  workId: string;
  roles: BibliographicRole[];
  attribution: AttributionStatus;
  // These evidence IDs must point to records that explicitly support the author/work/role,
  // not just an author biography or a link to a book's full text.
  evidenceIds: string[];
  editorialNote: string | null;
};
export type CatalogEvidence = {
  id: string;
  url: string;
  title: string;
  kind: SourceKind;
  // A short source-specific description (no invented quotation).
  supportingStatement: string;
  workId: string;
  authorId: string;
  rolesSupported: BibliographicRole[];
  reviewStatus: "PENDING_REVIEW" | "REVIEWED" | "REJECTED";
  reviewedBy: string | null;
  reviewedAt: string | null;
};
export type BibliographyCatalog = {
  schemaVersion: 1;
  authors: CatalogAuthor[];
  works: CatalogWork[];
  contributions: CatalogContribution[];
  evidence: CatalogEvidence[];
};
const slug=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const httpUrl=(value:string)=>{
  try { const u=new URL(value);return u.protocol==="https:"&&!!u.hostname&&!u.username&&!u.password; }
  catch {return false;}
};
function fail(why:string):never{throw new Error("BIBLIOGRAPHY_CATALOG_INVALID: "+why);}
const legalRoles=new Set<BibliographicRole>(["AUTHOR","CO_AUTHOR","EDITOR","CO_EDITOR","COMPILER","TRANSLATOR","ADAPTOR","COMMENTATOR","SOURCE_AUTHOR"]);
const legalStatus=new Set<AttributionStatus>(["REVIEW_REQUIRED","SOURCE_ATTESTED","DISPUTED","REJECTED"]);
const legalKind=new Set<SourceKind>(["PRIMARY_EDITION","OFFICIAL_CHURCH","SCHOLARLY_BIBLIOGRAPHY","PUBLISHER_CATALOG","COMMUNITY_REFERENCE"]);
const legalWorkKind=new Set<CatalogWork["workKind"]>(["ORIGINAL","ANTHOLOGY","TRANSLATION","ADAPTATION","COMMENTARY","COMPILATION","UNCERTAIN"]);
function canonical(value:string):string{
 return value.normalize("NFKC").toLocaleLowerCase("en").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
}
function uniqueStrings(values:string[],who:string):void{
 const seen=new Set<string>();
 for(const s of values){
  if(typeof s!=="string"||!s.trim())fail(who+" has blank name/title");
  const n=canonical(s);if(seen.has(n))fail(who+" duplicates normalized alias/title");
  seen.add(n);
 }
}
export function validateBibliographyCatalog(catalog:BibliographyCatalog):BibliographyCatalog{
 if(!catalog||catalog.schemaVersion!==1||!Array.isArray(catalog.authors)||
  !Array.isArray(catalog.works)||!Array.isArray(catalog.contributions)||
  !Array.isArray(catalog.evidence))fail("unsupported schema");
 const ids=new Set<string>();
 const requireId=(id:string,type:string)=>{
  if(typeof id!=="string"||!slug.test(id)||ids.has(id))fail(type+" invalid/duplicate id "+String(id));
  ids.add(id);
 };
 for(const a of catalog.authors){
  requireId(a.id,"author");
  if(!a.canonicalName?.trim()||!Array.isArray(a.nameVariants)||!["UNKNOWN","SELECTED","REVIEWED_FULL"].includes(a.completeness))
   fail("author fields");
  uniqueStrings([a.canonicalName,...a.nameVariants],a.id);
 }
 for(const w of catalog.works){
  requireId(w.id,"work");
  if(!w.canonicalTitle?.trim()||!Array.isArray(w.titleVariants)||
   !legalWorkKind.has(w.workKind)||w.completenessNote!==null&&typeof w.completenessNote!=="string")
   fail("work fields");
  uniqueStrings([w.canonicalTitle,...(w.originalTitle?[w.originalTitle]:[]),...w.titleVariants],w.id);
 }
 for(const e of catalog.evidence){
  requireId(e.id,"evidence");
  if(!catalog.authors.some(a=>a.id===e.authorId)||!catalog.works.some(w=>w.id===e.workId)||
   !httpUrl(e.url)||!e.title?.trim()||!e.supportingStatement?.trim()||
   !legalKind.has(e.kind)||!Array.isArray(e.rolesSupported)||!e.rolesSupported.length||
   e.rolesSupported.some(r=>!legalRoles.has(r))||
   !["PENDING_REVIEW","REVIEWED","REJECTED"].includes(e.reviewStatus))
    fail("evidence fields");
  if(e.reviewStatus==="REVIEWED"&&(!e.reviewedBy?.trim()||!e.reviewedAt||
    Number.isNaN(Date.parse(e.reviewedAt))))fail("reviewed evidence needs provenance");
  if(e.reviewStatus!=="REVIEWED"&&(e.reviewedBy!==null||e.reviewedAt!==null))
    fail("unreviewed evidence cannot have reviewer fields");
 }
 const seenContributions=new Set<string>();
 for(const c of catalog.contributions){
  const key=c.authorId+":"+c.workId;
  if(seenContributions.has(key))fail("duplicate contribution");
  seenContributions.add(key);
  if(!catalog.authors.some(a=>a.id===c.authorId)||!catalog.works.some(w=>w.id===c.workId)||
   !Array.isArray(c.roles)||!c.roles.length||c.roles.some(r=>!legalRoles.has(r))||
   new Set(c.roles).size!==c.roles.length||!legalStatus.has(c.attribution)||
   !Array.isArray(c.evidenceIds)||new Set(c.evidenceIds).size!==c.evidenceIds.length||
   c.editorialNote!==null&&typeof c.editorialNote!=="string")
    fail("contribution fields");
  for(const id of c.evidenceIds){
   const e=catalog.evidence.find(e=>e.id===id);
   if(!e||e.authorId!==c.authorId||e.workId!==c.workId||
     c.roles.some(r=>!e.rolesSupported.includes(r)))
     fail("evidence does not support contribution "+key);
  }
  // No positive attribution may rely on pending, community-only or disputed references.
  if(c.attribution==="SOURCE_ATTESTED"&&
     (!c.evidenceIds.length||!c.evidenceIds.some(id=>{
       const e=catalog.evidence.find(e=>e.id===id)!;
       return e.reviewStatus==="REVIEWED"&&e.kind!=="COMMUNITY_REFERENCE";
     })))fail("positive attribution requires independently reviewed source "+key);
 }
 return catalog;
}
export type BibliographyMatch=
 | {status:"EXACT_AUTHOR";author:CatalogAuthor;workContributions:CatalogContribution[]}
 | {status:"AMBIGUOUS_AUTHOR";authorIds:string[]}
 | {status:"AUTHOR_NOT_FOUND"};
export function findCatalogAuthor(query:string,catalog:BibliographyCatalog):BibliographyMatch{
 const input=" "+canonical(query)+" ";
 if(!input.trim())return {status:"AUTHOR_NOT_FOUND"};
 // Match only complete phrases; a short generic alias fully inside a longer
 // author alias must not falsely create ambiguity. Independent names in the
 // same question, and exact alias collisions, remain AMBIGUOUS_AUTHOR.
 const hits:{author:CatalogAuthor;start:number;end:number}[]=[];
 for(const author of catalog.authors){
  for(const variant of [author.canonicalName,...author.nameVariants]){
   const alias=canonical(variant);
   if(alias.length<4)continue;
   const needle=" "+alias+" ";
   let pos=0;
   while((pos=input.indexOf(needle,pos))>=0){
    hits.push({author,start:pos,end:pos+needle.length});
    pos+=needle.length-1;
   }
  }
 }
 if(!hits.length)return {status:"AUTHOR_NOT_FOUND"};
 const strongest=hits.filter(hit=>!hits.some(other=>
  other!==hit&&other.start<=hit.start&&other.end>=hit.end&&
  other.end-other.start>hit.end-hit.start));
 const authorIds=[...new Set(strongest.map(hit=>hit.author.id))];
 if(authorIds.length>1)return {status:"AMBIGUOUS_AUTHOR",authorIds:authorIds.sort()};
 const author=catalog.authors.find(author=>author.id===authorIds[0])!;
 return {status:"EXACT_AUTHOR",author,
  workContributions:catalog.contributions.filter(c=>c.authorId===author.id&&c.attribution!=="REJECTED")};
}
export type BibliographicEntry={
 work:CatalogWork; roles:BibliographicRole[]; status:AttributionStatus;
 evidence:CatalogEvidence[]; editorialNote:string|null;
};
export function listCatalogWorks(catalog:BibliographyCatalog,authorId:string):BibliographicEntry[]{
 const entries=catalog.contributions.filter(c=>c.authorId===authorId&&c.attribution!=="REJECTED")
  .map(c=>({work:catalog.works.find(w=>w.id===c.workId)!,roles:c.roles,status:c.attribution,
    evidence:catalog.evidence.filter(e=>c.evidenceIds.includes(e.id)),editorialNote:c.editorialNote}));
 return entries.sort((a,b)=>a.work.canonicalTitle.localeCompare(b.work.canonicalTitle,"en"));
}

/**
 * Evidence-scoped attribution dossier. Only the exact author's reviewed,
 * non-community citation can authorize SOURCE_ATTESTED. No title inference.
 * SOURCE_AUTHOR means authorship of the underlying text of an adaptation,
 * not of the adapted publication. Pending or disputed roles remain visible
 * for editorial review, never silently promoted to a user-facing fact.
 */
export type AttributionReviewRow = {
  authorId:string; workId:string; roles:BibliographicRole[];
  status:AttributionStatus; evidenceUrls:string[];
  verifiedEvidenceIds:string[]; openQuestions:string[];
};
export function attributionReviewMatrix(catalog:BibliographyCatalog):AttributionReviewRow[]{
 validateBibliographyCatalog(catalog);
 return catalog.contributions.map(c=>{
  const supporting=catalog.evidence.filter(e=>c.evidenceIds.includes(e.id));
  const verified=supporting.filter(e=>e.reviewStatus==="REVIEWED"&&e.kind!=="COMMUNITY_REFERENCE");
  const openQuestions:string[]=[];
  if(!verified.length)openQuestions.push("NO_REVIEWED_INDEPENDENT_SOURCE");
  if(c.attribution==="REVIEW_REQUIRED")openQuestions.push("ROLE_NEEDS_REVIEW");
  if(c.attribution==="DISPUTED")openQuestions.push("CONFLICTING_ATTRIBUTION");
  if(c.attribution==="REJECTED")openQuestions.push("ATTRIBUTION_REJECTED");
  return {authorId:c.authorId,workId:c.workId,roles:[...c.roles],
    status:c.attribution,evidenceUrls:supporting.map(e=>e.url),
    verifiedEvidenceIds:verified.map(e=>e.id),openQuestions};
 });
}
