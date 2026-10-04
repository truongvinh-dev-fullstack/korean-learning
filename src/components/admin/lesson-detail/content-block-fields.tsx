"use client";

import type { DiscriminatedLessonBlock, GrammarExample, HangulItem, VocabularyBlockItem } from "@/modules/lessons/lesson-block.schema";
import type { VocabularyBankEntry } from "@/modules/lessons/lesson-content";
import type { FieldErrors } from "@/modules/admin/admin.client";
import { CALLOUT_LABELS } from "@/modules/admin/lesson-detail.constants";
import { Field, AudioField, SelectField, StringListEditor, inputClass } from "./form-controls";
import { RepeatEditor } from "./repeat-editor";

const newExample = (): GrammarExample => ({ korean: "", vietnamese: "", romanization: "" });
const newCharacter = (): HangulItem => ({ char: "", romanization: "", soundHint: "", strokeCount: 1, strokeOrder: [], example: null });
const newWord = (): VocabularyBlockItem => ({ hangul: "", romanization: "", vietnamese: "", english: "" });

export function ContentBlockFields({ form, onChange, vocabulary, errors }: {
  form: DiscriminatedLessonBlock; onChange: (form: DiscriminatedLessonBlock) => void; vocabulary: VocabularyBankEntry[]; errors: FieldErrors;
}) {
  const field = (label: string, value: string | number | null | undefined, path: string, change: (value: string) => void, multiline = false) =>
    <Field label={label} value={value} path={`content.${path}`} errors={errors} onChange={change} multiline={multiline} />;
  const examples = (items: GrammarExample[], change: (items: GrammarExample[]) => void, path: string) => <RepeatEditor label="Ví dụ" items={items} onChange={change} create={newExample} errors={errors} path={`content.${path}`}
    render={(item, index, update) => <div className="grid gap-3 sm:grid-cols-2">
      {field("Tiếng Hàn", item.korean, `${path}.${index}.korean`, (korean) => update({ ...item, korean }))}
      {field("Tiếng Việt", item.vietnamese, `${path}.${index}.vietnamese`, (vietnamese) => update({ ...item, vietnamese }))}
      {field("Phiên âm", item.romanization, `${path}.${index}.romanization`, (romanization) => update({ ...item, romanization }))}
      {field("Ghi chú", item.note, `${path}.${index}.note`, (note) => update({ ...item, note }))}
      <AudioField label="Audio ví dụ" value={item.audioUrl} path={`content.${path}.${index}.audioUrl`} errors={errors} onChange={(audioUrl) => update({ ...item, audioUrl })} />
    </div>} />;

  switch (form.type) {
    case "TEXT": return field("Nội dung văn bản / Markdown", form.content.markdown, "markdown", (markdown) => onChange({ ...form, content: { ...form.content, markdown } }), true);
    case "HANGUL": return <>
      {field("Mô tả", form.content.description, "description", (description) => onChange({ ...form, content: { ...form.content, description } }), true)}
      <RepeatEditor label="Ký tự" items={form.content.characters} create={newCharacter} errors={errors} path="content.characters"
        onChange={(characters) => onChange({ ...form, content: { ...form.content, characters } })} render={(item, index, update) => { const example = item.example; return <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("Ký tự Hangeul", item.char, `characters.${index}.char`, (char) => update({ ...item, char }))}
            {field("Phiên âm", item.romanization, `characters.${index}.romanization`, (romanization) => update({ ...item, romanization }))}
            {field("Tên ký tự", item.name, `characters.${index}.name`, (name) => update({ ...item, name }))}
            {field("Gợi ý phát âm", item.soundHint, `characters.${index}.soundHint`, (soundHint) => update({ ...item, soundHint }))}
            <Field label="Số nét" type="number" min={1} value={item.strokeCount} path={`content.characters.${index}.strokeCount`} errors={errors} onChange={(value) => update({ ...item, strokeCount: value === "" ? undefined : Number(value) })} />
            <AudioField label="Audio ký tự" value={item.audioUrl} path={`content.characters.${index}.audioUrl`} errors={errors} onChange={(audioUrl) => update({ ...item, audioUrl })} />
          </div>
          {field("Giải thích ký tự", item.explanation, `characters.${index}.explanation`, (explanation) => update({ ...item, explanation }))}
          <StringListEditor label="Thứ tự nét" values={item.strokeOrder ?? []} path={`content.characters.${index}.strokeOrder`} errors={errors} onChange={(strokeOrder) => update({ ...item, strokeOrder })} />
          <label className="text-sm text-slate-300"><input type="checkbox" checked={!!item.example} onChange={(event) => update({ ...item, example: event.target.checked ? { hangul: "", romanization: "", vietnamese: "" } : null })} /> Có từ ví dụ</label>
          {example && <div className="grid gap-3 sm:grid-cols-3">{(["hangul", "romanization", "vietnamese"] as const).map((key) => <Field key={key} label={{ hangul: "Từ ví dụ", romanization: "Phiên âm ví dụ", vietnamese: "Nghĩa ví dụ" }[key]} value={example[key]}
            onChange={(value) => update({ ...item, example: { ...example, [key]: value } })} />)}</div>}
        </div>; }} />
    </>;
    case "VOCABULARY": { const vocabularyIds = form.content.vocabularyIds ?? []; return <div className="space-y-3">
      <p className="text-xs text-slate-400">Chọn từ trong ngân hàng của bài học. Nội dung luôn theo bản cập nhật của từ.</p>
      {form.content.vocabularyIds && <>
        {vocabulary.length === 0 && <p className="text-sm text-amber-300">Thêm từ ở section Ngân hàng từ vựng trước.</p>}
        {vocabulary.map((word) => <label key={word.id} className="flex gap-3 rounded-xl border border-slate-700 p-3 text-sm text-slate-200">
          <input type="checkbox" checked={vocabularyIds.includes(word.id)} onChange={(event) => onChange({ ...form, content: { ...form.content,
            vocabularyIds: event.target.checked ? [...vocabularyIds, word.id] : vocabularyIds.filter((id) => id !== word.id) } })} />
          {word.hangul} — {word.vietnameseMeaning}
        </label>)}
        {errors["content.vocabularyIds"] && <p role="alert" className="text-xs text-rose-300">{errors["content.vocabularyIds"]}</p>}
      </>}
      {!form.content.vocabularyIds && <>
        <p className="text-sm text-amber-300">Khối cũ dùng danh sách riêng. Có thể chỉnh sửa hoặc chọn tham chiếu sau khi thêm các từ này vào ngân hàng.</p>
        <button type="button" className={inputClass} onClick={() => { if (window.confirm("Thay danh sách riêng bằng các từ được chọn trong ngân hàng khi lưu khối?")) {
          const content = { ...form.content, vocabularyIds: [] }; delete content.items; onChange({ type: "VOCABULARY", content });
        } }}>Chuyển sang chọn từ trong ngân hàng</button>
        <RepeatEditor label="Từ vựng cũ" items={form.content.items ?? []} create={newWord} path="content.items" errors={errors}
          onChange={(items) => onChange({ ...form, content: { ...form.content, items } })} render={(word, index, update) => { const example = word.example; return <div className="grid gap-3 sm:grid-cols-2">
            {(["hangul", "romanization", "vietnamese", "english", "partOfSpeech"] as const).map((key) => <Field key={key} label={{ hangul: "Tiếng Hàn", romanization: "Phiên âm", vietnamese: "Nghĩa tiếng Việt", english: "Nghĩa tiếng Anh", partOfSpeech: "Từ loại" }[key]}
              value={word[key]} path={`content.items.${index}.${key}`} errors={errors} onChange={(value) => update({ ...word, [key]: value })} />)}
            <AudioField label="Audio từ vựng" value={word.audioUrl} onChange={(audioUrl) => update({ ...word, audioUrl })} errors={errors} path={`content.items.${index}.audioUrl`} />
            <label className="text-sm text-slate-300"><input type="checkbox" checked={!!word.example} onChange={(event) => update({ ...word, example: event.target.checked ? { korean: "", vietnamese: "" } : null })} /> Có câu ví dụ</label>
            {example && <>
              {field("Câu ví dụ tiếng Hàn", example.korean, `items.${index}.example.korean`, (korean) => update({ ...word, example: { ...example, korean } }))}
              {field("Câu ví dụ tiếng Việt", example.vietnamese, `items.${index}.example.vietnamese`, (vietnamese) => update({ ...word, example: { ...example, vietnamese } }))}
              <AudioField label="Audio câu ví dụ" value={example.audioUrl} path={`content.items.${index}.example.audioUrl`} errors={errors} onChange={(audioUrl) => update({ ...word, example: { ...example, audioUrl } })} />
            </>}
          </div>; }} />
      </>}
    </div>; }
    case "GRAMMAR": return <>
      {field("Cấu trúc ngữ pháp", form.content.pattern, "pattern", (pattern) => onChange({ ...form, content: { ...form.content, pattern } }))}
      {field("Giải thích", form.content.description, "description", (description) => onChange({ ...form, content: { ...form.content, description } }), true)}
      <StringListEditor label="Quy tắc" values={form.content.rules} path="content.rules" errors={errors} onChange={(rules) => onChange({ ...form, content: { ...form.content, rules } })} />
      {examples(form.content.examples, (items) => onChange({ ...form, content: { ...form.content, examples: items } }), "examples")}
    </>;
    case "EXAMPLE": return examples(form.content.items, (items) => onChange({ ...form, content: { ...form.content, items } }), "items");
    case "DIALOGUE": return <>
      <AudioField label="Audio toàn hội thoại" value={form.content.audioUrl} path="content.audioUrl" errors={errors} onChange={(audioUrl) => onChange({ ...form, content: { ...form.content, audioUrl } })} />
      <RepeatEditor label="Lượt hội thoại" items={form.content.lines} path="content.lines" errors={errors} create={() => ({ speaker: "", korean: "", vietnamese: "", romanization: "" })}
        onChange={(lines) => onChange({ ...form, content: { ...form.content, lines } })} render={(line, index, update) => <div className="grid gap-3 sm:grid-cols-2">
          {(["speaker", "korean", "vietnamese", "romanization"] as const).map((key) => <Field key={key} label={{ speaker: "Người nói", korean: "Tiếng Hàn", vietnamese: "Tiếng Việt", romanization: "Phiên âm" }[key]} value={line[key]} path={`content.lines.${index}.${key}`} errors={errors} onChange={(value) => update({ ...line, [key]: value })} />)}
          <AudioField label="Audio lượt nói" value={line.audioUrl} path={`content.lines.${index}.audioUrl`} errors={errors} onChange={(audioUrl) => update({ ...line, audioUrl })} />
        </div>} />
    </>;
    case "AUDIO": return <>
      <AudioField label="Đường dẫn audio" value={form.content.audioUrl} path="content.audioUrl" errors={errors} onChange={(audioUrl) => onChange({ ...form, content: { ...form.content, audioUrl } })} />
      {field("Chú thích", form.content.caption, "caption", (caption) => onChange({ ...form, content: { ...form.content, caption } }))}
      {field("Bản chép lời", form.content.transcript, "transcript", (transcript) => onChange({ ...form, content: { ...form.content, transcript } }), true)}
    </>;
    case "IMAGE": return <>
      {field("Đường dẫn hình ảnh", form.content.imageUrl, "imageUrl", (imageUrl) => onChange({ ...form, content: { ...form.content, imageUrl } }))}
      {field("Chú thích hình", form.content.caption, "caption", (caption) => onChange({ ...form, content: { ...form.content, caption } }))}
    </>;
    case "CALLOUT": return <>
      <SelectField label="Kiểu ghi chú" value={form.content.variant} onChange={(variant) => onChange({ ...form, content: { ...form.content, variant: variant as keyof typeof CALLOUT_LABELS } })}>
        {Object.entries(CALLOUT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </SelectField>
      {field("Thông điệp", form.content.message, "message", (message) => onChange({ ...form, content: { ...form.content, message } }), true)}
    </>;
  }
}
