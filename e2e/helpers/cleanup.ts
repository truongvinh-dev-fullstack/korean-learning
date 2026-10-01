import { prisma } from "../../src/shared/db/prisma";

export async function cleanupAccounts(emails: string[]) {
  if (emails.length === 0) return;
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  if (users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
}
