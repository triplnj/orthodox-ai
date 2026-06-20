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
            "Personal Scripture reading plans are available with OrthodoxAI Pro.",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    const body = await req.json();

    const experienceLevel = body.experienceLevel as string | undefined;
    const availableTime = body.availableTime as string | undefined;
    const goal = body.goal as string | undefined;
    const userProfileContext = await getUserProfileContext(user.id);
    const prompt = `
Create a realistic Orthodox Christian Scripture reading plan.
${userProfileContext}
User context:
- Experience level: ${experienceLevel ?? "Not provided"}
- Available time per day: ${availableTime ?? "Not provided"}
- Reading goal: ${goal ?? "Not provided"}

Requirements:
1. Keep the plan realistic and not overwhelming.
2. Include a daily reading rhythm.
3. Include both Gospel reading and broader Scripture reading.
4. Include one short reflection question per day.
5. Encourage prayer before reading.
6. Encourage the user to bring difficult spiritual questions to a priest.
7. Do not promote private sensational interpretation.
8. Do not act as a priest or spiritual authority.
`;

    const result = await generateOrthodoxAnswer({
      userMessage: prompt,
      contextKey: "scripture",
      isPro: true,
    });

    return NextResponse.json({
      plan: result.answer,
    });
  } catch (error) {
    console.error("SCRIPTURE_PLAN_API_ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while creating the Scripture plan." },
      { status: 500 }
    );
  }
}