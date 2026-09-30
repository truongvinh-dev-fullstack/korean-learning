import "dotenv/config";
import { adminService } from "../src/modules/admin/admin.service";
import { prisma } from "../src/shared/db/prisma";

function parseEmailArg(): string | null {
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith("--email=")) {
      return arg.split("=")[1]?.trim() || null;
    }
    if (arg === "--email" && i + 1 < process.argv.length) {
      return process.argv[i + 1]?.trim() || null;
    }
  }
  return null;
}

async function main() {
  const email = parseEmailArg();

  if (!email) {
    console.error("❌ Lỗi: Thiếu tham số email.");
    console.error("👉 Cách sử dụng: pnpm admin:promote --email=user@example.com");
    process.exit(1);
  }

  try {
    const updated = await adminService.promoteUserToAdmin(email);
    console.log("--------------------------------------------------");
    console.log("✅ Phân quyền ADMIN thành công!");
    console.log(`- Họ và tên: ${updated.name}`);
    console.log(`- Email:     ${updated.email}`);
    console.log(`- Quyền hạn: ${updated.role}`);
    console.log("--------------------------------------------------");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Thất bại: ${msg}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
