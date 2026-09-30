"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BlockType } from "@prisma/client";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

export interface LessonBlockItem {
  id: string;
  lessonId: string;
  type: BlockType;
  displayOrder: number;
  content: unknown;
}

export function LessonBlocksEditor({
  lessonId,
  initialBlocks,
}: {
  lessonId: string;
  initialBlocks: LessonBlockItem[];
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<LessonBlockItem[]>(initialBlocks);
  const [isReordering, setIsReordering] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<LessonBlockItem | null>(null);
  const [blockType, setBlockType] = useState<BlockType>(BlockType.TEXT);

  // Form states per type
  const [textTitle, setTextTitle] = useState("");
  const [textMarkdown, setTextMarkdown] = useState("");

  const [calloutVariant, setCalloutVariant] = useState<"info" | "warning" | "tip" | "note">("info");
  const [calloutTitle, setCalloutTitle] = useState("");
  const [calloutMessage, setCalloutMessage] = useState("");

  const [audioUrl, setAudioUrl] = useState("");
  const [audioTitle, setAudioTitle] = useState("");
  const [audioCaption, setAudioCaption] = useState("");

  const [grammarTitle, setGrammarTitle] = useState("");
  const [grammarFormula, setGrammarFormula] = useState("");
  const [grammarExplanation, setGrammarExplanation] = useState("");
  const [grammarExampleKorean, setGrammarExampleKorean] = useState("");
  const [grammarExampleVi, setGrammarExampleVi] = useState("");

  // Generic raw JSON for advanced editing
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [rawJsonText, setRawJsonText] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<LessonBlockItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingBlock(null);
    setBlockType(BlockType.TEXT);
    setTextTitle("");
    setTextMarkdown("");
    setCalloutVariant("info");
    setCalloutTitle("");
    setCalloutMessage("");
    setAudioUrl("");
    setAudioTitle("");
    setAudioCaption("");
    setGrammarTitle("");
    setGrammarFormula("");
    setGrammarExplanation("");
    setGrammarExampleKorean("");
    setGrammarExampleVi("");
    setRawJsonMode(false);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (block: LessonBlockItem) => {
    setEditingBlock(block);
    setBlockType(block.type);
    setRawJsonText(JSON.stringify(block.content, null, 2));
    setRawJsonMode(true); // default to raw json for complex existing blocks
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const buildContentPayload = () => {
    if (rawJsonMode) {
      try {
        return JSON.parse(rawJsonText);
      } catch {
        throw new Error("Cú pháp JSON không hợp lệ.");
      }
    }

    switch (blockType) {
      case BlockType.TEXT:
        if (!textMarkdown.trim()) throw new Error("Nội dung văn bản Markdown không được để trống.");
        return {
          title: textTitle.trim() || undefined,
          markdown: textMarkdown.trim(),
        };

      case BlockType.CALLOUT:
        if (!calloutMessage.trim()) throw new Error("Thông điệp Callout không được để trống.");
        return {
          variant: calloutVariant,
          title: calloutTitle.trim() || undefined,
          message: calloutMessage.trim(),
        };

      case BlockType.AUDIO:
        if (!audioUrl.trim()) throw new Error("Đường dẫn âm thanh không được để trống.");
        return {
          audioUrl: audioUrl.trim(),
          title: audioTitle.trim() || undefined,
          caption: audioCaption.trim() || undefined,
        };

      case BlockType.GRAMMAR:
        if (!grammarTitle.trim() || !grammarFormula.trim() || !grammarExplanation.trim()) {
          throw new Error("Vui lòng điền đầy đủ tiêu đề, cấu trúc và giải thích ngữ pháp.");
        }
        return {
          title: grammarTitle.trim(),
          formula: grammarFormula.trim(),
          explanation: grammarExplanation.trim(),
          examples: [
            {
              korean: grammarExampleKorean.trim() || "한국어 예문입니다.",
              vietnamese: grammarExampleVi.trim() || "Đây là câu ví dụ tiếng Hàn.",
            },
          ],
        };

      default:
        try {
          return JSON.parse(rawJsonText);
        } catch {
          throw new Error("Vui lòng nhập định dạng JSON hợp lệ cho loại khối này.");
        }
    }
  };

  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let content: unknown;
    try {
      content = buildContentPayload();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Dữ liệu không hợp lệ.");
      return;
    }

    setIsSubmitting(true);

    try {
      const url = editingBlock
        ? `/api/admin/blocks/${editingBlock.id}`
        : `/api/admin/lessons/${lessonId}/blocks`;
      const method = editingBlock ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: blockType,
          content,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi lưu khối nội dung.");
      }

      setIsModalOpen(false);

      // Refresh blocks
      const fetchList = await fetch(`/api/admin/lessons/${lessonId}/blocks`);
      const listData = await fetchList.json();
      if (listData.success) {
        setBlocks(listData.data);
      }
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReorder = async (id: string, direction: "UP" | "DOWN") => {
    if (isReordering) return;
    setIsReordering(true);
    try {
      const res = await fetch(`/api/admin/blocks/${id}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBlocks(data.data);
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setIsReordering(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/admin/blocks/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Lỗi khi xóa khối nội dung.");
      }

      setBlocks((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      setDeleteTarget(null);
      router.refresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white">2. Khối nội dung bài giảng ({blocks.length})</h3>
          <p className="text-xs text-slate-400">
            Các phần kiến thức: Văn bản giải thích, Bảng chữ cái, Ngữ pháp, Hội thoại, Audio phát âm
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          + Thêm khối nội dung
        </button>
      </div>

      <div className="space-y-3">
        {blocks.map((block, idx) => (
          <div
            key={block.id}
            className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              {/* Order Controls */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={idx === 0 || isReordering}
                  onClick={() => handleReorder(block.id, "UP")}
                  className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] disabled:opacity-20 cursor-pointer"
                  title="Di chuyển lên"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={idx === blocks.length - 1 || isReordering}
                  onClick={() => handleReorder(block.id, "DOWN")}
                  className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] disabled:opacity-20 cursor-pointer"
                  title="Di chuyển xuống"
                >
                  ▼
                </button>
              </div>

              {/* Block Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono">
                    {block.type}
                  </span>
                  <span className="text-xs font-semibold text-white">Khối thứ #{idx + 1}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono line-clamp-1 max-w-lg">
                  {JSON.stringify(block.content)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openEditModal(block)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                Sửa
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteTarget(block);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-950/30 hover:bg-rose-950/60 text-rose-400 border border-rose-800/40 transition-colors cursor-pointer"
              >
                Xóa
              </button>
            </div>
          </div>
        ))}

        {blocks.length === 0 && (
          <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs text-slate-500">
            Chưa có khối nội dung nào trong bài học này. Hãy nhấn &quot;+ Thêm khối nội dung&quot; để soạn bài.
          </div>
        )}
      </div>

      {/* Add / Edit Block Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="max-w-xl w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingBlock ? "Chỉnh sửa Khối nội dung" : "Thêm Khối nội dung mới"}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!rawJsonMode) {
                      try {
                        const payload = buildContentPayload();
                        setRawJsonText(JSON.stringify(payload, null, 2));
                      } catch {
                        setRawJsonText("{}");
                      }
                    }
                    setRawJsonMode(!rawJsonMode);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  {rawJsonMode ? "Chuyển sang biểu mẫu trực quan" : "Chế độ sửa mã JSON"}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleSaveBlock} className="space-y-4">
              {/* Block Type selector */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Loại khối nội dung (Block Type)
                </label>
                <select
                  disabled={Boolean(editingBlock)}
                  value={blockType}
                  onChange={(e) => setBlockType(e.target.value as BlockType)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                  <option value={BlockType.TEXT}>TEXT - Đoạn văn bản lý thuyết (Markdown)</option>
                  <option value={BlockType.CALLOUT}>CALLOUT - Hộp lưu ý / mẹo ghi nhớ</option>
                  <option value={BlockType.AUDIO}>AUDIO - Đoạn phát âm thanh (Local path / URL)</option>
                  <option value={BlockType.GRAMMAR}>GRAMMAR - Cấu trúc ngữ pháp & ví dụ</option>
                  <option value={BlockType.HANGUL}>HANGUL - Bảng chữ cái âm tiết (JSON)</option>
                  <option value={BlockType.VOCABULARY}>VOCABULARY - Bảng từ vựng khối (JSON)</option>
                  <option value={BlockType.DIALOGUE}>DIALOGUE - Đoạn hội thoại đối thoại (JSON)</option>
                </select>
              </div>

              {/* Sub-form based on block type if not rawJsonMode */}
              {!rawJsonMode ? (
                <>
                  {blockType === BlockType.TEXT && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-300">
                          Tiêu đề khối (tùy chọn)
                        </label>
                        <input
                          type="text"
                          value={textTitle}
                          onChange={(e) => setTextTitle(e.target.value)}
                          placeholder="Ví dụ: Giới thiệu chung"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-300">
                          Nội dung văn bản (Hỗ trợ Markdown) <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                          rows={6}
                          value={textMarkdown}
                          onChange={(e) => setTextMarkdown(e.target.value)}
                          placeholder="Nhập nội dung bài học..."
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {blockType === BlockType.CALLOUT && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-300">Kiểu hiển thị</label>
                          <select
                            value={calloutVariant}
                            onChange={(e) => setCalloutVariant(e.target.value as "info" | "warning" | "tip" | "note")}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                          >
                            <option value="info">Thông tin (Info - Xanh dương)</option>
                            <option value="tip">Mẹo học (Tip - Xanh lá)</option>
                            <option value="warning">Cảnh báo (Warning - Vàng cam)</option>
                            <option value="note">Ghi chú (Note - Tím)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-300">Tiêu đề Callout</label>
                          <input
                            type="text"
                            value={calloutTitle}
                            onChange={(e) => setCalloutTitle(e.target.value)}
                            placeholder="Ví dụ: Lưu ý phát âm"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-300">Nội dung Callout *</label>
                        <textarea
                          rows={3}
                          value={calloutMessage}
                          onChange={(e) => setCalloutMessage(e.target.value)}
                          placeholder="Nội dung lưu ý quan trọng cho học viên..."
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {blockType === BlockType.AUDIO && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-300">
                          Đường dẫn âm thanh (Audio Path / URL) <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={audioUrl}
                          onChange={(e) => setAudioUrl(e.target.value)}
                          placeholder="Ví dụ: /audio/hangul/a.mp3 hoặc https://example.com/audio.mp3"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
                        />
                        <p className="text-[10px] text-slate-500">
                          Chấp nhận đường dẫn nội bộ (bắt đầu bằng /) hoặc URL HTTPS. Không hỗ trợ tải file trực tiếp.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-300">Tiêu đề đoạn nghe</label>
                          <input
                            type="text"
                            value={audioTitle}
                            onChange={(e) => setAudioTitle(e.target.value)}
                            placeholder="Nghe và nhắc lại"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-300">Chú thích (Caption)</label>
                          <input
                            type="text"
                            value={audioCaption}
                            onChange={(e) => setAudioCaption(e.target.value)}
                            placeholder="Giọng đọc người bản xứ Seoul"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {blockType === BlockType.GRAMMAR && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-300">Tên ngữ pháp *</label>
                          <input
                            type="text"
                            value={grammarTitle}
                            onChange={(e) => setGrammarTitle(e.target.value)}
                            placeholder="Trợ từ chủ đề 은/는"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-300">Cấu trúc công thức *</label>
                          <input
                            type="text"
                            value={grammarFormula}
                            onChange={(e) => setGrammarFormula(e.target.value)}
                            placeholder="Danh từ + 은/는"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-300">Giải thích cách dùng *</label>
                        <textarea
                          rows={2}
                          value={grammarExplanation}
                          onChange={(e) => setGrammarExplanation(e.target.value)}
                          placeholder="Dùng sau danh từ để biểu thị danh từ đó là chủ đề của câu..."
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-300">Câu ví dụ tiếng Hàn</label>
                          <input
                            type="text"
                            value={grammarExampleKorean}
                            onChange={(e) => setGrammarExampleKorean(e.target.value)}
                            placeholder="저는 학생입니다."
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-300">Dịch nghĩa tiếng Việt</label>
                          <input
                            type="text"
                            value={grammarExampleVi}
                            onChange={(e) => setGrammarExampleVi(e.target.value)}
                            placeholder="Tôi là học sinh."
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {(blockType === BlockType.HANGUL ||
                    blockType === BlockType.VOCABULARY ||
                    blockType === BlockType.DIALOGUE) && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Cấu trúc JSON chi tiết:</span>
                        <span className="text-[11px] text-amber-300 font-mono">Dạng {blockType}</span>
                      </div>
                      <textarea
                        rows={8}
                        value={rawJsonText}
                        onChange={(e) => setRawJsonText(e.target.value)}
                        placeholder={`{\n  "title": "...",\n  "characters": [...]\n}`}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Nội dung JSON (Content Schema)
                  </label>
                  <textarea
                    rows={10}
                    value={rawJsonText}
                    onChange={(e) => setRawJsonText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? "Đang lưu..." : editingBlock ? "Cập nhật khối" : "Thêm khối"}
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
          title="Xác nhận xóa khối nội dung?"
          description={`Khối nội dung loại "${deleteTarget.type}" sẽ bị xóa khỏi bài học.`}
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
