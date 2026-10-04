import "server-only";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/shared/db/prisma";
import { withSerializableRetry } from "@/shared/db/serializable-transaction";
import { ConflictError, NotFoundError } from "@/shared/errors/domain-errors";
import { LessonFormSchema, LessonBlockFormSchema, VocabularyFormSchema, ExerciseFormSchema, QuestionFormSchema } from "@/modules/admin/admin.schema";
import { remapAiVocabularyReferences } from "./ai-lesson.mapper";
import type { AiLessonDraft, AiLessonTarget } from "./ai-lesson.schema";
import type { AiGenerationMetadata } from "./ai-generation.types";

export class AiLessonRepository {
  async previewFingerprint(target: AiLessonTarget, requestHash: string, tx: Prisma.TransactionClient = prisma) {
    if (target.mode !== "REPLACE") return requestHash;
    const version = await tx.lesson.findUnique({ where: { id: target.lessonId }, select: { id: true, updatedAt: true,
      blocks: { orderBy: { id: "asc" }, select: { id: true, updatedAt: true } }, vocabularies: { orderBy: { id: "asc" }, select: { id: true, updatedAt: true } },
      exercises: { orderBy: { id: "asc" }, select: { id: true, updatedAt: true, questions: { orderBy: { id: "asc" }, select: { id: true, updatedAt: true, options: { orderBy: { id: "asc" }, select: { id: true, updatedAt: true } } } } } },
    } });
    if (!version) throw new NotFoundError("Bài học không tồn tại.");
    return createHash("sha256").update(`${requestHash}:${JSON.stringify(version)}`).digest("hex");
  }
  async findImportReceipt(userId: string, key: string, hash: string) {
    const receipt = await prisma.aiLessonImport.findUnique({ where: { idempotencyKey: key } });
    if (!receipt) return null;
    if (receipt.userId !== userId || receipt.requestHash !== hash) throw new ConflictError("Mã nhập đã được dùng cho một yêu cầu khác.");
    if (!receipt.lessonId) throw new ConflictError("Bài học của lần nhập trước đã bị xóa.");
    return { lessonId: receipt.lessonId, replayed: true };
  }
  // Questions and relational options use the caller's transaction.
  async writeQuestions(tx: Prisma.TransactionClient, exerciseId: string, questions: AiLessonDraft["exercises"][number]["questions"]) {
    for (const q of questions) {
      const parsed = QuestionFormSchema.parse({ ...q, exerciseId, displayOrder: q.order, correctAnswer: q.type === "FILL_BLANK" ? q.content.answers[0] : q.correctAnswer });
      await tx.question.create({ data: { exerciseId, type: parsed.type, prompt: parsed.prompt, audioUrl: parsed.audioUrl, correctAnswer: parsed.correctAnswer, explanation: parsed.explanation, displayOrder: q.order, content: parsed.content as Prisma.InputJsonValue,
        options: { create: parsed.options.map((o, displayOrder) => ({ text: o.text, isCorrect: o.isCorrect, explanation: o.explanation, displayOrder })) } } });
    }
  }
  async importDraft(userId: string, draft: AiLessonDraft, target: AiLessonTarget, key: string, hash: string, replaceConfirmed: boolean, expectedFingerprint?: string, generation?: AiGenerationMetadata) {
    const run = () => withSerializableRetry(async (tx) => {
      const receipt = await tx.aiLessonImport.findUnique({ where: { idempotencyKey: key } });
      if (receipt) {
        if (receipt.userId !== userId || receipt.requestHash !== hash) throw new ConflictError("Mã nhập đã được dùng cho một yêu cầu khác.");
        if (!receipt.lessonId) throw new ConflictError("Bài học của lần nhập trước đã bị xóa.");
        return { lessonId: receipt.lessonId, replayed: true };
      }
      let lesson;
      const metadata = { title: draft.lesson.title, slug: draft.lesson.slug, summary: draft.lesson.summary, estimatedMinutes: draft.lesson.estimatedDuration, level: draft.lesson.level, tags: draft.lesson.tags, learningObjectives: draft.learningObjectives };
      if (target.mode === "NEW") {
        if (!await tx.chapter.findUnique({ where: { id: target.chapterId }, select: { id: true } })) throw new NotFoundError("Chương học không tồn tại.");
        if (await tx.lesson.findUnique({ where: { slug: metadata.slug }, select: { id: true } })) throw new ConflictError("Slug đã tồn tại. Hãy sửa slug trong preview rồi kiểm tra lại.");
        const max = await tx.lesson.aggregate({ where: { chapterId: target.chapterId }, _max: { displayOrder: true } });
        const data = LessonFormSchema.parse({ ...metadata, chapterId: target.chapterId, status: "DRAFT", displayOrder: (max._max.displayOrder ?? -1) + 1 });
        lesson = await tx.lesson.create({ data });
      } else {
        lesson = await tx.lesson.findUnique({ where: { id: target.lessonId } });
        if (!lesson) throw new NotFoundError("Bài học không tồn tại.");
        if (lesson.status !== "DRAFT") throw new ConflictError("Hãy chuyển bài học về DRAFT bằng quy trình hiện có trước khi nhập AI.");
        if (target.mode === "REPLACE") {
          if (!replaceConfirmed) throw new ConflictError("Cần xác nhận riêng việc thay toàn bộ nội dung nháp.");
          if (!expectedFingerprint || await this.previewFingerprint(target, hash, tx) !== expectedFingerprint) throw new ConflictError("Bài học đã thay đổi sau preview. Hãy kiểm tra lại trước khi replace.");
          const activity = [await tx.lessonProgress.count({ where: { lessonId: lesson.id } }), await tx.exerciseAttempt.count({ where: { exercise: { lessonId: lesson.id } } }), await tx.reviewCard.count({ where: { vocabulary: { lessonId: lesson.id } } })];
          if (activity.some(Boolean)) throw new ConflictError("Không thể thay nội dung vì bài học đã có dữ liệu học viên. Hãy append hoặc tạo bài mới.");
          const duplicate = await tx.lesson.findUnique({ where: { slug: metadata.slug }, select: { id: true } });
          if (duplicate && duplicate.id !== lesson.id) throw new ConflictError("Slug đã tồn tại. Hãy sửa slug trong preview rồi kiểm tra lại.");
          LessonFormSchema.parse({ ...metadata, chapterId: lesson.chapterId });
          await tx.lessonBlock.deleteMany({ where: { lessonId: lesson.id } });
          await tx.exercise.deleteMany({ where: { lessonId: lesson.id } });
          await tx.vocabulary.deleteMany({ where: { lessonId: lesson.id } });
          lesson = await tx.lesson.update({ where: { id: lesson.id }, data: metadata });
        } else {
          const learningObjectives = [...new Set([...lesson.learningObjectives, ...draft.learningObjectives])];
          LessonFormSchema.shape.learningObjectives.parse(learningObjectives);
          lesson = await tx.lesson.update({ where: { id: lesson.id }, data: { learningObjectives } });
        }
      }
      const lessonId = lesson.id;
      const offsets = { vocabulary: (await tx.vocabulary.aggregate({ where: { lessonId }, _max: { displayOrder: true } }))._max.displayOrder ?? -1,
        blocks: (await tx.lessonBlock.aggregate({ where: { lessonId }, _max: { displayOrder: true } }))._max.displayOrder ?? -1,
        exercises: (await tx.exercise.aggregate({ where: { lessonId }, _max: { displayOrder: true } }))._max.displayOrder ?? -1 };
      const ids = new Map<string, string>(); const blockIds: string[] = [], exerciseIds: string[] = [];
      for (const [i, word] of draft.vocabulary.entries()) {
        const data = VocabularyFormSchema.parse({ lessonId, hangul: word.hangul, romanization: word.romanization, vietnameseMeaning: word.vietnamese, englishMeaning: word.english ?? "", partOfSpeech: word.partOfSpeech, audioUrl: word.audioUrl, difficulty: word.difficulty, tags: word.tags, exampleSentenceHangul: word.exampleSentenceHangul, exampleSentenceVi: word.exampleSentenceVi, displayOrder: offsets.vocabulary + i + 1 });
        const created = await tx.vocabulary.create({ data: { ...data, englishMeaning: data.englishMeaning ?? "" } }); ids.set(word.clientId, created.id);
      }
      for (const block of draft.contentBlocks) {
        const mapped = remapAiVocabularyReferences(block, ids);
        const parsed = LessonBlockFormSchema.parse({ ...mapped, lessonId, displayOrder: offsets.blocks + block.order + 1 });
        const created = await tx.lessonBlock.create({ data: { ...parsed, content: parsed.content as Prisma.InputJsonValue } }); blockIds.push(created.id);
      }
      for (const e of draft.exercises) {
        const parsed = ExerciseFormSchema.parse({ lessonId, title: e.title, description: e.description, displayOrder: offsets.exercises + e.order + 1, status: "DRAFT" });
        const created = await tx.exercise.create({ data: parsed }); exerciseIds.push(created.id); await this.writeQuestions(tx, created.id, e.questions);
      }
      // Validate only the imported graph. APPEND must leave unrelated invalid legacy rows untouched.
      const blocks = await tx.lessonBlock.findMany({ where: { id: { in: blockIds } } });
      const bankIds = new Set((await tx.vocabulary.findMany({ where: { lessonId }, select: { id: true } })).map((v) => v.id));
      blocks.forEach((block) => { const parsed = LessonBlockFormSchema.parse(block); if (parsed.type === "VOCABULARY" && parsed.content.vocabularyIds?.some((id) => !bankIds.has(id))) throw new ConflictError("Tham chiếu từ vựng không hợp lệ sau import."); });
      const exercises = await tx.exercise.findMany({ where: { id: { in: exerciseIds } }, include: { questions: { include: { options: true } } } });
      exercises.forEach((e) => { ExerciseFormSchema.parse(e); e.questions.forEach((q) => QuestionFormSchema.parse(q)); });
      await tx.aiLessonImport.create({ data: { idempotencyKey: key, userId, requestHash: hash, lessonId, ...(generation ? { generationMetadata: generation as Prisma.InputJsonValue } : {}) } });
      return { lessonId, replayed: false };
    }, { timeout: 30000, maxWait: 10000, maxAttempts: 6 });
    try { return await run(); }
    catch (error) {
      // A competing request can hit the unique receipt/slug before Serializable retry sees a conflict.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const receipt = await prisma.aiLessonImport.findUnique({ where: { idempotencyKey: key } });
        if (receipt?.userId === userId && receipt.requestHash === hash && receipt.lessonId) return { lessonId: receipt.lessonId, replayed: true };
        throw new ConflictError("Yêu cầu nhập hoặc slug bị trùng. Hãy kiểm tra dữ liệu trước khi thử lại.");
      }
      throw error;
    }
  }
}
