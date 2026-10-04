ALTER TABLE "AiLessonImport" ADD COLUMN "generationMetadata" JSONB;
CREATE TABLE "AiLessonGenerationLimit" (
  "userId" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "activeRequestId" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  CONSTRAINT "AiLessonGenerationLimit_pkey" PRIMARY KEY ("userId")
);
