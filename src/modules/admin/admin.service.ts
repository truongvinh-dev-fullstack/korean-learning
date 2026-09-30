import { prisma } from "@/shared/db/prisma";
import { assertAdminRole } from "@/shared/auth/roles";

export class AdminService {
  /**
   * Retrieves high-level administrative metrics and content statistics.
   * Requires the caller to hold the ADMIN role.
   */
  async getAdminDashboardMetrics(sessionUser: { role?: string | null } | null | undefined) {
    assertAdminRole(sessionUser);

    const [userCount, courseCount, chapterCount, lessonCount, exerciseCount, vocabCount, users] =
      await Promise.all([
        prisma.user.count(),
        prisma.course.count(),
        prisma.chapter.count(),
        prisma.lesson.count(),
        prisma.exercise.count(),
        prisma.vocabulary.count(),
        prisma.user.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      userCount,
      courseCount,
      chapterCount,
      lessonCount,
      exerciseCount,
      vocabCount,
      recentUsers: users,
    };
  }

  /**
   * Promotes a registered user to the ADMIN role.
   */
  async promoteUserToAdmin(email: string) {
    const trimmedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!existing) {
      throw new Error(`Người dùng với email "${trimmedEmail}" không tồn tại trong hệ thống.`);
    }

    const updated = await prisma.user.update({
      where: { email: trimmedEmail },
      data: { role: "ADMIN" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
      },
    });

    return updated;
  }
}

export const adminService = new AdminService();
