"use client";

import type { SanitizedQuestion } from "@/modules/exercises/exercise.service";

export interface QuestionAnswerState {
  selectedOptionId?: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
}

function matchingValues(answer: QuestionAnswerState): Record<string, string> {
  try {
    const value = JSON.parse(answer.textAnswer ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function isQuestionAnswered(question: SanitizedQuestion, answer?: QuestionAnswerState) {
  if (!answer) return false;
  if (question.type === "MATCHING") {
    const values = matchingValues(answer);
    return question.content?.leftItems?.every((item) => !!values[item.id]) ?? false;
  }
  if (question.type === "ORDERING") {
    return answer.selectedOptionIds?.length === question.content?.items?.length;
  }
  return !!(answer.selectedOptionId || answer.selectedOptionIds?.length || answer.textAnswer?.trim());
}

export function StructuredQuestionInput({
  question,
  answer,
  onChange,
}: {
  question: SanitizedQuestion;
  answer: QuestionAnswerState;
  onChange: (answer: QuestionAnswerState) => void;
}) {
  switch (question.type) {
    case "TRUE_FALSE": {
      const options = [
        { value: "true", label: "Đúng", description: "Khẳng định trên là chính xác" },
        { value: "false", label: "Sai", description: "Khẳng định trên là không chính xác" },
      ] as const;

      return (
        <div className="space-y-4 pt-2">
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
            role="radiogroup"
            aria-label="Chọn Đúng hoặc Sai"
          >
            {options.map(({ value, label, description }) => {
              const isSelected = answer.textAnswer === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onChange({ textAnswer: value })}
                  className={`p-4 sm:p-5 rounded-2xl text-left border transition-all flex items-center justify-between cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${
                    isSelected
                      ? "bg-indigo-600/20 border-indigo-500 text-white font-bold ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-600/15"
                      : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60 hover:text-white"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-base sm:text-lg font-bold ${
                          isSelected ? "text-indigo-300" : "text-white"
                        }`}
                      >
                        {label}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-wider">
                          Đang chọn
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-normal">{description}</p>
                  </div>

                  <span
                    className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                      isSelected
                        ? "border-indigo-400 bg-indigo-600 text-white shadow-sm"
                        : "border-slate-700 bg-slate-900 text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Feedback showing current selection status */}
          {answer.textAnswer ? (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-950/30 border border-indigo-900/50 text-xs text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span>
                Bạn đang chọn:{" "}
                <strong className="text-white font-semibold">
                  {answer.textAnswer === "true" ? "Đúng" : "Sai"}
                </strong>
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Nhấp chọn một trong hai phương án &quot;Đúng&quot; hoặc &quot;Sai&quot; ở trên.
            </p>
          )}
        </div>
      );
    }

    case "MULTIPLE_SELECT": {
      const selected = answer.selectedOptionIds ?? [];
      return (
        <div className="space-y-3 pt-2">
          <p className="text-xs text-slate-400">
            Chọn tất cả đáp án đúng ({selected.length}/{question.options.length} đã chọn):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {question.options.map((option) => {
              const isSelected = selected.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-indigo-400 ${
                    isSelected
                      ? "bg-indigo-600/20 border-indigo-500 text-white font-bold ring-1 ring-indigo-500/40 shadow-md shadow-indigo-600/10"
                      : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <span className="text-sm sm:text-base pr-3">{option.text}</span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isSelected}
                    onChange={(event) =>
                      onChange({
                        selectedOptionIds: event.target.checked
                          ? [...selected, option.id]
                          : selected.filter((id) => id !== option.id),
                      })
                    }
                  />
                  <span
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center text-xs shrink-0 transition-all ${
                      isSelected
                        ? "border-indigo-400 bg-indigo-600 text-white"
                        : "border-slate-700 bg-slate-900"
                    }`}
                  >
                    {isSelected ? "✓" : ""}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    case "MATCHING": {
      const values = matchingValues(answer);
      return (
        <div className="space-y-3 pt-2">
          <p className="text-xs text-slate-400">
            Ghép mỗi vế bên trái với một vế tương ứng bên phải:
          </p>
          <div className="space-y-2.5">
            {question.content?.leftItems?.map((left) => {
              const isMatched = Boolean(values[left.id]);
              return (
                <div
                  key={left.id}
                  className={`p-3.5 rounded-2xl border transition-all grid gap-3 sm:grid-cols-2 items-center ${
                    isMatched
                      ? "bg-slate-950/80 border-indigo-500/40"
                      : "bg-slate-950/40 border-slate-800"
                  }`}
                >
                  <span className="text-sm font-semibold text-white pl-1">{left.text}</span>
                  <select
                    aria-label={`Ghép với ${left.text}`}
                    value={values[left.id] ?? ""}
                    className={`w-full rounded-xl border px-3 py-2 text-sm text-white bg-slate-900 focus:border-indigo-500 outline-none transition-all cursor-pointer ${
                      isMatched ? "border-indigo-500/60 text-indigo-200" : "border-slate-700"
                    }`}
                    onChange={(event) =>
                      onChange({
                        textAnswer: JSON.stringify({ ...values, [left.id]: event.target.value }),
                      })
                    }
                  >
                    <option value="">-- Chọn vế phải --</option>
                    {question.content?.rightItems?.map((right) => (
                      <option key={right.id} value={right.id}>
                        {right.text}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case "ORDERING": {
      const items = question.content?.items ?? [];
      const selected = answer.selectedOptionIds ?? [];
      return (
        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-400">
            Chọn các mục theo thứ tự; nhấn mục đã chọn để gỡ.
          </p>
          <div className="flex min-h-16 flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            {selected.length === 0 ? (
              <span className="text-xs text-slate-500 italic flex items-center">
                (Chưa chọn mục nào. Nhấn các mục bên dưới để sắp xếp theo thứ tự)
              </span>
            ) : (
              selected.map((id, idx) => (
                <button
                  key={id}
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-rose-600 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                  onClick={() =>
                    onChange({ selectedOptionIds: selected.filter((value) => value !== id) })
                  }
                  title="Nhấn để gỡ"
                >
                  <span className="w-4 h-4 rounded-full bg-indigo-800 text-[10px] flex items-center justify-center font-mono">
                    {idx + 1}
                  </span>
                  {items.find((item) => item.id === id)?.text} ×
                </button>
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => {
              const isUsed = selected.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isUsed}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                    isUsed
                      ? "opacity-30 border-dashed border-slate-800 bg-transparent text-slate-600 cursor-not-allowed"
                      : "bg-slate-900 border-slate-700 text-white hover:border-indigo-500 hover:bg-slate-800"
                  }`}
                  onClick={() => onChange({ selectedOptionIds: [...selected, item.id] })}
                >
                  {item.text}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    case "TRANSLATION":
      return (
        <div className="space-y-3 pt-2">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <span className="text-xs text-indigo-400 font-semibold block mb-1">Câu gốc:</span>
            <p className="text-base sm:text-lg font-bold text-white">{question.content?.source}</p>
          </div>
          <label className="block text-xs font-semibold text-slate-400">
            Bản dịch của bạn:
            <textarea
              className="w-full mt-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              rows={3}
              placeholder="Nhập bản dịch tiếng Việt của bạn..."
              value={answer.textAnswer ?? ""}
              onChange={(event) => onChange({ textAnswer: event.target.value })}
            />
          </label>
        </div>
      );

    default:
      return null;
  }
}
