import { apiJson } from "@/lib/api/response";
import { libraryEnabled } from "@/lib/library/config";
import { findLibraryWork } from "@/lib/library/query";
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 if(!libraryEnabled())return apiJson({error:"Library unavailable."},{status:404});
 const {id}=await params;
 if(!/^[a-z0-9_-]{1,128}$/i.test(id))return apiJson({error:"Not found."},{status:404});
 const work=await findLibraryWork(id);
 return work?apiJson({work}):apiJson({error:"Not found."},{status:404});
}
