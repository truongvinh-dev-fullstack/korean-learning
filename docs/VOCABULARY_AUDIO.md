# Nghe phát âm từ vựng

Trong bài học, nút loa nằm cạnh từ tiếng Hàn ở khối VOCABULARY và bảng tổng hợp từ vựng. Bấm để nghe, bấm lại để dừng. Khi nghe từ khác hoặc chuyển trang, âm thanh trước đó dừng. Audio chỉ tải khi bấm nút. File lỗi hoặc tải quá 15 giây sẽ có thông báo và cho phép thử lại.

## Bổ sung âm thanh trong admin

1. Mở bài học trong `/admin`, chọn thêm hoặc sửa từ vựng.
2. Điền **Audio URL**, ví dụ `/audio/vocab/ai.ogg`, hoặc URL HTTPS trực tiếp tới file âm thanh.
3. Bấm **Nghe thử**, kiểm tra đúng từ tiếng Hàn rồi lưu.
4. Mở trang xem trước để kiểm tra cả thẻ từ vựng và danh sách từ trọng tâm.

File nội bộ phải nằm trong `public/audio/vocab/` và được deploy cùng mã nguồn. Ô Audio URL tham chiếu file có sẵn; không upload file. Khối VOCABULARY biên tập bằng JSON có thể đặt `audioUrl` cho từng phần tử trong `items`.

## Nguồn audio và dữ liệu hiện có

- URL riêng của từ luôn được ưu tiên.
- Nếu một mục trong khối VOCABULARY chưa có URL, nó dùng URL của từ trùng chính xác trong danh sách từ vựng của bài. Nếu các mục trùng từ có URL khác nhau, hệ thống không tự chọn.
- Nếu chưa có URL riêng, bản ghi có sẵn trong `src/shared/audio/vocabulary-recordings.json` được chọn theo toàn bộ từ Hangul, sau khi chuẩn hóa Unicode.
- Từ chưa có bản ghi hiển thị nút bị vô hiệu hóa và “Chưa có âm thanh”. Không thay thế bằng bản ghi của từ gần giống.

Các bản ghi có sẵn dùng được ngay với dữ liệu production hiện tại sau khi deploy, không cần migration hoặc chạy lại seed. Seed mới cũng dùng các bản ghi này và giữ nguyên URL do admin cung cấp trong dữ liệu đã tồn tại.

Khi bổ sung vào danh mục có sẵn, thêm file âm thanh, mục tương ứng trong `vocabulary-recordings.json`, nguồn/tác giả/giấy phép trong [AUDIO_PROVENANCE.md](AUDIO_PROVENANCE.md) và `public/audio/vocab/ATTRIBUTION.txt`. Chỉ thêm bản ghi của đúng từ và có quyền phân phối. Các phần từ vựng có liên kết tới thông tin nguồn âm thanh.

## Kiểm tra

```powershell
pnpm test:run tests/vocabulary-audio.test.ts tests/vocabulary-audio-button.test.tsx
pnpm test:e2e e2e/vocabulary-audio.spec.ts
```

Kiểm tra thủ công thêm trên thiết bị di động: nút đủ dễ bấm, không tràn trang, phát đúng từ, dừng khi chuyển từ và khi rời bài học.
