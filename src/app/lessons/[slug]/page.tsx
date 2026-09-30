import { notFound, redirect } from "next/navigation";
import { lessonService } from "@/modules/lessons/lesson.service";

interface LessonRedirectPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LessonRedirectPage({ params }: LessonRedirectPageProps) {
  const { slug } = await params;
  const lesson = await lessonService.getPublishedLessonBySlug(slug);

  if (!lesson) {
    notFound();
  }

  redirect(`/courses/${lesson.chapter.course.slug}/lessons/${lesson.slug}`);
}
