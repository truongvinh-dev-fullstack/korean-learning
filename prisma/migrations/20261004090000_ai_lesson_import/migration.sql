CREATE TABLE "AiLessonImport" (
  "idempotencyKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "lessonId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiLessonImport_pkey" PRIMARY KEY ("idempotencyKey")
);
CREATE INDEX "AiLessonImport_lessonId_idx" ON "AiLessonImport"("lessonId");
ALTER TABLE "AiLessonImport" ADD CONSTRAINT "AiLessonImport_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
