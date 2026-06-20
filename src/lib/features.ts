export const FREE_DAILY_CHAT_LIMIT = 5;

export const features = {
  chat: {
    id: "chat",
    name: "Orthodox AI Chat",
    free: true,
    pro: true,
    freeDailyLimit: FREE_DAILY_CHAT_LIMIT,
  },

  today: {
    id: "today",
    name: "Today",
    free: true,
    pro: true,
  },

  prayers: {
    id: "prayers",
    name: "Prayers",
    free: true,
    pro: true,
  },

  fasting: {
    id: "fasting",
    name: "Fasting",
    free: true,
    pro: true,
  },

  personalPrayerPlan: {
    id: "personalPrayerPlan",
    name: "Personal Prayer Plan",
    free: false,
    pro: true,
  },

  scripturePlan: {
    id: "scripturePlan",
    name: "Scripture Reading Plan",
    free: false,
    pro: true,
  },

  journal: {
    id: "journal",
    name: "Spiritual Journal",
    free: false,
    pro: true,
  },
} as const;

export type FeatureId = keyof typeof features;