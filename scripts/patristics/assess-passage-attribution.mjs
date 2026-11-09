/** Bibliographic author alone is NEVER permission to assign dialogue speech.
 * Only a trusted checked-in review registry can resolve an exact fingerprinted passage.
 * Do not construct trustedReviews from user, model, or network input.
 */
export function assessPassageAttribution({workAuthor,passage,reviewedSpeaker=null,sourceLocator=null,reviewRecordId=null,
 passageId=null,contentSha256=null,editionId=null,sourceMatchStatus=null,trustedReviews=null}={}){
 if(typeof workAuthor!=="string"||!workAuthor.trim()||typeof passage!=="string"||!passage.trim())
  throw Error("Author and nonempty passage required");
 const unverified={status:"SPEAKER_NOT_VERIFIED",workAuthor,speaker:null,sourceLocator:sourceLocator??null,
  attributionAllowed:false,reason:"WORK_AUTHOR_DOES_NOT_PROVE_SPEAKER"};
 if(typeof reviewRecordId!=="string"||!reviewRecordId||!Array.isArray(trustedReviews)||
  typeof passageId!=="string"||typeof contentSha256!=="string"||
  typeof editionId!=="string"||typeof sourceLocator!=="string"||
  sourceMatchStatus!=="FULL_NORMALIZED_MATCH")return unverified;
 // Locate exactly one reviewed record; anonymous/fabricated IDs and altered hashes fail closed.
 const matches=trustedReviews.filter(r=>r?.reviewRecordId===reviewRecordId);
 if(matches.length!==1)return unverified;
 const record=matches[0];
 if(record.passageId!==passageId||record.contentSha256!==contentSha256||
  record.editionId!==editionId||record.locator!==sourceLocator||
  record.sourceMatchStatus!=="FULL_NORMALIZED_MATCH"||
  record.role!=="DIALOGUE"||record.mayQuoteDirectly!==false||
  record.evidencePhrase?.length<8||workAuthor!=="St. Gregory of Nyssa"||
  !["St. Gregory of Nyssa","St. Macrina"].includes(record.speaker)||
  (reviewedSpeaker!=null&&reviewedSpeaker!==record.speaker))return unverified;
 return {status:"SPEAKER_REVIEWED",workAuthor,speaker:record.speaker,sourceLocator,
  attributionAllowed:true,mayQuoteDirectly:false,reviewRecordId,
  reason:"FINGERPRINTED_TRUSTED_REVIEW_RECORD"};
}
