import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";

function harness({ guard = true } = {}) {
  const rows = new Map();
  const db = {
    $queryRaw: async (strings, ...params) => {
      const sql = strings.join(" ");
      if (sql.includes('FROM "PaddleSandboxBranchGuard"')) {
        return guard ? [{ id: "br-red-waterfall-asdlxovu" }] : [];
      }
      if (sql.includes('INSERT INTO "PaddleSandboxWebhookEvent"')) {
        const [eventId, eventType, providerSubscriptionId, payloadDigest, occurredAt] = params;
        if (rows.has(eventId)) return [];
        rows.set(eventId, { eventId, eventType, providerSubscriptionId, payloadDigest, occurredAt, status: "RECEIVED" });
        return [{ eventId }];
      }
      if (sql.includes('FROM "PaddleSandboxWebhookEvent"')) {
        const row = rows.get(params[0]);
        return row ? [row] : [];
      }
      throw new Error("Unexpected query");
    },
  };
  const prisma = { $transaction: async callback => callback(db) };
  const load = createLoader({
    "server-only": {},
    "@/lib/prisma": { prisma },
  });
  const { persistPaddleSandboxEvent } = load("src/lib/billing/paddle-event-store.ts");
  return { persistPaddleSandboxEvent, rows };
}

const event = {
  event_id: "evt_01jaaaaaaaaaaaaaaaaaaaaaaa",
  event_type: "subscription.activated",
  occurred_at: "2026-11-24T09:00:00Z",
  data: { id: "sub_01jaaaaaaaaaaaaaaaaaaaaaaa" },
};
const raw = JSON.stringify(event);

test("Paddle audit event persists metadata only and deduplicates signed event replay", async () => {
  const { persistPaddleSandboxEvent: persist, rows } = harness();
  assert.equal(await persist(raw, event), "inserted");
  assert.equal(await persist(raw, event), "duplicate");
  assert.equal(rows.size, 1);
  const row = [...rows.values()][0];
  assert.equal(row.status, "RECEIVED");
  assert.equal(row.eventType, "subscription.activated");
  assert.equal(row.providerSubscriptionId, event.data.id);
  assert.match(row.payloadDigest, /^[a-f0-9]{64}$/);
  assert.equal("data" in row, false);
});

test("same event ID with altered content fails closed", async () => {
  const { persistPaddleSandboxEvent: persist } = harness();
  await persist(raw, event);
  const different = { ...event, event_type: "subscription.canceled" };
  await assert.rejects(persist(JSON.stringify(different), different), /collision/);
});

test("wrong database guard rejects before writing anything", async () => {
  const { persistPaddleSandboxEvent: persist, rows } = harness({ guard: false });
  await assert.rejects(persist(raw, event), /guard mismatch/);
  assert.equal(rows.size, 0);
});
