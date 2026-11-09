/** Shadow-only reviewed logical identity overlay.
 * Two author IDs remain intact; never choose an arbitrary "primary" row.
 * A reviewed manifest may authorize the set, but not speaker attribution.
 */
import {resolveAuthorCatalogV2} from "./resolve-author-catalog-v2.mjs";
export function resolveReviewedLogicalAuthor(question,catalog,manifest){
 if(!manifest||manifest.schemaVersion!==1||
  manifest.purpose!=="STAGING_REVIEWED_LOGICAL_AUTHOR_GROUP"||
  manifest.stagingBranch!=="br-spring-frost-assfzje6"||
  manifest.canonicalName!=="St. Gregory of Nyssa"||
  manifest.historicalWork!=="On the Soul and the Resurrection"||
  manifest.policy?.databaseMerge!==false||
  manifest.policy?.deleteDuplicates!==false||
  manifest.policy?.autoSpeakerAttribution!==false)
  throw Error("Unapproved logical author manifest");
 const ids=manifest.workAuthorIds;
 if(!Array.isArray(ids)||ids.length!==2||new Set(ids).size!==2||
  !Array.isArray(manifest.editions)||manifest.editions.length!==2)
  throw Error("Incomplete duplicate author review");
 const relevant=catalog.filter(a=>a.canonicalName===manifest.canonicalName&&Number(a.indexed)>0);
 if(relevant.length!==2||relevant.some(a=>!ids.includes(a.id))||
  manifest.editions.some(e=>!ids.includes(e.authorId)||!e.editionId||!e.workId||!e.sourceUrl))
  throw Error("Catalog diverged from reviewed duplicate identities");
 // Resolve only after constructing one shadow row; never rewrite the source DB.
 const alias=new Set(relevant.flatMap(row=>row.nameVariants??[]));
 const syntheticId="reviewed-logical-gregory-nyssa";
 const shadow=catalog.filter(a=>!ids.includes(a.id)).concat([{
  id:syntheticId,canonicalName:manifest.canonicalName,indexed:relevant.reduce((n,a)=>n+Number(a.indexed),0),nameVariants:[...alias]
 }]);
 const result=resolveAuthorCatalogV2(question,shadow);
 if(result.status!=="EXACT_CATALOG_MATCH"||!Array.isArray(result.authorIds)||
  !result.authorIds.includes(syntheticId))return result;
 const authorIds=result.authorIds.flatMap(id=>id===syntheticId?[...ids]:[id]);
 return {...result,reason:"REVIEWED_LOGICAL_AUTHOR_GROUP",authorIds,
  logicalAuthorGroups:[{canonicalName:manifest.canonicalName,sourceAuthorIds:[...ids]}],
  speakerVerified:false};
}
