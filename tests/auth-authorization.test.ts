import "dotenv/config";
import { describe, it, expect } from "vitest";
import { sanitizeCallbackUrl } from "@/shared/auth/redirects";
import {
  assertAuthenticatedUser,
  assertAdminRole,
  UnauthorizedError,
  ForbiddenError,
} from "@/shared/auth/roles";
import { adminService } from "@/modules/admin/admin.service";
import { prisma } from "@/shared/db/prisma";

describe("Authentication & Authorization Security Suite", () => {
  describe("Callback URL Sanitizer (Open Redirect Protection)", () => {
    it("blocks arbitrary external HTTP and HTTPS URLs", () => {
      expect(sanitizeCallbackUrl("https://evil.com")).toBe("/dashboard");
      expect(sanitizeCallbackUrl("http://attacker.com/steal-cookie")).toBe("/dashboard");
      expect(sanitizeCallbackUrl("https://phishing.site/login")).toBe("/dashboard");
    });

    it("blocks protocol-relative URLs", () => {
      expect(sanitizeCallbackUrl("//evil.com")).toBe("/dashboard");
      expect(sanitizeCallbackUrl("//attacker.com/malicious")).toBe("/dashboard");
      expect(sanitizeCallbackUrl("/\\evil.com")).toBe("/dashboard");
    });

    it("blocks dangerous non-http pseudo-schemes", () => {
      expect(sanitizeCallbackUrl("javascript:alert(1)")).toBe("/dashboard");
      expect(sanitizeCallbackUrl("data:text/html,<script>alert(1)</script>")).toBe("/dashboard");
      expect(sanitizeCallbackUrl("vbscript:msgbox(1)")).toBe("/dashboard");
    });

    it("preserves safe internal relative URLs", () => {
      expect(sanitizeCallbackUrl("/dashboard")).toBe("/dashboard");
      expect(sanitizeCallbackUrl("/admin")).toBe("/admin");
      expect(sanitizeCallbackUrl("/courses/tieng-han-tu-con-so-0?tab=syllabus")).toBe(
        "/courses/tieng-han-tu-con-so-0?tab=syllabus"
      );
      expect(sanitizeCallbackUrl("/lessons/bai-1#vocab")).toBe("/lessons/bai-1#vocab");
    });

    it("allows absolute URLs matching the localhost application origin", () => {
      expect(sanitizeCallbackUrl("http://localhost:3000/dashboard")).toBe("/dashboard");
      expect(sanitizeCallbackUrl("http://localhost:3000/admin?section=users")).toBe(
        "/admin?section=users"
      );
    });

    it("falls back to default relative path when input is empty or null", () => {
      expect(sanitizeCallbackUrl(null)).toBe("/dashboard");
      expect(sanitizeCallbackUrl(undefined)).toBe("/dashboard");
      expect(sanitizeCallbackUrl("")).toBe("/dashboard");
      expect(sanitizeCallbackUrl("   ")).toBe("/dashboard");
      expect(sanitizeCallbackUrl("", "/custom-fallback")).toBe("/custom-fallback");
    });
  });

  describe("Protected Resource & Unauthenticated Access Enforcement", () => {
    it("rejects unauthenticated user session when asserting authentication", () => {
      expect(() => assertAuthenticatedUser(null)).toThrow(UnauthorizedError);
      expect(() =>
        assertAuthenticatedUser({ user: null as unknown as { id: string } })
      ).toThrow(UnauthorizedError);
    });

    it("prevents unauthenticated callers from accessing admin services", async () => {
      await expect(adminService.getAdminDashboardMetrics(null)).rejects.toThrow(
        UnauthorizedError
      );
      await expect(adminService.getAdminDashboardMetrics(undefined)).rejects.toThrow(
        UnauthorizedError
      );
    });
  });

  describe("Role-Based Access Control (STUDENT vs ADMIN)", () => {
    const studentUser = {
      id: "test-student-id",
      email: "student@korean.local",
      role: "STUDENT",
    };

    const adminUser = {
      id: "test-admin-id",
      email: "admin@korean.local",
      role: "ADMIN",
    };

    it("strictly blocks STUDENT role from asserting admin privilege", () => {
      expect(() => assertAdminRole(studentUser)).toThrow(ForbiddenError);

      try {
        assertAdminRole(studentUser);
      } catch (err) {
        expect((err as ForbiddenError).statusCode).toBe(403);
      }
    });

    it("strictly prevents STUDENT from executing admin services", async () => {
      await expect(
        adminService.getAdminDashboardMetrics(studentUser)
      ).rejects.toThrow(ForbiddenError);
    });

    it("permits ADMIN role to assert admin privilege without throwing", () => {
      expect(() => assertAdminRole(adminUser)).not.toThrow();
    });

    it("permits ADMIN to successfully execute admin services", async () => {
      const metrics = await adminService.getAdminDashboardMetrics(adminUser);

      expect(metrics).toBeDefined();
      expect(typeof metrics.courseCount).toBe("number");
      expect(typeof metrics.lessonCount).toBe("number");
      expect(typeof metrics.userCount).toBe("number");
      expect(Array.isArray(metrics.recentUsers)).toBe(true);
    });
  });

  describe("Admin Promotion Workflow", () => {
    it("fails when attempting to promote a non-existent email", async () => {
      await expect(
        adminService.promoteUserToAdmin("nguoidung-khong-ton-tai@domain.test")
      ).rejects.toThrow("không tồn tại");
    });

    it("successfully promotes a newly created student to ADMIN", async () => {
      const testEmail = `test-user-${Date.now()}@korean.local`;

      // Create a student in database
      const createdUser = await prisma.user.create({
        data: {
          id: `test-uid-${Date.now()}`,
          name: "Học viên Kiểm thử",
          email: testEmail,
          role: "STUDENT",
        },
      });

      expect(createdUser.role).toBe("STUDENT");

      // Promote to ADMIN
      const promoted = await adminService.promoteUserToAdmin(testEmail);
      expect(promoted.role).toBe("ADMIN");
      expect(promoted.email).toBe(testEmail);

      // Verify persistence in database
      const reFetched = await prisma.user.findUnique({
        where: { email: testEmail },
      });
      expect(reFetched?.role).toBe("ADMIN");

      // Cleanup
      await prisma.user.delete({ where: { email: testEmail } });
    });
  });
});
