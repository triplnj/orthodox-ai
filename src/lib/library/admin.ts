import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { libraryAdminIds,libraryEnabled,libraryString,libraryOptional,librarySlug,libraryUrl,libraryChoice,libraryInt,LIBRARY_ROLES,LIBRARY_AUTHENTICITY,LIBRARY_SURVIVAL,LIBRARY_TEXT_STATUS,LIBRARY_RIGHTS } from "./config";
export class LibraryAdminError extends Error {
 constructor(message:string,public status=400){super(message);}
}
export async function requireLibraryAdmin() {
 if(!libraryEnabled()) throw new LibraryAdminError("Patristic Library is disabled.",404);
 const user=await getSessionUser();
 if(!user) throw new LibraryAdminError("Authentication required.",401);
 if(!user.emailVerified || !libraryAdminIds().includes(user.id)) throw new LibraryAdminError("Administrator access required.",403);
 return user.id;
}
type Input=Record<string,unknown>;
function id(b:Input,key:string){return libraryString(b[key],128);}
export async function libraryAdminAction(action:string,b:Input,actorId:string) {
 switch(action){
  case "AUTHOR_CREATE": return prisma.libraryAuthor.create({data:{
   slug:librarySlug(libraryString(b.slug,90)), name:libraryString(b.name), originalName:libraryOptional(b.originalName),
   period:libraryOptional(b.period), language:libraryOptional(b.language,80),
  }});
  case "WORK_CREATE": return prisma.libraryWork.create({data:{
   slug:librarySlug(libraryString(b.slug,90)),title:libraryString(b.title),
   originalTitle:libraryOptional(b.originalTitle),language:libraryOptional(b.language,80),
   genre:libraryOptional(b.genre,80),
   survivalStatus:libraryChoice(b.survivalStatus,LIBRARY_SURVIVAL,"UNKNOWN"),
   parentWorkId:libraryOptional(b.parentWorkId,128)
  }});
  case "ATTRIBUTION_CREATE": return prisma.libraryAttribution.create({data:{
   authorId:id(b,"authorId"),workId:id(b,"workId"),
   role:libraryChoice(b.role,LIBRARY_ROLES,"AUTHOR"),
   authenticity:libraryChoice(b.authenticity,LIBRARY_AUTHENTICITY,"UNDETERMINED"),
   note:libraryOptional(b.note,2000)
  }});
  case "EDITION_CREATE": {
   const expectedUnits=libraryInt(b.expectedUnits),availableUnits=libraryInt(b.availableUnits);
   if(expectedUnits!==null&&availableUnits!==null&&availableUnits>expectedUnits)throw new LibraryAdminError("Available units exceed expected units.");
   const textStatus=libraryChoice(b.textStatus,LIBRARY_TEXT_STATUS,"METADATA_ONLY");
   if(textStatus==="FULL_TEXT"&&expectedUnits!==null&&availableUnits!==expectedUnits)throw new LibraryAdminError("Full text must cover every expected unit.");
   return prisma.libraryEdition.create({data:{
    workId:id(b,"workId"),title:libraryString(b.title),
    editor:libraryOptional(b.editor),publisher:libraryOptional(b.publisher),
    year:libraryInt(b.year,0,2200),language:libraryOptional(b.language,80),
    url:libraryUrl(b.url),citation:libraryOptional(b.citation,1000),textStatus,
    rightsStatus:libraryChoice(b.rightsStatus,LIBRARY_RIGHTS,"UNKNOWN"),
    expectedUnits,availableUnits
   }});
  }
  case "EVIDENCE_CREATE": {
   const workId=id(b,"workId");
   const attributionId=libraryOptional(b.attributionId,128);
   const editionId=libraryOptional(b.editionId,128);
   // A claim's evidence cannot accidentally be attached to another work.
   if(attributionId) {
    const record=await prisma.libraryAttribution.findUnique({where:{id:attributionId},select:{workId:true}});
    if(record?.workId!==workId)throw new LibraryAdminError("Attribution does not belong to this work.");
   }
   if(editionId){
    const record=await prisma.libraryEdition.findUnique({where:{id:editionId},select:{workId:true}});
    if(record?.workId!==workId)throw new LibraryAdminError("Edition does not belong to this work.");
   }
   return prisma.libraryEvidence.create({data:{
    workId,attributionId,editionId,
    sourceTitle:libraryString(b.sourceTitle),
    sourceUrl:libraryUrl(b.sourceUrl),reference:libraryOptional(b.reference),
    note:libraryOptional(b.note,2000),reviewed:false
   }});
  }
  case "EVIDENCE_REVIEW": {
   const workId=id(b,"workId");const evidenceId=id(b,"evidenceId");
   return prisma.$transaction(async tx=>{
    const evidence=await tx.libraryEvidence.findFirst({where:{id:evidenceId,workId}});
    if(!evidence)throw new LibraryAdminError("Evidence not found.",404);
    await tx.libraryEvidence.update({where:{id:evidenceId},data:{reviewed:true}});
    return tx.libraryReview.create({data:{workId,actorId,action:"EVIDENCE_REVIEW",note:libraryString(b.note,2000)}});
   });
  }
  case "PUBLISH_WORK": {
   const workId=id(b,"workId");
   return prisma.$transaction(async tx=>{
    const work=await tx.libraryWork.findUnique({where:{id:workId},include:{
     evidence:{where:{reviewed:true}},attributions:true}});
    if(!work)throw new LibraryAdminError("Work not found.",404);
    if(!work.evidence.length || !work.attributions.length)
      throw new LibraryAdminError("Published works require an attribution and reviewed evidence.");
    for(const a of work.attributions) {
     if(a.authenticity==="UNDETERMINED" && !work.evidence.some(e=>e.attributionId===a.id))
      throw new LibraryAdminError("Uncertain attribution requires dedicated evidence.");
    }
    await tx.libraryWork.update({where:{id:workId},data:{status:"PUBLISHED"}});
    return tx.libraryReview.create({data:{workId,actorId,action:"PUBLISH_WORK",note:libraryString(b.note,2000)}});
   });
  }
  case "PUBLISH_AUTHOR": {
   const authorId=id(b,"authorId");
   const author=await prisma.libraryAuthor.findUnique({where:{id:authorId}});
   if(!author)throw new LibraryAdminError("Author not found.",404);
   return prisma.libraryAuthor.update({where:{id:authorId},data:{status:"PUBLISHED"}});
  }
  default: throw new LibraryAdminError("Unsupported library action.");
 }
}
