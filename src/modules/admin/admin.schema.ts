import { z } from "zod";
import { ContentStatus, BlockType, QuestionType } from "@prisma/client";
import { LessonBlockContentMap } from "@/modules/lessons/lesson-block.schema";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AUDIO_REGEX = /^(\/[a-zA-Z0-9_\-./]+|https?:\/\/[a-zA-Z0-9_\-./:]+)$/;

export const AudioUrlSchema = z
  .string()
  .trim()
  .refine(
    (val) => !val || AUDIO_REGEX.test(val),
    "Đường dẫn âm thanh phải là đường dẫn nội bộ (bắt đầu bằng '/') hoặc URL hợp lệ (bắt đầu bằng 'http://' hoặc 'https://'). Không hỗ trợ tải file trực tiếp."
  );

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
  estimatedMinutes: z.coerce
    .number()
    .int("Thời gian học phải là số nguyên")
    .min(1, "Thời lượng ước tính tối thiểu 1 phút")
    .max(180, "Thời lượng ước tính tối đa 180 phút")
    .optional(),
  status: z.nativeEnum(ContentStatus).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});
export type LessonFormData = z.infer<typeof LessonFormSchema>;

// 4. Lesson Block Schema
export const LessonBlockFormSchema = z.object({
  lessonId: z.string().min(1, "Bài học không hợp lệ"),
  type: z.nativeEnum(BlockType, {
    message: "Loại khối nội dung không hợp lệ",
  }),
  displayOrder: z.coerce.number().int().min(0).optional(),
  content: z.unknown(),
}).superRefine((data, ctx) => {
  const schema = LessonBlockContentMap[data.type as keyof typeof LessonBlockContentMap];
  if (!schema) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Loại khối nội dung "${data.type}" không được hỗ trợ`,
      path: ["type"],
    });
    return;
  }
  const result = schema.safeParse(data.content);
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      ctx.addIssue({
        ...issue,
        path: ["content", ...issue.path],
      });
    });
  }
});
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
  explanation: z.string().trim().optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  options: z.array(QuestionOptionSchema).default([]),
});

export const QuestionPatchSchema = QuestionFormFieldsSchema.omit({ options: true })
  .partial()
  .extend({ options: z.array(QuestionOptionSchema).optional() });

export const QuestionFormSchema = QuestionFormFieldsSchema.superRefine((data, ctx) => {
  if (data.type === QuestionType.MULTIPLE_CHOICE || data.type === QuestionType.LISTENING_CHOICE) {
    if (data.options.length !== 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Câu hỏi trắc nghiệm phải có đúng 4 đáp án lựa chọn",
        path: ["options"],
      });
    }
    if (data.options.filter((option) => option.isCorrect).length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Câu hỏi trắc nghiệm phải có đúng 1 đáp án chính xác",
        path: ["options"],
      });
    }
  } else if (data.type === QuestionType.FILL_BLANK || data.type === QuestionType.ARRANGE_SENTENCE) {
    if (!data.correctAnswer || data.correctAnswer.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phải nhập đáp án đúng chuẩn cho dạng câu hỏi này",
        path: ["correctAnswer"],
      });
    }
  }
});
export type QuestionFormData = z.infer<typeof QuestionFormSchema>;

// 8. Reorder Schema
export const ReorderSchema = z.object({
  direction: z.enum(["UP", "DOWN"], {
    message: "Hướng di chuyển phải là UP hoặc DOWN",
  }),
});
export type ReorderData = z.infer<typeof ReorderSchema>;
