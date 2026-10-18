import { createLoader } from "./load-ts.mjs";

export function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if (value.gt) return row[key] > value.gt;
      if (value.in) return value.in.includes(row[key]);
    }
    return row[key] === value;
  });
}
export function authHarness({ realBcrypt, extraMocks = {}, env = {} } = {}) {
  const state = { users: [], sessions: [], resets: [], verifications: [], buckets: [], domains: [], audits: [] };
  const calls = [], delivered = [], pending = [], jar = new Map();
  const options = { emailFailure: false, updateFailure: false };
  let sequence = 0, queue = Promise.resolve();
  function model(key) {
    return {
      findUnique: async ({ where, include }) => {
        const row = state[key].find(row => matches(row, where)); if (!row) return null;
        return structuredClone({ ...row, ...(include?.user ? { user: state.users.find(user => user.id === row.userId) } : {}) });
      },
      findMany: async ({ where = {}, take } = {}) => structuredClone(state[key].filter(row => matches(row, where)).slice(0, take)),
      create: async ({ data }) => {
        const row = { id: `${key}-${++sequence}`, passwordHash: null, plan: "FREE", emailVerified: null, usedAt: null,
          createdAt: new Date(), ...data }; state[key].push(row); return structuredClone(row);
      },
      update: async ({ where, data }) => {
        if (key === "users" && options.updateFailure) throw new Error("Mock database write failure");
        const row = state[key].find(row => matches(row, where)); if (!row) throw new Error("Missing row");
        Object.assign(row, data); return structuredClone(row);
      },
      updateMany: async ({ where, data }) => { const rows = state[key].filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
      deleteMany: async ({ where }) => { const rows = state[key].filter(row => matches(row, where)); state[key] = state[key].filter(row => !rows.includes(row)); return { count: rows.length }; },
      upsert: async ({ where, create, update }) => {
        const row = state[key].find(row => matches(row, where));
        if (!row) return model(key).create({ data: create });
        for (const [name, value] of Object.entries(update)) row[name] = value?.increment ? row[name] + value.increment : value;
        return structuredClone(row);
      },
    };
  }
  const prisma = { user: model("users"), session: model("sessions"), passwordResetToken: model("resets"),
    emailVerificationToken: model("verifications"), authRateLimitBucket: model("buckets"),
    patristicSourceDomain: model("domains"), patristicSourceDomainAudit: model("audits"),
    $queryRaw: async (...args) => { calls.push(args); return [{ locked: 1 }]; } };
  prisma.$transaction = async work => {
    const previous = queue; let release;
    queue = new Promise(resolve => { release = resolve; }); await previous;
    const snapshot = structuredClone(state);
    try { return await work(prisma); }
    catch (error) { Object.assign(state, snapshot); throw error; }
    finally { release(); }
  };
  const cookies = { get: name => jar.has(name) ? { value: jar.get(name) } : undefined,
    set: (name, value) => { if (value) jar.set(name, value); else jar.delete(name); }, delete: name => jar.delete(name) };
  const send = async (kind, input) => { if (options.emailFailure) throw new Error("Mock email outage"); delivered.push({ kind, ...input }); };
  const load = createLoader({ "server-only": {}, "@/lib/prisma": { prisma },
    "next/server": { ...awaitlessNext(), after: callback => pending.push(callback) },
    "next/headers": { cookies: async () => cookies },
    "next/navigation": { redirect: location => { throw Object.assign(new Error("Redirect"), { location }); } },
    "@/lib/email": { sendEmailVerification: input => send("verify", input), sendPasswordResetEmail: input => send("reset", input) },
    bcryptjs: realBcrypt ?? { hash: async password => `hash:${password}`, compare: async (password, hash) => password && hash === `hash:${password}` },
    ...extraMocks,
  }, { AUTH_RATE_LIMIT_SECRET: "mock-rate-secret-at-least-32-characters", AUTH_TRUSTED_IP_HEADER: "x-test-ingress-ip",
    NEXT_PUBLIC_APP_URL: "https://example.test", NODE_ENV: "test", PATRISTICS_SOURCE_ADMIN_USER_IDS: "admin", ...env });
  return { state, calls, delivered, jar, load, prisma, options, cookies,
    drainEmail: async () => { while (pending.length) await pending.shift()(); },
    addUser: (overrides = {}) => { const value = { id: "user", email: "user@example.test", name: "User", plan: "FREE",
      passwordHash: "hash:password123", emailVerified: null, ...overrides }; state.users.push(value); return value; },
    request: (path, body, { ip = "8.8.8.8", method = "POST" } = {}) => load(`src/app/api/${path}/route.ts`)[method](new Request(`https://example.test/api/${path}`, {
      method, headers: { "Content-Type": "application/json", "x-test-ingress-ip": ip }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })),
  };
}

// Load NextResponse without starting Next.js or any server.
import { NextResponse, NextRequest } from "next/server.js";
function awaitlessNext() { return { NextResponse, NextRequest }; }
