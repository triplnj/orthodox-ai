// In-memory storage boundary only. Services, authorization, fences and quotas stay real.
export function addChatModels(prisma, state) {
  state.conversations = []; state.turns = []; state.messages = []; state.sources = [];
  let sequence = 0;
  const match = (row, where = {}) => Object.entries(where).every(([key, value]) => {
    if (key === "userId_requestId") return match(row, value);
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if (value.in) return value.in.includes(row[key]);
      if (value.not !== undefined) return row[key] !== value.not;
    }
    return row[key] === value;
  });
  const model = (key, defaults = {}) => ({
    create: async ({ data }) => {
      if (state.failMessage && key === "messages" && data.role === "assistant") throw new Error("Simulated message commit failure");
      const row = { id: `${key}-${++sequence}`, createdAt: new Date(), updatedAt: new Date(), ...defaults, ...data };
      delete row.sources;
      state[key].push(row);
      if (data.sources?.create) state.sources.push(...data.sources.create.map(source => ({ ...source, messageId: row.id })));
      return { ...row };
    },
    findFirst: async ({ where, orderBy } = {}) => {
      const rows = state[key].filter(row => match(row, where));
      return rows.length ? { ...(orderBy ? rows.at(-1) : rows[0]) } : null;
    },
    findUnique: async ({ where }) => {
      const row = state[key].find(row => match(row, where)); return row ? { ...row } : null;
    },
    findFirstOrThrow: async ({ where }) => {
      const row = state[key].find(row => match(row, where)); if (!row) throw new Error("Not found"); return { ...row };
    },
    findMany: async ({ where, take, orderBy, include, select } = {}) => {
      let rows = state[key].filter(row => match(row, where));
      const order = Array.isArray(orderBy) ? orderBy[0] : orderBy;
      if (order && Object.values(order)[0] === "desc") rows = [...rows].reverse();
      if (take !== undefined) rows = rows.slice(0, take);
      return rows.map(row => ({ ...row,
        ...(include?.messages || select?.messages ? { messages: state.messages.filter(message => message.turnId === row.id && message.role === "assistant") } : {}),
        ...(include?.sources ? { sources: state.sources.filter(source => source.messageId === row.id) } : {}),
      }));
    },
    update: async ({ where, data }) => {
      const row = state[key].find(row => match(row, where)); if (!row) throw new Error("Not found"); Object.assign(row, data); return { ...row };
    },
    updateMany: async ({ where, data }) => {
      const rows = state[key].filter(row => match(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length };
    },
  });
  prisma.conversation = model("conversations", { activeTurnId: null });
  prisma.chatTurn = model("turns", { status: "PENDING", responseSnapshot: null });
  prisma.chatMessage = model("messages");
}
