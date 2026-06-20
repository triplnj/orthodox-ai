import { NextResponse } from "next/server";
import { generateOrthodoxAnswer } from "@/lib/ai/chatService";
import { getCurrentUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { getUserProfileContext } from "@/lib/userProfileContext";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to use this feature." },
        { status: 401 }
      );
    }

    if (!isProUser(user)) {
      return NextResponse.json(
        {
          error:
            "Personal fasting guidance is available with OrthodoxAI Pro.",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    const body = await req.json();

    const experienceLevel = body.experienceLevel as string | undefined;
    const fastingContext = body.fastingContext as string | undefined;
    const currentChallenge = body.currentChallenge as string | undefined;
    const availableDiscipline = body.availableDiscipline as string | undefined;
    const userProfileContext = await getUserProfileContext(user.id);
    const prompt = `
Create a careful Orthodox Christian fasting support plan.
${userProfileContext}
User context:
- Experience level: ${experienceLevel ?? "Not provided"}
- Fasting context: ${fastingContext ?? "Not provided"}
- Current challenge: ${currentChallenge ?? "Not provided"}
- Available discipline: ${availableDiscipline ?? "Not provided"}

Requirements:
1. Explain that fasting is not only about food.
2. Keep the plan realistic, careful, and not extreme.
3. Include prayer, simplicity, almsgiving, self-control, and repentance.
4. Include a beginner-friendly weekly approach.
5. Include one practical daily reminder.
6. Clearly state that exact fasting rules and exceptions should be discussed with a priest.
7. Clearly state that health issues, pregnancy, eating disorders, medication, heavy work, or medical conditions require guidance from a qualified medical professional.
8. Do not give medical advice.
9. Do not act as a priest or spiritual father.
10. Do not prescribe strict fasting rules as binding.
`;

    const result = await generateOrthodoxAnswer({
      userMessage: prompt,
      contextKey: "fasting",
      isPro: true,
    });

    return NextResponse.json({
      plan: result.answer,
    });
  } catch (error) {
    console.error("FASTING_PLAN_API_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while creating the fasting guidance." },
      { status: 500 }
    );
  }
}