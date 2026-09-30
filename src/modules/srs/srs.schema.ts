import { z } from "zod";
import { ReviewRating } from "@prisma/client";

export const SubmitCardReviewSchema = z.object({
  cardId: z.string().uuid("ID thẻ ôn tập không hợp lệ."),
  rating: z.nativeEnum(ReviewRating, {
    message: "Đánh giá không hợp lệ. Chỉ chấp nhận: AGAIN, HARD, GOOD, EASY.",
  }),
  idempotencyKey: z.string().optional(),
});

export type SubmitCardReviewInput = z.infer<typeof SubmitCardReviewSchema>;
