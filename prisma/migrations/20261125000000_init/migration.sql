CREATE TABLE "WhatsAppSession" ("id" TEXT NOT NULL PRIMARY KEY DEFAULT 'primary',"phoneNumber" TEXT,"connectionStatus" TEXT NOT NULL DEFAULT 'disconnected',"lastConnectedAt" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL);
CREATE TABLE "StatusMedia" ("id" TEXT NOT NULL PRIMARY KEY,"whatsappId" TEXT NOT NULL,"mediaType" TEXT NOT NULL,"contactName" TEXT,"caption" TEXT,"mediaPath" TEXT NOT NULL,"thumbnailPath" TEXT,"mimeType" TEXT NOT NULL,"fileSize" INTEGER NOT NULL,"timestamp" DATETIME NOT NULL,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"saved" BOOLEAN NOT NULL DEFAULT false);
CREATE UNIQUE INDEX "StatusMedia_whatsappId_key" ON "StatusMedia"("whatsappId");
CREATE INDEX "StatusMedia_timestamp_idx" ON "StatusMedia"("timestamp");
CREATE INDEX "StatusMedia_mediaType_timestamp_idx" ON "StatusMedia"("mediaType", "timestamp");
CREATE TABLE "DownloadHistory" ("id" TEXT NOT NULL PRIMARY KEY,"statusMediaId" TEXT NOT NULL,"fileName" TEXT NOT NULL,"fileSize" INTEGER NOT NULL,"downloadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DownloadHistory_statusMediaId_fkey" FOREIGN KEY ("statusMediaId") REFERENCES "StatusMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "DownloadHistory_downloadedAt_idx" ON "DownloadHistory"("downloadedAt");
CREATE TABLE "AppSettings" ("id" TEXT NOT NULL PRIMARY KEY,"key" TEXT NOT NULL,"value" TEXT NOT NULL,"updatedAt" DATETIME NOT NULL);
CREATE UNIQUE INDEX "AppSettings_key_key" ON "AppSettings"("key");
