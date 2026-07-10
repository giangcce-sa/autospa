ALTER TABLE "Settings"
ADD COLUMN "telegramAdminUserId" TEXT,
ADD COLUMN "telegramWebhookSecret" TEXT,
ADD COLUMN "telegramWebhookUrl" TEXT,
ADD COLUMN "telegramWebhookAt" TIMESTAMP(3);

CREATE TABLE "TelegramDelivery" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "telegramMessageId" TEXT,
    "error" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramDelivery_type_status_createdAt_idx"
ON "TelegramDelivery"("type", "status", "createdAt");

CREATE TABLE "TelegramUpdate" (
    "updateId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "chatId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramUpdate_pkey" PRIMARY KEY ("updateId")
);
