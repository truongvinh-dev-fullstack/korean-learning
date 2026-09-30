import { prisma } from "../src/shared/db/prisma";

async function check() {
  const course = await prisma.course.findFirst({
    include: {
      chapters: {
        orderBy: { displayOrder: "asc" },
        include: {
          lessons: {
            orderBy: { displayOrder: "asc" },
            include: {
              _count: {
                select: { blocks: true, vocabularies: true, exercises: true },
              },
            },
          },
        },
      },
    },
  });

  console.log("=== COURSE ===");
  console.log({
    title: course?.title,
    slug: course?.slug,
    chapters: course?.chapters.length,
  });

  console.log("=== CHAPTERS & LESSONS ===");
  course?.chapters.forEach((c) => {
    console.log(`[Chapter ${c.displayOrder}] ${c.title} (${c.lessons.length} lessons)`);
    c.lessons.forEach((l) => {
      console.log(
        `  - [Lesson ${l.displayOrder}] ${l.title} (blocks: ${l._count.blocks}, vocab: ${l._count.vocabularies}, ex: ${l._count.exercises})`
      );
    });
  });

  const totalVocab = await prisma.vocabulary.count();
  const totalQuestions = await prisma.question.count();
  const questionsByType = await prisma.question.groupBy({
    by: ["type"],
    _count: { id: true },
  });

  console.log("=== METRICS ===");
  console.log({ totalVocab, totalQuestions, questionsByType });
}

check()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
