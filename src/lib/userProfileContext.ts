import { prisma } from "@/lib/prisma";

export async function getUserProfileContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      spiritualGoal: true,
      experienceLevel: true,
      dailyTime: true,
      onboardingCompleted: true,
    },
  });

  if (!user || !user.onboardingCompleted) {
    return "No onboarding profile has been completed yet.";
  }

  return `
User onboarding profile:
- Main spiritual goal: ${user.spiritualGoal ?? "Not set"}
- Experience level: ${user.experienceLevel ?? "Not set"}
- Realistic daily time: ${user.dailyTime ?? "Not set"}

Use this profile to make the answer realistic, gentle, and practical.
Do not create a burdensome or extreme spiritual rule.
`;
}