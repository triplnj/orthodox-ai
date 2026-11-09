import test from "node:test";
import assert from "node:assert/strict";
import {assessPassageAttribution as assess} from "../scripts/patristics/assess-passage-attribution.mjs";
test("a source author does not automatically become the speaker",()=>{
 const a=assess({workAuthor:"St. Gregory of Nyssa",passage:"Most certainly, the Virgin replied, the soul herself..."});
 assert.equal(a.attributionAllowed,false);assert.equal(a.speaker,null);
 const b=assess({workAuthor:"St. Gregory of Nyssa",passage:"I rejoined, Nay, it may be very possible..."});
 assert.equal(b.attributionAllowed,false);
});
test("human-reviewed speaker and exact locator permit attributed quotation",()=>{
 const a=assess({workAuthor:"St. Gregory of Nyssa",passage:"Most certainly, the Virgin replied...",reviewedSpeaker:"St. Macrina",sourceLocator:"Source paragraph 018",reviewRecordId:"review-gregory-018"});
 assert.equal(a.attributionAllowed,true);assert.equal(a.speaker,"St. Macrina");
 assert.equal(assess({workAuthor:"St. Gregory of Nyssa",passage:"Quote",reviewedSpeaker:"St. Macrina"}).attributionAllowed,false);
 assert.equal(assess({workAuthor:"St. Gregory of Nyssa",passage:"Quote",reviewedSpeaker:"St. Macrina",sourceLocator:"Source paragraph 018"}).attributionAllowed,false);
});
test("passage and bibliographic identity required",()=>{
 assert.throws(()=>assess({workAuthor:"",passage:"Quoted"}),/required/);
 assert.throws(()=>assess({workAuthor:"St. Gregory of Nyssa",passage:""}),/required/);
});
