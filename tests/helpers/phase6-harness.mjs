import { createLoader } from "./load-ts.mjs";
import { addChatModels } from "./chat-models.mjs";
export const free = { id: "alice", email: "alice@example.test", plan: "FREE", subscriptionStatus: null, emailVerified: new Date() };
export const pro = { ...free, plan: "PRO", subscriptionStatus: "active", billingAccessUntil: new Date(Date.now() + 86400000) };
export function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      if (expected.in) return expected.in.includes(row[key]);
      if ("not" in expected) return expected.not === null ? row[key] !== null && row[key] !== undefined : row[key] !== expected.not;
      if (expected.gte) return row[key] >= expected.gte;
      if (expected.gt) return row[key] > expected.gt;
      if (expected.lte) return row[key] <= expected.lte;
    }
    return row[key] === expected;
  });
}
export function phase6Harness(options = {}) {
  const state = { user: options.user === undefined ? pro : options.user, reservations: [], logs: [], entries: [], modelCalls: 0, gate: null, failModel: false, failCommit: false };
  const prisma = {}; let sequence = 0; let queue = Promise.resolve();
  addChatModels(prisma, state);
  prisma.chatMessage.count = async ({where}) => state.messages.filter(row=>matches(row,where)).length;
  const model = key => ({
    count: async ({ where }) => state[key].filter(row => matches(row, where)).length,
    findFirst: async ({ where }) => { const row = state[key].find(row => matches(row, where)); return row ? { ...row } : null; },
    findMany: async ({ where = {}, take } = {}) => state[key].filter(row => matches(row, where)).slice(0, take).map(row => ({ ...row })),
    create: async ({ data }) => { const row = { id: `row-${++sequence}`, status: "RUNNING", createdAt: new Date(), responseSnapshot: null, requestKey: null, ...data }; state[key].push(row); return { ...row }; },
    updateMany: async ({ where, data }) => { const rows = state[key].filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
    update: async ({ where, data }) => { const row = state[key].find(row => matches(row, where)); if (!row) throw new Error("Missing row"); Object.assign(row, data); return { ...row }; },
  });
  prisma.aiReservation = model("reservations"); prisma.usageLog = model("logs"); prisma.journalEntry = model("entries");
  prisma.user = { update: async ({ data }) => ({ id: state.user.id, ...data }), findUnique: async () => state.user };
  prisma.$transaction = async work => {
    let release; const previous = queue; queue = new Promise(resolve => { release = resolve; }); await previous;
    const keys = ["reservations", "logs", "entries", "conversations", "turns", "messages", "sources"];
    const snapshot = Object.fromEntries(keys.map(key => [key, structuredClone(state[key])]));
    try {
      const result = await work({ ...prisma, $queryRaw: async () => [{ locked: 1 }] });
      if (state.failCommit && state.reservations.some(row => row.status === "COMPLETED")) throw new Error("Unknown commit");
      return result;
    } catch (error) { Object.assign(state, snapshot); throw error; } finally { release(); }
  };
  const load = createLoader({
    "server-only": {}, "@/lib/prisma": { prisma }, "@/generated/prisma/client": { Prisma: { DbNull: null } },
    "@/lib/auth": { getCurrentUser: async () => state.user },
    "@/lib/session": { getSessionUser: async () => state.user },
    "@/lib/userProfileContext": { getUserProfileContext: async () => "Profile" },
    "@/lib/ai/chatService": { generateOrthodoxAnswer: async () => { state.modelCalls++; if (state.gate) await state.gate; if (state.failModel) throw new Error("Secret provider failure"); return { answer: "Answer" }; } },
    "@/lib/patristics/build-patristic-research-context": { buildPatristicResearchContext: async () => null },
  }, { NODE_ENV: "test", AI_QUOTA_TIMEZONE: "UTC", ...options.env });
  const request = (path, body, init = {}) => new Request(`https://example.test/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), ...init });
  const send = (path, body, init) => load(`src/app/api/${path}/route.ts`).POST(request(path, body, init));
  return { state, prisma, load, send, request };
}
