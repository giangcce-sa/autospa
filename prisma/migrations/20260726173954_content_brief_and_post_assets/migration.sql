-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "hooks" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "outline" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "targetChannels" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "title" TEXT,
ADD COLUMN     "topicTags" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "VideoProject" ADD COLUMN     "sourcePostId" TEXT;

-- CreateTable
CREATE TABLE "PostAsset" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'image',
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "durationSec" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostAsset_postId_position_idx" ON "PostAsset"("postId", "position");

-- AddForeignKey
ALTER TABLE "PostAsset" ADD CONSTRAINT "PostAsset_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
