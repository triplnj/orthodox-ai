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
            "Personal prayer plans are available with OrthodoxAI Pro.",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    const body = await req.json();

    const experienceLevel = body.experienceLevel as string | undefined;
    const availableTime = body.availableTime as string | undefined;
    const focus = body.focus as string | undefined;
    const userProfileContext = await getUserProfileContext(user.id);
    const prompt = `
Create a realistic Orthodox Christian personal prayer plan.
${userProfileContext}
User context:
- Experience level: ${experienceLevel ?? "Not provided"}
- Available time per day: ${availableTime ?? "Not provided"}
- Current focus: ${focus ?? "Not provided"}

Requirements:
1. Keep the plan realistic and not extreme.
2. Include morning, daytime, and evening suggestions.
3. Include one short Scripture reading suggestion.
4. Include one weekly review question.
5. Clearly state that a personal prayer rule should be discussed with a priest.
6. Do not act as a priest or spiritual father.
`;

    const result = await generateOrthodoxAnswer({
      userMessage: prompt,
      contextKey: "prayers",
      isPro: true,
    });

    return NextResponse.json({
      plan: result.answer,
    });
  } catch (error) {
    console.error("PRAYER_PLAN_API_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while creating the prayer plan." },
      { status: 500 }
    );
  }
}