import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const preview = "feature/paddle-transition-phase1-20261120";
const account = {
  id: "qa_patristic_20261109",
  email: "patristic-qa@example.test",
  emailVerified: new Date(),
  billingDeletionRequestedAt: null,
};
const paid = {
  userId: account.id,
  periodEndsAt: new Date(Date.now() + 2 * 86400_000),
};
const req = new Request("https://preview.example/api/paddle/qa-payment-check", {
  method: "POST", headers: { origin: "https://preview.example" },
});
function makeRoute({ env = {}, user = account, evidence = paid } = {}) {
  let saved = 0;
  const loader = createLoader({
    "next/server": {
      NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status ?? 200 }) },
    },
    "@/lib/session": { getSessionUser: async () => user },
    "@/lib/prisma": { prisma: { $queryRaw: async () => [{ id: "br-red-waterfall-asdlxovu" }] } },
    "@/lib/billing/paddle-provider-evidence": {
      retrieveVerifiedPaddleSandboxAccess: async () => evidence,
    },
    "@/lib/billing/paddle-sandbox-access": {
      saveVerifiedPaddleSandboxAccess: async () => { saved += 1; },
    },
  }, {
    VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: preview,
    PADDLE_SANDBOX_GRANT_ACCESS: "enabled", ...env,
  });
  return {
    handler: loader("src/app/api/paddle/qa-payment-check/route.ts"),
    savedCount: () => saved,
  };
}
test("only fully verified QA paid customer can backfill access", async () => {
  const { handler, savedCount } = makeRoute();
  const res = await handler.POST(req);
  assert.equal(res.status, 200);
  assert.equal(res.body.activated, true);
  assert.equal(savedCount(), 1);
});
test("grant disabled and production reject without writes", async () => {
  for (const env of [{ PADDLE_SANDBOX_GRANT_ACCESS: "" }, { VERCEL_ENV: "production" },
    { VERCEL_GIT_COMMIT_REF: "main" }]) {
    const route = makeRoute({ env });
    assert.notEqual((await route.handler.POST(req)).status, 200);
    assert.equal(route.savedCount(), 0);
  }
});
test("other accounts, unknown proof, wrong owner and expiry reject", async () => {
  const cases = [
    { user: { ...account, id: "other" } },
    { user: { ...account, emailVerified: null } },
    { evidence: null }, { evidence: { ...paid, userId: "other" } },
    { evidence: { ...paid, periodEndsAt: new Date(0) } },
  ];
  for (const args of cases) {
    const route = makeRoute(args);
    assert.notEqual((await route.handler.POST(req)).status, 200);
    assert.equal(route.savedCount(), 0);
  }
});
test("cross-origin attempts cannot provision QA access", async () => {
  const route = makeRoute();
  const res = await route.handler.POST(new Request(req.url, {
    method: "POST", headers: { origin: "https://untrusted.example" },
  }));
  assert.equal(res.status, 403);
  assert.equal(route.savedCount(), 0);
});
