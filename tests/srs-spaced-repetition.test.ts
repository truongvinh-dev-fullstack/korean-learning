import "dotenv/config";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { CardState, ReviewRating } from "@prisma/client";
import {
  calculateNextSchedule,
  MIN_EASE_FACTOR,
  DEFAULT_EASE_FACTOR,
} from "@/modules/srs/srs-scheduler";
import { srsService } from "@/modules/srs/srs.service";
import { prisma } from "@/shared/db/prisma";
import { ForbiddenError } from "@/shared/errors/domain-errors";
import {
  getVietnamDateString,
  getVietnamEndOfDayUtc,
} from "@/shared/utils/date";

describe("Phase 7: Pure SM-2 Scheduler Engine (Fixed Clock)", () => {
  const fixedClock = new Date("2026-10-15T09:00:00.000Z");

  describe("First Review Behavior (repetitions = 0)", () => {
    const baseNewCard = {
      state: CardState.NEW,
      intervalDays: 0,
      easeFactor: DEFAULT_EASE_FACTOR,
      repetitions: 0,
      lapses: 0,
      dueAt: fixedClock,
    };

    it("schedules AGAIN: interval = 1, repetitions = 0, lapses = 1, state = LEARNING, EF reduced", () => {
      const result = calculateNextSchedule(baseNewCard, ReviewRating.AGAIN, fixedClock);

      expect(result.intervalDays).toBe(1);
      expect(result.repetitions).toBe(0);
      expect(result.lapses).toBe(1);
      expect(result.state).toBe(CardState.LEARNING);
      // EF delta: 0.1 - (4 - 1) * (0.08 + 3 * 0.02) = 0.1 - 3 * 0.14 = -0.32
      expect(result.easeFactor).toBe(2.18);
      expect(result.dueAt.getTime()).toBe(
        fixedClock.getTime() + 1 * 24 * 60 * 60 * 1000
      );
    });

    it("schedules HARD on first review: interval = 1, repetitions = 1, state = REVIEW", () => {
      const result = calculateNextSchedule(baseNewCard, ReviewRating.HARD, fixedClock);

      expect(result.intervalDays).toBe(1);
      expect(result.repetitions).toBe(1);
      expect(result.lapses).toBe(0);
      expect(result.state).toBe(CardState.REVIEW);
      // EF delta: 0.1 - (4 - 2) * (0.08 + 2 * 0.02) = 0.1 - 2 * 0.12 = -0.14
      expect(result.easeFactor).toBe(2.36);
    });

    it("schedules GOOD on first review: interval = 1, repetitions = 1, state = REVIEW, EF preserved", () => {
      const result = calculateNextSchedule(baseNewCard, ReviewRating.GOOD, fixedClock);

      expect(result.intervalDays).toBe(1);
      expect(result.repetitions).toBe(1);
      expect(result.lapses).toBe(0);
      expect(result.state).toBe(CardState.REVIEW);
      // EF delta: 0.1 - (4 - 3) * (0.08 + 1 * 0.02) = 0.1 - 0.1 = 0
      expect(result.easeFactor).toBe(2.50);
    });

    it("schedules EASY on first review: interval = 1, repetitions = 1, state = REVIEW, EF increased", () => {
      const result = calculateNextSchedule(baseNewCard, ReviewRating.EASY, fixedClock);

      expect(result.intervalDays).toBe(1);
      expect(result.repetitions).toBe(1);
      expect(result.lapses).toBe(0);
      expect(result.state).toBe(CardState.REVIEW);
      // EF delta: 0.1 - (4 - 4) * ... = +0.10
      expect(result.easeFactor).toBe(2.60);
    });
  });

  describe("Subsequent Review Intervals (repetitions >= 1)", () => {
    it("advances interval to 3 days on second successful review (repetitions = 1 -> 2)", () => {
      const cardAfterFirstGood = {
        state: CardState.REVIEW,
        intervalDays: 1,
        easeFactor: 2.50,
        repetitions: 1,
        lapses: 0,
        dueAt: fixedClock,
      };

      const result = calculateNextSchedule(cardAfterFirstGood, ReviewRating.GOOD, fixedClock);

      expect(result.intervalDays).toBe(3);
      expect(result.repetitions).toBe(2);
      expect(result.state).toBe(CardState.REVIEW);
      expect(result.dueAt.getTime()).toBe(
        fixedClock.getTime() + 3 * 24 * 60 * 60 * 1000
      );
    });

    it("calculates distinct intervals for HARD, GOOD and EASY when repetitions = 2 (previous interval = 3)", () => {
      const cardRep2 = {
        state: CardState.REVIEW,
        intervalDays: 3,
        easeFactor: 2.50,
        repetitions: 2,
        lapses: 0,
        dueAt: fixedClock,
      };

      // HARD: round(3 * 1.2) = 4 days
      const hardRes = calculateNextSchedule(cardRep2, ReviewRating.HARD, fixedClock);
      expect(hardRes.intervalDays).toBe(4);
      expect(hardRes.repetitions).toBe(3);

      // GOOD: round(3 * 2.50) = 8 days
      const goodRes = calculateNextSchedule(cardRep2, ReviewRating.GOOD, fixedClock);
      expect(goodRes.intervalDays).toBe(8);
      expect(goodRes.repetitions).toBe(3);

      // EASY: round(3 * 2.60 * 1.3) = round(10.14) = 10 days
      const easyRes = calculateNextSchedule(cardRep2, ReviewRating.EASY, fixedClock);
      expect(easyRes.intervalDays).toBe(10);
      expect(easyRes.repetitions).toBe(3);
    });
  });

  describe("Lapse Behavior & Repeated AGAIN", () => {
    it("handles lapse on a mature card: resets repetitions to 0, increments lapses, state to LEARNING", () => {
      const matureCard = {
        state: CardState.MASTERED,
        intervalDays: 25,
        easeFactor: 2.70,
        repetitions: 5,
        lapses: 0,
        dueAt: fixedClock,
      };

      const result = calculateNextSchedule(matureCard, ReviewRating.AGAIN, fixedClock);

      expect(result.repetitions).toBe(0);
      expect(result.lapses).toBe(1);
      expect(result.intervalDays).toBe(1);
      expect(result.state).toBe(CardState.LEARNING);
      expect(result.easeFactor).toBe(2.38); // 2.70 - 0.32
    });

    it("clamps ease factor to minimum 1.30 on repeated AGAIN failures", () => {
      const current = {
        state: CardState.NEW,
        intervalDays: 1,
        easeFactor: 1.50,
        repetitions: 0,
        lapses: 2,
        dueAt: fixedClock,
      };

      // 1.50 - 0.32 = 1.18 -> clamped to 1.30
      const res1 = calculateNextSchedule(current, ReviewRating.AGAIN, fixedClock);
      expect(res1.easeFactor).toBe(MIN_EASE_FACTOR);
      expect(res1.lapses).toBe(3);

      // Repeated again still clamped at 1.30
      const res2 = calculateNextSchedule(res1, ReviewRating.AGAIN, fixedClock);
      expect(res2.easeFactor).toBe(MIN_EASE_FACTOR);
      expect(res2.lapses).toBe(4);
    });
  });

  describe("Mastery State Transition", () => {
    it("transitions card to MASTERED when interval reaches or exceeds 21 days", () => {
      const highIntervalCard = {
        state: CardState.REVIEW,
        intervalDays: 10,
        easeFactor: 2.50,
        repetitions: 3,
        lapses: 0,
        dueAt: fixedClock,
      };

      // 10 * 2.50 = 25 days >= 21
      const result = calculateNextSchedule(highIntervalCard, ReviewRating.GOOD, fixedClock);
      expect(result.intervalDays).toBe(25);
      expect(result.state).toBe(CardState.MASTERED);
    });
  });
});

describe("Timezone Boundary Handling (Asia/Ho_Chi_Minh UTC+7)", () => {
  it("determines correct local study day boundary", () => {
    // 2026-10-20 10:00:00 VN (+7) is 2026-10-20 03:00:00Z UTC
    const vnMorningUtc = new Date("2026-10-20T03:00:00.000Z");
    const dateStr = getVietnamDateString(vnMorningUtc);
    expect(dateStr).toBe("2026-10-20");

    const endOfDayUtc = getVietnamEndOfDayUtc(vnMorningUtc);
    // 23:59:59.999 in VN (+7) is 16:59:59.999Z UTC
    expect(endOfDayUtc.toISOString()).toBe("2026-10-20T16:59:59.999Z");
  });

  it("differentiates cards due before vs after midnight Vietnam time", () => {
    const fixedNow = new Date("2026-10-20T08:00:00.000Z"); // 15:00 VN time
    const endOfDayUtc = getVietnamEndOfDayUtc(fixedNow); // 16:59:59.999Z

    // Card A: due at 23:30 VN time (16:30Z UTC) -> due today
    const cardADue = new Date("2026-10-20T16:30:00.000Z");
    expect(cardADue.getTime() <= endOfDayUtc.getTime()).toBe(true);

    // Card B: due at 00:30 next morning VN time (17:30Z UTC) -> NOT due today
    const cardBDue = new Date("2026-10-20T17:30:00.000Z");
    expect(cardBDue.getTime() <= endOfDayUtc.getTime()).toBe(false);
  });
});

describe("SRS Service & Database Integration (Security & Idempotency)", () => {
  let studentA: { id: string; email: string };
  let studentB: { id: string; email: string };
  const seededLessonId = "l0000000-0000-4000-a000-000000000001"; // Lesson 1

  beforeEach(async () => {
    const ts = Date.now() + Math.floor(Math.random() * 10000);
    studentA = await prisma.user.create({
      data: {
        id: `srs-student-a-${ts}`,
        email: `srs_student_a_${ts}@example.com`,
        name: "Học Viên SRS A",
        role: "STUDENT",
      },
    });

    studentB = await prisma.user.create({
      data: {
        id: `srs-student-b-${ts}`,
        email: `srs_student_b_${ts}@example.com`,
        name: "Học Viên SRS B",
        role: "STUDENT",
      },
    });
  });

  afterAll(async () => {
    await prisma.reviewLog.deleteMany({
      where: { user: { email: { contains: "srs_student_" } } },
    });
    await prisma.reviewCard.deleteMany({
      where: { user: { email: { contains: "srs_student_" } } },
    });
    await prisma.dailyStudyStat.deleteMany({
      where: { user: { email: { contains: "srs_student_" } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: "srs_student_" } },
    });
  });

  it("enqueues lesson vocabulary idempotently without creating duplicates", async () => {
    // First enqueue
    const countFirst = await srsService.enqueueLessonVocabulary(studentA.id, seededLessonId);
    expect(countFirst).toBeGreaterThan(0);

    const initialCardsCount = await prisma.reviewCard.count({
      where: { userId: studentA.id },
    });
    expect(initialCardsCount).toBe(countFirst);

    // Second enqueue (idempotent re-run)
    const countSecond = await srsService.enqueueLessonVocabulary(studentA.id, seededLessonId);
    expect(countSecond).toBe(0); // 0 new cards created

    const finalCardsCount = await prisma.reviewCard.count({
      where: { userId: studentA.id },
    });
    expect(finalCardsCount).toBe(initialCardsCount);
  });

  it("retrieves due cards for student in Asia/Ho_Chi_Minh local day", async () => {
    await srsService.enqueueLessonVocabulary(studentA.id, seededLessonId);

    const dueCards = await srsService.getDueCardsForStudent(studentA.id);
    expect(dueCards.length).toBeGreaterThan(0);

    const first = dueCards[0];
    expect(first.hangul).toBeDefined();
    expect(first.vietnameseMeaning).toBeDefined();
    expect(first.romanization).toBeDefined();
    expect(first.state).toBe(CardState.NEW);
  });

  it("submits card review and records ReviewLog and DailyStudyStat", async () => {
    await srsService.enqueueLessonVocabulary(studentA.id, seededLessonId);
    const dueCards = await srsService.getDueCardsForStudent(studentA.id);
    const targetCard = dueCards[0];

    const submission = await srsService.submitCardReview({
      userId: studentA.id,
      cardId: targetCard.id,
      rating: ReviewRating.GOOD,
    });

    expect(submission.cardId).toBe(targetCard.id);
    expect(submission.rating).toBe(ReviewRating.GOOD);
    expect(submission.nextIntervalDays).toBe(1);
    expect(submission.nextRepetitions).toBe(1);
    expect(submission.nextState).toBe(CardState.REVIEW);

    // Verify stored in DB
    const updatedDbCard = await prisma.reviewCard.findUnique({
      where: { id: targetCard.id },
    });
    expect(updatedDbCard?.state).toBe(CardState.REVIEW);
    expect(updatedDbCard?.intervalDays).toBe(1);

    // Verify ReviewLog created
    const log = await prisma.reviewLog.findFirst({
      where: { cardId: targetCard.id },
    });
    expect(log).not.toBeNull();
    expect(log?.rating).toBe(ReviewRating.GOOD);

    // Verify DailyStudyStat incremented
    const todayStr = getVietnamDateString();
    const stat = await prisma.dailyStudyStat.findUnique({
      where: {
        userId_date: {
          userId: studentA.id,
          date: todayStr,
        },
      },
    });
    expect(stat?.reviewsCompleted).toBeGreaterThanOrEqual(1);
  });

  it("handles duplicate network submissions idempotently via idempotencyKey", async () => {
    await srsService.enqueueLessonVocabulary(studentA.id, seededLessonId);
    const dueCards = await srsService.getDueCardsForStudent(studentA.id);
    const targetCard = dueCards[0];

    const idempotencyKey = `srs-idem-${Date.now()}`;

    // First request
    const firstRes = await srsService.submitCardReview({
      userId: studentA.id,
      cardId: targetCard.id,
      rating: ReviewRating.EASY,
      idempotencyKey,
    });

    // Duplicate request with same idempotencyKey
    const secondRes = await srsService.submitCardReview({
      userId: studentA.id,
      cardId: targetCard.id,
      rating: ReviewRating.EASY,
      idempotencyKey,
    });

    expect(secondRes.cardId).toBe(firstRes.cardId);
    expect(secondRes.nextIntervalDays).toBe(firstRes.nextIntervalDays);

    // Ensure only ONE log exists for this key
    const logCount = await prisma.reviewLog.count({
      where: { idempotencyKey },
    });
    expect(logCount).toBe(1);
  });

  it("strictly prevents modifying another student's review cards (user isolation)", async () => {
    await srsService.enqueueLessonVocabulary(studentA.id, seededLessonId);
    const dueCardsA = await srsService.getDueCardsForStudent(studentA.id);
    const cardOfA = dueCardsA[0];

    // Student B attempts to review Student A's card
    await expect(
      srsService.submitCardReview({
        userId: studentB.id,
        cardId: cardOfA.id,
        rating: ReviewRating.GOOD,
      })
    ).rejects.toThrow(ForbiddenError);
  });
});
