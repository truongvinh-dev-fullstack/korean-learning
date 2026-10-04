# Lesson Detail: phân tích và kế hoạch

## Source trước refactor

- Routing: `src/app/admin/courses/[id]/edit`, `admin/chapters/[id]/lessons`, `admin/lessons/[id]/edit` và `preview`; trang học tại `courses/[slug]/lessons/[lessonSlug]`.
- Prisma: Course → Chapter → Lesson → LessonBlock/Vocabulary/Exercise → Question → QuestionOption. Status dùng DRAFT/PUBLISHED/ARCHIVED. Tất cả thứ tự dùng `displayOrder`; API reorder nhận `{direction: "UP" | "DOWN"}`, chưa có drag.
- `modules/admin/admin.schema.ts`, `admin.service.ts`, `admin.repository.ts`: Zod → kiểm tra RBAC/slug/dữ liệu học viên → Prisma. API trả `{success, data}` hoặc `{success: false, error: {code, message, details}}`. POST tạo, PUT cập nhật từng phần, DELETE xóa.
- `components/admin/lesson-*-editor.tsx`: meta, block, vocabulary, exercise; block đang render JSON trong card và bật JSON khi sửa. HANGUL/VOCABULARY/DIALOGUE chưa có form. GRAMMAR tạo một ví dụ mặc định, câu trắc nghiệm bị giới hạn đúng 4 lựa chọn.
- `modules/lessons/lesson-block.schema.ts` và `components/lessons/lesson-block-renderer.tsx`: 7 loại khối; schema GRAMMAR cũ dùng formula/explanation, CALLOUT có info. TEXT hiển thị multiline, chưa có markdown renderer.
- Vocabulary Block lưu `items` độc lập với bảng Vocabulary; SRS dùng bảng Vocabulary. Hiện có thể lệch nội dung giữa hai nguồn.
- `modules/exercises`: sanitizer giấu đáp án, scoring chấm 4 loại; submit lưu attempt và chỉ hoàn thành lesson khi đạt 80%. QuestionOption/attempt đã có ID và cần giữ khi có lịch sử.
- Audio dùng URL/path cùng AudioUrlSchema, audio controls, VocabularyAudioButton và fallback bản ghi đóng gói; không có upload service.
- Có thể reuse dark theme Tailwind, modal xóa, AudioUrlSchema, VocabularyAudioButton, admin guards, domain errors, các route CRUD/reorder, SRS và progress.
- Breaking risks: đổi enum/field cũ, mất trường JSON/audio khi round-trip, lộ đáp án khi thêm type, thay đổi chấm điểm/lịch sử attempts, tham chiếu từ vựng dangling, order trùng nhau.

## TODO (trước triển khai)

- [x] Model, enum, schema, mapper và migration bổ sung, không xóa dữ liệu.
- [x] 5 section với objective list và field editor cho 9 block types.
- [x] Vocabulary Bank metadata/reference, CRUD và bảo vệ reference/SRS.
- [x] Question editor theo type, scoring/sanitizer/runner tương ứng, publish validation.
- [x] Regression tests, typecheck/lint/build, ví dụ bài nguyên âm và báo cáo kết quả.

## Quy ước

Giữ `estimatedMinutes`, `displayOrder`, `prompt`, `vietnameseMeaning`, `englishMeaning` ở API/DB. Mapper domain có thể dùng tên dễ đọc hơn. Thêm cột/enum trước khi chạy phiên bản mới. Không chạy seed lên dữ liệu thật để áp dụng refactor.

## Kết quả triển khai

Lesson Detail có 5 section theo đúng thứ tự yêu cầu, giữ dark theme. Các editor được chia nhỏ theo convention kebab-case hiện có, dùng chung field, modal có focus trap, list/reorder, API client và state CRUD. Card khối hiển thị badge, tiêu đề và preview nội dung; có thêm/sửa/xóa/đổi thứ tự/nhân bản. Các danh sách con (ký tự, ví dụ, hội thoại, lựa chọn, mục tiêu) có thao tác riêng. Có xác nhận xóa, empty/loading/error/success states, lỗi tại field và khóa form khi lưu.

Cả 9 block types có form theo field và renderer cho admin preview/trang học. Vocabulary block mới chọn ID trong ngân hàng, không lưu bản sao văn bản. Thay đổi từ trong ngân hàng xuất hiện ở block khi tải lại; backend kiểm tra ID thuộc bài học và từ chối xóa từ đang được tham chiếu hoặc dùng trong SRS. Giao dịch có Serializable isolation và retry lỗi xung đột; thứ tự trùng trong dữ liệu cũ được chuẩn hóa trong nhóm khi đổi chỗ. Reader và admin dùng ID để phân định thứ tự khi `displayOrder` bằng nhau.

Question editor hỗ trợ MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE, FILL_BLANK, MATCHING, ORDERING, LISTENING_CHOICE, TRANSLATION, WRITING, PRONUNCIATION và ARRANGE_SENTENCE cũ. Các dạng tự chấm có learner UI, kiểm tra quyền sở hữu ID đáp án, scoring phía server và replay attempt. Sanitizer chỉ gửi dữ liệu học viên cần dùng; không gửi đáp án đúng, mapping ghép cặp hoặc thứ tự đúng. MC/listening có từ 2 lựa chọn thay cho giới hạn đúng 4. MULTIPLE_SELECT chấm theo toàn bộ tập đúng; TRANSLATION so khớp danh sách bản dịch chấp nhận sau khi normalize, chưa chấm theo ngữ nghĩa.

### Thay đổi data model

| Model | Bổ sung | Mặc định / tương thích |
| --- | --- | --- |
| Lesson | `level: String?`, `tags: String[]`, `learningObjectives: String[]` | `null`, `[]`, `[]`; giữ toàn bộ trường cũ |
| Vocabulary | `difficulty: Int?`, `tags: String[]` | `null`, `[]`; UI/schema độ khó 1–5 |
| Question | `content: Json?` | `null`; giữ `correctAnswer`, relational `options` |
| BlockType | EXAMPLE, IMAGE | giữ 7 enum cũ |
| QuestionType | MULTIPLE_SELECT, TRUE_FALSE, MATCHING, ORDERING, TRANSLATION, WRITING, PRONUNCIATION | giữ 4 enum cũ |
| LessonBlock.content | schema phân biệt theo type; VOCABULARY thêm `vocabularyIds` | dữ liệu vẫn là JSONB trong DB, form không bắt nhập JSON |

### API request / response

Không đổi URL, HTTP method, RBAC, envelope hay các route CRUD/reorder hiện có. Các route PUT vẫn nhận cập nhật từng phần.

| Endpoint / chức năng | Bổ sung payload và hành vi |
| --- | --- |
| POST `/api/admin/lessons`, PUT `/api/admin/lessons/:id` | `level`, `tags`, `learningObjectives`; `estimatedMinutes >= 0`; khi trạng thái hiệu lực PUBLISHED, validate cả nội dung lưu trong bài |
| POST `/api/admin/lessons/:id/blocks`, PUT `/api/admin/blocks/:id` | 9 type, `content` đúng schema; VOCABULARY nhận `{title, vocabularyIds}` hoặc legacy `{title, items}` |
| POST `/api/admin/lessons/:id/vocabularies`, PUT `/api/admin/vocabularies/:id` | `difficulty`, `tags`; giữ các tên nghĩa/câu ví dụ cũ; không chuyển từ sang bài khác |
| DELETE `/api/admin/vocabularies/:id` | 409 nếu đang được block tham chiếu hoặc dùng trong SRS |
| POST `/api/admin/exercises/:id/questions`, PUT `/api/admin/questions/:id` | thêm `content` cho dữ liệu theo type; options đúng lưu bằng `isCorrect` như trước |
| PUT `/api/admin/exercises/:id` | kiểm tra câu hỏi khi xuất bản; không chuyển bài tập sang bài học khác; manual giữ nháp |
| POST các route `/reorder` | vẫn `{direction: "UP" \| "DOWN"}`; không thêm drag hoặc API reorder mới |
| GET `/api/exercises/:id`, POST `/api/exercises/:id/submit` | giữ envelope và cấu trúc answers; thêm `content` đã sanitize cho matching/ordering/translation; `selectedOptionIds` cho multiple-select/ordering, `textAnswer` cho true-false/translation/matching |

Ví dụ content câu hỏi: FILL_BLANK `{answers: ["유"], caseSensitive: false}`; TRUE_FALSE `{correctAnswer: true}`; MATCHING `{pairs: [{leftId, rightId, left, right}, ...]}`; ORDERING `{items: [{id, text}, ...], correctOrder: [...]}`; WRITING/PRONUNCIATION `{prompt, gradingMode: "MANUAL"}`. Editor sinh ID độc lập cho hai vế của cặp ghép. Nhân bản block dùng POST cũ; server sinh ID/order mới, không cần endpoint riêng.

### Migration và triển khai

Migration: `prisma/migrations/20261003090000_lesson_authoring/migration.sql`. Chỉ ADD COLUMN/ADD enum, không xóa/sửa ID, JSON cũ, progress, attempts, options hoặc review cards. Đã áp dụng trên `localhost/korean_zero` và `localhost/korean_zero_test`; chưa triển khai production.

Trên môi trường đích, cấu hình kết nối DB phù hợp rồi chạy trước khi khởi động phiên bản mới:

```sh
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm build
```

Giữ API và payload cũ, nhưng phiên bản mới **cần migration trước khi chạy**. Publish validation chặt hơn có thể từ chối bài cũ có dữ liệu lỗi hoặc bài tập đã xuất bản nhưng không có câu hỏi. LISTENING_CHOICE thiếu audio giờ bị từ chối khi ghi/publish; dữ liệu đã lưu không bị tự sửa. Các enum mới đòi hỏi consumer bên ngoài xử lý thêm type; không rollback về code cũ khi đã dùng nội dung mới.

### Legacy compatibility

- TEXT/HANGUL/VOCABULARY/AUDIO/CALLOUT cũ vẫn parse; các trường mới tùy chọn hoặc có default. CALLOUT `info` vẫn được giữ.
- GRAMMAR `formula`/`explanation` fallback sang `pattern`/`description`; khi sửa, mapper đồng bộ alias nếu alias có trong dữ liệu cũ.
- Giữ ví dụ nhiều dòng, `note`, audio trên ký tự/ví dụ/hội thoại; round-trip có regression tests.
- Vocabulary `items` vẫn đọc/render/sửa được. Có thao tác chuyển sang chọn ngân hàng, yêu cầu quản trị viên đối chiếu và chọn từ trước khi lưu; không tự backfill gây trùng từ hoặc đổi SRS ID.
- FILL_BLANK `content = null` fallback từ `correctAnswer`; MC/listening vẫn dùng bảng options; ARRANGE_SENTENCE và lịch sử attempts giữ cách lưu/chấm cũ.
- Cập nhật question từng phần không xóa options khi payload không có `options`. Những câu đã có attempt nộp bài vẫn được bảo vệ khỏi sửa/xóa.
- Invalid legacy block không bị thay bằng dữ liệu mẫu: admin thấy lỗi và giữ nguyên bản gốc, preview cảnh báo; cần sửa bằng API/data repair nếu parser không đọc được.
- VocabularyAudioButton giữ playback behavior và dọn playback khi unmount; đổi kiểm tra speech support sang `useSyncExternalStore` để lint React hooks và SSR hydration đều hợp lệ.

### Các giới hạn và TODO cụ thể

1. WRITING/PRONUNCIATION có enum, schema và form lưu nháp. Chưa có backend phân công người chấm, hàng đợi, rubric, trạng thái pending/graded, API duyệt điểm và cách tính progress khi chờ chấm. Do đó chưa cho xuất bản bài tập chứa các dạng này; không gán điểm tự động.
2. Rules 1–3 về kiến thức đã giới thiệu chưa enforce ngữ nghĩa. `buildLessonKnowledgeContext()` gom ký tự, cấu trúc và ngân hàng từ vựng làm đầu vào. Cần thêm metadata knowledge-reference cho question và coverage validator/editor gợi ý trước khi enforce.
3. AI chưa tích hợp thật. Có input/output types và domain mapper; bước tiếp theo là validate kết quả AI, remap ID tạm, lưu qua service và duyệt nháp. Chưa có Chapter Test mới; mô hình Lesson → Exercise được giữ để mở rộng riêng sau.
4. Không có media uploader trong source hiện tại. Giữ nhập URL/local path và nghe preview; TEXT vẫn dùng multiline theo renderer hiện có. Chưa thêm markdown renderer, drag-and-drop hoặc tự chuyển toàn bộ vocabulary legacy.
5. Bài mẫu là tài liệu minh họa, không tự import vào production/seed. `strokeOrder: null` và các audio chưa có giữ `null`; cần nội dung hướng dẫn nét/bản ghi riêng nếu muốn đầy đủ tài liệu học cho mọi ký tự/từ.

### Ví dụ Bài 1

Xem [lesson-1-vowels.json](examples/lesson-1-vowels.json): thông tin bài, 4 mục tiêu, 10 ký tự, 5 loại block TEXT/HANGUL/VOCABULARY/AUDIO/CALLOUT, 5 từ ngân hàng, 1 bài tập và 4 câu hỏi. `tests/lesson-authoring-example.test.ts` kiểm tra toàn bộ payload bằng schema thật, publish validation và audio đóng gói.

Các ID `example-*` chỉ minh họa graph. Khi tạo bài qua API, tạo lesson → ngân hàng → blocks/bài tập → questions; thay `chapterId`, `lessonId`, `exerciseId`, `vocabularyIds` bằng ID server trả về. Không có endpoint import nguyên graph trong task này.

### Kiểm tra

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS, không warning |
| `pnpm test:run` | PASS: 29 files, 252 tests |
| `pnpm test:e2e` | PASS: 14 Chromium journeys |
| Playwright sau chỉnh bảng mobile | PASS: chạy lại 2 journeys responsive và authoring |
| `pnpm build` | PASS: Prisma generate, Next compile, TypeScript và static page generation |
| `git diff --check` | PASS |

Unit/integration tests chạy trên DB `_test` riêng. E2E kiểm tra đăng ký/RBAC, CMS CRUD/reorder, phone/tablet/desktop, audio, lưu/replay quiz và SRS, soạn bài mới bằng form rồi học viên hoàn thành bài. Đã xem ảnh mobile Lesson Detail. Môi trường hiện tại Node 26; project khai báo Node 22, nên CI/deploy cần giữ phiên bản khai báo.

`.env` hiện dùng BETTER_AUTH_SECRET placeholder; test/build dùng secret tạm trong process, không ghi secret vào source. Để chạy dev bằng cấu hình hiện tại cần thay placeholder bằng secret hợp lệ của môi trường.

## Danh sách file

32 file mới, 27 file sửa. Các file generated `next-env.d.ts` và `tsconfig.tsbuildinfo` đã được đưa về trạng thái ban đầu để không đưa artifact kiểm tra vào diff.

### Tạo mới

- `docs/LESSON_DETAIL_REFACTOR.md`
- `docs/examples/lesson-1-vowels.json`
- `prisma/migrations/20261003090000_lesson_authoring/migration.sql`
- `src/components/admin/lesson-detail/content-block-card.tsx`
- `src/components/admin/lesson-detail/content-block-fields.tsx`
- `src/components/admin/lesson-detail/exercise-card.tsx`
- `src/components/admin/lesson-detail/form-controls.tsx`
- `src/components/admin/lesson-detail/lesson-content-blocks.tsx`
- `src/components/admin/lesson-detail/lesson-exercises.tsx`
- `src/components/admin/lesson-detail/lesson-objectives.tsx`
- `src/components/admin/lesson-detail/lesson-vocabulary.tsx`
- `src/components/admin/lesson-detail/question-editor.tsx`
- `src/components/admin/lesson-detail/question-fields.tsx`
- `src/components/admin/lesson-detail/repeat-editor.tsx`
- `src/components/admin/lesson-detail/use-admin-collection.ts`
- `src/components/admin/lesson-detail/vocabulary-editor.tsx`
- `src/components/exercises/structured-question-input.tsx`
- `src/components/lessons/learning-objectives.tsx`
- `src/modules/admin/admin-order.ts`
- `src/modules/admin/admin-transaction.ts`
- `src/modules/admin/admin.client.ts`
- `src/modules/admin/lesson-detail.constants.ts`
- `src/modules/admin/lesson-detail.mapper.ts`
- `src/modules/admin/lesson-publish.ts`
- `src/modules/exercises/question.schema.ts`
- `src/modules/exercises/structured-scoring.ts`
- `src/modules/lessons/lesson-content.ts`
- `tests/admin-transaction.test.ts`
- `tests/lesson-authoring-example.test.ts`
- `tests/lesson-authoring-ui.test.tsx`
- `tests/lesson-authoring.test.ts`
- `e2e/lesson-authoring.spec.ts`

### Sửa

- `prisma/schema.prisma`
- `src/app/admin/lessons/[id]/edit/page.tsx`
- `src/app/admin/lessons/[id]/preview/page.tsx`
- `src/app/courses/[slug]/lessons/[lessonSlug]/page.tsx`
- `src/components/admin/lesson-blocks-editor.tsx`
- `src/components/admin/lesson-exercise-editor.tsx`
- `src/components/admin/lesson-meta-editor.tsx`
- `src/components/admin/lesson-vocab-editor.tsx`
- `src/components/exercises/exercise-runner.tsx`
- `src/components/lessons/lesson-block-renderer.tsx`
- `src/components/lessons/vocabulary-audio-button.tsx`
- `src/modules/admin/admin.repository.ts`
- `src/modules/admin/admin.schema.ts`
- `src/modules/admin/admin.service.ts`
- `src/modules/exercises/exercise.repository.ts`
- `src/modules/exercises/exercise.service.ts`
- `src/modules/exercises/result.ts`
- `src/modules/exercises/scoring.ts`
- `src/modules/lessons/lesson-block.schema.ts`
- `src/modules/lessons/lesson.repository.ts`
- `src/modules/lessons/lesson.service.ts`
- `tests/lesson-block.test.ts`
- `tests/release-blocks.test.ts`
- `tests/remediation-batch-4.test.ts`
- `e2e/batch4-responsive-admin.spec.ts`
- `e2e/release-candidate.spec.ts`
- `e2e/vocabulary-audio.spec.ts`

Các module Course/Chapter, routes và wrappers cũ được giữ; không đổi UI library hay thêm dependency.

## Review / QA tiếp theo

Xem [LESSON_DETAIL_QA.md](LESSON_DETAIL_QA.md) cho các lỗi được phát hiện/sửa sau refactor, kiểm tra persistence qua form/API/DB, migration, legacy, responsive và kết quả kiểm thử mới nhất. Các kết quả kiểm thử ở trên thuộc lượt triển khai refactor ban đầu.

## Phase AI-assisted tiếp theo

Luồng draft → schema/knowledge validation → preview/edit → confirm → transactional import đã được triển khai trong [AI_LESSON_AUTHORING.md](AI_LESSON_AUTHORING.md). Các TODO AI/stub types và kết quả test ở báo cáo refactor này là lịch sử trước phase AI; contract mới tách khỏi DB entities. Workflow manual publish vẫn giữ nguyên.
