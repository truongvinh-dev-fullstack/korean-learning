/**
 * Product-wide date and streak calculation utilities.
 * Default timezone: Asia/Ho_Chi_Minh (UTC+7).
 * Timestamps in DB are stored in UTC; dates are calculated deterministically.
 */

export const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";

/**
 * Returns the calendar date string in YYYY-MM-DD for a given date in Asia/Ho_Chi_Minh.
 */
export function getVietnamDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Returns the preceding calendar day string in YYYY-MM-DD.
 */
export function getPreviousDateString(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export interface StreakCalculationResult {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  studiedToday: boolean;
}

/**
 * Deterministically calculates current and longest study streak given an array
 * of active date strings (YYYY-MM-DD).
 */
export function calculateStreak(
  activeDates: string[],
  referenceDate: Date = new Date()
): StreakCalculationResult {
  const dateSet = new Set(
    activeDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  );

  if (dateSet.size === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      studiedToday: false,
    };
  }

  const todayStr = getVietnamDateString(referenceDate);
  const yesterdayStr = getPreviousDateString(todayStr);

  const studiedToday = dateSet.has(todayStr);
  const studiedYesterday = dateSet.has(yesterdayStr);

  // 1. Calculate currentStreak
  let currentStreak = 0;
  if (studiedToday || studiedYesterday) {
    let checkDate = studiedToday ? todayStr : yesterdayStr;
    while (dateSet.has(checkDate)) {
      currentStreak += 1;
      checkDate = getPreviousDateString(checkDate);
    }
  }

  // 2. Calculate longestStreak across all historical dates
  const sortedDates = Array.from(dateSet).sort();
  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = sortedDates[i - 1];
    const curr = sortedDates[i];

    if (getPreviousDateString(curr) === prev) {
      currentRun += 1;
    } else {
      currentRun = 1;
    }

    if (currentRun > longestStreak) {
      longestStreak = currentRun;
    }
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  // Last active date is the most recent date in sorted array
  const lastActiveDate = sortedDates[sortedDates.length - 1];

  return {
    currentStreak,
    longestStreak,
    lastActiveDate,
    studiedToday,
  };
}

/**
 * Returns the UTC Date representing the end of the local day (23:59:59.999)
 * for a given timestamp in Asia/Ho_Chi_Minh (UTC+7).
 */
export function getVietnamEndOfDayUtc(date: Date = new Date()): Date {
  const dateStr = getVietnamDateString(date);
  const [year, month, day] = dateStr.split("-").map(Number);
  // 23:59:59.999 in VN (UTC+7) corresponds to 16:59:59.999 UTC of the same date
  return new Date(Date.UTC(year, month - 1, day, 16, 59, 59, 999));
}

/**
 * Returns the UTC Date representing the start of the local day (00:00:00.000)
 * for a given timestamp in Asia/Ho_Chi_Minh (UTC+7).
 */
export function getVietnamStartOfDayUtc(date: Date = new Date()): Date {
  const dateStr = getVietnamDateString(date);
  const [year, month, day] = dateStr.split("-").map(Number);
  // 00:00:00.000 in VN (UTC+7) corresponds to 17:00:00.000 UTC of previous date
  return new Date(Date.UTC(year, month - 1, day - 1, 17, 0, 0, 0));
}

