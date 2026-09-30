import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, handleAdminError } from "@/shared/auth/admin-guard";
import { adminService } from "@/modules/admin/admin.service";

export async function GET() {
  const { errorResponse, user } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  try {
    const courses = await adminService.getAllCourses(user);
    return NextResponse.json({ success: true, data: courses });
  } catch (err) {
    return handleAdminError(err);
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse, user } = await requireAdminApi();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const course = await adminService.createCourse(user, body);
    return NextResponse.json({ success: true, data: course }, { status: 201 });
  } catch (err) {
    return handleAdminError(err);
  }
}
