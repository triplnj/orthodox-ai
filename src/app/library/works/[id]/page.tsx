import Link from "next/link";
import { notFound } from "next/navigation";
import { libraryEnabled } from "@/lib/library/config";
import { findLibraryWork } from "@/lib/library/query";
export const dynamic="force-dynamic";
export default async function WorkPage({params}:{params:Promise<{id:string}>}){
 if(!libraryEnabled())notFound();
 const {id}=await params;
 if(!/^[a-z0-9_-]{1,128}$/i.test(id))notFound();
 const work=await findLibraryWork(id);if(!work)notFound();
 return <main className="mx-auto max-w-4xl px-4 py-10">
  <Link href="/library" className="underline">Library</Link>
  <h1 className="mt-4 text-3xl font-bold">{work.title}</h1>
  {work.originalTitle&&<p className="text-gray-700">{work.originalTitle}</p>}
  <p className="mt-2 text-sm text-gray-600">Original language: {work.language??"Unknown"} · Genre: {work.genre??"Unclassified"} · Survival: {work.survivalStatus}</p>
  <h2 className="mt-8 text-xl font-semibold">Attribution and role</h2>
  <ul className="mt-3 list-disc space-y-2 pl-6">{work.attributions.map(a=><li key={a.id}>
   {a.author.status==="PUBLISHED"?<Link className="underline" href={`/library/authors/${a.author.slug}`}>{a.author.name}</Link>:<span>{a.author.name}</span>} — {a.role} / {a.authenticity}
   {a.note&&<p className="text-sm text-gray-600">{a.note}</p>}
  </li>)}</ul>
  <h2 className="mt-8 text-xl font-semibold">Editions and available texts</h2>
  <ol className="mt-3 list-decimal space-y-4 pl-6">{work.editions.map(e=><li key={e.id}>
   <strong>{e.title}</strong> — {e.textStatus} · Rights: {e.rightsStatus}
   <p className="text-sm text-gray-600">{[e.editor,e.publisher,e.year,e.language].filter(Boolean).join(" · ")}</p>
   {e.citation&&<p className="text-sm">{e.citation}</p>}
   {e.url&&<p><a className="underline" href={e.url} target="_blank" rel="noopener noreferrer">Open edition (external)</a></p>}
   {e.expectedUnits!==null&&<p className="text-sm text-gray-600">{e.availableUnits??"Unknown"} / {e.expectedUnits} expected units available, according to this edition.</p>}
  </li>)}</ol>
  {!work.editions.length&&<p className="mt-3 text-gray-600">No verified edition recorded.</p>}
  <h2 className="mt-8 text-xl font-semibold">Bibliographic evidence</h2>
  <ol className="mt-3 list-decimal space-y-3 pl-6">{work.evidence.map(e=><li key={e.id}>
   {e.sourceUrl?<a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{e.sourceTitle}</a>:e.sourceTitle}
   {e.reference&&<span> — {e.reference}</span>}
   {e.note&&<p className="text-sm text-gray-600">{e.note}</p>}
  </li>)}</ol>
  {!work.evidence.length&&<p>No editorially reviewed evidence displayed.</p>}
  {work.parts.length>0&&<><h2 className="mt-8 text-xl font-semibold">Parts</h2><ul className="mt-3 list-disc pl-6">{work.parts.map(p=><li key={p.id}><Link className="underline" href={`/library/works/${p.id}`}>{p.title}</Link></li>)}</ul></>}
 </main>;
}
