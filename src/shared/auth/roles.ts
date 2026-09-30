export type UserRole = "STUDENT" | "ADMIN";

import {
  UnauthorizedError,
  ForbiddenError,
} from "@/shared/errors/domain-errors";

export { UnauthorizedError, ForbiddenError };

/**
 * Asserts that a session exists and has an authenticated user.
 */
export function assertAuthenticatedUser<T extends { user: { id: string; role?: string | null } } | null>(
  session: T
): asserts session is NonNullable<T> {
  if (!session || !session.user) {
    throw new UnauthorizedError();
  }
}

/**
 * Asserts that the authenticated user has the ADMIN role.
 */
export function assertAdminRole(user: { role?: string | null } | null | undefined): void {
  if (!user) {
    throw new UnauthorizedError();
  }
  if (user.role !== "ADMIN") {
    throw new ForbiddenError();
  }
}

/**
 * Checks whether a user possesses the ADMIN role without throwing.
 */
export function isAdmin(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === "ADMIN";
}
