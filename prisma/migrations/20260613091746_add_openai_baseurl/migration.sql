-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT '1',
    "claudeApiKey" TEXT,
    "claudeBaseUrl" TEXT NOT NULL DEFAULT 'https://api.anthropic.com',
    "openaiApiKey" TEXT,
    "openaiBaseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    "imageModel" TEXT NOT NULL DEFAULT 'dall-e-3',
    "fbAccessToken" TEXT,
    "fbPageId" TEXT,
    "fbPageName" TEXT,
    "zaloToken" TEXT,
    "zaloOaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("claudeApiKey", "claudeBaseUrl", "createdAt", "fbAccessToken", "fbPageId", "fbPageName", "id", "openaiApiKey", "updatedAt", "zaloOaId", "zaloToken") SELECT "claudeApiKey", "claudeBaseUrl", "createdAt", "fbAccessToken", "fbPageId", "fbPageName", "id", "openaiApiKey", "updatedAt", "zaloOaId", "zaloToken" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
