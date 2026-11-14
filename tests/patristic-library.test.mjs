import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createLoader} from "./helpers/load-ts.mjs";
const source=p=>readFileSync(p,"utf8");
const load=createLoader({});
const config=load("src/lib/library/config.ts");

test("library flag defaults to disabled and requires explicit server-side opt in",()=>{
 assert.equal(config.libraryEnabled(),false);
 assert.match(source("src/app/library/page.tsx"),/if\(!libraryEnabled\(\)\)notFound\(\)/);
 assert.match(source("src/app/api/library/authors/route.ts"),/if\(!libraryEnabled\(\)\)/);
 assert.match(source("src/app/api/library/admin/route.ts"),/requireLibraryAdmin/);
});
test("conservative bibliographic input validation",()=>{
 assert.equal(config.librarySlug("St-John-Chrysostom"),"st-john-chrysostom");
 assert.throws(()=>config.librarySlug("свети јован"),/Slug/);
 assert.equal(config.libraryUrl("https://www.newadvent.org/fathers/230121.htm"),"https://www.newadvent.org/fathers/230121.htm");
 for(const url of ["javascript:alert(1)","http://example.com","https://x:y@example.org","https://example.org:8443/path"])
  assert.throws(()=>config.libraryUrl(url));
 assert.equal(config.libraryChoice("AUTHENTIC",config.LIBRARY_AUTHENTICITY,"UNDETERMINED"),"AUTHENTIC");
 assert.throws(()=>config.libraryChoice("PROVEN",config.LIBRARY_AUTHENTICITY,"UNDETERMINED"));
 assert.throws(()=>config.libraryInt(1.3));
});
test("work identity, authorship roles and editions are separate reviewable entities",()=>{
 const schema=source("prisma/schema.prisma");
 for(const name of ["LibraryAuthor","LibraryWork","LibraryAttribution","LibraryEdition","LibraryEvidence","LibraryReview"])
  assert.match(schema,new RegExp(`model ${name} \\{`));
 assert.match(schema,/@@unique\(\[authorId, workId, role\]\)/);
 assert.match(schema,/parentWorkId/);
 const migration=source("prisma/migrations/20261114120000_patristic_library/migration.sql");
 assert.match(migration,/CREATE TABLE "LibraryReview"/);
 assert.doesNotMatch(migration,/DROP TABLE|ALTER TABLE "ChatMessage"|ALTER TABLE "users"/);
});
test("editorial publication requires an attribution and reviewed evidence",()=>{
 const admin=source("src/lib/library/admin.ts");
 assert.match(admin,/work\.evidence\.length \|\| !work\.attributions\.length/);
 assert.match(admin,/evidence\.some\(e=>e\.attributionId===a\.id\)/);
 assert.match(admin,/EVIDENCE_REVIEW/);
 assert.match(admin,/PUBLISH_WORK/);
 assert.match(admin,/PUBLISH_AUTHOR/);
 assert.match(admin,/importChrysostomPilot/);
 const pilot=source("src/lib/library/pilot.ts");
 assert.match(pilot,/status:"DRAFT"/);
 assert.match(pilot,/reviewed:false/);
 assert.doesNotMatch(pilot,/textStatus:"FULL_TEXT"/);
});
test("no patristic library database calls are added to chat's core route",()=>{
 const route=source("src/app/api/chat/route.ts");
 assert.doesNotMatch(route,/libraryAuthor|libraryWork|findLibraryAuthor|PATRISTIC_LIBRARY_ENABLED/);
 const chat=source("src/components/chat/ChatBox.tsx");
 assert.match(chat,/NEXT_PUBLIC_PATRISTIC_LIBRARY_ENABLED === "true"/);
 assert.match(chat,/OrthodoxAI may make a mistake\. Check relevant sources/);
 assert.match(chat,/SourceCards sources=\{message\.sources \?\? \[\]\}/);
});
