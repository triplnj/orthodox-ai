import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const account = {
  id: "qa_patristic_20261109",
  email: "patristic-qa@example.test",
  emailVerified: new Date(),
  billingDeletionRequestedAt: null,
};
const paid = {
  userId: account.id,
  customerId: "ctm_" + "a".repeat(26),
  periodEndsAt: new Date(Date.now() + 86400000),
};
const request = (origin = "https://preview.example") =>
  new Request("https://preview.example/api/paddle/qa-customer-portal", {
    method: "POST", headers: { origin },
  });

function makeRoute({ user = account, proof = paid, env = {}, rows = [{
  subscriptionId: "sub_" + "b".repeat(26), customerId: paid.customerId,
}] } = {}) {
  const loader = createLoader({
    "next/server": {
      NextResponse: { json: (body, opts = {}) => ({
        status: opts.status ?? 200, body,
      }) },
    },
    "@/lib/session": { getSessionUser: async () => user },
    "@/lib/prisma": { prisma: { $queryRaw: async () => rows } },
    "@/lib/billing/paddle-provider-evidence": {
      retrieveVerifiedPaddleSandboxAccess: async () => proof,
    },
  }, {
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "feature/paddle-transition-phase1-20261120",
    PADDLE_SANDBOX_GRANT_ACCESS: "enabled",
    PADDLE_API_KEY: "pdl_sdbx_apikey_" + "test",
    ...env,
  });
  return loader("src/app/api/paddle/qa-customer-portal/route.ts");
}

test("Paddle portal refuses production, disabled flag and wrong QA account", async () => {
  for (const options of [
    { env: { VERCEL_ENV: "production" } },
    { env: { PADDLE_SANDBOX_GRANT_ACCESS: "" } },
    { user: { ...account, id: "another-user" } },
    { user: { ...account, emailVerified: null } },
    { rows: [] },
    { proof: { ...paid, customerId: "ctm_" + "c".repeat(26) } },
    { proof: { ...paid, periodEndsAt: new Date(0) } },
  ]) {
    const route = makeRoute(options);
    assert.notEqual((await route.POST(request())).status, 200);
  }
});
test("Paddle portal rejects cross-origin request", async () => {
  const route = makeRoute();
  const res = await route.POST(request("https://attacker.example"));
  assert.equal(res.status, 403);
});
