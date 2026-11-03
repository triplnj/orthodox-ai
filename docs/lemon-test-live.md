# Lemon Squeezy: test and live isolation

## TEST (restricted QA only)

Configure these **server-side** Vercel environment variables with credentials generated in Lemon Squeezy **Test Mode**:

- `LEMONSQUEEZY_TEST_API_KEY`: API key created in Test Mode.
- `LEMONSQUEEZY_TEST_STORE_ID`: test store ID.
- `LEMONSQUEEZY_TEST_PRO_VARIANT_ID`: published test subscription variant ID.
- `LEMONSQUEEZY_TEST_WEBHOOK_SECRET`: signing secret of a **separate test webhook**.
- `BILLING_TEST_USER_IDS` (optional): comma-separated verified test account IDs authorized for test checkout. Verified IDs in `BLOG_ADMIN_USER_IDS` also have access.

Create the Test Mode webhook in Lemon Squeezy, directed to
`https://www.orthodoxai.app/api/lemonsqueezy/test-webhook`.
Subscribe to subscription and order creation events. Use a distinct signing secret.

Visit `/admin/billing-test` signed in as an allowed account; click **Start TEST checkout**. Only dummy cards. Successful test webhooks record their outcome under `provider=LEMONSQUEEZY_TEST` without changing the user's plan or live subscription.

## LIVE (customer payments)

The existing checkout and webhook continue to use:

- `LEMONSQUEEZY_API_KEY`: a **Live** API key.
- `LEMONSQUEEZY_STORE_ID`: live store.
- `LEMONSQUEEZY_PRO_VARIANT_ID`: a published **Live** subscription variant.
- `LEMONSQUEEZY_WEBHOOK_SECRET`: distinct **Live** webhook signing secret.

Live webhook URL: `https://www.orthodoxai.app/api/lemonsqueezy/webhook`.

Live checkout pre-verifies that its variant is `test_mode: false`. Live webhook rejects test events. Test checkout uses `test_mode: true` and a distinct API key. Do not reuse test keys or variants in live variables.

**Before enabling real sales:** verify Lemon Squeezy store activation, live product, live API key, webhook signature, receipt, subscription state and cancellation. Test purchase receipts never grant Pro entitlements.

### Existing legacy attempts

Old `LEMONSQUEEZY` checkout attempts created while the app pointed at test credentials remain legacy records. Do not delete or relabel them without checking their provider orders and subscription state. The new test flow does not reuse them.
