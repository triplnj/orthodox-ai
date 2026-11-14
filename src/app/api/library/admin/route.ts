import { apiJson } from "@/lib/api/response";
import { requireLibraryAdmin, libraryAdminAction, LibraryAdminError } from "@/lib/library/admin";
import { prisma } from "@/lib/prisma";
export const runtime="nodejs";
export async function GET(){
 try {
  await requireLibraryAdmin();
  const [authors,works]=await Promise.all([
   prisma.libraryAuthor.findMany({orderBy:{name:"asc"},take:100}),
   prisma.libraryWork.findMany({orderBy:{title:"asc"},take:100,include:{
    attributions:{include:{author:{select:{name:true}}}},
    evidence:{select:{id:true,sourceTitle:true,reviewed:true}},
    editions:{select:{id:true,title:true,textStatus:true}}
   }})
  ]);
  return apiJson({authors,works});
 }catch(e){return apiJson({error:e instanceof LibraryAdminError?e.message:"Library unavailable."},{status:e instanceof LibraryAdminError?e.status:500});}
}
export async function POST(req:Request){
 try {
  const actorId=await requireLibraryAdmin();
  if(Number(req.headers.get("content-length")??0)>16384)return apiJson({error:"Payload too large."},{status:413});
  const body=await req.json() as unknown;
  if(!body||typeof body!=="object"||Array.isArray(body))throw new LibraryAdminError("Invalid request.");
  const data=body as Record<string,unknown>;
  if(typeof data.action!=="string")throw new LibraryAdminError("Action required.");
  const result=await libraryAdminAction(data.action,data,actorId);
  return apiJson({result});
 }catch(e){
  if(e instanceof LibraryAdminError)return apiJson({error:e.message},{status:e.status});
  if(e instanceof SyntaxError || e instanceof Error && /Invalid|requires|exceed|HTTPS|Slug|Unsupported/.test(e.message))return apiJson({error:"Invalid library data."},{status:400});
  return apiJson({error:"Library update failed."},{status:500});
 }
}
