"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ContentStatus, QuestionType } from "@prisma/client";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { AudioUrlSchema, ExerciseFormSchema, QuestionFormSchema } from "@/modules/admin/admin.schema";

export interface QuestionOptionItem {
  id?: string;
  text: string;
  isCorrect: boolean;
  explanation?: string | null;
  displayOrder: number;
}

export interface QuestionItem {
  id: string;
  exerciseId: string;
  type: QuestionType;
  prompt: string;
  audioUrl: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  displayOrder: number;
  options: QuestionOptionItem[];
  _count?: {
    attemptAnswers: number;
  };
}

export interface ExerciseItem {
  id: string;
  lessonId: string;
  title: string;
  description: string | null;
  status: ContentStatus;
  displayOrder: number;
  questions: QuestionItem[];
  _count?: {
    attempts: number;
  };
}

export function LessonExerciseEditor({
  lessonId,
  initialExercises,
}: {
  lessonId: string;
  initialExercises: ExerciseItem[];
}) {
  const router = useRouter();
  const [exercises, setExercises] = useState<ExerciseItem[]>(initialExercises);

  // Exercise Create / Edit Modal
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseItem | null>(null);
  const [exerciseFormData, setExerciseFormData] = useState<{
    title: string;
    description: string;
    status: ContentStatus;
  }>({
    title: "",
    description: "",
    status: ContentStatus.PUBLISHED,
  });
  const [exerciseFormError, setExerciseFormError] = useState<string | null>(null);

  // Question Create / Edit Modal
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [targetExerciseId, setTargetExerciseId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [questionFormData, setQuestionFormData] = useState<{
    type: QuestionType;
    prompt: string;
    audioUrl: string;
    correctAnswer: string;
    explanation: string;
    options: { text: string; isCorrect: boolean; displayOrder: number }[];
  }>({
    type: QuestionType.MULTIPLE_CHOICE,
    prompt: "",
    audioUrl: "",
    correctAnswer: "",
    explanation: "",
    options: [
      { text: "", isCorrect: true, displayOrder: 0 },
      { text: "", isCorrect: false, displayOrder: 1 },
      { text: "", isCorrect: false, displayOrder: 2 },
      { text: "", isCorrect: false, displayOrder: 3 },
    ],
  });
  const [questionFormError, setQuestionFormError] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "exercise" | "question";
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refreshExercises = async () => {
    const res = await fetch(`/api/admin/lessons/${lessonId}/exercises`);
    const data = await res.json();
    if (data.success) {
      setExercises(data.data);
    }
    router.refresh();
  };

  // EXERCISE HANDLERS
  const openCreateExercise = () => {
    setEditingExercise(null);
    setExerciseFormData({
      title: "Bài tập củng cố",
      description: "Luyện tập để ghi nhớ nội dung vừa học",
      status: ContentStatus.PUBLISHED,
    });
    setExerciseFormError(null);
    setIsExerciseModalOpen(true);
  };

  const openEditExercise = (ex: ExerciseItem) => {
    setEditingExercise(ex);
    setExerciseFormData({
      title: ex.title,
      description: ex.description || "",
      status: ex.status,
    });
    setExerciseFormError(null);
    setIsExerciseModalOpen(true);
  };

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    setExerciseFormError(null);

    const parseResult = ExerciseFormSchema.safeParse({
      ...exerciseFormData,
      lessonId,
    });

    if (!parseResult.success) {
      setExerciseFormError(parseResult.error.issues[0]?.message || "Dữ liệu bài tập không hợp lệ.");
      return;
    }

    try {
      const url = editingExercise
        ? `/api/admin/exercises/${editingExercise.id}`
        : `/api/admin/lessons/${lessonId}/exercises`;
      const method = editingExercise ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseResult.data),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi lưu bài tập.");
      }

      setIsExerciseModalOpen(false);
      await refreshExercises();
    } catch (err: unknown) {
      setExerciseFormError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  };

  // QUESTION HANDLERS
  const openCreateQuestion = (exerciseId: string) => {
    setTargetExerciseId(exerciseId);
    setEditingQuestion(null);
    setQuestionFormData({
      type: QuestionType.MULTIPLE_CHOICE,
      prompt: "",
      audioUrl: "",
      correctAnswer: "",
      explanation: "",
      options: [
        { text: "", isCorrect: true, displayOrder: 0 },
        { text: "", isCorrect: false, displayOrder: 1 },
        { text: "", isCorrect: false, displayOrder: 2 },
        { text: "", isCorrect: false, displayOrder: 3 },
      ],
    });
    setQuestionFormError(null);
    setIsQuestionModalOpen(true);
  };

  const openEditQuestion = (q: QuestionItem) => {
    setTargetExerciseId(q.exerciseId);
    setEditingQuestion(q);
    setQuestionFormData({
      type: q.type,
      prompt: q.prompt,
      audioUrl: q.audioUrl || "",
      correctAnswer: q.correctAnswer || "",
      explanation: q.explanation || "",
      options:
        q.options.length > 0
          ? q.options.map((o) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              displayOrder: o.displayOrder,
            }))
          : [
              { text: "", isCorrect: true, displayOrder: 0 },
              { text: "", isCorrect: false, displayOrder: 1 },
            ],
    });
    setQuestionFormError(null);
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuestionFormError(null);

    const payload = {
      exerciseId: targetExerciseId,
      type: questionFormData.type,
      prompt: questionFormData.prompt,
      audioUrl: questionFormData.audioUrl.trim() || null,
      correctAnswer: questionFormData.correctAnswer.trim() || null,
      explanation: questionFormData.explanation.trim() || null,
      options:
        questionFormData.type === QuestionType.MULTIPLE_CHOICE ||
        questionFormData.type === QuestionType.LISTENING_CHOICE
          ? questionFormData.options.filter((o) => o.text.trim().length > 0)
          : [],
    };

    const parseResult = QuestionFormSchema.safeParse(payload);
    if (!parseResult.success) {
      setQuestionFormError(
        parseResult.error.issues[0]?.message || "Dữ liệu câu hỏi không hợp lệ."
      );
      return;
    }

    try {
      const url = editingQuestion
        ? `/api/admin/questions/${editingQuestion.id}`
        : `/api/admin/exercises/${targetExerciseId}/questions`;
      const method = editingQuestion ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseResult.data),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi lưu câu hỏi.");
      }

      setIsQuestionModalOpen(false);
      await refreshExercises();
    } catch (err: unknown) {
      setQuestionFormError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  };

  const handleReorderQuestion = async (
    questionId: string,
    direction: "UP" | "DOWN"
  ) => {
    try {
      const res = await fetch(`/api/admin/questions/${questionId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refreshExercises();
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const url =
        deleteTarget.type === "exercise"
          ? `/api/admin/exercises/${deleteTarget.id}`
          : `/api/admin/questions/${deleteTarget.id}`;

      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi xóa đối tượng.");
      }

      setDeleteTarget(null);
      await refreshExercises();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white">4. Bài tập & Câu hỏi chấm điểm ({exercises.length})</h3>
          <p className="text-xs text-slate-400">
            Học viên làm bài tập và nhận kết quả chấm điểm nghiêm ngặt từ máy chủ (Server-Side Grading)
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateExercise}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          + Thêm bài tập
        </button>
      </div>

      <div className="space-y-6">
        {exercises.map((ex) => (
          <div
            key={ex.id}
            className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4"
          >
            {/* Exercise Header */}
            <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap pb-3 border-b border-slate-800/80">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-sm">{ex.title}</h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      ex.status === ContentStatus.PUBLISHED
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                        : "bg-amber-950/80 text-amber-300 border-amber-700/60"
                    }`}
                  >
                    {ex.status === ContentStatus.PUBLISHED ? "Đã công khai" : "Nháp"}
                  </span>
                </div>
                {ex.description && (
                  <p className="text-xs text-slate-400">{ex.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openCreateQuestion(ex.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 cursor-pointer"
                >
                  + Thêm câu hỏi
                </button>
                <button
                  type="button"
                  onClick={() => openEditExercise(ex)}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget({
                      type: "exercise",
                      id: ex.id,
                      name: ex.title,
                    });
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-rose-950/30 hover:bg-rose-950/60 text-rose-400 border border-rose-800/40 cursor-pointer"
                >
                  Xóa
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">
                  Danh sách câu hỏi ({ex.questions.length}):
                </span>
              </div>

              {ex.questions.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start sm:items-center justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-center gap-3">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={qIdx === 0}
                        onClick={() => handleReorderQuestion(q.id, "UP")}
                        className="p-0.5 rounded bg-slate-800 text-slate-300 text-[10px] disabled:opacity-20 cursor-pointer"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={qIdx === ex.questions.length - 1}
                        onClick={() => handleReorderQuestion(q.id, "DOWN")}
                        className="p-0.5 rounded bg-slate-800 text-slate-300 text-[10px] disabled:opacity-20 cursor-pointer"
                      >
                        ▼
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">
                          {q.type}
                        </span>
                        <span className="text-xs font-bold text-white">Câu #{qIdx + 1}</span>
                      </div>
                      <p className="text-xs text-slate-200">{q.prompt}</p>
                      {q.options && q.options.length > 0 && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                          <span>Đáp án đúng:</span>
                          {q.options
                            .filter((o) => o.isCorrect)
                            .map((o, idx) => (
                              <span
                                key={idx}
                                className="text-emerald-300 font-semibold px-1.5 py-0.5 bg-emerald-950/60 rounded border border-emerald-800/40"
                              >
                                ✔ {o.text}
                              </span>
                            ))}
                        </div>
                      )}
                      {q.correctAnswer && (
                        <div className="text-[11px] text-emerald-300 font-mono">
                          ✔ Đáp án chuẩn: {q.correctAnswer}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditQuestion(q)}
                      className="px-2 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget({
                          type: "question",
                          id: q.id,
                          name: `Câu #${qIdx + 1}: ${q.prompt}`,
                        });
                      }}
                      className="px-2 py-1 rounded text-xs bg-rose-950/30 hover:bg-rose-950/60 text-rose-400 border border-rose-800/40 cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}

              {ex.questions.length === 0 && (
                <div className="p-4 text-center rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-500">
                  Chưa có câu hỏi nào trong bài tập này. Nhấn &quot;+ Thêm câu hỏi&quot; để tạo.
                </div>
              )}
            </div>
          </div>
        ))}

        {exercises.length === 0 && (
          <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs text-slate-500">
            Chưa có bài tập nào trong bài học này. Nhấn &quot;+ Thêm bài tập&quot; để tạo.
          </div>
        )}
      </div>

      {/* Exercise Modal */}
      {isExerciseModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 text-left">
            <h3 className="text-lg font-bold text-white">
              {editingExercise ? "Chỉnh sửa Bài tập" : "Thêm Bài tập mới"}
            </h3>

            {exerciseFormError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
                ⚠️ {exerciseFormError}
              </div>
            )}

            <form onSubmit={handleSaveExercise} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Tiêu đề bài tập <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={exerciseFormData.title}
                  onChange={(e) =>
                    setExerciseFormData({ ...exerciseFormData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Mô tả bài tập</label>
                <textarea
                  rows={2}
                  value={exerciseFormData.description}
                  onChange={(e) =>
                    setExerciseFormData({ ...exerciseFormData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Trạng thái</label>
                <select
                  value={exerciseFormData.status}
                  onChange={(e) =>
                    setExerciseFormData({
                      ...exerciseFormData,
                      status: e.target.value as ContentStatus,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={ContentStatus.PUBLISHED}>Đã xuất bản (PUBLISHED)</option>
                  <option value={ContentStatus.DRAFT}>Bản nháp (DRAFT)</option>
                  <option value={ContentStatus.ARCHIVED}>Lưu trữ (ARCHIVED)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExerciseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Lưu bài tập
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {isQuestionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="max-w-xl w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 text-left max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">
              {editingQuestion ? "Chỉnh sửa Câu hỏi" : "Thêm Câu hỏi mới"}
            </h3>

            {questionFormError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
                ⚠️ {questionFormError}
              </div>
            )}

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Loại câu hỏi</label>
                  <select
                    value={questionFormData.type}
                    onChange={(e) =>
                      setQuestionFormData({
                        ...questionFormData,
                        type: e.target.value as QuestionType,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value={QuestionType.MULTIPLE_CHOICE}>MULTIPLE_CHOICE (Trắc nghiệm)</option>
                    <option value={QuestionType.FILL_BLANK}>FILL_BLANK (Điền từ vào chỗ trống)</option>
                    <option value={QuestionType.ARRANGE_SENTENCE}>ARRANGE_SENTENCE (Sắp xếp từ ghép câu)</option>
                    <option value={QuestionType.LISTENING_CHOICE}>LISTENING_CHOICE (Nghe chọn đáp án)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Audio URL (nếu có)</label>
                  <input
                    type="text"
                    value={questionFormData.audioUrl}
                    onChange={(e) =>
                      setQuestionFormData({ ...questionFormData, audioUrl: e.target.value })
                    }
                    placeholder="/audio/exercise/q1.mp3"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
                  />
                  {questionFormData.audioUrl.trim() && AudioUrlSchema.safeParse(questionFormData.audioUrl.trim()).success && (
                    <audio aria-label="Nghe thử âm thanh câu hỏi" controls preload="none" src={questionFormData.audioUrl.trim()} className="w-full max-w-sm" />
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Đề bài câu hỏi <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={2}
                  value={questionFormData.prompt}
                  onChange={(e) =>
                    setQuestionFormData({ ...questionFormData, prompt: e.target.value })
                  }
                  placeholder="Ví dụ: Chọn nguyên âm phát âm là 'a' trong tiếng Hàn"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Options for MULTIPLE_CHOICE and LISTENING_CHOICE */}
              {(questionFormData.type === QuestionType.MULTIPLE_CHOICE ||
                questionFormData.type === QuestionType.LISTENING_CHOICE) && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-semibold">Các đáp án lựa chọn (chọn đáp án đúng):</span>
                  </div>

                  {questionFormData.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct-option"
                        checked={opt.isCorrect}
                        onChange={() => {
                          const updated = questionFormData.options.map((o, i) => ({
                            ...o,
                            isCorrect: i === idx,
                          }));
                          setQuestionFormData({ ...questionFormData, options: updated });
                        }}
                        className="w-4 h-4 text-emerald-500 cursor-pointer"
                        title="Đánh dấu đáp án này là đúng"
                      />
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...questionFormData.options];
                          updated[idx] = { ...updated[idx], text: e.target.value };
                          setQuestionFormData({ ...questionFormData, options: updated });
                        }}
                        placeholder={`Lựa chọn ${idx + 1}`}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Correct Answer input for FILL_BLANK & ARRANGE_SENTENCE */}
              {(questionFormData.type === QuestionType.FILL_BLANK ||
                questionFormData.type === QuestionType.ARRANGE_SENTENCE) && (
                <div className="space-y-1 pt-2 border-t border-slate-800">
                  <label className="block text-xs font-semibold text-emerald-300">
                    Đáp án chuẩn máy chủ chấm <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={questionFormData.correctAnswer}
                    onChange={(e) =>
                      setQuestionFormData({ ...questionFormData, correctAnswer: e.target.value })
                    }
                    placeholder="Ví dụ: 사과 hoặc 저는 학생입니다"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-800/60 font-mono text-xs text-emerald-300 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Hệ thống sẽ giữ bí mật đáp án này và chỉ chấm điểm trên máy chủ.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Giải thích đáp án (hiển thị sau khi học viên nộp bài)
                </label>
                <textarea
                  rows={2}
                  value={questionFormData.explanation}
                  onChange={(e) =>
                    setQuestionFormData({ ...questionFormData, explanation: e.target.value })
                  }
                  placeholder="Giải thích chi tiết vì sao đáp án này đúng..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Lưu câu hỏi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmDialog
          isOpen={Boolean(deleteTarget)}
          title={`Xác nhận xóa ${deleteTarget.type === "exercise" ? "bài tập" : "câu hỏi"}?`}
          description={`Theo quy tắc an toàn, hệ thống sẽ từ chối xóa nếu đã có học viên nộp bài làm cho ${
            deleteTarget.type === "exercise" ? "bài tập" : "câu hỏi"
          } này.`}
          itemName={deleteTarget.name}
          isDeleting={isDeleting}
          errorMessage={deleteError}
          onConfirm={handleDelete}
          onCancel={() => {
            if (!isDeleting) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
        />
      )}
    </div>
  );
}
