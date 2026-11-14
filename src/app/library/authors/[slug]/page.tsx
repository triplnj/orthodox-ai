import Link from "next/link";
import { notFound } from "next/navigation";
import { libraryEnabled } from "@/lib/library/config";
import { findLibraryAuthor } from "@/lib/library/query";
export const dynamic="force-dynamic";
export default async function AuthorPage({params}:{params:Promise<{slug:string}>}){
 if(!libraryEnabled())notFound();
 const {slug}=await params;
 if(!/^[a-z0-9-]{1,100}$/.test(slug))notFound();
 const author=await findLibraryAuthor(slug);
 if(!author)notFound();
 const items=[...author.attributions].sort((a,b)=>a.work.title.localeCompare(b.work.title));
 return <main className="mx-auto max-w-4xl px-4 py-10">
  <Link href="/library" className="underline">Library</Link>
  <h1 className="mt-4 text-3xl font-bold">{author.name}</h1>
  {author.originalName&&<p className="mt-1 text-gray-600">{author.originalName}</p>}
  <p className="mt-2 text-gray-600">{author.period??""} {author.language??""}</p>
  <p className="mt-5 text-sm text-gray-600">Published catalogue entries, not a claim of a complete oeuvre. Each role and attribution should be checked against its evidence.</p>
  <ol className="mt-6 list-decimal space-y-4 pl-6">{items.map(a=><li key={a.id}>
   <Link className="font-semibold underline" href={`/library/works/${a.work.id}`}>{a.work.title}</Link>
   <p className="text-sm text-gray-600">{a.role} · {a.authenticity} · {a.work.editions.length} editions</p>
  </li>)}</ol>
  {!items.length&&<p className="mt-6">No published works yet.</p>}
 </main>;
}
