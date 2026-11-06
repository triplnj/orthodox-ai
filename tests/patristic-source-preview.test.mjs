import test from "node:test";
import assert from "node:assert/strict";
import { extractPreview, prepareSource } from "../scripts/patristics/prepare-gregory-source.mjs";

test("source preview identifies the real beginning and retains source metadata", () => {
  const opening = "Basil, great among the saints, had departed from this life to God.";
  const text = Array.from({length:35}, (_, i) =>
    "<p>" + (i === 0 ? opening : i === 34 ? "When such, then, have been purged from it, it can be restored, and in His Image, man as he was made." : "Macrina and Gregory discuss death and resurrection. ".repeat(22)) + "</p>"
  ).join("");
  const result = extractPreview("<html><body><main><p>Navigation intro</p>" + text + "</main></body></html>");
  assert.equal(result.author,"St. Gregory of Nyssa");
  assert.equal(result.extraction.paragraphCount,35);
  assert.doesNotMatch(result.last.at(-1),/Contact information/);
  assert.equal(result.extraction.coverage,"UNVERIFIED_PREVIEW");
  assert.match(result.first[0],/Basil, great/);
  assert.match(result.extraction.sha256,/^[0-9a-f]{64}$/);
});
test("source preview refuses truncated or unexpected material", () => {
  assert.throws(()=>extractPreview("<p>bad</p>"), /short/);
  const doc="<html><body>" + "<p>Some other source entirely.</p>".repeat(80) + "</body></html>";
  assert.throws(()=>extractPreview(doc), /Opening passage/);
});
test("network preview fails on non-html response", async () => {
  await assert.rejects(prepareSource(async ()=>({
    ok:true,
    headers:{get:()=>"text/plain"},
    text:async()=>"<p>wrong type</p>"
  })),/Expected HTML/);
});

test("footer material after final paragraph is never included", () => {
  const html="<html><body><p>Basil, great among the saints " + "Gregory grieves. ".repeat(25) + "</p>" +
    Array.from({length:24},()=>"<p>"+ "A theological conversation continues. ".repeat(50)+"</p>").join("") +
    "<p>When such, then, have been purged from it, the good is restored and in His Image, man as he was made.</p>" +
    "<h2>About this page</h2><p>Contact information. The editor of New Advent is Kevin Knight.</p></body></html>";
  const output=extractPreview(html);
  assert.equal(output.extraction.paragraphCount,26);
  assert.doesNotMatch(JSON.stringify(output),/Contact information/);
});
test("missing last paragraph fails closed", () => {
  const html="<html><body><p>Basil, great among the saints.</p>" +
    Array.from({length:30},()=>"<p>"+ "Dialogue about the resurrection. ".repeat(30)+"</p>").join("")+"</body></html>";
  assert.throws(()=>extractPreview(html),/Ending passage not found/);
});
