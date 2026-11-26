import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

const load = createLoader();
const { inspectPaddleLiveConfiguration: check } =
  load("src/lib/billing/paddle-live-config.ts");

const valid = {
  PADDLE_LIVE_API_KEY: "pdl_live_apikey_" + "a".repeat(40),
  NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN: "live_" + "a".repeat(27),
  PADDLE_LIVE_WEBHOOK_SECRET: "pdl_ntfset_" + "a".repeat(26),
  PADDLE_LIVE_PRO_PRICE_ID: "pri_" + "a".repeat(26),
  PADDLE_LIVE_PRO_PRODUCT_ID: "pro_" + "b".repeat(26),
  PADDLE_LIVE_CHECKOUT_ENABLED: "disabled",
  PADDLE_LIVE_GRANT_ACCESS: "disabled",
};

test("missing live configuration stays unavailable; no checkout action exists", () => {
  const result = check({});
  assert.equal(result.readyForImplementationReview, false);
  assert.equal(result.endpoint, "https://api.paddle.com");
  assert.ok(result.problems.length >= 5);
});

test("valid-looking isolated live values permit review only, never authorize checkout", () => {
  const result = check(valid);
  assert.equal(result.readyForImplementationReview, true);
  assert.equal("checkoutEnabled" in result, false);
});

test("sandbox catalog cannot be used as live catalog", () => {
  const result = check({
    ...valid,
    PADDLE_LIVE_PRO_PRICE_ID: "pri_01m84j47gzd7tw449trss5wsh4",
    PADDLE_LIVE_PRO_PRODUCT_ID: "pro_01m84hpaffkkag5zftcz3nk9qz",
  });
  assert.equal(result.readyForImplementationReview, false);
});

test("sandbox credentials and incorrect token fail closed", () => {
  const result = check({
    ...valid,
    PADDLE_ENVIRONMENT: "sandbox",
    PADDLE_API_KEY: "pdl_sdbx_apikey_" + "a".repeat(32),
    NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN: "test_" + "a".repeat(27),
  });
  assert.equal(result.readyForImplementationReview, false);
});

test("accidentally enabled production billing flags prevent readiness", () => {
  for (const flag of ["PADDLE_LIVE_CHECKOUT_ENABLED", "PADDLE_LIVE_GRANT_ACCESS"]) {
    const result = check({ ...valid, [flag]: "enabled" });
    assert.equal(result.readyForImplementationReview, false);
  }
});

test("invalid and empty live product/price identifiers fail closed", () => {
  assert.equal(check({ ...valid, PADDLE_LIVE_PRO_PRICE_ID: "pri_bad" }).readyForImplementationReview, false);
  assert.equal(check({ ...valid, PADDLE_LIVE_PRO_PRODUCT_ID: "" }).readyForImplementationReview, false);
});
