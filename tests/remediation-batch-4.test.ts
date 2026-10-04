import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { QuestionType } from "@prisma/client";
import { QuestionFormSchema } from "@/modules/admin/admin.schema";
import { adminService } from "@/modules/admin/admin.service";
import { validateServerEnv } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { ConflictError, ValidationError } from "@/shared/errors/domain-errors";

const admin = { role: "ADMIN" };
const exerciseId = "e0000000-0000-4000-a000-000000000001";
let authoringExerciseId: string;
const seededQuestionId = "q0000000-0000-4000-a000-000000000001";
const validOptions = [
  { text: "A", isCorrect: true },
  { text: "B", isCorrect: false },
  { text: "C", isCorrect: false },
  { text: "D", isCorrect: false },
];
const question = (options: typeof validOptions, type: QuestionType = QuestionType.MULTIPLE_CHOICE) => ({
  exerciseId: authoringExerciseId, type, prompt: "Batch 4 authoring check", options, audioUrl: type === "LISTENING_CHOICE" ? "/audio/exercises/vowel-a.ogg" : null,
});

describe("Batch 4 authoring and configuration", () => {
  const createdUsers: string[] = [];
  beforeAll(async () => {
    const exercise = await prisma.exercise.create({ data: {
      lessonId: "l0000000-0000-4000-a000-000000000001", title: "Batch 4 draft authoring", status: "DRAFT",
    } });
    authoringExerciseId = exercise.id;
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.exercise.delete({ where: { id: authoringExerciseId } });
  });

  it("requires at least two choices and exactly one correct answer on create and update", async () => {
    for (const count of [0, 1]) {
      const options = count === 5 ? [...validOptions, { text: "E", isCorrect: false }] : validOptions.slice(0, count);
      expect(QuestionFormSchema.safeParse(question(options)).success).toBe(false);
      await expect(adminService.createQuestion(admin, question(options))).rejects.toThrow(ValidationError);
    }
    for (const type of [QuestionType.MULTIPLE_CHOICE, QuestionType.LISTENING_CHOICE]) {
      const twoCorrect = validOptions.map((option, index) => ({ ...option, isCorrect: index < 2 }));
      expect(QuestionFormSchema.safeParse(question(twoCorrect, type)).success).toBe(false);
      await expect(adminService.createQuestion(admin, question(twoCorrect, type))).rejects.toThrow(ValidationError);
    }
    const created = await adminService.createQuestion(admin, question(validOptions));
    expect(created?.options).toHaveLength(4);
    try {
      await expect(adminService.updateQuestion(admin, created!.id, { options: validOptions.slice(0, 1) })).rejects.toThrow(ValidationError);
      expect((await adminService.updateQuestion(admin, created!.id, { options: validOptions.slice(0, 2) }))?.options).toHaveLength(2);
      await expect(adminService.updateQuestion(admin, created!.id, { options: validOptions.map((option) => ({ ...option, isCorrect: true })) })).rejects.toThrow(ValidationError);
      const updated = await adminService.updateQuestion(admin, created!.id, { prompt: "Updated valid question" });
      expect(updated?.options).toHaveLength(2);
    } finally {
      await prisma.question.delete({ where: { id: created!.id } });
    }
  });

  it("rejects edits and deletion after an exercise has a submitted attempt", async () => {
    const id = crypto.randomUUID();
    await prisma.user.create({ data: { id, email: `batch4-${id}@example.com`, name: "Batch 4 tester" } });
    createdUsers.push(id);
    const attempt = await prisma.exerciseAttempt.create({ data: {
      userId: id, exerciseId, submittedAt: new Date(), score: 1, maxScore: 1, percentage: 100, isPassing: true,
    } });
    const before = await prisma.question.findUniqueOrThrow({ where: { id: seededQuestionId }, include: { options: true } });
    try {
      await expect(adminService.updateQuestion(admin, seededQuestionId, { prompt: "Changed answer" })).rejects.toThrow(ConflictError);
      await expect(adminService.updateQuestion(admin, seededQuestionId, { options: validOptions })).rejects.toThrow(ConflictError);
      await expect(adminService.updateQuestion(admin, seededQuestionId, { options: [] })).rejects.toThrow(ConflictError);
      await expect(adminService.deleteQuestion(admin, seededQuestionId)).rejects.toThrow(ConflictError);
      const after = await prisma.question.findUniqueOrThrow({ where: { id: seededQuestionId }, include: { options: true } });
      expect(after.prompt).toBe(before.prompt);
      expect(after.options).toEqual(before.options);
    } finally {
      await prisma.exerciseAttempt.delete({ where: { id: attempt.id } });
    }
  });

  it("fails with actionable errors when production configuration is missing or unsafe", () => {
    expect(() => validateServerEnv({ NODE_ENV: "production" })).toThrow(/DATABASE_URL.*BETTER_AUTH_SECRET.*BETTER_AUTH_URL.*NEXT_PUBLIC_APP_URL/);
    const configured = {
      NODE_ENV: "production" as const, DATABASE_URL: "postgresql://user:pass@localhost:5432/korean_zero",
      BETTER_AUTH_SECRET: "a".repeat(48), BETTER_AUTH_URL: "https://example.com", NEXT_PUBLIC_APP_URL: "https://example.com",
    };
    expect(validateServerEnv(configured).databaseUrl).toBe(configured.DATABASE_URL);
    expect(() => validateServerEnv({ ...configured, DATABASE_URL: "file:./dev.db" })).toThrow(/PostgreSQL/);
    expect(() => validateServerEnv({ ...configured, BETTER_AUTH_SECRET: "korean-zero-dev-secret-placeholder" })).toThrow(/unique random/);
  });
});
