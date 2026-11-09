import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("isolated Preview cannot invoke Resend or real payment provider",()=>{
 const email=readFileSync("src/lib/email.ts","utf8");
 const billing=readFileSync("src/lib/billing/providers.ts","utf8");
 assert.equal((email.match(/Outbound email is disabled in isolated Chat Preview/g)||[]).length,2);
 assert.match(billing,/function assertNoPreviewBilling\(/);
 for(const functionName of ["lemon","assertLiveLemonConfiguration","retrieve","inventory","cancel","assertNoDebt","createCheckout","lemonOrdersSince","checkoutClosed","portal"]){
  const at=billing.indexOf("export async function "+functionName+"(");
  assert.ok(at>=0,functionName+" must be present");
  assert.ok(billing.slice(at,at+260).includes("assertNoPreviewBilling();"),functionName+" must check guard before provider calls");
 }
});
test("isolated Preview requires test-domain login and refuses registration/reset",()=>{
 const code=readFileSync("src/lib/security/auth-http.ts","utf8");
 assert.match(code,/action !== "login"/);
 assert.match(code,/@example\.test/);
 assert.ok(code.indexOf('action !== "login"')<code.indexOf("await authLimit(req, action)"));
});
