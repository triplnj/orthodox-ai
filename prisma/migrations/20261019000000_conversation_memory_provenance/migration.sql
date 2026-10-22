BEGIN;
-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "conversationId" TEXT,
ADD COLUMN     "turnId" TEXT;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextKey" TEXT NOT NULL DEFAULT 'general',
    "activeTurnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatTurn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "executionToken" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "evidenceSnapshot" JSONB,
    "responseSnapshot" JSONB,
    "budgetSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessageSource" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sourceOrder" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "authorName" TEXT,
    "workTitle" TEXT,
    "reference" TEXT,
    "originalLanguage" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "scanUrl" TEXT,
    "verificationStatus" TEXT NOT NULL,
    "includedInContext" BOOLEAN NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessageSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_userId_updatedAt_id_idx" ON "Conversation"("userId", "updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_id_userId_key" ON "Conversation"("id", "userId");

-- CreateIndex
CREATE INDEX "ChatTurn_conversationId_createdAt_id_idx" ON "ChatTurn"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ChatTurn_status_createdAt_idx" ON "ChatTurn"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatTurn_userId_requestId_key" ON "ChatTurn"("userId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatTurn_id_conversationId_userId_key" ON "ChatTurn"("id", "conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessageSource_messageId_sourceOrder_key" ON "ChatMessageSource"("messageId", "sourceOrder");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_createdAt_id_idx" ON "chat_messages"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_turnId_role_key" ON "chat_messages"("turnId", "role");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_userId_fkey" FOREIGN KEY ("conversationId", "userId") REFERENCES "Conversation"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_turnId_conversationId_userId_fkey" FOREIGN KEY ("turnId", "conversationId", "userId") REFERENCES "ChatTurn"("id", "conversationId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTurn" ADD CONSTRAINT "ChatTurn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTurn" ADD CONSTRAINT "ChatTurn_conversationId_userId_fkey" FOREIGN KEY ("conversationId", "userId") REFERENCES "Conversation"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageSource" ADD CONSTRAINT "ChatMessageSource_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Defense in depth alongside the per-user advisory lock and execution tokens.
CREATE UNIQUE INDEX "ChatTurn_active_conversation" ON "ChatTurn" ("conversationId")
  WHERE "status" IN ('PENDING', 'RUNNING');
ALTER TABLE "ChatTurn" ADD CONSTRAINT "ChatTurn_status_check"
  CHECK ("status" IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'ABANDONED'));
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_turn_links_check"
  CHECK (("turnId" IS NULL AND "conversationId" IS NULL) OR
         ("turnId" IS NOT NULL AND "conversationId" IS NOT NULL AND "role" IN ('user', 'assistant')));

CREATE FUNCTION reject_answer_source_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Answer source snapshots are immutable';
END;
$$;
CREATE TRIGGER "ChatMessageSource_immutable" BEFORE UPDATE ON "ChatMessageSource"
  FOR EACH ROW EXECUTE FUNCTION reject_answer_source_update();

CREATE FUNCTION reject_completed_turn_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'COMPLETED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Completed turns are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ChatTurn_completed_immutable" BEFORE UPDATE ON "ChatTurn"
  FOR EACH ROW EXECUTE FUNCTION reject_completed_turn_update();

CREATE FUNCTION reject_conversation_message_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."turnId" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Saved conversation messages are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "chat_messages_turn_immutable" BEFORE UPDATE ON "chat_messages"
  FOR EACH ROW EXECUTE FUNCTION reject_conversation_message_update();
-- DELETE remains permitted for existing account deletion / privacy cascades.
COMMIT;
