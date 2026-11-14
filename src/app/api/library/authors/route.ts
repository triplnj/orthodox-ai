import { NextRequest } from "next/server";
import { apiJson } from "@/lib/api/response";
import { libraryEnabled } from "@/lib/library/config";
import { findLibraryAuthors } from "@/lib/library/query";
export async function GET(req:NextRequest){
 if(!libraryEnabled())return apiJson({error:"Library unavailable."},{status:404});
 const q=(req.nextUrl.searchParams.get("q")??"").trim().slice(0,100);
 const raw=Number(req.nextUrl.searchParams.get("page")??"1");
 const page=Number.isSafeInteger(raw)&&raw>0&&raw<=1000?raw:1;
 return apiJson({authors:await findLibraryAuthors(q,(page-1)*24),page});
}
