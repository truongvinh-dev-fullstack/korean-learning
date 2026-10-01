# Triển khai HTTPS với Vercel + Supabase

Vercel chạy Next.js và cấp địa chỉ `https://<project>.vercel.app`. Supabase cung cấp PostgreSQL; ứng dụng tiếp tục dùng Better Auth và Prisma. Không cần Supabase Auth, anon key hoặc service-role key. Audio trong `public/audio` được deploy cùng ứng dụng.

Production hiện tại: https://korean-zero.vercel.app. Vercel project: https://vercel.com/tri-nghia/korean-zero. Đã áp dụng 6 migrations, nạp nội dung mẫu và kiểm tra health, audio, đăng ký, đăng nhập, đăng xuất và dashboard trên production. Deployment đầu tiên được thực hiện từ workspace qua CLI; commit/push các thay đổi setup để các lần deploy tự động từ GitHub có cùng cấu hình.

## 1. Tạo Supabase Free

1. Đăng nhập https://supabase.com/dashboard và tạo project trong organization Free.
2. Đặt tên `korean-zero`, tạo mật khẩu database mạnh và chọn Singapore nếu có. Chờ database sẵn sàng.
3. Vào **Integrations > Data API**, tắt **Enable Data API**. Nếu wizard tạo project có tùy chọn này, bỏ chọn ngay từ đầu. App truy cập DB từ server bằng Prisma, không dùng Data API; các bảng Better Auth chứa session và thông tin đăng nhập nên không được phơi ra qua REST/GraphQL. Tắt Data API không ảnh hưởng kết nối PostgreSQL. Trước migration đầu tiên, chạy `prisma/supabase-hardening.sql` trong Supabase SQL Editor để thu hồi quyền của `anon`, `authenticated`, `service_role` trên các bảng hiện tại và tương lai. Script này đã được áp dụng cho project hiện tại.
4. Trong **Connect**, copy hai URI thực tế:
   - **Transaction pooler**, port **6543** → `DATABASE_URL` cho Vercel runtime.
   - **Session pooler**, port **5432** → `DIRECT_URL` cho migration. Session pooler hỗ trợ IPv4, không cần mua IPv4 add-on.
5. Thay `[YOUR-PASSWORD]` bằng mật khẩu database đã URL-encode. Không dùng mật khẩu đăng nhập tài khoản Supabase. Giữ hostname và username được dashboard cung cấp. Thêm `?sslmode=verify-full&sslrootcert=certs/supabase-ca.crt` để xác thực TLS bằng CA Supabase đã kèm trong repository. Next.js đã cấu hình đưa certificate vào các server functions.

App dùng Prisma 7 với driver `pg`; pool được cấu hình trong code (tối đa 5 kết nối mỗi instance). Các tham số Prisma engine cũ như `connection_limit` không cấu hình pool `pg` này.

## 2. Cấu hình bí mật production trên máy

Copy `.env.production.example` thành `.env.production.local` (đã được Git bỏ qua). Giữ `.env` hiện tại cho database local.

Điền `DATABASE_URL` và `DIRECT_URL` như bước 1. Tạo secret riêng cho production:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Lưu giá trị vào `BETTER_AUTH_SECRET`. Giữ secret ổn định qua các lần deploy. Đặt `BETTER_AUTH_URL` và `NEXT_PUBLIC_APP_URL` bằng cùng địa chỉ HTTPS production, ví dụ `https://korean-zero-ten-cua-ban.vercel.app`, không có dấu `/` cuối. Xác nhận domain thực tế trong Vercel; tên project có thể đã được sử dụng.

Không commit file này hoặc gửi URI có mật khẩu vào chat.

## 3. Tạo project Vercel

1. Đăng nhập https://vercel.com/new bằng tài khoản Hobby, import repository `truongvinh-dev-fullstack/korean-learning`.
2. Chọn tên project và ghi lại domain production. Framework **Next.js**, Root Directory **`.`**, Node.js **22.x**.
3. Trước khi bấm Deploy, đảm bảo các thay đổi setup đã được commit và push lên GitHub. Nếu deploy từ thư mục hiện tại bằng CLI thì không cần chờ push.
4. Trong **Environment Variables**, thêm các giá trị sau, chỉ chọn **Production**:

| Biến | Giá trị |
| --- | --- |
| `DATABASE_URL` | Transaction pooler Supabase, port 6543 |
| `DIRECT_URL` | Session pooler Supabase, port 5432 |
| `BETTER_AUTH_SECRET` | Secret production đã tạo |
| `BETTER_AUTH_URL` | Domain HTTPS production của Vercel |
| `NEXT_PUBLIC_APP_URL` | Cùng domain HTTPS production |

Không thêm `POSTGRES_PASSWORD`, `PORT` hay `NODE_ENV` vào Vercel. Next.js/Vercel tự đặt môi trường production. Không đặt prefix `NEXT_PUBLIC_` cho URI database hoặc secret.

`vercel.json` đã chọn Singapore (`sin1`), install bằng `npx --yes pnpm@12.8.1 install --frozen-lockfile` và build bằng `node scripts/vercel-build.mjs` (tương đương `pnpm run build:vercel`). Version pnpm được chỉ định vì repository dùng pnpm 12, mới hơn các version Vercel mặc định hỗ trợ. Build tự generate Prisma Client rồi áp dụng migrations **chỉ khi `VERCEL_ENV=production`**. Migration thất bại sẽ dừng build. Seed được chạy riêng, không chạy lại mỗi lần deploy.

Nếu dùng CLI từ thư mục dự án:

```powershell
pnpm dlx vercel login
pnpm dlx vercel link
pnpm dlx vercel env add DATABASE_URL production
pnpm dlx vercel env add DIRECT_URL production
pnpm dlx vercel env add BETTER_AUTH_SECRET production
pnpm dlx vercel env add BETTER_AUTH_URL production
pnpm dlx vercel env add NEXT_PUBLIC_APP_URL production
pnpm dlx vercel --prod
```

CLI sẽ yêu cầu nhập từng giá trị. Kiểm tra domain trong Vercel và sửa hai biến URL nếu domain khác dự kiến, rồi redeploy; `NEXT_PUBLIC_APP_URL` được đưa vào bundle lúc build.

## 4. Khởi tạo nội dung và admin

Sau deployment đầu tiên thành công (migrations đã chạy), dùng file production trên máy:

```powershell
pnpm db:seed:production
```

Lệnh này nạp khóa học mẫu, không sao chép học viên hoặc tiến độ từ database local. Nếu cần chuyển dữ liệu hiện có, phải thực hiện export/import riêng trước khi mở site cho người học.

Đăng ký tài khoản trên website production, sau đó cấp admin:

```powershell
pnpm admin:promote:production --email=ban@example.com
```

Nếu cần chạy migration trước deployment thủ công:

```powershell
pnpm db:deploy:production
```

Không dùng `prisma migrate dev`, `prisma migrate reset`, `prisma db push` hoặc bộ test trên database production. Bộ test của repository chạy trên database local riêng có hậu tố `_test`.

## 5. Kiểm tra website

- Mở `https://<project>.vercel.app/api/health`: HTTP 200, `status: "ok"`, `database: "connected"`.
- Trang chủ hiển thị khóa học sau seed.
- Đăng ký, đăng nhập, đăng xuất và đăng nhập lại; kiểm tra cookie trên domain HTTPS production.
- Thử ghi danh, học bài, nộp bài và ôn tập.
- Kiểm tra audio `/audio/lessons/korean-vowels.ogg` và `/audio/vocab/mul.ogg`.
- Đăng nhập admin, xác nhận mở được trang quản trị.

Preview cần database Supabase riêng và auth URL đúng domain preview. Không copy biến database production sang scope Preview. Build preview không chạy migration; áp dụng migrations riêng trên database preview nếu cần. Khi chỉ cấu hình Production, preview chưa thể dùng đầy đủ ứng dụng.

## Giới hạn miễn phí

Vercel Hobby dành cho dự án cá nhân, phi thương mại, có hạn mức sử dụng. Supabase Free hiện có 500 MB database, 2 project active và có thể pause sau 1 tuần không hoạt động. Dùng domain `vercel.app` để có HTTPS mà không phải mua tên miền. Không bật nâng cấp trả phí hay IPv4 add-on cho setup này.

## Tài liệu chính thức

- [Supabase + Prisma, kết nối session/transaction](https://supabase.com/docs/guides/database/prisma)
- [Tắt Data API khi chỉ dùng server-side database](https://supabase.com/docs/guides/api/securing-your-api)
- [Prisma trên Vercel](https://www.prisma.io/docs/orm/v7/prisma-client/deployment/serverless/deploy-to-vercel)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Supabase Free](https://supabase.com/pricing)
