import { expect, type Page } from "@playwright/test";

export async function enrollInSeedCourse(page: Page) {
  const response = await page.request.post("/api/courses/c0000000-0000-4000-a000-000000000001/enroll");
  expect(response.status()).toBe(200);
}

export const firstSeedAnswers = [
  { questionId: "q0000000-0000-4000-a000-000000000001", selectedOptionId: "o0000000-0000-4000-a000-000000000001" },
  { questionId: "q0000000-0000-4000-a000-000000000002", selectedOptionId: "o0000000-0000-4000-a000-000000000005" },
  { questionId: "q0000000-0000-4000-a000-000000000003", textAnswer: "유" },
  { questionId: "q0000000-0000-4000-a000-000000000004", selectedOptionId: "o0000000-0000-4000-a000-000000000009" },
];

export async function passFirstSeedExercise(page: Page) {
  const response = await page.request.post("/api/exercises/e0000000-0000-4000-a000-000000000001/submit", {
    data: {
      answers: firstSeedAnswers,
    },
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).data.isPassing).toBe(true);
}
