import { notFound, redirect } from "next/navigation";
import { lessonAccessService } from "@/modules/lessons/lesson-access.service";

interface LessonRedirectPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LessonRedirectPage({ params }: LessonRedirectPageProps) {
  const { slug } = await params;
  const decision = await lessonAccessService.resolveBySlug(null, slug);

  if (decision.kind === "NOT_FOUND") {
    notFound();
  }

  redirect(`/courses/${decision.lesson.chapter.course.slug}/lessons/${decision.lesson.slug}`);
}
