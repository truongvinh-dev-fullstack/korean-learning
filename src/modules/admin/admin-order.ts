import type { Prisma } from "@prisma/client";

type OrderedItem = { id: string; displayOrder: number };
export type OrderedModel = "course" | "chapter" | "lesson" | "lessonBlock" | "vocabulary" | "exercise" | "question";
type LessonOrderedModel = "lessonBlock" | "vocabulary" | "exercise" | "question";

async function lessonGroup(tx: Prisma.TransactionClient, model: LessonOrderedModel, parentId: string) {
  const select = { id: true, displayOrder: true } as const;
  const orderBy = [{ displayOrder: "asc" }, { id: "asc" }] as const;
  switch (model) {
    case "lessonBlock": return tx.lessonBlock.findMany({ where: { lessonId: parentId }, select, orderBy: [...orderBy] });
    case "vocabulary": return tx.vocabulary.findMany({ where: { lessonId: parentId }, select, orderBy: [...orderBy] });
    case "exercise": return tx.exercise.findMany({ where: { lessonId: parentId }, select, orderBy: [...orderBy] });
    case "question": return tx.question.findMany({ where: { exerciseId: parentId }, select, orderBy: [...orderBy] });
  }
}

function updateOrder(tx: Prisma.TransactionClient, model: OrderedModel, id: string, displayOrder: number) {
  switch (model) {
    case "course": return tx.course.update({ where: { id }, data: { displayOrder } });
    case "chapter": return tx.chapter.update({ where: { id }, data: { displayOrder } });
    case "lesson": return tx.lesson.update({ where: { id }, data: { displayOrder } });
    case "lessonBlock": return tx.lessonBlock.update({ where: { id }, data: { displayOrder } });
    case "vocabulary": return tx.vocabulary.update({ where: { id }, data: { displayOrder } });
    case "exercise": return tx.exercise.update({ where: { id }, data: { displayOrder } });
    case "question": return tx.question.update({ where: { id }, data: { displayOrder } });
  }
}

async function uniqueGroup(tx: Prisma.TransactionClient, model: LessonOrderedModel, parentId: string) {
  const group = await lessonGroup(tx, model, parentId);
  if (new Set(group.map((item) => item.displayOrder)).size !== group.length) {
    for (const [index, item] of group.entries()) { await updateOrder(tx, model, item.id, index); item.displayOrder = index; }
  }
  return group;
}

/** Called inside a Serializable transaction, including the sibling reads. */
export async function insertDisplayOrder(tx: Prisma.TransactionClient, model: LessonOrderedModel, parentId: string, requested?: number) {
  const group = await uniqueGroup(tx, model, parentId);
  const order = requested ?? (group.at(-1)?.displayOrder ?? -1) + 1;
  for (const item of group) if (item.displayOrder >= order) await updateOrder(tx, model, item.id, item.displayOrder + 1);
  return order;
}

export async function moveDisplayOrder(tx: Prisma.TransactionClient, model: LessonOrderedModel, parentId: string, id: string, requested?: number) {
  if (requested === undefined) return;
  const group = await uniqueGroup(tx, model, parentId);
  const current = group.find((item) => item.id === id);
  if (!current || requested === current.displayOrder) return;
  for (const item of group) {
    if (item.id === id) continue;
    if (requested < current.displayOrder && item.displayOrder >= requested && item.displayOrder < current.displayOrder) await updateOrder(tx, model, item.id, item.displayOrder + 1);
    if (requested > current.displayOrder && item.displayOrder > current.displayOrder && item.displayOrder <= requested) await updateOrder(tx, model, item.id, item.displayOrder - 1);
  }
  await updateOrder(tx, model, id, requested);
}

async function siblings(tx: Prisma.TransactionClient, model: OrderedModel, id: string): Promise<OrderedItem[]> {
  const select = { id: true, displayOrder: true } as const;
  const orderBy = [{ displayOrder: "asc" }, { id: "asc" }] as const;
  switch (model) {
    case "course": return tx.course.findMany({ select, orderBy: [...orderBy] });
    case "chapter": { const item = await tx.chapter.findUniqueOrThrow({ where: { id } }); return tx.chapter.findMany({ where: { courseId: item.courseId }, select, orderBy: [...orderBy] }); }
    case "lesson": { const item = await tx.lesson.findUniqueOrThrow({ where: { id } }); return tx.lesson.findMany({ where: { chapterId: item.chapterId }, select, orderBy: [...orderBy] }); }
    case "lessonBlock": { const item = await tx.lessonBlock.findUniqueOrThrow({ where: { id } }); return tx.lessonBlock.findMany({ where: { lessonId: item.lessonId }, select, orderBy: [...orderBy] }); }
    case "vocabulary": { const item = await tx.vocabulary.findUniqueOrThrow({ where: { id } }); return tx.vocabulary.findMany({ where: { lessonId: item.lessonId }, select, orderBy: [...orderBy] }); }
    case "exercise": { const item = await tx.exercise.findUniqueOrThrow({ where: { id } }); return tx.exercise.findMany({ where: { lessonId: item.lessonId }, select, orderBy: [...orderBy] }); }
    case "question": { const item = await tx.question.findUniqueOrThrow({ where: { id } }); return tx.question.findMany({ where: { exerciseId: item.exerciseId }, select, orderBy: [...orderBy] }); }
  }
}

export async function swapDisplayOrder(tx: Prisma.TransactionClient, model: OrderedModel, a: OrderedItem, b: OrderedItem) {
  const group = await siblings(tx, model, a.id);
  // Repair the entire legacy sibling group, even when this particular pair has different orders.
  if (new Set(group.map((item) => item.displayOrder)).size !== group.length) {
    for (const [index, item] of group.entries()) { await updateOrder(tx, model, item.id, index); item.displayOrder = index; }
  }
  const freshA = group.find((item) => item.id === a.id), freshB = group.find((item) => item.id === b.id);
  if (!freshA || !freshB) return;
  a = freshA; b = freshB;
  await updateOrder(tx, model, a.id, b.displayOrder);
  await updateOrder(tx, model, b.id, a.displayOrder);
}
