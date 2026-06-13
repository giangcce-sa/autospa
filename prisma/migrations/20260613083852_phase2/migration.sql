-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "zaloOaId" TEXT;
ALTER TABLE "Settings" ADD COLUMN "zaloToken" TEXT;

-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT '1',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#2d6a4f',
    "accentColor" TEXT NOT NULL DEFAULT '#40c074',
    "fontStyle" TEXT NOT NULL DEFAULT 'elegant',
    "spaName" TEXT,
    "tagline" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BulkPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PostAnalytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostAnalytics_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "fbCommentId" TEXT,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentiment" TEXT,
    "isReplied" BOOLEAN NOT NULL DEFAULT false,
    "autoReply" TEXT,
    "isAlert" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommentRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trigger" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "fbId" TEXT,
    "fbName" TEXT,
    "email" TEXT,
    "birthday" TEXT,
    "segment" TEXT NOT NULL DEFAULT 'new',
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "lastContact" DATETIME,
    "note" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'note',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CareMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'facebook',
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HolidayEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT,
    "isVietnamese" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SocialAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'facebook',
    "score" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'cold',
    "service" TEXT,
    "lastAction" TEXT,
    "nextFollowUp" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppointmentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "service" TEXT,
    "preferredAt" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'inbox',
    "customerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppointmentRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AppointmentRequest" ("createdAt", "id", "name", "note", "phone", "preferredAt", "service", "source", "status", "updatedAt") SELECT "createdAt", "id", "name", "note", "phone", "preferredAt", "service", "source", "status", "updatedAt" FROM "AppointmentRequest";
DROP TABLE "AppointmentRequest";
ALTER TABLE "new_AppointmentRequest" RENAME TO "AppointmentRequest";
CREATE TABLE "new_InboxMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reply" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isAutoReply" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InboxMessage" ("createdAt", "id", "isAutoReply", "isRead", "message", "reply", "senderId", "senderName") SELECT "createdAt", "id", "isAutoReply", "isRead", "message", "reply", "senderId", "senderName" FROM "InboxMessage";
DROP TABLE "InboxMessage";
ALTER TABLE "new_InboxMessage" RENAME TO "InboxMessage";
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT,
    "imageUrl" TEXT,
    "imagePrompt" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'facebook',
    "postType" TEXT NOT NULL DEFAULT 'service',
    "tone" TEXT NOT NULL DEFAULT 'friendly',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" DATETIME,
    "publishedAt" DATETIME,
    "fbPostId" TEXT,
    "qualityScore" INTEGER,
    "qualityNotes" TEXT,
    "serviceId" TEXT,
    "bulkPlanId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_bulkPlanId_fkey" FOREIGN KEY ("bulkPlanId") REFERENCES "BulkPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("caption", "createdAt", "fbPostId", "hashtags", "id", "imagePrompt", "imageUrl", "platform", "postType", "publishedAt", "qualityNotes", "qualityScore", "scheduledAt", "serviceId", "status", "tone", "updatedAt") SELECT "caption", "createdAt", "fbPostId", "hashtags", "id", "imagePrompt", "imageUrl", "platform", "postType", "publishedAt", "qualityNotes", "qualityScore", "scheduledAt", "serviceId", "status", "tone", "updatedAt" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PostAnalytics_postId_key" ON "PostAnalytics"("postId");
