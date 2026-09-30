# Hướng dẫn Phát triển & Vận hành Cục bộ (Local Development & Operations Guide)

Tài liệu này cung cấp toàn bộ quy trình thiết lập, kiểm thử, phân quyền và khắc phục sự cố dành cho lập trình viên trên môi trường Windows với cơ sở dữ liệu PostgreSQL cục bộ.

---

## 1. Yêu cầu Tiên quyết (Prerequisites)

- **Hệ điều hành**: Windows 10/11 (hỗ trợ PowerShell 5.1+ hoặc PowerShell 7+).
- **Node.js**: Phiên bản LTS 20.19+ hoặc 22.12+ (khuyên dùng Node.js 20.x LTS).
- **Package Manager**: `pnpm` (khuyên dùng v12.8+, cài đặt toàn cục bằng `npm install -g pnpm`).
- **Cơ sở dữ liệu**:
  - **Docker Desktop & Docker Compose** (khuyên dùng để tự động hóa khởi chạy PostgreSQL), HOẶC
  - **PostgreSQL Native 16 / 17** cài đặt trực tiếp trên máy và lắng nghe tại cổng `5432`.
- **Git** & **Chromium** (Playwright sẽ tải tự động qua `npx playwright install chromium`).

---

## 2. Thiết lập Lần đầu (First-Time Setup)

Dành cho lập trình viên mới clone mã nguồn, chạy lần lượt 6 câu lệnh sau trong terminal PowerShell:

```powershell
# 1. Cài đặt các thư viện phụ thuộc
pnpm install

# 2. Tạo file cấu hình môi trường từ mẫu chuẩn
Copy-Item .env.example .env

# 3. Khởi động PostgreSQL container chạy nền (nếu dùng Docker)
pnpm db:up

# 4. Áp dụng toàn bộ lịch sử migrations vào cơ sở dữ liệu
pnpm db:migrate

# 5. Khởi tạo dữ liệu mẫu chuẩn (Giáo trình tiếng Hàn, bài tập, câu hỏi)
pnpm db:seed

# 6. Khởi động máy chủ Next.js phát triển cục bộ
pnpm dev
```

Sau khi hoàn tất, ứng dụng sẽ hoạt động tại: **`http://localhost:3000`**.

Kiểm tra trạng thái kết nối cơ sở dữ liệu và sức khỏe hệ thống:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/health" | ConvertTo-Json
```

---

## 3. Tạo Tài khoản và Phân quyền Quản trị viên (Admin Promotion)

Hệ thống tuân thủ nguyên tắc bảo mật: Mọi tài khoản đăng ký mới qua giao diện mặc định luôn mang vai trò `STUDENT`. Chỉ tài khoản có vai trò `ADMIN` mới được phép truy cập `/admin` và gọi các mutation API `/api/admin/*`.

### Bước 1: Đăng ký tài khoản
Truy cập trình duyệt tại `http://localhost:3000/dang-ky` và tạo tài khoản (ví dụ: `admin@example.com`).

### Bước 2: Kích hoạt quyền ADMIN bằng CLI
Chạy lệnh quản trị viên trên terminal máy chủ:

```powershell
pnpm admin:promote --email=admin@example.com
```

### Bước 3: Đăng nhập và truy cập CMS Quản trị
1. Đăng nhập tại `http://localhost:3000/dang-nhap`.
2. Trên thanh điều hướng hoặc tại bảng học tập, nhấp vào **Trang Quản trị** hoặc truy cập trực tiếp `http://localhost:3000/admin`.
3. Kiểm tra quyền tác giả: tạo khóa học, chương học, bài học, khối nội dung, từ vựng và bài tập.

---

## 4. Đặt lại Dữ liệu Cục bộ An toàn (Safe Data Reset)

### Cách 1: Đặt lại dữ liệu chuẩn (Giữ nguyên cấu trúc bảng - Khuyên dùng)
Dùng khi muốn xóa sạch các dữ liệu rác, bài học thử nghiệm hoặc tiến độ học thử để quay về dữ liệu giáo trình chuẩn ban đầu:
```powershell
pnpm db:seed
```
*Lưu ý: Lệnh này xóa các tiến độ học viên thử nghiệm và khôi phục 8 bài học chuẩn cùng ngân hàng câu hỏi ban đầu một cách xác định (deterministic).*

### Cách 2: Làm mới hoàn toàn cơ sở dữ liệu (Clean Hard Reset)
Dùng khi muốn xóa toàn bộ database và chạy lại migration từ đầu:
```powershell
pnpm prisma migrate reset --force
pnpm db:seed
```

---

## 5. Chạy các Bộ Kiểm thử (Running Test Suites)

Tất cả các bài kiểm thử đều hoạt động độc lập, tự tạo tài khoản kiểm thử cô lập (isolated test users) và không phụ thuộc vào thứ tự chạy:

### 5.1. Unit & Integration Tests (Vitest)
Chạy toàn bộ 11 bộ kiểm thử đơn vị, quy tắc chấm điểm bảo mật và giải thuật SM-2:
```powershell
# Chạy một lần và xuất báo cáo:
pnpm test:run

# Chạy ở chế độ theo dõi file (watch mode):
pnpm test
```

### 5.2. End-to-End Tests (Playwright)
Chạy bộ kiểm thử mô phỏng hành vi người dùng thực tế trên trình duyệt Chromium:
```powershell
# Chạy toàn bộ 7 kịch bản E2E:
pnpm test:e2e

# Chạy một file kịch bản cụ thể:
npx playwright test e2e/01-anonymous-browsing.spec.ts
npx playwright test e2e/02-auth-journey.spec.ts
npx playwright test e2e/03-enrollment-progress.spec.ts
npx playwright test e2e/04-admin-cms-journey.spec.ts
npx playwright test e2e/exercise-smoke.spec.ts
npx playwright test e2e/srs-review.spec.ts

# Chạy có giao diện trực quan (UI mode):
npx playwright test --ui
```

### 5.3. Kiểm tra Chất lượng Code & Type Safety
```powershell
# Kiểm tra TypeScript strict mode:
pnpm typecheck

# Kiểm tra quy chuẩn linter:
pnpm lint

# Kiểm tra biên dịch gói sản xuất (Production Build):
pnpm build
```

---

## 6. Xử lý Lỗi Thường gặp (Troubleshooting & Common Errors)

### 6.1. Xung đột Cổng 5432 (`port is already allocated` hoặc `ECONNREFUSED`)
- **Nguyên nhân**: Máy tính đã cài đặt PostgreSQL dạng Windows Service chạy ngầm chiếm cổng 5432, khiến Docker không thể mở cổng.
- **Khắc phục**:
  - *Phương án A (Dùng service sẵn có trên máy)*: Mở `.env` và sửa mật khẩu khớp với mật khẩu Postgres trên máy của bạn:
    ```ini
    DATABASE_URL="postgresql://postgres:MAT_KHAU_CUA_BAN@localhost:5432/korean_zero?schema=public"
    ```
    Tạo database `korean_zero` qua pgAdmin hoặc psql:
    ```powershell
    & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE korean_zero;"
    ```
  - *Phương án B (Tắt service Windows để dùng Docker)*:
    ```powershell
    Stop-Service postgresql* -Force
    pnpm db:up
    ```

### 6.2. Lỗi Sai Mật khẩu Database (`password authentication failed for user "postgres"`)
- Kiểm tra tài khoản trong file `.env`:
  - Khi chạy Docker container qua `docker-compose.yml`, tài khoản mặc định là `postgres` / `postgres`.
  - Khi chạy PostgreSQL cài tay cục bộ, cập nhật mật khẩu bạn đã đặt khi cài đặt vào `.env`.

### 6.3. Docker Daemon Không Chạy (`docker: error during connect`)
- Khởi động ứng dụng **Docker Desktop** trên Windows và chờ biểu tượng góc chuyển sang trạng thái xanh (Engine Running).

### 6.4. Trình duyệt Playwright Chưa Cài Đặt
Nếu gặp thông báo `Executable doesn't exist at ms-playwright\...`:
```powershell
npx playwright install chromium
```

---

## 7. Danh mục Nghiệm thu Luồng MVP (Demo Checklist)

Thực hiện quy trình nghiệm thu đầy đủ 9 bước của MVP:

1. **Khách vãng lai xem trang chủ & danh mục**:
   - Mở `http://localhost:3000/`, xem giới thiệu và tính năng.
   - Nhấp vào "Khóa học", duyệt syllabus các chương và bài học.
   - Mở thử Bài 1 để đọc nội dung và nghe file phát âm mẫu.
2. **Đăng ký tài khoản học viên**:
   - Nhấp "Đăng ký" (`/dang-ky`), nhập thông tin học viên mới.
   - Xác nhận chuyển hướng tự động vào Bảng học tập cá nhân (`/dashboard`).
3. **Ghi danh khóa học**:
   - Chọn khóa "Tiếng Hàn từ con số 0", nhấp "Đăng ký khóa học ngay (Miễn phí)".
   - Hệ thống tự động chuyển vào Bài 1 của giáo trình.
4. **Học và hoàn thành bài học**:
   - Đọc các khối kiến thức: Hangul, từ vựng, ngữ pháp, đoạn hội thoại.
   - Nhấp nút "✓ Đánh dấu hoàn thành bài học", trạng thái bài học chuyển sang "Đã hoàn thành".
5. **Làm bài tập trắc nghiệm & điền từ**:
   - Cuộn xuống phần bài tập cuối bài: làm câu trắc nghiệm, điền từ, nghe audio và xếp câu.
   - Nộp bài tập, nhận kết quả chấm điểm bảo mật trả về từ máy chủ kèm lời giải chi tiết.
6. **Kiểm tra tiến độ trên Bảng học tập**:
   - Truy cập `/dashboard`.
   - Chuỗi học tập (Streak) hiển thị ngày học đầu tiên ("✔ Đã học hôm nay").
   - Thẻ "Tiếp tục học" gợi ý chuẩn xác Bài 2 tiếp theo.
7. **Ôn tập Flashcard ngắt quãng (SRS)**:
   - Các từ vựng của bài học đã hoàn thành tự động được nạp vào hàng đợi ôn tập.
   - Nhấp "Ôn ngay" (`/on-tap`), lật thẻ bằng [Phím Cách], đánh giá độ nhớ từ 1 đến 4.
   - Hoàn thành phiên ôn tập và nhận thông báo cập nhật chuỗi Streak.
8. **Chặn quyền Học viên truy cập Admin**:
   - Với tài khoản học viên, nhập URL `http://localhost:3000/admin`.
   - Màn hình 403 Forbidden xuất hiện thông báo từ chối truy cập và cung cấp nút quay về Dashboard.
9. **Biên soạn & Xuất bản nội dung của Admin**:
   - Nâng cấp tài khoản thành ADMIN (`pnpm admin:promote --email=...`).
   - Vào `/admin`, tạo một bài học mới ở trạng thái DRAFT.
   - Thêm khối nội dung TEXT, AUDIO (dùng đường dẫn `/audio/sample-hangul.mp3`) và từ vựng.
   - Nhấp "Xem trước (Preview)" để kiểm tra bài giảng.
   - Chuyển trạng thái sang PUBLISHED.
   - Mở tab ẩn danh kiểm tra: học viên đã có thể truy cập bài học mới ngay lập tức.

---

## 8. Giới hạn Sao lưu & Phục hồi trong Bản MVP (Backup/Restore Limitations)

- **Dữ liệu PostgreSQL**: Toàn bộ dữ liệu được lưu trong Docker volume `korean_zero_postgres_data` (hoặc data directory của native Postgres).
- **Lệnh Sao lưu Cục bộ (Backup)**:
  ```powershell
  # Tạo file dump SQL dự phòng:
  docker exec -t korean_zero_postgres pg_dump -U postgres korean_zero > backup_korean_zero.sql
  ```
- **Lệnh Khôi phục (Restore)**:
  ```powershell
  Get-Content backup_korean_zero.sql | docker exec -i korean_zero_postgres psql -U postgres -d korean_zero
  ```
- **Giới hạn MVP**:
  - Không có tự động sao lưu đám mây (S3/GCS); dữ liệu hoàn toàn nằm cục bộ trên máy host.
  - Tệp âm thanh không hỗ trợ upload trực tiếp qua multipart; chỉ tham chiếu file nội bộ trong thư mục `public/audio/` hoặc đường dẫn HTTPS hợp lệ.
