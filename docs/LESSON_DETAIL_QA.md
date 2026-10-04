# Lesson Detail — REVIEW / QA

Ngày: 04/10/2026. Phạm vi: implementation hiện tại, migration authoring, tài liệu refactor và bài mẫu nguyên âm. Không thêm feature lớn.

Đã đọc source và lần theo UI → form → mapper/payload → route/guard → service → repository/transaction → PostgreSQL → API/server snapshot → mapper → UI. Kiểm thử dùng database riêng `korean_zero_test`, không seed hoặc nhập bài mẫu vào production. Bài mẫu được tạo qua API quản trị và các form thật trong Playwright, rồi dọn fixture sau test.

## A. BUG PHÁT HIỆN

| Mức | Lỗi | Ảnh hưởng |
| --- | --- | --- |
| Critical | Schema Zod mặc định bỏ các trường JSON legacy chưa khai báo, cả trường lồng trong ký tự/từ/ví dụ | Mở form rồi lưu có thể làm mất dữ liệu đã có |
| Critical | Kiểm tra lịch sử học viên ngoài transaction; câu hỏi có thể thay đổi giữa lúc tính điểm và ghi attempt | Có thể xóa/sửa dữ liệu đã có lịch sử hoặc ghi điểm từ phiên bản câu hỏi khác |
| Major | Partial update `correctAnswer` của FILL_BLANK không cập nhật `content.answers` đã sinh trước đó | Database và bộ chấm dùng đáp án cũ sau lần sửa |
| Major | Publish chưa kiểm tra đầy đủ metadata bài tập; bài tập rỗng có thể được xuất bản/tạo trong lesson đang live; có thể xóa câu cuối | Nội dung published có trạng thái không hợp lệ |
| Major | Cấp order ngoài transaction; bỏ qua vị trí 0, chèn giữa không dịch sibling; swap chỉ sửa duplicate của chính cặp đang đổi | Trùng thứ tự, thứ tự sai sau create/reorder/reload |
| Major | Kiểm tra reference khi xóa từ phụ thuộc toàn bộ block parse thành công | Block có field khác bị lỗi khiến từ đang được reference vẫn bị xóa |
| Major | Retry chỉ nhận Prisma P2034, không nhận lỗi serialization tại COMMIT từ pg adapter | Request đồng thời có thể trả 500; retry tức thời cũng dễ va chạm lại |
| Major | ORDERING lưu danh sách ID bằng chuỗi phân cách dấu phẩy | ID hợp lệ chứa dấu phẩy bị tách sai khi đọc lại kết quả |
| Major | Parser lỗi của câu hỏi legacy làm editor throw khi mở | Thay vì thông báo giữ bản gốc, UI có thể crash |
| Major | Lưu form câu hỏi xóa/tạo lại toàn bộ options, bỏ qua ID từ DTO | ID lựa chọn thay đổi cả khi chỉ sửa đề bài; persistence mất identity của dữ liệu cũ |
| Minor | Thông báo thành công cũ còn khi mở editor mới; API envelope/JSON lỗi chưa có thông báo phù hợp | Admin có thể hiểu sai kết quả hoặc thấy lỗi kỹ thuật |
| Minor | Card câu hỏi WRITING/PRONUNCIATION chưa ghi rõ việc không tự chấm | Dễ hiểu nhầm phạm vi grading |
| Minor | Mỗi sửa block/câu hỏi vừa reload collection vừa refresh cả lesson graph | Đọc lại dữ liệu nhiều hơn cần thiết |

Tám test tái hiện đầu tiên đều fail trước khi sửa. Các lỗi bổ sung được xác nhận qua source, lỗi pg adapter thực tế và kiểm thử persistence/concurrency. Khi sửa order, mapper câu hỏi mới cũng được chỉnh để bỏ `displayOrder` mặc định 0, cho server append; order tường minh của API vẫn được tôn trọng.

Kiểm thử tái hiện riêng về option IDs cũng fail trước sửa, với toàn bộ ID bị thay. Đã giữ ID/createdAt khi cập nhật và reorder, chỉ tạo ID cho lựa chọn mới; từ chối ID trùng hoặc thuộc câu khác. E2E so cả identity thay vì chỉ so text/đáp án.

## B. BUG ĐÃ SỬA

| File | Nguyên nhân | Cách sửa |
| --- | --- | --- |
| `src/modules/lessons/lesson-block.schema.ts` | Zod strip các field ngoài schema | Giữ extension bằng passthrough ở content và object lồng; các field chính vẫn validate |
| `src/modules/lessons/lesson-content.ts`, `src/modules/admin/admin.service.ts` | Round-trip legacy và đổi type có yêu cầu khác nhau; đáp án fill cũ thắng patch mới | Giữ extension khi sửa cùng type, chỉ loại field không tương thích khi chủ động đổi type; đồng bộ fill answer khi API cũ patch đáp án |
| `src/modules/admin/lesson-publish.ts`, `admin.repository.ts` | Publish/guard kiểm tra thiếu hoặc ở ngoài transaction | Validate bài tập và câu hỏi; không publish exercise rỗng; tạo draft trước trong lesson live; bảo vệ câu cuối; recheck guard và publish trong Serializable transaction |
| `src/modules/admin/admin-order.ts`, `admin.repository.ts`, `admin.service.ts` | Read max trước transaction và không dịch order | Read sibling, chèn/move/swap và ghi cùng transaction; xử lý 0, insertion, duplicate legacy trong toàn nhóm |
| `src/modules/admin/lesson-detail.mapper.ts` | Form mới mang order 0 và mapping question dựa vào cast | Bỏ order tự đặt của câu mới; dùng schema variant để tạo union theo type |
| `src/modules/admin/admin.repository.ts` | Xóa/recreate tất cả options và bỏ ID | Validate ownership/unique IDs, chỉ xóa lựa chọn bị bỏ, update lựa chọn giữ lại theo ID và create lựa chọn mới |
| `src/modules/admin/admin.repository.ts` | Chỉ kiểm tra vocabulary IDs sau khi toàn block parse hợp lệ | Kiểm tra reference array gốc, cùng transaction với guard SRS/xóa từ |
| `src/shared/db/serializable-transaction.ts`, `src/modules/admin/admin-transaction.ts` | Không nhận lỗi commit của adapter | Retry cả P2034 và `DriverAdapterError` có `TransactionWriteConflict`, backoff ngắn có jitter, hết retry trả conflict rõ ràng |
| `src/modules/exercises/exercise.service.ts`, `exercise.repository.ts` | Grading đọc câu hỏi trước transaction ghi attempt | Gửi ID/updatedAt của question snapshot; transaction đọc lại và từ chối snapshot đã thay đổi, bảo vệ phối hợp với transaction admin |
| `src/modules/exercises/exercise.repository.ts`, `result.ts` | Encoding ID bằng dấu phẩy không lossless | Dùng JSON array cho dạng mới; vẫn đọc cách lưu legacy và giữ ARRANGE_SENTENCE cũ |
| `src/components/admin/lesson-detail/question-editor.tsx`, `question-fields.tsx`, `exercise-card.tsx` | Không có fallback parser và badge đủ rõ | Mở modal lỗi an toàn, giữ nguyên bản gốc; ghi rõ chấm thủ công/chưa hỗ trợ tự động chấm |
| `src/modules/admin/admin.client.ts`, `use-admin-collection.ts`, các section | Envelope lỗi, feedback cũ và refetch toàn trang | Validate envelope, thông báo dễ hiểu, reset feedback khi mở form, khóa mutation/reload; chỉ vocabulary refresh server để cập nhật các reference picker |

## C. ARCHITECTURE IMPROVEMENT

- Giữ Course → Chapter → Lesson → Lesson Detail và đúng 5 section: thông tin, mục tiêu, nội dung, ngân hàng từ vựng, bài tập/câu hỏi.
- Page chính chỉ tải một graph và compose các section; business rules nằm ở schema/service/repository. Field editors và renderer có switch theo type phục vụ đúng trách nhiệm, không nhân thêm tầng abstraction.
- ContentBlock có discriminated union từ Zod; Question domain/form có union tương ứng và variant parser. UI không ép content sang từng type bằng cast rải rác.
- Dùng chung order transaction, retry, API/error handling, field controls và repeat/list editor. Bỏ non-null assertions ở editor, giảm cast cho mapping DOM/form; chỉ giữ cast tại biên API/generic schema/Prisma JSON có lý do về kiểu dữ liệu.
- Bỏ `as any`/eslint suppression ở API admin error handler bằng narrowing thuộc tính `details`. Giữ một suppression `no-img-element` có chủ ý ở IMAGE renderer: nguồn ảnh CMS có thể là URL tùy ý và chưa có metadata kích thước cho Next Image; không đổi media architecture trong QA.
- Xem SQL thực tế: lesson graph đọc theo từng relation bằng truy vấn nhóm `IN (...)`, gồm cả toàn bộ questions/options; không có vòng lặp query cho mỗi exercise/question. Đây là nhiều query theo relation, không phải một SQL duy nhất, nhưng số query không tăng theo số item. Objective nằm trong row lesson.
- Sau mutation block/exercise chỉ GET collection cần dùng. Vocabulary cần thêm server refresh để các block/reference picker có bank mới. Kiểm tra trình duyệt khi idle không có API quản trị tự lặp.

## D. DATABASE REVIEW

Migration `20261003090000_lesson_authoring` chỉ thêm cột và enum. Không backfill phá JSON, không sửa ID, không xóa dữ liệu, không thay FK/cascade hoặc index hiện có. Không cần migration mới cho các sửa QA.

- Prisma `migrate deploy` dùng ledger `_prisma_migrations`: đã chạy lại nhiều lần, không có migration pending; kiểm thử xác nhận migration này có đúng một lần áp dụng thành công. Không chạy lại SQL migration bằng tay — các lệnh ADD không tự idempotent ngoài ledger.
- Lesson level và Vocabulary difficulty nullable; tags/objectives có default mảng rỗng và NOT NULL; Question content nullable để đọc câu cũ.
- Enum giữ mọi giá trị cũ, thêm đủ type mới. Index theo `[lessonId, displayOrder]` và `[exerciseId, displayOrder]` vẫn có; FK parent có cascade theo thiết kế cũ.
- Vocabulary IDs trong JSON chưa có FK. API kiểm tra tồn tại/đúng lesson và prevent delete reference/SRS trong transaction. Reader bỏ ID không tìm thấy để tránh crash với dữ liệu hỏng nhập ngoài API.
- Xóa block không xóa vocabulary; đã kiểm tra cả API/DB. Xóa lesson/exercise/course/chapter có guard lịch sử trước cascade, kiểm tra lại trong transaction. Truy cập SQL/Prisma trực tiếp có thể bypass guard; không xem cascade ở DB là cơ chế bảo vệ lịch sử độc lập.
- Order chưa có unique constraint ở DB; bảo đảm nằm ở API/transaction, legacy duplicate được normalize trong nhóm khi mutation. Delete có thể để khoảng trống số nhưng không phá thứ tự; insertion/reorder tiếp tục hoạt động.

## E. LEGACY COMPATIBILITY

- TEXT, HANGUL, VOCABULARY `items[]`, AUDIO, CALLOUT `info` được kiểm tra parser → form → lưu → DB/reload. Test trình duyệt dùng API thật cho cả năm dạng; kiểm tra extension top-level và nested không mất.
- GRAMMAR `formula/explanation` vẫn đọc; mapper đồng bộ alias khi sửa và giữ nhiều examples/audio. Có regression tests sẵn và được chạy lại.
- Legacy vocabulary không tự convert. Admin phải xác nhận chuyển và chọn ID trong bank trước khi lưu; đóng modal sau chuyển không ghi gì. Sau chuyển, chỉ `items` được bỏ có chủ ý; các extension khác còn nguyên. Từ bank được sửa sẽ cập nhật preview sau reload; xóa từ referenced trả 409.
- FILL_BLANK null content fallback `correctAnswer`; partial edit lặp lại dùng đáp án mới. MC/listening vẫn dùng options; ARRANGE_SENTENCE và replay legacy giữ compatibility. Không sửa/xóa/ thêm câu vào bộ câu hỏi đã có lượt nộp.
- Legacy sai schema được giữ bản gốc và báo lỗi; không thay bằng fixture hoặc dữ liệu mẫu.

## F. UX REVIEW

| Phạm vi | Kiểm tra |
| --- | --- |
| 9 blocks | Create, validation field, save, reload, edit, reorder, preview, delete; đối chiếu trực tiếp DB |
| Dynamic arrays | Add/delete/reorder characters, grammar rules/examples, example items, dialogue lines; choice/item editors có field riêng |
| 11 questions | Form thật cho 10 type yêu cầu và ARRANGE_SENTENCE cũ; save/edit/reload/delete; TRUE_FALSE JSON là boolean, ORDERING đồng bộ items/order |
| Manual grading | WRITING/PRONUNCIATION lưu draft, card/editor ghi rõ giới hạn, publish bị từ chối |
| Vocabulary | Một bank theo lesson; references, sửa nghĩa và preview cập nhật, prevent delete; xóa block giữ bank |
| Errors | API lỗi giữ modal và state đã lưu; lỗi đọc response có notification; reload thất bại sau commit báo rõ đã lưu nhưng danh sách chưa cập nhật, có nút Tải lại |
| Double submit | Button/fieldset disable và ref guard chặn request trùng khi đang chạy; kiểm thử delayed request và failure/retry |
| Unsaved | Đóng/Escape không auto-save; destructive list/type conversion có confirm theo convention |
| Responsive | 1920/1440/1280/1024: không overflow ngang trang, table dùng được, modal ≤ 90vh có scroll, field/textarea và Save tiếp cận được |
| Media | Có validation URL/path và audio preview; source không có uploader nên upload error không có flow để test, không dựng feature upload trong QA |

Không có raw JSON trong card/list chính hoặc yêu cầu nhập array bằng JSON. Đã xem ảnh chụp các viewport và modal, ngoài kiểm tra DOM tự động.

Bài **“Bài 1: 10 Nguyên âm cơ bản”** được tạo qua API quản trị cho parent/lesson và form thật cho metadata, 4 objectives, 5 words (아이/오이/우유/이유/여우), 5 blocks, 10 characters và exercise **“Luyện tập: 10 Nguyên âm cơ bản”** với MC/MC/FILL_BLANK/LISTENING_CHOICE. Save/reload so toàn graph; sửa nội dung/nghĩa/đề bài, reorder các section rồi reload và so lại snapshot, ID, content, options/order trong DB. Exercise insertion/move/delete/reload còn được kiểm tra riêng vì bài mẫu chỉ có một exercise.

## G. TEST RESULT

| Lệnh | Kết quả cuối |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS, không warning/error |
| `pnpm test:run` | PASS — 276/276 tests, 30 files |
| `pnpm test:e2e` | PASS — 18/18 Chromium journeys, gồm 4 test QA mới |
| `pnpm build` | PASS — Prisma Client 7.10.0, Next.js 16.3.6, compile/TypeScript/static generation hoàn tất |
| `git diff --check` | PASS |

Unit/integration và E2E chạy tuần tự giữa hai suite vì cùng dùng test DB và global setup có reseed. Secret auth hợp lệ được cấp riêng cho process kiểm tra; không sửa `.env` hoặc ghi secret vào source. Production chưa được deploy.

Không bỏ test hoặc giảm assertion để đạt PASS. Đã thêm test fail trước sửa, so snapshot database sau reload, tăng assertion kiểm tra option IDs/createdAt. Test reorder chờ đúng HTTP response trước reload, tránh đọc khi request chưa hoàn tất. Fixture runtime vẫn fail trên mọi 5xx/pageerror ngoài dự kiến; case fault injection chỉ đăng ký một phản hồi 500 chính xác theo URL/method/status và bắt buộc phản hồi đó được quan sát.

Ảnh QA đã xem: `.temp/lesson-detail-{1920,1440,1280,1024}.png`, modal tương ứng và `.temp/lesson-detail-vowels-persisted.png`. Log kiểm tra cuối nằm trong `.temp/qa-unit.log`, `.temp/qa-e2e.log`, `.temp/qa-build.log`; thư mục này là artifact local, không commit.

Các test mới: `tests/lesson-detail-qa.test.ts`, kiểm thử UI/error/guard trong `tests/lesson-authoring-ui.test.tsx`, retry adapter trong `tests/admin-transaction.test.ts`, và `e2e/lesson-detail-qa.spec.ts`. Fixture JSON không được hard-code vào production source.

## H. CÒN TODO

1. Trước tích hợp AI: validator kiến thức câu hỏi theo vocabulary/characters/grammar đã giới thiệu (rules 1–3), không chỉ validator cấu trúc JSON.
2. Luồng nhận graph do AI sinh, validate, remap ID tạm → ID server, ghi nháp có khả năng rollback/recovery và duyệt trước publish. Hiện CRUD từng phần đã kiểm tra nhưng chưa có import graph nguyên khối.
3. Manual grading workflow/rubric/duyệt điểm cho WRITING/PRONUNCIATION; tiếp tục khóa published các dạng này.
4. Nếu cần bảo đảm reference/order cả cho SQL/import ngoài API: thiết kế bảng reference/FK và ràng buộc order riêng, kèm migration dữ liệu legacy; không mở rộng DB trong vòng QA này.
5. Upload media và hướng dẫn nét/audio còn thiếu ở một số ký tự/từ thuộc công việc nội dung/feature riêng. Chưa kiểm tra triển khai production.

## I. READY STATUS

**NOT READY FOR AI LESSON GENERATION** ở mức luồng tự động end-to-end: còn thiếu validator coverage kiến thức và luồng validate/remap/lưu graph AI. Nền tảng authoring thủ công, schema, API và persistence đã được sửa/kiểm tra trong phạm vi QA này; không lấy việc các test CRUD pass làm bằng chứng rằng AI generation đã hoàn chỉnh. Không triển khai các feature AI hoặc grading mới trong task QA.

## Phase tiếp theo

Kết luận trên thuộc vòng QA trước triển khai AI. Báo cáo phase AI-assisted authoring, validator, preview/confirm/import và kết quả kiểm thử mới nằm tại [AI_LESSON_AUTHORING.md](AI_LESSON_AUTHORING.md). Lịch sử lỗi/QA và các guard publish/manual grading được giữ nguyên.
