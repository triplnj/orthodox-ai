/**
 * Evidence-first bibliography graph. Discovery identity is separate from
 * historically adjudicated authorship. Zero LLM or network calls required.
 *
 * INDEX_LISTED: New Advent index names this author/title heading ONLY.
 * CROSSCHECKED: two or more independent external bibliographic references
 * agree on a role/relation, still pending independent editorial adjudication.
 * EXTERNAL_DOCUMENT: source directly identifies a work/collection/letter.
 */
import index from "../../../docs/qa/external-fathers-index-benchmark.json";
import checked from "../../../docs/qa/crosschecked-author-work-role-corpus.json";
import type {PatristicResearchContext,PatristicResearchSource} from "./build-patristic-research-context";

type Node={author:string;work:string;role:string;relation:string;parentWork:string|null;grade:"INDEX_LISTED"|"CROSSCHECKED"|"EXTERNAL_DOCUMENT";urls:string[];notes:string};
const norm=(s:string)=>s.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim();
const mentions=(text:string,term:string)=>(" "+norm(text)+" ").includes(" "+norm(term)+" ");
const aliases:Record<string,string[]>={
 "Ambrose":["амвросијe миланск","амвросије миланск","ambrose of milan"],
 "Athanasius":["атанасије велик","атанасија велик","атанасије александријск","athanasius of alexandria","athanasius the great"],
 "Augustine of Hippo":["августин блажен","августин хипонск","augustine"],
 "Basil the Great":["василије велик","василија велик","василију велик","basil of caesarea","saint basil","st basil"],
 "Clement of Alexandria":["климент александријск","clement of alexandria"],
 "Cyprian of Carthage":["кипријан картагинск","cyprian"],
 "Ephraim the Syrian":["јефрем сирин","ефрем сирин","ephrem"],
 "Gregory Nazianzen":["григорије богослов","григорија богослов","gregory of nazianzus"],
 "Gregory of Nyssa":["григорије ниск","григорија ниск","gregory of nyssa"],
 "Gregory Thaumaturgus":["григорије чудотворац","gregory thaumaturgus"],
 "Hilary of Poitiers":["иларије поатијск","hilary of poitiers"],
 "Ignatius of Antioch":["игњатије богонос","игњатија богонос","игњатије антиохијск","ignatius of antioch"],
 "Irenaeus of Lyons":["иринеј лионск","irenaeus"],
 "Jerome":["јероним","jerome"],
 "John Cassian":["јован касијан","john cassian"],
 "John Chrysostom":["јован златоуст","john chrysostom"],
 "John of Damascus":["јован дамаскин","јована дамаскин","john damascene","john of damascus"],
 "Lactantius":["лактанције","lactantius"],
 "Origen":["ориген","origen"],
 "Tertullian":["тертулијан","tertullian"],
 "Maximus the Confessor":["максим исповедник","максима исповедника","maximus the confessor"],
 "Clement of Rome":["климент римск","климента римск","clement of rome"],
 "Polycarp":["поликарп","polycarp"],
 "Nicodemus the Hagiorite":["никодим светогорац","никодима светогорца","никодим агиорит","nicodemus the hagiorite"],
 "Macarius of Corinth":["макарије коринтск","макарија коринтск","macarius of corinth"],
 "Lorenzo Scupoli":["лоренцо скуполи","lorenzo scupoli"]
};
const authorEntries=Object.entries(aliases);
function findAuthor(question:string):string|null{
 const normalized=norm(question);
 const candidates=authorEntries.filter(([canonical,variants])=>
    [canonical,...variants].some(v=>norm(v).length>=5&&normalized.includes(norm(v))));
 // No guessing when two different authors are named. Cross-author queries
 // must go to the existing reviewed catalogue or live evidence resolver.
 return candidates.length===1?candidates[0][0]:null;
}
const extra:Node[]=[
 {author:"Maximus the Confessor",work:"Ambigua",role:"AUTHOR",relation:"WORK",parentWork:null,grade:"EXTERNAL_DOCUMENT",urls:["https://guides.library.yale.edu/ancientchristianity/maximus","https://mountthabor.com/en-au/pages/the-professors-suggested-reading-lists"],notes:"Identified in Yale bibliographic guidance and critical-edition bibliography; translation/edition must be identified separately."},
 {author:"Maximus the Confessor",work:"Mystagogia",role:"AUTHOR",relation:"WORK",parentWork:null,grade:"EXTERNAL_DOCUMENT",urls:["https://guides.library.yale.edu/ancientchristianity/maximus","https://mountthabor.com/en-au/pages/the-professors-suggested-reading-lists"],notes:"Critical edition CCSG 69 identified; no invented quotations or publication dates."},
 {author:"Maximus the Confessor",work:"Questions to Thalassius",role:"AUTHOR",relation:"WORK",parentWork:null,grade:"EXTERNAL_DOCUMENT",urls:["https://guides.library.yale.edu/ancientchristianity/maximus","https://mountthabor.com/en-au/pages/the-professors-suggested-reading-lists"],notes:"Bibliography identifies Quaestiones ad Thalassium and CCSG 7, 22."},
 {author:"Ignatius of Antioch",work:"Seven letters (middle recension)",role:"AUTHOR",relation:"COLLECTION",parentWork:null,grade:"EXTERNAL_DOCUMENT",urls:["https://www.cambridge.org/core/journals/church-history/article/abs/expanding-the-narrative-the-reception-of-ignatius-of-antioch-in-britain-ca-12001700/9D64E73855A47D66CD4EB0DBD1d223d6e","https://www.peeters-leuven.be/download_OA.php?id=9789042943902&name=Texts+in+Context"],notes:"Seven letters of the middle recension are generally regarded as genuine; long recension and additional letters are disputed/spurious."},
 {author:"Polycarp",work:"Martyrdom of Polycarp",role:"SUBJECT_NOT_AUTHOR",relation:"ABOUT",parentWork:null,grade:"EXTERNAL_DOCUMENT",urls:["https://www.newadvent.org/fathers/0102.htm","https://www.newadvent.org/fathers/250104.htm"],notes:"The text presents itself as a letter from the Church of Smyrna to the Church of Philomelium about Polycarp, not a work authored by Polycarp."},
 {author:"Clement of Rome",work:"Second Epistle of Clement",role:"DISPUTED_NOT_ESTABLISHED",relation:"PSEUDEPIGRAPHICAL_ATTRIBUTION",parentWork:null,grade:"INDEX_LISTED",urls:["https://www.newadvent.org/fathers/"],notes:"Traditional attribution in the catalog title does not establish Clement of Rome as author. Authorship must not be asserted."}
];
const indexed:Node[]=index.positive.map(x=>({
 author:x.author,work:x.work,role:"UNKNOWN",relation:"INDEX_LISTED",parentWork:null,
 grade:"INDEX_LISTED",urls:["https://www.newadvent.org/fathers/"],
 notes:"Source lists the title under an author heading. This is not a source-reviewed original-authorship assertion."
}));
const crosschecked:Node[]=checked.claims.map(x=>({
 author:x.author,work:x.work,role:x.role,relation:x.relation,parentWork:x.parentWork??null,
 grade:"CROSSCHECKED",urls:x.sourceIds.map(id=>checked.sourceRegistry[id].url),
 notes:x.caution??"Multiple external bibliography entries support this author-work-role relation, pending independent scholarly adjudication."
}));
const all=[...crosschecked,...extra,...indexed];
export function recognizesBibliographyIntent(question:string):boolean{
 const intent=/(?:\b(?:works|writings|books|bibliography|authorship|attributed|letters|epistles|martyrdom|recension|translations|editions|original author)\b|дел[а-я]*|спис[а-я]*|књиг[а-я]*|библиограф[а-я]*|аутор[а-я]*|припис[а-я]*|писм[а-я]*|посланиц[а-я]*|мучеништв[а-я]*|редакциј[а-я]*|превод[а-я]*|издањ[а-я]*|антологиј[а-я]*|филокалиј[а-я]*|дијалектик[а-я]*|јерес[а-я]*|састављач|приређивач)/iu.test(question);
 return intent&&!!findAuthor(question);
}
export function bibliographyGraphContext(question:string):PatristicResearchContext|null{
 if(!recognizesBibliographyIntent(question))return null;
 const author=findAuthor(question)!;
 const nodes=all.filter(x=>x.author===author);
 if(!nodes.length)return null;
 const titleHits=nodes.filter(x=>[x.work,x.parentWork??""].some(t=>t&&mentions(question,t)));
 const candidates=titleHits.length?titleHits:nodes;
 // Crosschecked and directly published documents come before index headings.
 const priority={CROSSCHECKED:0,EXTERNAL_DOCUMENT:1,INDEX_LISTED:2};
 const selected=[...candidates].sort((a,b)=>priority[a.grade]-priority[b.grade]).slice(0,9);
 const sourceRecords:PatristicResearchSource[]=[];
 const blocks=selected.map((node,i)=>{
   const urls=[...new Set(node.urls)].slice(0,2);
   urls.forEach((url,j)=>sourceRecords.push({
     provider:"WEB_RESEARCH",authorName:node.author,workTitle:node.work,
     reference:null,originalLanguage:null,sourceUrl:url,scanUrl:null,
     verificationStatus:node.grade==="INDEX_LISTED"?"EXTERNAL_INDEX_LISTING_ONLY":"EXTERNAL_BIBLIOGRAPHY_CROSSCHECK_UNREVIEWED",
     webpageTitle:url,metadata:{bibliographyCatalog:true,graphRecord:true,recordType:node.relation,
       workId:norm(node.author)+"|"+norm(node.work),roles:[node.role],relation:node.relation,
       parentWorkTitle:node.parentWork,sourceKind:node.grade,editorialReview:false,
       supportingStatement:node.notes,evidenceId:"graph-"+i+"-"+j},
   }));
   return ["[GRAPH_RECORD_"+(i+1)+"]","PERSON: "+node.author,"TITLE: "+node.work,
    "ROLE: "+node.role,"RELATION: "+node.relation,"PARENT: "+(node.parentWork??"none established"),
    "EVIDENCE_GRADE: "+node.grade,"SOURCES: "+urls.join(" | "),
    "LIMITATION: "+node.notes,"[/GRAPH_RECORD_"+(i+1)+"]"].join("\n");
 });
 return {
  context:[
   "STRUCTURED BIBLIOGRAPHY GRAPH — SOURCE-TAGGED DISCOVERY, NOT COMPLETE OR EDITORIALLY CERTIFIED.",
   "Requested person: "+author+". Each record links a specific person, title, role, relation and provenance.",
   "Use ONLY the displayed graph records. An INDEX_LISTED entry proves only that an index lists the work under a person; its role UNKNOWN cannot be upgraded to AUTHOR by inference.",
   "CROSSCHECKED and EXTERNAL_DOCUMENT are externally supported but not independently critically reviewed. Do not claim absolute attribution certainty or fabricate direct quotations.",
   "An ABOUT/SUBJECT_NOT_AUTHOR record expressly excludes attributing the text to its subject.",
   "PSEUDEPIGRAPHICAL_ATTRIBUTION is not positive original authorship.",
   "PART_OF is a constituent work, not an additional independent modern book. TRANSLATION_OF and ADAPTATION_OF are not original-authorship evidence for the translator/adaptor.",
   "Never cite an unrelated document for a title. Source URLs on each record support only that record, and index-only citations should be explicitly called preliminary.",
   "If the question requests exhaustive works, label this list as selected; do not invent missing entries. Avoid generic refusal when matching documentary bibliographic records exist.",
   ...blocks,
  ].join("\n\n"),
  sources:sourceRecords,providersAttempted:["STRUCTURED_BIBLIOGRAPHY_GRAPH"],
  providersSucceeded:["STRUCTURED_BIBLIOGRAPHY_GRAPH"],
 };
}
