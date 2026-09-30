import { CardState, ReviewRating } from "@prisma/client";

export const MIN_EASE_FACTOR = 1.30;
export const DEFAULT_EASE_FACTOR = 2.50;
export const MASTERED_INTERVAL_DAYS = 21;

export interface ReviewCardState {
  state: CardState;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  dueAt: Date;
  lastReviewedAt?: Date | null;
}

export interface NextCardSchedule {
  state: CardState;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  dueAt: Date;
  lastReviewedAt: Date;
}

/**
 * Maps the domain ReviewRating enum to SuperMemo-2 quality score (1 to 4).
 * 1 = Again: Complete recall failure / lapse
 * 2 = Hard: Successful recall with significant hesitation
 * 3 = Good: Standard, smooth recall
 * 4 = Easy: Immediate, effortless recall
 */
export function ratingToQuality(rating: ReviewRating): number {
  switch (rating) {
    case ReviewRating.AGAIN:
      return 1;
    case ReviewRating.HARD:
      return 2;
    case ReviewRating.GOOD:
      return 3;
    case ReviewRating.EASY:
      return 4;
    default:
      return 1;
  }
}

/**
 * Pure SuperMemo-2 (SM-2) inspired scheduling function.
 *
 * Mathematically deterministic and fully isolated with no side effects or external dependencies.
 * Easily tested with arbitrary fixed clock timestamps.
 *
 * Algorithm details:
 * 1. Ease Factor (EF') calculation:
 *    EF' = EF + (0.1 - (4 - q) * (0.08 + (4 - q) * 0.02))
 *    where q in [1, 4]. Clamped to minimum 1.30.
 *
 * 2. Lapses & Repetitions:
 *    - If q = 1 (AGAIN):
 *      repetitions' = 0
 *      lapses' = lapses + 1
 *      interval' = 1 day
 *      state' = LEARNING
 *    - If q >= 2 (HARD, GOOD, EASY):
 *      repetitions' = repetitions + 1
 *      lapses' = lapses (unchanged)
 *      interval':
 *        rep = 0 -> 1 day
 *        rep = 1 -> 3 days
 *        rep >= 2 ->
 *          q = 2 (HARD): round(interval * 1.2)
 *          q = 3 (GOOD): round(interval * EF')
 *          q = 4 (EASY): round(interval * EF' * 1.3)
 *      state':
 *        interval >= 21 days -> MASTERED
 *        else -> REVIEW
 *
 * 3. Next due timestamp:
 *    dueAt' = now + (interval' * 86,400,000 ms) in UTC.
 */
export function calculateNextSchedule(
  current: ReviewCardState,
  rating: ReviewRating,
  now: Date = new Date()
): NextCardSchedule {
  const q = ratingToQuality(rating);
  const currentEf = current.easeFactor || DEFAULT_EASE_FACTOR;

  // 1. Calculate next Ease Factor
  const efDelta = 0.1 - (4 - q) * (0.08 + (4 - q) * 0.02);
  const nextEaseFactor = Math.max(
    MIN_EASE_FACTOR,
    Number((currentEf + efDelta).toFixed(4))
  );

  let nextInterval: number;
  let nextRepetitions: number;
  let nextLapses: number;
  let nextState: CardState;

  if (q === 1) {
    // Card forgotten / Lapse
    nextRepetitions = 0;
    nextLapses = (current.lapses || 0) + 1;
    nextInterval = 1; // Re-test tomorrow (or in next session)
    nextState = CardState.LEARNING;
  } else {
    // Successful recall (Hard, Good, Easy)
    nextLapses = current.lapses || 0;

    if (current.repetitions === 0) {
      nextInterval = 1;
    } else if (current.repetitions === 1) {
      nextInterval = 3;
    } else {
      if (q === 2) {
        // Hard
        nextInterval = Math.max(1, Math.round(current.intervalDays * 1.2));
      } else if (q === 3) {
        // Good
        nextInterval = Math.max(1, Math.round(current.intervalDays * nextEaseFactor));
      } else {
        // Easy (bonus 1.3x multiplier)
        nextInterval = Math.max(
          1,
          Math.round(current.intervalDays * nextEaseFactor * 1.3)
        );
      }
    }

    nextRepetitions = current.repetitions + 1;
    nextState =
      nextInterval >= MASTERED_INTERVAL_DAYS
        ? CardState.MASTERED
        : CardState.REVIEW;
  }

  // Next Due Date (UTC)
  const nextDueAt = new Date(
    now.getTime() + Math.round(nextInterval * 24 * 60 * 60 * 1000)
  );

  return {
    state: nextState,
    intervalDays: nextInterval,
    easeFactor: nextEaseFactor,
    repetitions: nextRepetitions,
    lapses: nextLapses,
    dueAt: nextDueAt,
    lastReviewedAt: now,
  };
}
