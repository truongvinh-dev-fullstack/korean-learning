# Production AI provider hardening

## Kế hoạch trước code

Đã đọc provider, service, AI schema, knowledge validator, token/mapper/repository import, API/UI, env, tài liệu AI Lesson Authoring và hướng dẫn Next.js đi kèm phiên bản cài đặt.

1. Cấu hình server riêng: OpenAI thật, HTTP bridge tương thích, mock chỉ dev/test; production phải cấu hình hợp lệ hoặc tắt rõ ràng bằng `disabled`.
2. Prompt builder có version và chuẩn HANGEUL/GRAMMAR/CONVERSATION/TOPIK; Structured Outputs có schema wire strict, sau đó vẫn qua schema và knowledge validation nội bộ.
3. Timeout tổng, tối đa ba attempts, backoff có giới hạn; chỉ retry lỗi tạm thời. Không repair hoặc retry schema invalid.
4. Rate limit và lease đồng thời theo admin trong PostgreSQL, không giữ transaction trong lúc gọi AI. Không ghi draft/lesson trước import.
5. Request ID xuyên suốt, log scalar có tên rõ ràng, usage; provenance được ký, giữ qua sửa/revalidate và lưu trong receipt import.
6. Lỗi API an toàn, metadata preview gọn; test HTTP giả lập, regression import/UI/E2E và script provider thật không ghi DB.

## Tài liệu chính thức đã đối chiếu

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [OpenAI error codes](https://developers.openai.com/api/docs/guides/error-codes)

## A. Provider

`OpenAiLessonProvider` gọi `POST /v1/responses` bằng server-side fetch, `store:false`, không stream và không tools. `LessonAiProvider.generateLesson(input, context?)` giữ contract trả output unknown để validator nội bộ quyết định. HTTP bridge cũ vẫn được hỗ trợ; bridge phải trả draft JSON trực tiếp và tuân thủ model/token cap được gửi. Usage chỉ có khi provider cung cấp; bridge trực tiếp không có usage thì để trống, không bịa số token.

## B. Config/env

| Biến | Cấu hình |
| --- | --- |
| AI_LESSON_PROVIDER | `openai`, `http`, `mock` (dev/test), hoặc `disabled` |
| AI_LESSON_API_KEY | Secret server-only, bắt buộc với provider thật |
| AI_LESSON_MODEL | Model do môi trường/account chọn, phải hỗ trợ Responses + Structured Outputs |
| AI_LESSON_BASE_URL | Mặc định `https://api.openai.com/v1`; chỉ HTTPS, không credentials/query/hash |
| AI_LESSON_ENDPOINT | Endpoint HTTPS cho custom `http` bridge |
| AI_LESSON_TIMEOUT_MS | Tổng ngân sách HTTP/retry/backoff: mặc định 90000, khoảng 1000–120000 |
| AI_LESSON_MAX_ATTEMPTS | Mặc định 3, tối đa 3; 1 để tắt retry |
| AI_LESSON_MAX_OUTPUT_TOKENS | Mặc định 12000, khoảng 256–32000 |
| AI_LESSON_RATE_LIMIT | Mặc định 5 lượt/admin/window |
| AI_LESSON_RATE_WINDOW_MS | Mặc định 600000 (10 phút) |
| AI_LESSON_VERIFIED_AUDIO_URLS | Asset remote đã được content team xác minh, phân cách dấu phẩy |

Production kiểm tra ở cả `next.config.ts` và `instrumentation.register()`. Phiên bản Next này in Ready sớm và có thể giữ process sống khi instrumentation reject; kiểm tra ngay lúc load config bảo đảm process thoát khi cấu hình sai. Thiếu provider, thiếu key/model, mock hoặc giá trị sai đều fail-fast với tên biến, không in giá trị secret. `disabled` là lựa chọn tắt tính năng rõ ràng. Development chưa cấu hình coi là disabled; API generate trả 503. Không dùng NEXT_PUBLIC cho cấu hình AI và không sửa/in `.env` thực tế.

Migration `20261004120000_ai_provider_hardening` thêm counter/lease và cột metadata nullable vào receipt. Triển khai migration cùng release. Generate chỉ ghi dữ liệu giới hạn, không ghi lesson/block/vocab/exercise/draft/receipt.

## C. Prompt builder

`buildLessonGenerationPrompt(input)` tách instructions và input JSON, gồm chủ đề, trình độ, số bài, thời lượng, đối tượng, notes; không gửi target ID hoặc graph cũ. Topic tối đa 1000 ký tự, level 100, audience 1000, notes 4000. Input được validate trước khi chiếm slot/gọi provider.

`LESSON_CONTENT_STANDARDS` tái sử dụng gợi ý HANGEUL/GRAMMAR/CONVERSATION/TOPIK. Giải thích tiếng Việt, tiếng Hàn tự nhiên, kiến thức được giới thiệu trước bài tập, đáp án rõ ràng. Không asset được cung cấp nên prompt cấm bịa audio/image URLs, yêu cầu null/omit audio và bỏ AUDIO/IMAGE/LISTENING_CHOICE. Knowledge validation cũng chặn URL audio không tồn tại/chưa xác minh ở bank, block và câu hỏi.

## D. Structured output

OpenAI nhận `text.format={type:"json_schema",name:"lesson_draft",strict:true,schema:...}`. Schema wire được suy ra từ contract thật: chuyển `oneOf`/intersection thành `anyOf`, tất cả object `additionalProperties:false`, tất cả field required; optional biểu diễn nullable. Chỉ chuyển null optional không nullable thành field vắng; không sửa nội dung, đáp án hoặc cấu trúc sai.

Parse bằng JSON.parse; không tách JSON từ prose/markdown bằng regex. Refusal/truncation/envelope hoặc JSON sai bị từ chối. Response bị giới hạn khi đọc cả chunked body, draft tối đa 512 KiB. Limits/refinements của Zod và knowledge validator luôn chạy lại. Schema invalid trả `draft:null`, `validationToken:null`, errorCode và validation summary; không retry/repair/import.

## E. Retry/timeout

Tối đa ba attempts cho timeout, 429, 5xx và network failure tạm thời đã nhận diện. Backoff 250/500 ms, có nhận Retry-After nhưng giới hạn 5 giây; mọi attempt/backoff nằm trong ngân sách tổng. Mỗi attempt có AbortController và phần ngân sách còn lại; timer được dọn khi kết thúc. Không retry 400/401/403, JSON/schema invalid hoặc lỗi bất kỳ không xác định là transient. Redirect bị chặn; không đọc/log error body của provider.

## F. Rate limit/concurrency

`AiLessonGenerationLimit` lưu một row/admin: window/counter và lease hết hạn. Transaction ngắn lock row PostgreSQL nên có hiệu lực giữa nhiều instance; không giữ transaction khi gọi AI. Một generation đang chạy chặn yêu cầu tiếp theo bằng 429. Lượt lỗi cũng tiêu thụ quota. Lease tự hết hạn khi process chết; private nonce ngăn release cũ xóa lease mới ngay cả khi client dùng lại request ID. Import/validate không dùng quota generate. 429 từ limiter có Retry-After.

## G. Error handling

Các mã API/UI: AI_PROVIDER_UNAVAILABLE, AI_PROVIDER_TIMEOUT, AI_RATE_LIMITED, AI_INVALID_RESPONSE, AI_SCHEMA_VALIDATION_FAILED, AI_GENERATION_FAILED. UI map mã sang thông báo Việt; timeout: “AI tạo bài học mất quá nhiều thời gian. Vui lòng thử lại.” Schema invalid giữ summary để admin xem, knowledge invalid vẫn có preview để sửa. Lỗi transport không làm lộ stack, provider body hoặc secret.

## H. Observability

Log JSON allowlist với event ai.lesson.generate.started/completed/failed, ai.lesson.schema.invalid, ai.lesson.knowledge.validation. Có requestId/userId/provider/model/promptVersion/durationMs/retryCount và validation/block/vocab/question counts khi đã có kết quả. Không log input, full prompt/response, token xác nhận hoặc API key. Browser tạo UUID riêng cho generation; API trả cùng ID trong payload và X-Request-Id, chuyển đến provider qua X-Client-Request-Id/metadata. ID này khác idempotency key import và không phải DB entity ID.

## I. Usage

`AiGenerationUsage` gồm inputTokens/outputTokens/totalTokens; map từ Responses usage. Log khi có và lưu trong provenance receipt; không dựng dashboard/cost, không hiển thị token trong preview.

## J. Prompt version/provenance

Version hiện tại `lesson-authoring-v1`. Metadata generation có requestId/provider/model/version/time/duration/retry/usage, nằm ngoài AiLessonDraft. Token HMAC với domain riêng gắn metadata và admin; UI giữ token qua edit/mode change/revalidate. Validation token và requestHash import gắn cả provenance, chống sửa/đổi nguồn sau validation. Receipt lưu metadata trong cùng transaction với graph. Metadata không chèn vào LessonBlock/Question content, không auto-publish. Preview chỉ thêm “AI tạo bản nháp · model · thời gian”.

## K. Tests

HTTP hoàn toàn mock trong CI: success, timeout/abort, 429, 500→success, transient network, invalid JSON/fences/envelope, refusal/truncation, schema invalid, retry exhausted, missing key/model, production mock rejected, input cap, request ID, usage, secret-safe logging. Có integration PostgreSQL cho rate/concurrency/window/abandoned lease và provenance import; UI kiểm tra error mapping/token giữ sau sửa. E2E kiểm tra browser→API ID và receipt metadata cùng workflow preview/edit/import.

Kết quả kiểm thử cuối được ghi ở cuối tài liệu. Một lần chạy full suite song song gặp xung đột Serializable ở test publish CRUD cũ; full suite được xác minh lại tuần tự (`vitest run --no-file-parallelism`) để tránh các test DB độc lập tranh chấp nhau. Retry transaction/publish pipeline hiện có được giữ nguyên.

## L. Manual real-provider test

1. Cấu hình trong môi trường server: AI_LESSON_PROVIDER=openai, AI_LESSON_MODEL là model có Structured Outputs được account cấp quyền, AI_LESSON_API_KEY và BASE_URL nếu cần. Không dán key vào source/docs/logs.
2. `npm run ai:test-provider -- --check-config` chỉ kiểm tra env, không gọi mạng/DB.
3. `npm run ai:test-provider` hoặc `npm run ai:test-provider -- --topic "Nguyên âm tiếng Hàn"` thực hiện một generation thật (có thể tính phí), rồi schema/knowledge/audio validation.
4. Xem summary: schemaValid/knowledgeValid/errors/warnings/info/block/vocab/question counts, request ID, model/version/time/retry/usage và issue codes/paths. Exit 0 khi valid, 1 khi cấu hình/provider/validation lỗi. Không in key/prompt/draft, không ghi DB. Script không import repository/service/Prisma.
5. Admin có thể tiếp tục kiểm tra UI bằng generate→review→edit→revalidate→confirm import ở môi trường mong muốn.

## M. TODO vận hành

Chọn model/account, nạp key trong secret store, chạy smoke test thật, đối chiếu chất lượng tiếng Hàn và đặt quota phù hợp. Không thực hiện paid network test trong vòng kiểm thử tự động này. Deployment cần migration và provider hợp lệ hoặc explicit disabled. Không thêm audio/image generation, RAG, embeddings, vector DB, auto-publish hoặc manual grading.

## Kết quả xác minh — 2026-10-04

- Full suite tuần tự: **367/367 tests, 35/35 files**.
- Full Chromium E2E: **21/21**; request ID/metadata/receipt và preview/edit/revalidate/import đều qua.
- Rerun AI E2E sau thay đổi fail-fast cuối: **3/3**; HTTP/provider test sau bổ sung diagnostic log: **30/30**.
- Typecheck/lint/production build: PASS (build dùng explicit disabled và secret auth chỉ trong process).
- Production startup smoke: mock bị từ chối bằng exit 1; explicit disabled khởi động, `/api/health` trả 200. Không gọi provider thật.
- CLI `--check-config`: PASS, networkCalled=false/databaseWrites=false.
- Migration mới đã áp dụng cho development PostgreSQL `localhost:5432/korean_zero` và DB test tách biệt `korean_zero_test`; không seed development, không thay lesson graph.
- Không sửa `.env` thực tế, không commit/deploy hoặc gọi AI trả phí. Key/model thật còn do môi trường vận hành cung cấp.

**READY FOR REAL AI PROVIDER TEST**
