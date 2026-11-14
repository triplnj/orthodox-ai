import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { libraryAdminIds,libraryEnabled } from "@/lib/library/config";
import { LibraryEditor } from "@/components/library/LibraryEditor";
export const dynamic="force-dynamic";
export default async function LibraryAdminPage(){
 if(!libraryEnabled())notFound();
 const user=await getSessionUser();
 if(!user?.emailVerified || !libraryAdminIds().includes(user.id))notFound();
 return <main className="mx-auto max-w-5xl px-4 py-10">
  <h1 className="text-3xl font-bold">Patristic Library — Editorial Desk</h1>
  <p className="my-4 text-gray-600">Private staging records. No AI-generated bibliography is published automatically.</p>
  <LibraryEditor/>
 </main>;
}
