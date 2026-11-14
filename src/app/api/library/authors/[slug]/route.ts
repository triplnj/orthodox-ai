import { apiJson } from "@/lib/api/response";
import { libraryEnabled } from "@/lib/library/config";
import { findLibraryAuthor } from "@/lib/library/query";
export async function GET(_req:Request,{params}:{params:Promise<{slug:string}>}){
 if(!libraryEnabled())return apiJson({error:"Library unavailable."},{status:404});
 const {slug}=await params;
 if(!/^[a-z0-9-]{1,100}$/.test(slug))return apiJson({error:"Not found."},{status:404});
 const author=await findLibraryAuthor(slug);
 return author?apiJson({author}):apiJson({error:"Not found."},{status:404});
}
