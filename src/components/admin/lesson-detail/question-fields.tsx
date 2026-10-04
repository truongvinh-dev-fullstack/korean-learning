"use client";

import type { QuestionFormModel } from "@/modules/admin/lesson-detail.mapper";
import type { FieldErrors } from "@/modules/admin/admin.client";
import type { QuestionOptionData } from "@/modules/admin/admin.schema";
import { Field, AudioField, SelectField, StringListEditor } from "./form-controls";
import { RepeatEditor } from "./repeat-editor";

export function QuestionFields({ form, onChange, errors }: { form: QuestionFormModel; onChange: (form: QuestionFormModel) => void; errors: FieldErrors }) {
  switch (form.type) {
    case "MULTIPLE_CHOICE": case "MULTIPLE_SELECT": case "LISTENING_CHOICE": case "ARRANGE_SENTENCE": return <>
      {form.type === "LISTENING_CHOICE" && <AudioField label="Audio câu hỏi nghe" value={form.audioUrl} path="audioUrl" errors={errors} onChange={(audioUrl) => onChange({ ...form, audioUrl })} />}
      <RepeatEditor<QuestionOptionData> label={form.type === "ARRANGE_SENTENCE" ? "Thẻ từ" : "Lựa chọn"} items={form.options} path="options" errors={errors}
        create={() => ({ text: "", isCorrect: false })} onChange={(options) => onChange({ ...form, options })} render={(option, index, update) => <div className="space-y-2">
          <Field label={form.type === "ARRANGE_SENTENCE" ? `Thẻ từ ${index + 1}` : `Lựa chọn ${index + 1}`} value={option.text} errors={errors} path={`options.${index}.text`} onChange={(text) => update({ ...option, text })} />
          {form.type !== "ARRANGE_SENTENCE" && <label className="flex items-center gap-2 text-sm text-emerald-300"><input
            type={form.type === "MULTIPLE_SELECT" ? "checkbox" : "radio"} name="correct-option" checked={option.isCorrect}
            onChange={(event) => form.type === "MULTIPLE_SELECT" ? update({ ...option, isCorrect: event.target.checked }) : onChange({ ...form, options: form.options.map((item, i) => ({ ...item, isCorrect: i === index })) })} /> Đáp án đúng</label>}
          {option.explanation != null && <Field label="Giải thích lựa chọn" value={option.explanation} onChange={(explanation) => update({ ...option, explanation })} />}
        </div>} />
      {form.type === "ARRANGE_SENTENCE" && <Field label="Đáp án chuẩn" value={form.correctAnswer} errors={errors} path="correctAnswer" onChange={(correctAnswer) => onChange({ ...form, correctAnswer })} />}
    </>;
    case "TRUE_FALSE": return <SelectField label="Đáp án đúng" value={String(form.content.correctAnswer)} onChange={(value) => onChange({ ...form, content: { correctAnswer: value === "true" } })}>
      <option value="true">Đúng</option><option value="false">Sai</option></SelectField>;
    case "FILL_BLANK": return <>
      <StringListEditor label="Đáp án chấp nhận" values={form.content.answers} path="content.answers" errors={errors} onChange={(answers) => onChange({ ...form, content: { ...form.content, answers } })} />
      <label className="text-sm text-slate-300"><input type="checkbox" checked={form.content.caseSensitive} onChange={(event) => onChange({ ...form, content: { ...form.content, caseSensitive: event.target.checked } })} /> Phân biệt chữ hoa/thường</label>
    </>;
    case "MATCHING": return <RepeatEditor label="Cặp ghép" items={form.content.pairs} path="content.pairs" errors={errors}
      create={() => ({ leftId: crypto.randomUUID(), rightId: crypto.randomUUID(), left: "", right: "" })}
      onChange={(pairs) => onChange({ ...form, content: { pairs } })} render={(pair, index, update) => <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vế trái" value={pair.left} path={`content.pairs.${index}.left`} errors={errors} onChange={(left) => update({ ...pair, left })} />
        <Field label="Vế phải" value={pair.right} path={`content.pairs.${index}.right`} errors={errors} onChange={(right) => update({ ...pair, right })} />
      </div>} />;
    case "ORDERING": return <div className="space-y-3"><p className="text-xs text-slate-400">Nhập các mục theo thứ tự đáp án đúng; dùng ↑ ↓ để đổi đáp án. Học viên nhận danh sách được xáo trộn.</p>
      <RepeatEditor label="Mục sắp xếp" items={form.content.correctOrder.flatMap((id) => { const item = form.content.items.find((item) => item.id === id); return item ? [item] : []; })}
        create={() => ({ id: crypto.randomUUID(), text: "" })} path="content.items" errors={errors}
        onChange={(items) => onChange({ ...form, content: { items, correctOrder: items.map((item) => item.id) } })}
        render={(item, index, update) => <Field label={`Mục ${index + 1}`} value={item.text} errors={errors} path={`content.items.${index}.text`} onChange={(text) => update({ ...item, text })} /> } />
    </div>;
    case "TRANSLATION": return <>
      <Field label="Câu cần dịch" value={form.content.source} path="content.source" errors={errors} onChange={(source) => onChange({ ...form, content: { ...form.content, source } })} multiline />
      <StringListEditor label="Bản dịch chấp nhận" values={form.content.acceptedAnswers} path="content.acceptedAnswers" errors={errors} onChange={(acceptedAnswers) => onChange({ ...form, content: { ...form.content, acceptedAnswers } })} />
    </>;
    case "WRITING": case "PRONUNCIATION": return <div className="space-y-3">
      <p className="text-sm text-amber-300">Chấm thủ công · Chưa hỗ trợ tự động chấm. Lưu được trong bài tập nháp; chưa có quy trình duyệt điểm để xuất bản dạng câu hỏi này.</p>
      <Field label={form.type === "WRITING" ? "Yêu cầu viết" : "Yêu cầu phát âm"} value={form.content.prompt} path="content.prompt" errors={errors} multiline onChange={(prompt) => onChange({ ...form, content: { ...form.content, prompt } })} />
    </div>;
  }
}
