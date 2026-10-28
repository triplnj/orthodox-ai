import { FULL_ACCESS_DAILY_CHAT_LIMIT } from "@/lib/features";
export const productCopy = {
  brandName: "OrthodoxAI",

  heroTitle:
    "A daily Orthodox Christian assistant for prayer, fasting, Scripture, and spiritual discipline.",

  heroSubtitle:
    "Ask questions, follow a prayer rhythm, understand fasting days, reflect on Scripture, and build a more consistent Orthodox Christian life.",

  disclaimer:
    "OrthodoxAI is an educational tool. It does not replace the Church, a priest, confession, pastoral counsel, medical advice, psychological help, or emergency services.",

  freePlan: {
    name: "Free",
    price: "$0",
    description: "For basic Orthodox guidance and occasional use.",
    features: [
      "3 AI questions per day",
      "Basic Orthodox Q&A",
      "Daily prayer card",
      "Basic fasting guidance",
      "Basic feast explanations",
    ],
  },

  proPlan: {
    name: "Pro",
    price: "$7.99/month",
    yearlyPrice: "$69/year",
    description:
      `For believers who want daily structure, deeper explanations, and up to ${FULL_ACCESS_DAILY_CHAT_LIMIT} chat questions per day.`,
    features: [
      `${FULL_ACCESS_DAILY_CHAT_LIMIT} AI questions per day`,
      "Personal prayer plan",
      "Scripture reading plan",
      "Spiritual journal",
      "Deeper feast and fasting explanations",
      "Conversation history",
      "Future PDF export",
    ],
  },

  upgradeMessage:
    `You have reached your daily Free limit. Upgrade to OrthodoxAI Pro for ${FULL_ACCESS_DAILY_CHAT_LIMIT} questions per day, personal prayer plans, Scripture reading plans, and a spiritual journal.`,
};