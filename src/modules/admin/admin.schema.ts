import { z } from "zod";
import { ContentStatus, BlockType, QuestionType } from "@prisma/client";
import { LessonBlockDiscriminatedSchema } from "@/modules/lessons/lesson-block.schema";
import { canConstructArrangement } from "@/modules/exercises/arrangement";
import { parseQuestionContent, QuestionVariantSchema } from "@/modules/exercises/question.schema";
export { AudioUrlSchema } from "@/shared/validation/audio-url";
import { AudioUrlSchema } from "@/shared/validation/audio-url";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// 1. Course Schema
export const CourseFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Tiêu đề khóa học không được để trống")
    .max(200, "Tiêu đề khóa học tối đa 200 ký tự"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug không được để trống")
    .max(100, "Slug tối đa 100 ký tự")
    .regex(
      SLUG_REGEX,
      "Slug chỉ được chứa chữ cái thường không dấu, số và dấu gạch ngang (ví dụ: tieng-han-so-cap-1)"
    ),
  description: z
    .string()
    .trim()
    .min(1, "Mô tả khóa học không được để trống"),
  level: z
    .string()
    .trim()
    .min(1, "Cấp độ không được để trống")
    .optional(),
  status: z.nativeEnum(ContentStatus, {
    message: "Trạng thái xuất bản không hợp lệ",
  }).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});
export type CourseFormData = z.infer<typeof CourseFormSchema>;

// 2. Chapter Schema
export const ChapterFormSchema = z.object({
  courseId: z.string().min(1, "Khóa học không hợp lệ"),
  title: z
    .string()
    .trim()
    .min(1, "Tiêu đề chương không được để trống")
    .max(200, "Tiêu đề chương tối đa 200 ký tự"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug không được để trống")
    .max(100, "Slug tối đa 100 ký tự")
    .regex(
      SLUG_REGEX,
      "Slug chỉ được chứa chữ cái thường không dấu, số và dấu gạch ngang (ví dụ: chuong-1-bang-chu-cai)"
    ),
  description: z.string().trim().optional().nullable(),
  status: z.nativeEnum(ContentStatus).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});
export type ChapterFormData = z.infer<typeof ChapterFormSchema>;

// 3. Lesson Schema
export const LessonFormSchema = z.object({
  chapterId: z.string().min(1, "Chương học không hợp lệ"),
  title: z
    .string()
    .trim()
    .min(1, "Tiêu đề bài học không được để trống")
    .max(200, "Tiêu đề bài học tối đa 200 ký tự"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug không được để trống")
    .max(100, "Slug tối đa 100 ký tự")
    .regex(
      SLUG_REGEX,
      "Slug chỉ được chứa chữ cái thường không dấu, số và dấu gạch ngang (ví dụ: bai-1-nguyen-am-co-ban)"
    ),
  summary: z.string().trim().optional().nullable(),
  level: z.string().trim().max(100).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  learningObjectives: z.array(z.string().trim().min(1, "Mục tiêu không được để trống").max(500)).max(100).optional(),
  estimatedMinutes: z.coerce
    .number()
    .int("Thời gian học phải là số nguyên")
    .min(0, "Thời lượng không được âm")
    .max(180, "Thời lượng ước tính tối đa 180 phút")
    .optional(),
  status: z.nativeEnum(ContentStatus).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});
export type LessonFormData = z.infer<typeof LessonFormSchema>;

// 4. Lesson Block Schema
export const LessonBlockFieldsSchema = z.object({
  lessonId: z.string().min(1, "Bài học không hợp lệ"),
  type: z.nativeEnum(BlockType, {
    message: "Loại khối nội dung không hợp lệ",
  }),
  displayOrder: z.coerce.number().int().min(0).optional(),
  content: z.unknown(),
});
export const LessonBlockPatchSchema = LessonBlockFieldsSchema.partial();
export const LessonBlockFormSchema = z.object({
  lessonId: z.string().min(1, "Bài học không hợp lệ"),
  displayOrder: z.coerce.number().int().min(0).optional(),
}).and(LessonBlockDiscriminatedSchema);
export type LessonBlockFormData = z.infer<typeof LessonBlockFormSchema>;

// 5. Vocabulary Schema
export const VocabularyFormSchema = z.object({
  lessonId: z.string().min(1, "Bài học không hợp lệ"),
  hangul: z
    .string()
    .trim()
    .min(1, "Từ tiếng Hàn (Hangeul) không được để trống")
    .max(100, "Từ tiếng Hàn tối đa 100 ký tự"),
  romanization: z
    .string()
    .trim()
    .min(1, "Phiên âm Romanization không được để trống")
    .max(100, "Phiên âm tối đa 100 ký tự"),
  vietnameseMeaning: z
    .string()
    .trim()
    .min(1, "Nghĩa tiếng Việt không được để trống")
    .max(200, "Nghĩa tiếng Việt tối đa 200 ký tự"),
  englishMeaning: z
    .string()
    .trim()
    .max(200, "Nghĩa tiếng Anh tối đa 200 ký tự")
    .optional()
    .nullable(),
  partOfSpeech: z.string().trim().max(50).optional().nullable(),
  audioUrl: AudioUrlSchema.optional().nullable(),
  exampleSentenceHangul: z.string().trim().max(500).optional().nullable(),
  exampleSentenceVi: z.string().trim().max(500).optional().nullable(),
  difficulty: z.number().int().min(1).max(5).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});
export type VocabularyFormData = z.infer<typeof VocabularyFormSchema>;

// 6. Exercise Schema
export const ExerciseFormSchema = z.object({
  lessonId: z.string().min(1, "Bài học không hợp lệ"),
  title: z
    .string()
    .trim()
    .min(1, "Tiêu đề bài tập không được để trống")
    .max(200, "Tiêu đề bài tập tối đa 200 ký tự"),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.nativeEnum(ContentStatus).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});
export type ExerciseFormData = z.infer<typeof ExerciseFormSchema>;

// 7. Question & Options Schema
export const QuestionOptionSchema = z.object({
  id: z.string().optional(),
  text: z.string().trim().min(1, "Nội dung đáp án không được để trống"),
  isCorrect: z.boolean().default(false),
  explanation: z.string().trim().optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});
export type QuestionOptionData = z.infer<typeof QuestionOptionSchema>;

const QuestionFormFieldsSchema = z.object({
  exerciseId: z.string().min(1, "Bài tập không hợp lệ"),
  type: z.nativeEnum(QuestionType, {
    message: "Loại câu hỏi không hợp lệ",
  }),
  prompt: z
    .string()
    .trim()
    .min(1, "Đề bài câu hỏi không được để trống"),
  audioUrl: AudioUrlSchema.optional().nullable(),
  correctAnswer: z.string().trim().optional().nullable(),
  content: z.unknown().optional(),
  explanation: z.string().trim().optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  options: z.array(QuestionOptionSchema).default([]),
});

export const QuestionPatchSchema = QuestionFormFieldsSchema.omit({ options: true })
  .partial()
  .extend({ options: z.array(QuestionOptionSchema).optional() });
export type QuestionPatchData = z.infer<typeof QuestionPatchSchema>;

export const QuestionFormSchema = QuestionFormFieldsSchema.superRefine((data, ctx) => {
  if (data.type === QuestionType.MULTIPLE_CHOICE || data.type === QuestionType.LISTENING_CHOICE || data.type === QuestionType.MULTIPLE_SELECT) {
    if (data.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Câu hỏi cần ít nhất 2 đáp án lựa chọn",
        path: ["options"],
      });
    }
    const correctCount = data.options.filter((option) => option.isCorrect).length;
    if (data.type === QuestionType.MULTIPLE_SELECT ? correctCount < 1 : correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: data.type === QuestionType.MULTIPLE_SELECT ? "Chọn ít nhất 1 đáp án đúng" : "Câu hỏi trắc nghiệm phải có đúng 1 đáp án chính xác",
        path: ["options"],
      });
    }
  } else if (data.type === QuestionType.ARRANGE_SENTENCE) {
    if (!data.correctAnswer || data.correctAnswer.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phải nhập đáp án đúng chuẩn cho dạng câu hỏi này",
        path: ["correctAnswer"],
      });
    }
    if (data.type === QuestionType.ARRANGE_SENTENCE && !canConstructArrangement(data.correctAnswer ?? "", data.options.map((o) => o.text))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cần có các thẻ từ để ghép được đáp án chuẩn, kể cả số lần lặp lại của mỗi từ.",
        path: ["options"],
      });
    }
  }
  if (data.type === QuestionType.LISTENING_CHOICE && !data.audioUrl) {
    ctx.addIssue({ code: "custom", message: "Câu hỏi nghe cần đường dẫn âm thanh", path: ["audioUrl"] });
  }
  try { parseQuestionContent(data.type, data.content, data.correctAnswer); }
  catch (error) {
    if (error instanceof z.ZodError) error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ["content", ...issue.path] }));
  }
}).transform((data) => ({ ...data, ...QuestionVariantSchema.parse({ type: data.type, content: parseQuestionContent(data.type, data.content, data.correctAnswer) }) }));
export type QuestionFormData = z.infer<typeof QuestionFormSchema>;

// 8. Reorder Schema
export const ReorderSchema = z.object({
  direction: z.enum(["UP", "DOWN"], {
    message: "Hướng di chuyển phải là UP hoặc DOWN",
  }),
});
export type ReorderData = z.infer<typeof ReorderSchema>;
