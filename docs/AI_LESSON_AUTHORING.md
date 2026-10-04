# AI Lesson Generation — kế hoạch và kiến trúc

Phase production provider mới nhất: [AI_PROVIDER_HARDENING.md](AI_PROVIDER_HARDENING.md). Các mục kế hoạch/kết quả kiểm thử ban đầu bên dưới lưu lịch sử phase authoring.

## Plan trước code

Đã đọc Lesson Detail, schema block/question, bank/mapper, admin service/repository, Serializable retry, publish guards, QA và bài mẫu. Giữ nguyên contract CRUD/DB và các legacy fields.

1. Contract AI riêng: clientId, order, estimatedDuration, vietnamese và vocabularyClientIds; parser/normalizer/schema dùng lại các validator nội dung hiện có.
2. KnowledgeIndex và rule-based validation theo loại câu hỏi; ERROR chặn import, WARNING cần admin duyệt.
3. Provider server-side qua interface; HTTP adapter cấu hình bằng môi trường và deterministic mock chỉ cho dev/test. Không có fallback dữ liệu mẫu trong production.
4. Generate/validate không ghi DB. Preview trên client dùng lại ContentBlockFields, VocabularyEditor, QuestionEditor và list controls; thay đổi làm mất hiệu lực validation trước đó.
5. Import yêu cầu token validation gắn với user, target và hash draft, cùng xác nhận; một transaction Serializable tạo toàn graph, remap vocabulary, validate lần cuối và ghi receipt chống gửi trùng.
6. NEW tạo DRAFT; APPEND giữ metadata/IDs/nội dung cũ và thêm objectives; REPLACE chỉ DRAFT, xác nhận riêng, chặn nếu có dữ liệu học viên. Không auto-publish.
7. Fixture, unit/integration, E2E, typecheck/lint/build và báo cáo kết quả.

## Provider

`AI_LESSON_PROVIDER=openai` dùng Responses API với model/key/base URL cấu hình server và Structured Outputs strict. `http` hỗ trợ bridge HTTPS trả draft trực tiếp, nhận input/contract/prompt/model/token cap. Cả hai có timeout tổng, retry có giới hạn; không fallback. Xem cấu hình đầy đủ và smoke test trong tài liệu hardening.

Dev/test dùng `AI_LESSON_PROVIDER=mock`; production luôn từ chối mock hoặc cấu hình thiếu/sai khi khởi động. Dùng `disabled` để tắt AI rõ ràng. Fixture của mock nằm trong `docs/examples/ai/`. Test không gọi AI thật.

## Workflow

Generate → parse/trim/slug/schema → knowledge → preview trong bộ nhớ → edit → kiểm tra lại → confirm → import transaction → Lesson Detail. Schema invalid không trả draft. Knowledge invalid vẫn cho sửa preview, khóa import. Không lưu preview trong DB. Token hết hạn sau 30 phút; sửa nội dung/mode phải kiểm tra lại. Retry import dùng cùng idempotency key để tìm receipt ngay cả khi phản hồi trước bị mất.

APPEND giữ metadata cũ; objectives được nối và loại trùng. REPLACE thay metadata/objectives và graph sau xác nhận; kiểm tra activity trong cùng transaction. Published/archived phải chuyển sang DRAFT qua workflow sẵn có. Tất cả exercise mới là DRAFT, gồm WRITING/PRONUNCIATION.

## A. Architecture

`modules/ai-lessons` sở hữu contract, normalizer, knowledge validator, provider, token, mapper, service và repository import. UI chỉ giữ draft trong bộ nhớ. Các endpoint admin mới đều kiểm tra session/RBAC trước khi đọc JSON. Schema/domain CRUD cũ giữ nguyên và được reuse khi ghi/final validation.

## B. Files created

- `src/modules/ai-lessons/ai-lesson.schema.ts`
- `src/modules/ai-lessons/ai-lesson-normalizer.ts`
- `src/modules/ai-lessons/lesson-knowledge-validator.ts`
- `src/modules/ai-lessons/lesson-ai-provider.ts`
- `src/modules/ai-lessons/ai-lesson.mapper.ts`
- `src/modules/ai-lessons/ai-lesson-token.ts`
- `src/modules/ai-lessons/ai-lesson.repository.ts`
- `src/modules/ai-lessons/ai-lesson.service.ts`
- `src/modules/ai-lessons/ai-lesson.api.ts`
- `src/components/admin/ai-lesson/ai-lesson-authoring.tsx`
- `src/components/admin/ai-lesson/draft-preview.tsx`
- `src/components/admin/ai-lesson/draft-editors.tsx`
- `src/app/admin/ai-lessons/page.tsx`
- `src/app/api/admin/ai-lessons/generate/route.ts`
- `src/app/api/admin/ai-lessons/validate/route.ts`
- `src/app/api/admin/ai-lessons/import/route.ts`
- `prisma/migrations/20261004090000_ai_lesson_import/migration.sql`
- `docs/examples/ai/valid-lesson-generation.json`
- `docs/examples/ai/invalid-knowledge-generation.json`
- `docs/examples/ai/invalid-schema-generation.json`
- `tests/ai-lesson-generation.test.ts`
- `tests/ai-lesson-import.test.ts`
- `tests/ai-lesson-ui.test.tsx`
- `tests/stubs/server-only.ts`
- `e2e/ai-lesson-generation.spec.ts`
- `docs/AI_LESSON_AUTHORING.md`

## C. Files modified

- `prisma/schema.prisma`: thêm model receipt và relation tới Lesson; không thay dữ liệu cũ.
- `src/app/admin/lessons/[id]/edit/page.tsx`, `src/app/admin/chapters/[id]/lessons/page.tsx`: entry tạo AI cho existing/new lesson.
- `src/modules/admin/admin.client.ts`: thêm HTTP status trên lỗi để phân biệt request bị từ chối và phản hồi import bị mất.
- `src/shared/db/serializable-transaction.ts`: thêm options timeout/maxWait/số lần retry; mặc định CRUD vẫn ba lần, graph import sáu lần và backoff có giới hạn.
- `src/modules/lessons/lesson-content.ts`: bỏ hai AI stub types dùng entity DB; thay bằng contract AI riêng.
- `.env.example`: các biến provider server-only.
- `playwright.config.ts`: web server E2E dùng deterministic mock.
- `vitest.config.mts`: test alias cho marker server-only (Next vẫn enforce khi build).
- `tests/admin-transaction.test.ts`: kiểm tra cấu hình retry graph không truyền nhầm options vào Prisma.
- `docs/LESSON_DETAIL_REFACTOR.md`, `docs/LESSON_DETAIL_QA.md`: dẫn tới báo cáo phase này, giữ lịch sử QA.

Các thay đổi từ refactor/QA trước được giữ nguyên. Không commit, deploy hay seed development DB.

## D. AI provider abstraction

`LessonAiProvider.generateLesson(input, context?): Promise<unknown>` giữ abstraction/injection hiện có, thêm adapter OpenAI thật và HTTP bridge. Context mang request ID, model/provider, retry count và usage. Model luôn lấy từ env. Schema wire chuyển `oneOf`/intersection sang `anyOf`, đóng object và biểu diễn optional bằng null; nội dung vẫn phải qua validator nội bộ.

Provider/service/repository/token có `server-only`. Không dùng `NEXT_PUBLIC_*` cho key. Lỗi provider được thay bằng thông báo an toàn; generation logs có tên, request/user ID, provider/model/version, thời gian, retry, usage và validation counts. Không log secret, topic, notes hoặc toàn draft. Generate chỉ ghi counter/lease rate limit; không ghi graph hay receipt trước xác nhận import.

## E. AI output schema

Contract riêng `AiLessonDraft`, `AiLessonValidationResult`, `AiLessonImportPayload`; outer objects strict. Nội dung chín block types và mười một question types reuse schema thật. VOCABULARY chỉ nhận `vocabularyClientIds`; không nhận DB IDs hoặc bản sao `items`. Options chỉ có nội dung/đáp án/giải thích, không có relational IDs.

Kiểm tra required fields, type, content, correct answer, options, duplicate global clientId, duplicate sibling order, duplicate reference và dangling vocabulary. Giới hạn 512 KB, độ sâu 30, tổng 200 câu hỏi; giới hạn số item/string theo schema. Reject duplicate order **trước** khi sort/rank từ 0. Trim strings, normalize slug ASCII theo convention, loại trùng tags và chuyển chuỗi rỗng sang null chỉ ở field nullable của contract. Không NFKC hoặc tự sửa tiếng Hàn.

Schema invalid không trả draft cho lần generate. Draft đã có nhưng bị admin sửa sai vẫn giữ để sửa lại, không được import.

## F. Knowledge validator

KnowledgeIndex thu thập characters/bank/grammar/examples/dialogue/transcript/text và audio; không lấy question làm nguồn kiến thức. Rule-based kiểm tra target/đáp án MC/multi-select, phiên âm/nghĩa được hỏi, fill answers, listening audio và transcript, cặp matching, ngữ cảnh ordering/arrangement, translation source và pronunciation target. MC hỏi nghĩa cần target trong bank. Auxiliary words có thể WARNING. TRUE_FALSE là WARNING cho admin đối chiếu. WRITING không kiểm tra đáp án và luôn MANUAL.

Local listening audio phải là file audio thật dưới `public/`. Không probe remote URL do AI gửi; remote audio cần có trong `AI_LESSON_VERIFIED_AUDIO_URLS`, do đội nội dung xác minh. Không có transcript trả cảnh báo yêu cầu nghe đối chiếu. Không auto-generate audio.

Mỗi issue có code/path/message/severity, hiển thị ở summary và câu/section. Chỉ ERROR chặn import; WARNING vẫn cần xác nhận. Validator kiểm tra coverage và các rule cụ thể, không chứng minh toàn bộ ngữ nghĩa/độ đúng của tiếng Hàn.

## G. Draft preview flow

Hai entry “AI tạo bài học” mở một trang dùng chung. Form đủ topic, level, lessonNumber, duration, targetAudience, notes. Generate có loading/ref guard; preview đủ metadata, objectives, blocks, vocabulary, exercises và đáp án/giải thích/audio. Reuse `Field`, `StringListEditor`, `ReorderButtons`, `EditorModal`, `ContentBlockFields`, `VocabularyEditor`, `QuestionEditor`, `LessonBlockRenderer`.

Sửa/xóa/reorder chỉ đổi state local; không gọi CRUD để lắp graph. Thay draft hoặc mode vô hiệu hóa validation/token và khóa import cho đến khi “Kiểm tra lại”. Cancel confirm không gửi request. Replace có thêm confirm riêng. Schema lỗi không mở preview mới; knowledge lỗi vẫn sửa trực tiếp được. Bài published khóa nhập vào bài hiện tại, có lựa chọn NEW.

Nếu import mất phản hồi, giữ draft và cùng idempotency key, khóa sửa và cho retry cùng request. Lỗi 4xx xác định cho phép sửa/validate lại. Receipt khôi phục kết quả đã commit, cả sau token hết hạn.

## H. Import transaction

`importAiLessonDraft()` re-parse/normalize/validate schema và knowledge ở server. Token HMAC hết hạn 30 phút gắn user, target và hash draft. Import đòi `confirmed: true`; REPLACE thêm `replaceConfirmed: true`.

Một Serializable transaction: đọc receipt → guard target/status/history/source version → lesson/objectives → vocabulary → mapping → blocks → exercises/questions/options → validate graph vừa nhập → receipt → commit. Transaction timeout 30 giây, tối đa sáu lần retry serialization với backoff có giới hạn. Bất kỳ lỗi nào đều rollback cả graph và receipt. APPEND chỉ validate graph mới, không rewrite các hàng legacy chưa hợp lệ.

Idempotency receipt dùng key UUID duy nhất, user ID và hash request; cùng key/cùng payload trả cùng lesson, khác user/payload trả 409. Receipt commit cùng graph, có xử lý unique race. Xóa lesson làm receipt tombstone (`lessonId = null`), không trả kết quả trỏ tới bài đã xóa. Receipt không lưu nội dung preview.

## I. Vocabulary ID remapping

`remapAiVocabularyReferences()` chuyển từng vocabularyClientId qua Map đã xây từ các vocabulary vừa tạo. Thiếu mapping làm transaction fail. Chỉ lưu `{title, vocabularyIds}` với IDs thuộc lesson; final validation kiểm tra ownership. Không copy word vào block.

## J. Existing lesson behavior

APPEND giữ nguyên metadata, content/IDs/options/JSON extensions và thứ tự cũ; nối objective loại trùng và các collection mới sau max order. Không sửa câu đã có attempt.

Target lesson/chapter ID giữ kiểu chuỗi như Prisma và API hiện tại, chấp nhận ID seed/legacy không phải UUID; chỉ idempotency key cần UUID. Không tự đổi ID cũ.

REPLACE thay metadata và toàn graph sau xác nhận, chỉ khi lesson là DRAFT và không có progress, attempts hoặc SRS cards. Token còn gắn fingerprint metadata/IDs/updatedAt của mọi block/vocabulary/exercise/question/option. Nếu có sửa mới sau preview, yêu cầu kiểm tra lại; fingerprint được kiểm tra lại **trong transaction** để bảo vệ race. Rollback khôi phục cả những hàng cũ đã bị delete trước khi lỗi.

## K. Published lesson behavior

APPEND/REPLACE đều từ chối PUBLISHED/ARCHIVED trong transaction. Admin phải dùng workflow hiện có chuyển về DRAFT hoặc tạo NEW. Không hạ status tự động. Lesson và exercises do AI nhập luôn DRAFT; publish validation cũ giữ nguyên, WRITING/PRONUNCIATION tiếp tục không được xuất bản khi chưa có quy trình chấm thủ công.

## L. Tests

Fixture/schema/knowledge/provider/security, import transaction, rollback sau khi đã ghi questions, vocabulary remap, simultaneous double submit, replay sau expiry, changed-key payload, stale tokens/REPLACE, append legacy, replace rollback, published/archived, progress/attempt/SRS guards và UI cancellation/disable/revalidation/lost response. Provider HTTP được mock fetch, không gọi AI thật. Tests dùng DB `_test`; không chạy unit và E2E cùng lúc vì global setup reseed.

Kết quả kiểm tra cuối:

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS, không warning |
| `pnpm test:run` | PASS: 331/331 tests, 33 files (55 test mới so với QA trước) |
| `pnpm test:e2e` | PASS: 21/21 Chromium journeys |
| Playwright AI sau sửa ID legacy/preview | PASS: chạy lại 3/3 journeys với lesson/chapter ID không phải UUID |
| `pnpm build` | PASS: Prisma generate, compile, TypeScript và static generation; có đầy đủ page/API AI mới |
| `git diff --check` | PASS |
| `prisma migrate status` | Local development DB up to date |

Migration additive mới đã áp dụng trên local `korean_zero` và test `korean_zero_test`; không seed development DB. Test/build dùng auth secret tạm trong process, không sửa `.env`. Các log local: `.temp/ai-{unit,e2e,e2e-final,build,lint,typecheck}.log`; ảnh `.temp/ai-preview-{desktop,mobile,mobile-viewport}.png`. Artifact kiểm tra/generated files không đưa vào source diff.

## M. E2E

Ba journey AI mới: (1) Lesson → input 10 nguyên âm → generate → preview không DB writes → validate → sửa title/slug/block/vocabulary/question → validate → confirm import NEW → reload → đối chiếu full DB graph/IDs/objectives/options/DRAFT; (2) từ chưa học → ERROR/import disabled → sửa bằng QuestionEditor → validate thành công; (3) published guard và schema-invalid output không tới preview. Runtime fixture vẫn fail mọi pageerror/unexpected 5xx.

Đã xem ảnh desktop/mobile và viewport mobile; có assertion không overflow ngang. Full regression còn gồm CRUD authoring, legacy, responsive, learner quiz/replay/progress, auth/RBAC và SRS/audio.

## N. Remaining TODO

1. Cấu hình/test kết nối dịch vụ AI thật trên môi trường đích qua HTTP adapter. Hiện positive journeys dùng mock đúng yêu cầu; chưa đo chất lượng, latency/cost của một model thật, chưa gọi AI thật hoặc deploy production.
2. Admin vẫn cần đọc/đối chiếu kiến thức, nghĩa, bản dịch, pronunciation và audio. Coverage validator không thay người duyệt; semantic NLP/RAG/embeddings nằm ngoài phase này.
3. Manual grading workflow, media upload và các bản ghi âm còn thiếu giữ TODO của phase trước. Draft UI không tự lưu khi đóng/reload; chỉ confirm import lưu graph.
4. Khi triển khai cần chạy migration trước phiên bản mới; cấu hình secret auth hợp lệ, provider và remote audio allowlist nếu dùng remote recordings. Migration đã áp dụng local development/test, không seed dữ liệu thật.

## Ready status

**READY FOR AI-ASSISTED LESSON AUTHORING** cho pipeline authoring đã kiểm thử với mock deterministic và HTTP adapter có cấu hình. Đây là luồng admin duyệt draft và confirm import, không phải AI auto publishing. Provider/model thật vẫn cần được cấu hình và smoke-test trên môi trường đích.
