import test from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../scripts/patristics/evaluate-staging.mjs";

const env = {
  LIBRARY_STAGING_DB_URL: "postgresql://example:example@ep-staging.aws.neon.tech/neondb",
  LIBRARY_STAGING_BRANCH_ID: "br-spring-frost-assfzje6",
  OPENAI_API_KEY: "unused-mock-key",
};
const vector = Array(1536).fill(0.005);
function mockDb(valid = true) {
  const queries = [];
  const db = {
    queries, async connect() { queries.push("CONNECT"); },
    async end() { queries.push("END"); },
    async query(sql, args) {
      queries.push({sql,args});
      if (sql.includes('FROM "LibraryStagingGuard"')) return {rows:valid ?
        [{branchId:env.LIBRARY_STAGING_BRANCH_ID,purpose:"PATRISTIC_LIBRARY_STAGING"}] : []};
      return {rows:[{authorName:"Augustine of Hippo",workTitle:"Confessiones",
        corpus:"PL",editionTitle:"PL 32",sourceUrl:"https://example.org",
        locator:"I.1.1",content:"inquietum est cor nostrum",importStatus:"STAGED",
        similarity:0.91,previousContent:"",nextContent:null,
        speakerName:"Augustine of Hippo",speakerRole:"DIALOGUE_SPEAKER",statementKind:"QUESTION",
        attributionStatus:"TEXT_VERIFIED",attributionEvidenceUrl:"https://example.org/proof",
        followingReplyContent:"Macrina offers a reply",followingReplySpeaker:"Macrina",followingReplyStatus:"TEXT_VERIFIED"}]};
    },
  };
  return db;
}
test("staging evaluation has hard branch guard and no writes",async()=>{
  const db=mockDb();
  const ai={embeddings:{async create(arg){
    assert.equal(arg.model,"text-embedding-3-small");
    return {data:[{index:0,embedding:vector}]};
  }}};
  const got=await evaluate(["--question","Why does the heart seek God?","--corpus","PL"],env,{db,ai});
  assert.equal(got.hits[0].author,"Augustine of Hippo");
  assert.equal(got.hits[0].locator,"I.1.1");
  assert.equal(got.hits[0].similarity,0.91);
  assert.equal(got.hits[0].speaker,"Augustine of Hippo");
  assert.equal(got.hits[0].statementKind,"QUESTION");
  assert.equal(got.hits[0].attributionEvidenceUrl,"https://example.org/proof");
  assert.deepEqual(got.hits[0].followingReply,{speaker:"Macrina",excerpt:"Macrina offers a reply"});
  const sql=db.queries.filter(x=>typeof x==="object").map(x=>x.sql);
  assert.ok(sql.some(x=>x.includes("e.\"importStatus\"='STAGED'")));
  assert.ok(sql.every(x=>/^\s*SELECT\b/.test(x)));
  assert.ok(!db.queries.includes("BEGIN"));
});
test("staging evaluation fails closed before embedding API on wrong branch",async()=>{
  const db=mockDb(false);
  const ai={embeddings:{async create(){throw Error("should not be called")}}};
  await assert.rejects(evaluate(["--question","God"],env,{db,ai}),/wrong database branch/);
  assert.equal(db.queries.at(-1),"END");
});
test("staging evaluation rejects invalid question embeddings",async()=>{
  const db=mockDb();
  const ai={embeddings:{async create(){return {data:[{embedding:[1]}]}}}};
  await assert.rejects(evaluate(["--question","God"],env,{db,ai}),/Invalid question embedding/);
  assert.ok(!db.queries.some(x=>typeof x==="object" && x.sql.includes('JOIN "LibraryEdition"')));
});

test("unreviewed speaker attribution is never presented as verified",async()=>{
  const db=mockDb();
  const original=db.query.bind(db);
  db.query=async (sql,args)=>{
    const result=await original(sql,args);
    if (sql.includes('JOIN "LibraryEdition"')) {
      result.rows[0].attributionStatus="UNREVIEWED";
      result.rows[0].speakerName="A guessed speaker";
      result.rows[0].statementKind="TEACHING";
      result.rows[0].followingReplyStatus="UNREVIEWED";
    }
    return result;
  };
  const ai={embeddings:{async create(){return {data:[{index:0,embedding:vector}]}}}};
  const output=await evaluate(["--question","Who is speaking?"],env,{db,ai});
  assert.equal(output.hits[0].speaker,null);
  assert.equal(output.hits[0].statementKind,"UNDETERMINED");
  assert.equal(output.hits[0].attributionEvidenceUrl,null);
  assert.equal(output.hits[0].followingReply,null);
});
