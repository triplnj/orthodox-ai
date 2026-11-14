import { prisma } from "@/lib/prisma";

// Explicitly curated starter records. All entries remain DRAFT and all evidence
// remains unreviewed until an administrator checks provenance and attribution.
export async function importChrysostomPilot() {
 return prisma.$transaction(async tx=>{
  const author=await tx.libraryAuthor.upsert({
   where:{slug:"st-john-chrysostom"},
   create:{slug:"st-john-chrysostom",name:"St. John Chrysostom",originalName:"Ἰωάννης ὁ Χρυσόστομος",period:"c. 347–407",language:"Greek"},
   update:{}
  });
  const items=[
   {slug:"chrysostom-on-vainglory-and-children",title:"Address on Vainglory and How to Bring Up Children",url:"https://www.catholicapologetics.info/morality/family/Rightway.pdf",textStatus:"FULL_TEXT"},
   {slug:"chrysostom-homily-21-on-ephesians",title:"Homily 21 on Ephesians",url:"https://www.newadvent.org/fathers/230121.htm",textStatus:"FULL_TEXT"},
   {slug:"chrysostom-homily-9-on-colossians",title:"Homily 9 on Colossians",url:"https://www.newadvent.org/fathers/230309.htm",textStatus:"FULL_TEXT"}
  ] as const;
  for(const item of items){
   const work=await tx.libraryWork.upsert({
    where:{slug:item.slug},create:{slug:item.slug,title:item.title,language:"Greek",genre:item.slug.includes("homily")?"Homily":"Treatise"},update:{}
   });
   await tx.libraryAttribution.upsert({
    where:{authorId_workId_role:{authorId:author.id,workId:work.id,role:"AUTHOR"}},
    create:{authorId:author.id,workId:work.id,role:"AUTHOR",authenticity:"UNDETERMINED",note:"Editorial review required before publication."},
    update:{}
   });
   const exists=await tx.libraryEdition.findFirst({where:{workId:work.id,url:item.url}});
   if(!exists) await tx.libraryEdition.create({data:{
    workId:work.id,title:item.title+" — English translation",language:"English",url:item.url,
    textStatus:item.textStatus,rightsStatus:"LINK_ONLY"
   }});
   const evidence=await tx.libraryEvidence.findFirst({where:{workId:work.id,sourceUrl:item.url}});
   if(!evidence)await tx.libraryEvidence.create({data:{
    workId:work.id,sourceTitle:item.title+" — source edition",sourceUrl:item.url,
    note:"Curated translation locator only; not independent evidence of attribution or text completeness.",reviewed:false
   }});
  }
  return {authorId:author.id,workCount:items.length,status:"DRAFT"};
 });
}
