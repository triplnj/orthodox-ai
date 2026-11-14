import Link from "next/link";
import { notFound } from "next/navigation";
import { libraryEnabled } from "@/lib/library/config";
import { findLibraryAuthors } from "@/lib/library/query";
export const dynamic="force-dynamic";
export default async function LibraryHome({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 if(!libraryEnabled())notFound();
 const {q="",page:requested="1"}=await searchParams;
 const query=q.slice(0,100);
 const number=Number(requested);const page=Number.isSafeInteger(number)&&number>0&&number<=1000?number:1;
 const authors=await findLibraryAuthors(query,(page-1)*24);
 return <main className="mx-auto max-w-5xl px-4 py-10">
  <h1 className="text-3xl font-bold">Patristic Library</h1>
  <p className="mt-2 text-gray-600">A reviewed catalogue of Church Fathers, writings and editions. Published records only; the catalogue is not necessarily exhaustive.</p>
  <form className="mt-6 flex gap-2"><label className="sr-only" htmlFor="library-q">Search authors</label>
   <input id="library-q" name="q" defaultValue={query} maxLength={100} placeholder="Search an author" className="flex-1 rounded border p-3"/>
   <button className="rounded bg-gray-950 px-5 text-white">Search</button>
  </form>
  <ul className="mt-8 grid gap-3 md:grid-cols-2">{authors.map(a=><li key={a.id} className="rounded-lg border bg-white p-5">
   <Link href={`/library/authors/${a.slug}`} className="text-lg font-semibold underline">{a.name}</Link>
   {a.originalName&&<p className="text-sm text-gray-600">{a.originalName}</p>}
   <p className="mt-2 text-sm text-gray-600">{a.period??"Period not recorded"} · {a._count.attributions} linked work records</p>
  </li>)}</ul>
  {!authors.length&&<p className="mt-6">No published authors match this search.</p>}
  <nav className="mt-6 flex gap-4" aria-label="Library pages">
   {page>1&&<Link className="underline" href={`/library?q=${encodeURIComponent(query)}&page=${page-1}`}>Previous</Link>}
   {authors.length===24&&page<1000&&<Link className="underline" href={`/library?q=${encodeURIComponent(query)}&page=${page+1}`}>Next</Link>}
  </nav>
 </main>;
}
