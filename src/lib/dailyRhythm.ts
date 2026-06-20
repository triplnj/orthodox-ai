type DailyRhythmInput = {
  spiritualGoal?: string | null;
  experienceLevel?: string | null;
  dailyTime?: string | null;
};

export function buildDailyRhythm({
  spiritualGoal,
  experienceLevel,
  dailyTime,
}: DailyRhythmInput) {
  const time = dailyTime ?? "10 minutes";
  const level = experienceLevel ?? "beginner";
  const goal = spiritualGoal ?? "build prayer habit";

  const base = {
    title: "Today’s suggested rhythm",
    subtitle:
      "A simple daily structure based on your current OrthodoxAI setup.",
    time,
    level,
    goal,
  };

  if (goal === "read Scripture") {
    return {
      ...base,
      steps: [
        {
          title: "Begin with a short prayer",
          description:
            "Take one quiet minute and ask God for attention, humility, and understanding.",
        },
        {
          title: "Read a short Gospel passage",
          description:
            time === "5 minutes"
              ? "Read 5–8 verses from one Gospel slowly."
              : "Read one short Gospel section slowly and without rushing.",
        },
        {
          title: "Write one sentence",
          description:
            "Write one line about what the passage calls you to notice, repent of, or practice.",
        },
      ],
      journalQuestion:
        "What word, phrase, or command from today’s Scripture should I carry with me?",
    };
  }

  if (goal === "understand fasting") {
    return {
      ...base,
      steps: [
        {
          title: "Start with the meaning",
          description:
            "Remember that fasting is not only about food, but about repentance, prayer, simplicity, and self-control.",
        },
        {
          title: "Choose one simple restraint",
          description:
            "Choose one realistic act of restraint today: simpler food, less distraction, less complaining, or a small act of generosity.",
        },
        {
          title: "Keep it pastoral",
          description:
            "Do not make strict personal fasting rules without speaking with a priest, especially if health or family circumstances are involved.",
        },
      ],
      journalQuestion:
        "Where do I need more self-control today: food, speech, attention, comfort, or pride?",
    };
  }

  if (goal === "use spiritual journal") {
    return {
      ...base,
      steps: [
        {
          title: "Pray briefly before writing",
          description:
            "Begin with a short prayer for honesty, humility, and clarity.",
        },
        {
          title: "Write without performing",
          description:
            "Write a few honest lines about your day, temptations, gratitude, or questions.",
        },
        {
          title: "End with one concrete intention",
          description:
            "Choose one small action for today rather than a large emotional resolution.",
        },
      ],
      journalQuestion:
        "What is one thing I should bring honestly before God today?",
    };
  }

  if (goal === "learn Orthodox basics") {
    return {
      ...base,
      steps: [
        {
          title: "Learn one small concept",
          description:
            "Choose one Orthodox topic today: prayer, fasting, icons, confession, liturgy, Scripture, or the saints.",
        },
        {
          title: "Ask one focused question",
          description:
            "Use OrthodoxAI to ask one clear question rather than trying to learn everything at once.",
        },
        {
          title: "Connect knowledge to practice",
          description:
            "End by asking: how does this help me pray, repent, forgive, or live more faithfully?",
        },
      ],
      journalQuestion:
        "What did I learn today that should become practice, not only information?",
    };
  }

  return {
    ...base,
    steps: [
      {
        title: "Morning prayer",
        description:
          level === "beginner"
            ? `Pray simply for ${time}. Begin with the Trisagion prayers or the Lord’s Prayer if that is all you can do.`
            : `Keep a realistic morning prayer rhythm for ${time}, without rushing or turning prayer into a burden.`,
      },
      {
        title: "One remembrance during the day",
        description:
          "Pause once during the day and say the Jesus Prayer slowly and attentively.",
      },
      {
        title: "Evening reflection",
        description:
          "Before sleep, briefly review the day with gratitude, repentance, and one simple intention for tomorrow.",
      },
    ],
    journalQuestion:
      "What helped or harmed my attention to God today?",
  };
}