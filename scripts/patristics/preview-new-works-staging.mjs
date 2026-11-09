/**
 * Two NEW patristic works, source provenance + conservative draft extraction.
 * Fetches only historical 1892/1894 English NPNF Wikisource pages.
 * Does NOT approve copyright, import, embed, or activate any source.
 * Usage: node scripts/patristics/preview-new-works-staging.mjs [output.json]
 */
import {writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import * as cheerio from "cheerio";
import {createHash} from "node:crypto";
const hash=text=>createHash("sha256").update(text,"utf8").digest("hex");
export const SOURCES=Object.freeze([
 {author:"St. Athanasius of Alexandria",title:"On the Incarnation of the Word, Chapter 1",
  editionTitle:"NPNF Series II, Volume IV (1892), translation Archibald Robertson",
  page:"Nicene and Post-Nicene Fathers: Series II/Volume IV/Incarnation of the Word/On the Incarnation of the Word/Chapter 1",
  minimumCharacters:1500,translator:"Archibald Robertson",publicationYear:1892},
 {author:"St. Cyril of Jerusalem",title:"Catechetical Lecture 1",
  editionTitle:"NPNF Series II, Volume VII (1894), translation Edwin Hamilton Gifford",
  page:"Nicene and Post-Nicene Fathers: Series II/Volume VII/S. Cyril/Lecture 1",
  minimumCharacters:2500,translator:"Edwin Hamilton Gifford",publicationYear:1894}
]);
export function extractText(html,{minimumCharacters=1500}={}){
 const $=cheerio.load(html);
 const root=$(".mw-parser-output").first();
 if(!root.length)throw Error("Expected parsed Wikisource article body");
 root.find("sup.reference").replaceWith(" ");
 root.find("script,style,nav,table,figure,.mw-references-wrap,.reflist,.references,.noprint,.mw-editsection,.ws-noexport").remove();
 const paragraphs=root.children("p, blockquote").toArray().map(node=>
   $(node).text().replace(/\u00a0/g," ").replace(/[ \t]+/g," ").replace(/\s*\n\s*/g," ").trim())
   .filter(Boolean);
 const fullText=paragraphs.join("\n\n");
 if(paragraphs.length<3||fullText.length<minimumCharacters)throw Error("Source extraction too short; human review required");
 const numbered=paragraphs.filter(t=>/^\d{1,2}\.\s+/.test(t));
 if(!numbered.length)throw Error("No numbered authorial source sections; refusing unverifiable article extraction");
 return {paragraphs:paragraphs.map((text,i)=>({locator:"Source paragraph "+String(i+1).padStart(3,"0"),text,sha256:hash(text)})),
   numberedSections:numbered.length,textSha256:hash(fullText),extractedCharacters:fullText.length};
}
async function fetchSource(page,fetchImpl){
 const u=new URL("https://en.wikisource.org/w/api.php");
 u.searchParams.set("action","parse");u.searchParams.set("page",page);
 u.searchParams.set("prop","text");u.searchParams.set("format","json");
 u.searchParams.set("formatversion","2");
 const response=await fetchImpl(u,{headers:{"User-Agent":"OrthodoxAI-Patristic-Research/0.1 (staging-only provenance inspection)"}});
 if(!response.ok)throw Error("Wikisource HTTP "+response.status);
 const body=await response.json();
 if(body.error||typeof body.parse?.text!=="string")throw Error("Wikisource missing parsed article");
 return body.parse.text;
}
export async function previewNewWorks({fetchImpl=fetch,writeImpl=writeFile,outputPath="new-patristic-works.preview.json"}={}){
 const works=[];
 for(const s of SOURCES){
  const html=await fetchSource(s.page,fetchImpl);
  const extracted=extractText(html,{minimumCharacters:s.minimumCharacters});
  const sourceUrl="https://en.wikisource.org/wiki/"+encodeURIComponent(s.page).replaceAll("%2F","/");
  works.push({author:s.author,title:s.title,editionTitle:s.editionTitle,
   translator:s.translator,publicationYear:s.publicationYear,
   language:"English",sourceUrl,sourcePage:s.page,
   provenance:"Historic NPNF translation; digitized via Wikisource. Verify against facsimile before editorial approval.",
   rightsStatus:"PENDING_EDITORIAL_REVIEW",importStatus:"PREVIEW_NOT_STAGED",
   ...extracted});
 }
 const preview={schemaVersion:1,purpose:"TWO_NEW_WORKS_SOURCE_PREVIEW_ONLY",
  stagingBranch:"br-spring-frost-assfzje6",sourceCount:works.length,
  notApprovedForImport:true,works};
 await writeImpl(outputPath,JSON.stringify(preview,null,2)+"\n",{flag:"wx"});
 return {status:"PREVIEW_ONLY",outputPath,works:works.map(w=>({author:w.author,title:w.title,sourceUrl:w.sourceUrl,paragraphCount:w.paragraphs.length,numberedSections:w.numberedSections,sha256:w.textSha256,rightsStatus:w.rightsStatus})),databaseWrites:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 previewNewWorks({outputPath:process.argv[2]??"new-patristic-works.preview.json"})
  .then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
  .catch(e=>{process.stderr.write("SOURCE_PREVIEW_FAILED: "+e.message+"\n");process.exitCode=1;});
}
