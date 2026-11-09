/** Read-only passage attribution gate. Author metadata alone never proves speaker identity. */
export function assessPassageAttribution({workAuthor,passage,reviewedSpeaker=null,sourceLocator=null}={}){
 if(typeof workAuthor!=="string"||!workAuthor.trim()||typeof passage!=="string"||!passage.trim())
  throw Error("Author and nonempty passage required");
 if(typeof reviewedSpeaker==="string"&&reviewedSpeaker.trim()&&typeof sourceLocator==="string"&&sourceLocator.trim())
  return {status:"SPEAKER_REVIEWED",workAuthor,speaker:reviewedSpeaker,sourceLocator,
   attributionAllowed:true,reason:"HUMAN_REVIEWED_PASSAGE_SPEAKER"};
 // Even a narrative-looking paragraph can contain dialogue, objections, or quotations.
 // No implicit speaker assignment from the bibliographical author.
 return {status:"SPEAKER_NOT_VERIFIED",workAuthor,speaker:null,sourceLocator:sourceLocator??null,
  attributionAllowed:false,reason:"WORK_AUTHOR_DOES_NOT_PROVE_SPEAKER"};
}
