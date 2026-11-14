import { prisma } from "@/lib/prisma";
export async function findLibraryAuthors(q="", skip=0) {
 return prisma.libraryAuthor.findMany({
  where:{status:"PUBLISHED", ...(q ? {OR:[{name:{contains:q,mode:"insensitive"}},{slug:{contains:q,mode:"insensitive"}},{aliases:{has:q}}]}:{})},
  orderBy:{name:"asc"},skip,take:24,
  select:{id:true,slug:true,name:true,originalName:true,period:true,language:true,
   _count:{select:{attributions:{where:{work:{status:"PUBLISHED"}}}}}}
 });
}
export async function findLibraryAuthor(slug:string){
 return prisma.libraryAuthor.findFirst({
  where:{slug,status:"PUBLISHED"},
  include:{attributions:{where:{work:{status:"PUBLISHED"}},include:{work:{
   include:{editions:{select:{id:true,textStatus:true}},
    attributions:{include:{author:{select:{name:true,slug:true}}}}}
  }}}}
 });
}
export async function findLibraryWork(id:string) {
 return prisma.libraryWork.findFirst({
  where:{id,status:"PUBLISHED"},
  include:{
   attributions:{include:{author:{select:{name:true,slug:true,status:true}}}},
   editions:true,
   evidence:{where:{reviewed:true},orderBy:{createdAt:"asc"}},
   parentWork:{select:{id:true,title:true,status:true}},
   parts:{where:{status:"PUBLISHED"},select:{id:true,title:true}}
  }
 });
}
