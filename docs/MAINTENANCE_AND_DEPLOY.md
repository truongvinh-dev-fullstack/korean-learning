# Hướng dẫn chỉnh sửa và deploy lại Korean Zero

Dành cho các lần cập nhật sau khi dự án đã chạy trên Vercel + Supabase. Các lệnh bên dưới dùng **PowerShell**, chạy tại thư mục gốc dự án. Chạy từng lệnh và chỉ tiếp tục khi lệnh trước thành công.

- Website hiện tại: [korean-zero.vercel.app](https://korean-zero.vercel.app).
- Vercel project theo tài liệu triển khai: [korean-zero](https://vercel.com/tri-nghia/korean-zero).
- Cài đặt từ đầu hoặc chuyển sang project khác: [DEPLOYMENT.md](DEPLOYMENT.md).
- Hướng dẫn local chi tiết: [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md). Phiên bản Node.js/pnpm dùng theo `package.json`: **Node.js 22.x**, **pnpm 12.8.1**.

## 1. Quy trình nhanh cho mỗi lần sửa code

### Bước 1 — Cập nhật và chạy local

```powershell
Set-Location D:\Vinh\korean
git status
git branch --show-current
```

Nếu còn thay đổi chưa commit, lưu chúng bằng commit hoặc stash trước khi pull/chuyển nhánh. Ví dụ dưới dùng `main`; nếu Vercel theo dõi nhánh khác, thay tên nhánh tương ứng.

```powershell
git switch main
git pull --ff-only origin main
pnpm install --frozen-lockfile

# Chỉ khi dùng PostgreSQL qua Docker; mở Docker Desktop trước
pnpm db:up

# Áp dụng migrations mới từ Git vào database LOCAL
pnpm db:deploy
pnpm dev
```

Mở `http://localhost:3000`, sửa code và kiểm tra chức năng vừa sửa. Giữ terminal này chạy; dùng terminal thứ hai để kiểm tra/commit. Dừng server bằng `Ctrl+C`.

**Trước khi chạy:** `.env` phải trỏ tới PostgreSQL local. Nếu có `.env.local` hoặc `.env.development.local`, các giá trị trong đó cũng phải là local vì Next.js có thể ưu tiên chúng hơn `.env`. Prisma CLI và các script dùng `dotenv/config` mặc định đọc `.env`; giữ cấu hình local nhất quán. Không dùng cấu hình production để chạy dev hoặc test.

### Bước 2 — Kiểm tra trước khi đưa lên website

```powershell
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

`pnpm build` tạo Prisma Client và build Next.js; script này **không chạy migration**. Tuy nhiên, Next.js ưu tiên `.env.production.local` khi build. Nếu file này đang chứa Supabase thật, build có thể dùng database/domain production. Muốn kiểm tra hoàn toàn bằng local, tạm cất file đó ngoài thư mục dự án và bảo đảm các file `.env*` còn lại dùng cấu hình local; đưa file trở lại sau khi kiểm tra. Biến đã có trong terminal (`process.env`) cũng được ưu tiên hơn file `.env*`. Không đặt `NODE_ENV=development` trong terminal khi build.

Khi sửa đăng nhập, ghi danh, tiến độ, bài tập, ôn tập hoặc admin, chạy thêm E2E:

```powershell
# Chỉ cần tải Chromium lần đầu, hoặc khi Playwright yêu cầu phiên bản mới
pnpm exec playwright install chromium
pnpm test:e2e
```

Vitest/Playwright cần PostgreSQL đang chạy. Runner tạo/chuẩn bị database riêng có tên kết thúc bằng `_test`, chạy migration và seed ở đó. Chỉ dùng database test local; nếu đặt `TEST_DATABASE_URL`, phải trỏ tới database test riêng. E2E tự mở app tại cổng `3100`.

### Bước 3 — Commit và deploy qua Git

```powershell
git status
git diff

# Chỉ stage các file thuộc lần sửa này; thay bằng đường dẫn thực tế
git add src/components/ten-file-da-sua.tsx
git diff --cached
git commit -m "fix: mo ta thay doi"
git push origin main
```

Nếu Vercel đã kết nối repository và `main` là **Production Branch**, push sẽ tạo deployment Production. Kiểm tra repository ở **Settings > Git**, và nhánh theo dõi ở **Settings > Environments > Production > Branch Tracking**. Nếu chưa kết nối Git, dùng CLI ở mục 5. Cơ chế tự deploy được mô tả trong [tài liệu Vercel Git](https://vercel.com/docs/git).

Vào **Deployments**, đợi trạng thái **Ready**, đối chiếu commit vừa push rồi kiểm tra website theo mục 7. Git push thành công chưa có nghĩa là build/deploy đã thành công.

## 2. Cấu hình cần giữ giữa các lần làm việc

Kiểm tra công cụ:

```powershell
node --version
pnpm --version
git --version

# Khi chưa có pnpm đúng phiên bản, sau khi đã cài Node.js 22.x
npm install -g pnpm@12.8.1
```

| Nơi cấu hình | Dùng để làm gì |
| --- | --- |
| `.env` | PostgreSQL local, Better Auth local và `http://localhost:3000`; Docker đọc `POSTGRES_PASSWORD` ở đây |
| `.env.production.local` | Các lệnh quản trị production trên máy có hậu tố `:production` |
| Vercel Environment Variables, scope Production | Cấu hình build và runtime của website thật |
| Vercel Environment Variables, scope Preview | Database thử nghiệm riêng và URL auth của Preview, nếu sử dụng |

Chỉ tạo file cấu hình nếu chưa có, rồi điền giá trị phù hợp:

```powershell
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
if (-not (Test-Path .env.production.local)) {
    Copy-Item .env.production.example .env.production.local
}
```

Các file đã điền mật khẩu/secret và `.vercel/` được Git bỏ qua. `.vercelignore` cũng loại `.env*` khỏi upload CLI. Cấu hình trên Vercel phải được cập nhật riêng; sửa file trên máy không tự sửa biến trên Vercel. Giữ `BETTER_AUTH_SECRET` production ổn định qua các lần deploy thông thường.

## 3. Chọn quy trình theo loại thay đổi

| Thay đổi | Việc cần làm |
| --- | --- |
| Giao diện, CSS, chấm bài, API, logic học tập | Sửa code → kiểm tra → commit/push hoặc deploy CLI |
| Thêm ảnh/audio trong `public/` | Thêm file và cập nhật đường dẫn → commit/push → kiểm tra asset sau deploy |
| Sửa giáo trình trên trang `/admin` production | Lưu/xuất bản trong admin; dữ liệu được ghi vào Supabase, không cần deploy code |
| Sửa `prisma/schema.prisma` | Tạo migration local → kiểm tra SQL → commit schema và migration → deploy |
| Sửa `prisma/seed.ts` | Commit code chưa làm dữ liệu production thay đổi; chỉ seed thủ công khi chủ đích cập nhật dữ liệu mẫu |
| Thêm thư viện | `pnpm add TEN_GOI` hoặc `pnpm add -D TEN_GOI` → kiểm tra → commit `package.json` và `pnpm-lock.yaml` |
| Đổi domain, mật khẩu DB hoặc biến môi trường | Cập nhật biến Production trên Vercel và cấu hình quản trị trên máy → deploy mới |

Repository có cả `package-lock.json` và `pnpm-lock.yaml`, nhưng Vercel hiện cài bằng **pnpm** theo `vercel.json`. Dùng pnpm khi thêm/cập nhật thư viện và commit lockfile pnpm cùng `package.json`.

## 4. Khi thay đổi cấu trúc database

### Tạo migration trên local

Sửa `prisma/schema.prisma`, bảo đảm `DATABASE_URL` và `DIRECT_URL` trong `.env` trỏ tới local (`DIRECT_URL` có thể để trống để dùng `DATABASE_URL`), rồi chạy:

```powershell
pnpm db:migrate --name add_ten_thay_doi
pnpm exec prisma generate
pnpm exec prisma migrate status
```

Lệnh đầu tạo thư mục mới trong `prisma/migrations/` và áp dụng migration vào local. Đọc `migration.sql`, kiểm tra việc xóa cột/bảng, đổi kiểu dữ liệu hoặc thêm trường bắt buộc trên bảng đã có dữ liệu. Chạy lại các kiểm tra ở mục 1, sau đó:

```powershell
git add prisma/schema.prisma prisma/migrations
# Stage thêm các file code liên quan trước khi commit
git diff --cached
git commit -m "feat: cap nhat cau truc database"
git push origin main
```

### Production nhận migration thế nào?

Theo `scripts/vercel-build.mjs`, build trên Vercel chạy lần lượt:

1. `prisma generate`.
2. `prisma migrate deploy` **chỉ khi `VERCEL_ENV=production`**.
3. `next build`.

Migration lỗi sẽ dừng build. Deploy Production thông thường không cần chạy migration tay và **không tự seed**. Migration đã áp dụng có thể vẫn còn trong Supabase nếu bước build Next.js thất bại sau đó.

Trước migration có nguy cơ mất/biến đổi dữ liệu, sao lưu và kiểm tra cách khôi phục. Code đang chạy vẫn dùng database trong lúc build mới áp dụng migration; nên thêm trường/bảng trước, chuyển code và dữ liệu, rồi xóa cấu trúc cũ trong lần cập nhật sau. Không sửa migration đã áp dụng; tạo migration mới để điều chỉnh.

### Chạy thủ công khi cần

Sau khi điền đúng `.env.production.local`, kiểm tra trạng thái:

```powershell
node --env-file=.env.production.local node_modules/prisma/build/index.js migrate status
```

Chỉ khi muốn áp dụng migrations trước deployment:

```powershell
pnpm db:deploy:production
```

Đây là thao tác lên Supabase thật. Các script `:production` dùng `node --env-file=.env.production.local`; biến môi trường đã có trong terminal có thể ghi đè giá trị từ file, nên dùng terminal không có các biến database/auth cũ.

**Không dùng trên production:** `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, hoặc bộ test. Thay đổi schema được quản lý bằng Prisma trong repository; không cần chạy thêm `supabase db push` cho quy trình hiện tại.

## 5. Deploy thủ công bằng Vercel CLI

Chạy trong thư mục dự án. Đăng nhập/link khi dùng máy mới hoặc thư mục chưa liên kết:

```powershell
pnpm dlx vercel login
pnpm dlx vercel link
```

Chọn đúng tài khoản/team và **project đã tồn tại** `korean-zero`. Sau đó:

```powershell
git status
pnpm dlx vercel --prod
```

Lệnh này upload source từ thư mục hiện tại và build trên Vercel bằng biến Production. Vì có thể đưa cả thay đổi chưa commit lên website, nên kiểm tra và commit trước để dễ truy vết. `--prod` được xác nhận trong [tài liệu deploy CLI](https://vercel.com/docs/cli/deploy).

Nếu đã push nhánh Production và Vercel đang tự deploy commit đó, chỉ theo dõi deployment hiện có; không cần deploy CLI lần nữa.

### Preview cho tính năng mới

```powershell
git switch -c feature/ten-tinh-nang
# Sửa, kiểm tra, commit rồi push
git push -u origin feature/ten-tinh-nang
```

Vercel Git integration có thể tạo Preview cho nhánh này. Có thể deploy Preview từ local bằng `pnpm dlx vercel` khi project đã link. Chỉ sử dụng khi đã cấu hình **database riêng** và hai biến URL khớp domain Preview ổn định. Không dùng biến database production trong scope Preview.

Build Preview của dự án **không chạy migration**. Trước khi thử app, áp dụng migrations đã commit vào database Preview bằng session/direct URL riêng; có thể dùng file riêng `.env.preview.local` đã được Git bỏ qua:

```powershell
node --env-file=.env.preview.local node_modules/prisma/build/index.js migrate deploy
```

Điền `DIRECT_URL` database Preview trong file đó và dùng terminal không có biến production. Nếu Preview chưa có đủ biến môi trường, build hoặc chức năng cần database/auth có thể lỗi. Sau khi kiểm tra, merge tính năng vào Production Branch để tạo build Production mới với cấu hình và migration đúng môi trường.

## 6. Cập nhật biến môi trường hoặc domain

Trong Vercel project → **Settings > Environment Variables**, cập nhật đúng scope **Production**:

| Biến | Giá trị cần giữ đúng |
| --- | --- |
| `DATABASE_URL` | Supabase Transaction pooler, cổng `6543`, dùng cho runtime |
| `DIRECT_URL` | Supabase Session pooler, cổng `5432`, dùng cho migration |
| `BETTER_AUTH_SECRET` | Secret production hiện tại, tối thiểu 32 ký tự |
| `BETTER_AUTH_URL` | Domain HTTPS production, không có `/` cuối |
| `NEXT_PUBLIC_APP_URL` | Cùng domain với `BETTER_AUTH_URL` |

Copy hostname/username từ **Supabase > Connect**, không tự suy ra từ tên region. URL-encode mật khẩu DB, và giữ cấu hình TLS `sslmode=verify-full&sslrootcert=certs/supabase-ca.crt`. Cách chọn pooler tham khảo [tài liệu kết nối Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

Ví dụ cập nhật biến đã có bằng CLI, nhập giá trị khi được hỏi:

```powershell
pnpm dlx vercel env update BETTER_AUTH_URL production
pnpm dlx vercel env update NEXT_PUBLIC_APP_URL production
# Chạy riêng khi cần đổi kết nối database
pnpm dlx vercel env update DATABASE_URL production
pnpm dlx vercel env update DIRECT_URL production
```

Với biến mới, dùng `pnpm dlx vercel env add TEN_BIEN production`. Cú pháp tham khảo [Vercel env CLI](https://vercel.com/docs/cli/env).

Sau khi lưu biến, tạo **deployment mới** bằng push code hoặc `pnpm dlx vercel --prod`. Biến mới không áp dụng ngược cho deployment cũ theo [tài liệu Environment Variables](https://vercel.com/docs/environment-variables). `NEXT_PUBLIC_APP_URL` được đóng gói khi build nên cần build lại. Cập nhật `.env.production.local` riêng để các lệnh quản trị trên máy dùng cùng cấu hình.

Đổi domain thì thêm/cấu hình domain ở Vercel trước, cập nhật cả hai biến URL, deploy lại và kiểm tra đăng nhập trên domain mới. Không thêm `POSTGRES_PASSWORD`, `PORT` hoặc `NODE_ENV` vào Vercel theo setup hiện tại.

## 7. Kiểm tra sau mỗi lần deploy

```powershell
Invoke-RestMethod -Uri "https://korean-zero.vercel.app/api/health" | ConvertTo-Json
```

Kỳ vọng HTTP `200`, `status: "ok"`, `database: "connected"`. Thay URL nếu đã đổi domain. Health chỉ xác nhận app kết nối được database; kiểm tra thêm:

- Trang chủ và danh sách khóa học.
- Đăng nhập, đăng xuất, đăng nhập lại.
- Chức năng vừa sửa; nếu liên quan, thử ghi danh, nộp bài, lưu tiến độ và ôn tập.
- Quyền admin và nội dung đã xuất bản.
- Audio, ví dụ `/audio/lessons/korean-vowels.ogg` và `/audio/vocab/mul.ogg`.

Xem log từ Vercel Dashboard hoặc CLI. Thay URL ví dụ bằng **URL deployment cụ thể** lấy từ Deployments:

```powershell
# Thông tin deployment
pnpm dlx vercel inspect https://URL-DEPLOYMENT.vercel.app

# Log trong quá trình build
pnpm dlx vercel inspect https://URL-DEPLOYMENT.vercel.app --logs

# Log khi ứng dụng chạy
pnpm dlx vercel logs --deployment https://URL-DEPLOYMENT.vercel.app
```

Tham khảo [inspect](https://vercel.com/docs/cli/inspect) và [logs](https://vercel.com/docs/cli/logs). Khi cần gửi log để xử lý lỗi, loại bỏ mật khẩu, secret và URI chứa thông tin đăng nhập.

## 8. Dữ liệu mẫu và tài khoản admin

Dự án **không tạo sẵn tài khoản admin hoặc mật khẩu admin mặc định** khi build/deploy hoặc seed. Admin là tài khoản người dùng được cấp vai trò `ADMIN`; tài khoản đăng ký mới mặc định là `STUDENT`. Email và mật khẩu đăng nhập vẫn là thông tin bạn đã chọn khi đăng ký.

### Tạo admin đầu tiên trên website đã deploy

1. Mở [trang đăng ký production](https://korean-zero.vercel.app/dang-ky), tạo tài khoản bằng email của bạn và mật khẩu bạn tự đặt (tối thiểu 8 ký tự). Nếu đã có tài khoản trên website này, dùng email đó và bỏ qua đăng ký. Tài khoản tạo ở localhost không tự xuất hiện trên production.
2. Trên máy, mở terminal PowerShell tại `D:\Vinh\korean`. Bảo đảm đã cài dependencies và file `.env.production.local` chứa cấu hình của **cùng Supabase project mà website đang dùng**: `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` và `NEXT_PUBLIC_APP_URL`. Xem mục 2 và 6; chỉ copy `.env.production.example` nếu chưa có file, rồi điền giá trị thật.
3. Chạy lệnh sau, thay `ban@example.com` bằng email vừa đăng ký:

```powershell
Set-Location D:\Vinh\korean
pnpm admin:promote:production --email=ban@example.com
```

4. Khi terminal báo phân quyền thành công và `Quyền hạn: ADMIN`, đăng xuất trên website rồi đăng nhập lại bằng **email và mật khẩu đã đăng ký**.
5. Mở [trang quản trị](https://korean-zero.vercel.app/admin). Không cần build hoặc deploy lại vì quyền đã được cập nhật trực tiếp trong Supabase.

Nếu báo email không tồn tại, kiểm tra bạn đã đăng ký trên production, nhập đúng email và `.env.production.local` trỏ đúng database của website. Lệnh chỉ nâng quyền cho tài khoản đã tồn tại, không tạo tài khoản hay đổi mật khẩu. Nếu báo thiếu file/biến môi trường, hoàn thiện cấu hình production trước khi chạy lại.

Local dùng `pnpm admin:promote --email=ban@example.com` sau khi đăng ký tại `http://localhost:3000/dang-ky`; lệnh này không cấp quyền trên website production.

### Nạp dữ liệu mẫu khi cần

Chỉ khi chủ đích nạp/cập nhật giáo trình mẫu trên Supabase:

```powershell
pnpm db:seed:production
```

Seed có thể cập nhật/ghi đè các trường giáo trình mẫu đã sửa; không chạy lại sau mỗi deployment. `pnpm db:seed` dùng cho local. Sửa dữ liệu trong admin local không tự chuyển sang Supabase production; migrations cũng không sao chép học viên, bài học hoặc tiến độ giữa các database.

## 9. Quay lại bản cũ khi deployment gặp lỗi

Nếu build thất bại, domain production thường tiếp tục phục vụ deployment đang hoạt động. Xem log và trạng thái migration trước khi thử lại; database có thể đã được thay đổi ở bước migration.

Nếu deployment mới đã Ready nhưng chức năng lỗi, chọn bản Production trước đó trong Vercel Dashboard để rollback, hoặc dùng URL bản cũ:

```powershell
pnpm dlx vercel rollback https://URL-DEPLOYMENT-CU.vercel.app
```

Theo [Vercel rollback CLI](https://vercel.com/docs/cli/rollback), Hobby chỉ cho rollback về deployment Production liền trước. Rollback ứng dụng không hoàn tác migration hoặc dữ liệu Supabase; chỉ quay lại code cũ khi code đó còn tương thích với schema hiện tại.

Sau khi ổn định website, sửa lỗi hoặc revert commit code trên Git để lần deploy tiếp theo không đưa lỗi trở lại:

```powershell
git log --oneline -10
git revert MA_COMMIT_LOI
# Kiểm tra lại trước khi push
git push origin main
```

Lệnh ví dụ dành cho một commit code thông thường. Nếu commit chứa migration đã áp dụng, giữ nguyên lịch sử migration và tạo bản sửa/migration mới; không revert mù cả thư mục migration.

## 10. Tra nhanh lỗi thường gặp

| Triệu chứng | Kiểm tra/cách xử lý |
| --- | --- |
| `pnpm` không tìm thấy | Cài Node.js 22.x và `pnpm@12.8.1`, mở terminal mới |
| `ERR_PNPM_OUTDATED_LOCKFILE` khi deploy | Chạy `pnpm install` ở local, kiểm tra rồi commit `package.json` và `pnpm-lock.yaml` |
| Vercel không deploy sau push | Kiểm tra repository, Production Branch và trạng thái deployment; nếu chưa kết nối Git thì dùng CLI |
| `DIRECT_URL is required` hoặc lỗi cổng `6543` khi build Production | Đặt `DIRECT_URL` trong scope Production bằng Session pooler `5432` rồi deploy mới |
| Health trả `503`, lỗi kết nối hoặc xác thực DB | Kiểm tra trạng thái Supabase, hostname/username từ Connect, mật khẩu URL-encoded, biến Production và certificate TLS |
| Đăng nhập lỗi sau đổi domain | Kiểm tra cả hai biến URL cùng domain HTTPS và tạo deployment mới |
| Prisma Client thiếu field vừa thêm | Chạy `pnpm exec prisma generate`, khởi động lại dev server; xác nhận schema/migration đã commit |
| Migration thất bại | Đọc build log, đối chiếu migration status và SQL; sửa nguyên nhân trước khi deploy lại, không reset database thật |
| Playwright báo thiếu Chromium | `pnpm exec playwright install chromium` |
| Sửa admin local nhưng website thật chưa đổi | Local và Supabase là hai database riêng; cập nhật nội dung trên admin production |

## 11. Checklist trước khi kết thúc lần cập nhật

- [ ] Đã kiểm tra local và các lệnh kiểm tra cần thiết thành công.
- [ ] Commit có đủ code, asset, schema/migration hoặc lockfile liên quan.
- [ ] Không stage `.env*` đã điền secret hoặc `.vercel/`.
- [ ] Nếu đổi biến môi trường, đã cập nhật đúng scope và deploy mới.
- [ ] Deployment đúng commit đã Ready; health và chức năng vừa sửa hoạt động.
- [ ] Không chạy seed/reset trên Supabase trong quy trình cập nhật thông thường.
