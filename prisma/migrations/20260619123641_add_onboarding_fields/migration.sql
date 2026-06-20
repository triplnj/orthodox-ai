-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dailyTime" TEXT,
ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "spiritualGoal" TEXT;
