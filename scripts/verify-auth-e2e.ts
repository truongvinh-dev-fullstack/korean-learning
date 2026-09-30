import "dotenv/config";
import { adminService } from "../src/modules/admin/admin.service";
import { prisma } from "../src/shared/db/prisma";

async function runE2EVerification() {
  const baseUrl = "http://localhost:3000";
  console.log("=== BẮT ĐẦU KIỂM THỬ XÁC THỰC THỰC TẾ TRÊN LOCAL SERVER ===");

  // 1. Kiểm tra truy cập khi chưa đăng nhập
  console.log("\n[Bước 1] Kiểm tra bảo vệ route khi chưa đăng nhập:");
  const unauthDash = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
  console.log(`- GET /dashboard (chưa đăng nhập) -> Status: ${unauthDash.status}`);
  const dashLocation = unauthDash.headers.get("location");
  console.log(`- Redirect location: ${dashLocation}`);
  if (unauthDash.status === 307 && dashLocation?.includes("/dang-nhap")) {
    console.log("  => CHÍNH XÁC: Đã chặn truy cập và chuyển hướng về /dang-nhap");
  } else {
    throw new Error("Lỗi: Route /dashboard không chặn người dùng chưa đăng nhập!");
  }

  const unauthAdmin = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
  console.log(`- GET /admin (chưa đăng nhập) -> Status: ${unauthAdmin.status}`);
  const adminLocation = unauthAdmin.headers.get("location");
  console.log(`- Redirect location: ${adminLocation}`);
  if (unauthAdmin.status === 307 && adminLocation?.includes("/dang-nhap")) {
    console.log("  => CHÍNH XÁC: Đã chặn truy cập và chuyển hướng về /dang-nhap");
  } else {
    throw new Error("Lỗi: Route /admin không chặn người dùng chưa đăng nhập!");
  }

  // 2. Đăng ký tài khoản học viên mới
  const testEmail = `student.test.${Date.now()}@korean.local`;
  const testPassword = "Password123!";
  const testName = "Học Viên Thử Nghiệm";
  console.log(`\n[Bước 2] Đăng ký tài khoản mới: ${testEmail}`);

  const registerRes = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({
      name: testName,
      email: testEmail,
      password: testPassword,
    }),
  });

  const registerData = await registerRes.json();
  const setCookie = registerRes.headers.get("set-cookie");
  console.log(`- Status đăng ký: ${registerRes.status}`);
  console.log(`- Kết quả trả về: ${JSON.stringify(registerData)}`);

  if (!setCookie) {
    throw new Error("Lỗi: Không nhận được session cookie sau khi đăng ký!");
  }

  // Trích xuất cookie để gửi trong các request tiếp theo
  const cookieHeader = setCookie
    .split(",")
    .map((c) => c.split(";")[0])
    .join("; ");

  // 3. Kiểm tra Session và Role mặc định
  console.log("\n[Bước 3] Kiểm tra thông tin Session & Role:");
  const sessionRes = await fetch(`${baseUrl}/api/auth/get-session`, {
    headers: { Cookie: cookieHeader },
  });
  const sessionData = await sessionRes.json();
  console.log(`- Session user role: ${sessionData?.user?.role}`);
  if (sessionData?.user?.role === "STUDENT") {
    console.log("  => CHÍNH XÁC: Người dùng mới đăng ký tự động mang vai trò STUDENT");
  } else {
    throw new Error("Lỗi: Vai trò mặc định không phải STUDENT!");
  }

  // 4. Truy cập /dashboard với quyền STUDENT
  console.log("\n[Bước 4] Truy cập /dashboard với tài khoản STUDENT:");
  const studentDashRes = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: cookieHeader },
    redirect: "manual",
  });
  console.log(`- GET /dashboard (STUDENT) -> Status: ${studentDashRes.status}`);
  const dashHtml = await studentDashRes.text();
  if (studentDashRes.status === 200 && dashHtml.includes("Xin chào")) {
    console.log("  => CHÍNH XÁC: Học viên truy cập thành công giao diện Dashboard");
  } else {
    throw new Error("Lỗi: Học viên không mở được /dashboard!");
  }

  // 5. Thử truy cập /admin với quyền STUDENT
  console.log("\n[Bước 5] Thử truy cập /admin với tài khoản STUDENT:");
  const studentAdminRes = await fetch(`${baseUrl}/admin`, {
    headers: { Cookie: cookieHeader },
  });
  const adminHtml = await studentAdminRes.text();
  console.log(`- GET /admin (STUDENT) -> Status: ${studentAdminRes.status}`);
  if (adminHtml.includes("403 - Quyền truy cập bị từ chối")) {
    console.log("  => CHÍNH XÁC: Hệ thống chặn và hiển thị màn hình 403 Forbidden");
  } else {
    throw new Error("Lỗi: STUDENT không bị chặn khỏi /admin!");
  }

  // 6. Phân quyền ADMIN cho tài khoản qua AdminService
  console.log(`\n[Bước 6] Phân quyền ADMIN cho ${testEmail}:`);
  const promotedUser = await adminService.promoteUserToAdmin(testEmail);
  console.log(`- Đã cập nhật database: ${promotedUser.email} -> Role: ${promotedUser.role}`);

  // 7. Truy cập lại /admin sau khi đã là ADMIN
  console.log("\n[Bước 7] Truy cập lại /admin sau khi được phân quyền ADMIN:");
  const adminAccessRes = await fetch(`${baseUrl}/admin`, {
    headers: { Cookie: cookieHeader },
  });
  const adminPageHtml = await adminAccessRes.text();
  console.log(`- GET /admin (ADMIN) -> Status: ${adminAccessRes.status}`);
  if (
    adminAccessRes.status === 200 &&
    adminPageHtml.includes("Hệ thống Quản trị Korean Zero") &&
    !adminPageHtml.includes("403 - Quyền truy cập bị từ chối")
  ) {
    console.log("  => CHÍNH XÁC: Quản trị viên truy cập thành công Admin CMS Dashboard");
  } else {
    throw new Error("Lỗi: ADMIN không truy cập được /admin!");
  }

  // 8. Đăng xuất
  console.log("\n[Bước 8] Đăng xuất tài khoản:");
  const signOutRes = await fetch(`${baseUrl}/api/auth/sign-out`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      Cookie: cookieHeader,
    },
    body: JSON.stringify({}),
  });
  console.log(`- POST /api/auth/sign-out -> Status: ${signOutRes.status}`);

  // 9. Kiểm tra lại sau khi đăng xuất
  console.log("\n[Bước 9] Kiểm tra sau khi đăng xuất:");
  const postLogoutDash = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: cookieHeader },
    redirect: "manual",
  });
  console.log(`- GET /dashboard (sau đăng xuất) -> Status: ${postLogoutDash.status}`);
  if (postLogoutDash.status === 307) {
    console.log("  => CHÍNH XÁC: Session đã bị hủy và chuyển hướng về đăng nhập");
  }

  // Dọn dẹp tài khoản test
  await prisma.user.delete({ where: { email: testEmail } });
  console.log("\n=== TẤT CẢ CÁC BƯỚC XÁC THỰC THỰC TẾ ĐỀU THÀNH CÔNG RỰC RỠ! ===");
}

runE2EVerification()
  .catch((e) => {
    console.error("❌ Thất bại kiểm thử:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
