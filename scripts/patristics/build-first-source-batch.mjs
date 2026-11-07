/**
 * Download two historic public-domain English patristic translations
 * from Wikisource and produce a local source manifest for HUMAN QA.
 *
 * DOES NOT write to database, create embeddings, or affect live chat.
 * Usage: node scripts/patristics/build-first-source-batch.mjs
 */
import { writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import { prepareSourceBatch } from "./prepare-source-batch.mjs";
import { pathToFileURL } from "node:url";

const PAGES=[
  {
    author:"St. Basil the Great",
    title:"Hexaemeron, Homily I",
    editionTitle:"NPNF, Series II, Volume VIII (1895), English translation",
    page:"Nicene and Post-Nicene Fathers: Series II/Volume VIII/The Hexaemeron/Homily 1",
    description:"Blomfield Jackson translation, NPNF2 VIII (1895)"
  },
  {
    author:"St. John Chrysostom",
    title:"Homilies on Matthew, Homily I",
    editionTitle:"NPNF, Series I, Volume X (1888), English translation",
    page:"Nicene and Post-Nicene Fathers: Series I/Volume X/The Homilies of St. John Chrysostom/Homily 1",
    description:"NPNF1 X nineteenth-century translation"
  }
];
export function extractPrimaryParagraphs(html){
  const $=cheerio.load(html);
  // MediaWiki API returns parsed article HTML, not full site navigation.
  const root=$(".mw-parser-output").first();
  if(!root.length) throw Error("Cannot locate Wikisource article body");
  root.find("sup.reference, .mw-references-wrap, .reflist, .references, .mw-editsection, .noprint, .navigation-not-searchable, .ws-noexport, style, script, table, nav, figure").remove();
  // Only top-level paragraphs and blockquotes; not references, page furniture
  const nodes=root.children("p, blockquote").toArray();
  const paragraphs=nodes.map(el=>$(el).text().replace(/\u00a0/g," ").replace(/[ \t]+/g," ").trim())
    .filter(t=>t.length>0 && !/^(?:previous|next|this page|return to|footnotes|references)$/i.test(t));
  if(paragraphs.length<5 || paragraphs.join(" ").length<3000){
    throw Error("Extraction incomplete: fewer than five paragraphs or 3000 characters");
  }
  return paragraphs.map((text,i)=>({locator:"Source paragraph "+String(i+1).padStart(3,"0"),text}));
}
async function fetchPage(page,fetchImpl){
  const endpoint=new URL("https://en.wikisource.org/w/api.php");
  endpoint.searchParams.set("action","parse");
  endpoint.searchParams.set("page",page);
  endpoint.searchParams.set("prop","text");
  endpoint.searchParams.set("format","json");
  endpoint.searchParams.set("formatversion","2");
  const response=await fetchImpl(endpoint,{headers:{"User-Agent":"OrthodoxAI-Patristic-Research/0.1 (source verification; operator controlled)"}});
  if(!response.ok)throw Error("Wikisource returned HTTP "+response.status);
  const body=await response.json();
  if(body.error || !body.parse?.text)throw Error("Wikisource API returned no parsed text");
  return body.parse.text;
}
export async function buildFirstSourceBatch({fetchImpl=fetch,writeImpl=writeFile,outFile="patristic-first-batch.preview.json"}={}){
 const works=[];
 for(const p of PAGES){
  const html=await fetchPage(p.page,fetchImpl);
  const paragraphs=extractPrimaryParagraphs(html);
  const url="https://en.wikisource.org/wiki/"+encodeURIComponent(p.page).replaceAll("%2F","/");
  works.push({
    author:p.author,title:p.title,editionTitle:p.editionTitle,
    corpus:"CURATED_OTHER",language:"English",sourceUrl:url,
    licenseNote:"Historic 19th-century NPNF translation (public domain); Wikisource identifies the series as public domain. Digital transcription and paragraph boundaries still require editorial verification. "+p.description,
    rightsReviewed:true,paragraphs
  });
 }
 const manifest={schemaVersion:1,works};
 const prepared=prepareSourceBatch(manifest);
 await writeImpl(outFile,JSON.stringify(manifest,null,2)+"\n",{flag:"wx"});
 return {status:"LOCAL_PREVIEW_ONLY",file:outFile,
   works:works.map(w=>({author:w.author,title:w.title,paragraphs:w.paragraphs.length,sourceUrl:w.sourceUrl})),
   chunks:prepared.counts.passages,
   reviewRequired:"Compare extracted text and locators against Wikisource before staging; no DB write or embeddings"};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length>3){process.stderr.write("Usage: node scripts/patristics/build-first-source-batch.mjs [output.json]\n");process.exitCode=1;}
  else buildFirstSourceBatch({outFile:process.argv[2]??"patristic-first-batch.preview.json"})
    .then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
    .catch(e=>{process.stderr.write("SOURCE_FETCH_FAILED: "+e.message+"\n");process.exitCode=1;});
}
