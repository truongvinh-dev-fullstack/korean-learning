import Link from "next/link";
import { courseService } from "@/modules/courses/course.service";
import { CourseCard } from "@/components/ui/course-card";
import { getServerSession } from "@/shared/auth/session";

export default async function HomePage() {
  const session = await getServerSession();
  const user = session?.user;
  const courses = await courseService.getPublishedCatalog();
  const featuredCourse = courses[0];

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-xs font-semibold">
            <span className="text-indigo-400">✨</span>
            <span>Học tiếng Hàn bài bản • Miễn phí 100% cho người mới bắt đầu</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Chinh phục tiếng Hàn{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-rose-400">
              từ con số 0
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Học bảng chữ cái <strong>Hangul</strong>, từ vựng theo chủ đề, cấu trúc ngữ pháp thông dụng
            và ghi nhớ bền vững cùng hệ thống lặp lại ngắt quãng <strong>Spaced Repetition (SRS)</strong>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {user ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/25 transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
              >
                Vào Bảng học tập cá nhân →
              </Link>
            ) : (
              <Link
                href="/dang-ky"
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/25 transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
              >
                Bắt đầu học ngay (Miễn phí)
              </Link>
            )}

            <Link
              href="/courses"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
            >
              Xem danh mục khóa học
            </Link>
          </div>

          {/* Quick Hangul Preview Chips */}
          <div className="pt-6 flex items-center justify-center gap-2 flex-wrap text-xs text-slate-400">
            <span className="text-slate-400">Âm tiết mẫu:</span>
            {["한 (Han)", "글 (Geul)", "안 (An)", "녕 (Nyeong)", "하 (Ha)", "세 (Se)", "요 (Yo)"].map(
              (syllable) => (
                <span
                  key={syllable}
                  className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 font-mono text-xs"
                >
                  {syllable}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* Pillars / Features Grid */}
      <section id="gioi-thieu" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Phương pháp học tập khoa học
          </h2>
          <p className="text-sm text-slate-400">
            Được xây dựng theo chu trình sư phạm: Tiếp thu lý thuyết → Luyện tập tương tác → Ôn tập ngắt quãng
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-800/60 text-indigo-400 flex items-center justify-center font-bold text-lg">
              ㄱ
            </div>
            <h3 className="font-bold text-white text-base">Hangul Nền Tảng</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Làm quen nguyên âm, phụ âm và cơ chế ghép vần tiếng Hàn từng bước trực quan, dễ nhớ.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800/60 text-purple-400 flex items-center justify-center font-bold text-lg">
              💬
            </div>
            <h3 className="font-bold text-white text-base">Từ Vựng & Hội Thoại</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Học từ vựng theo chủ đề đời sống, kèm ngữ cảnh hội thoại thực tế và giải thích ngữ pháp chi tiết.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 flex items-center justify-center font-bold text-lg">
              ✓
            </div>
            <h3 className="font-bold text-white text-base">Chấm Điểm Phía Server</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Các dạng câu hỏi trắc nghiệm, điền khuyết và sắp xếp câu được chấm điểm chính xác ngay lập tức.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-800/60 text-amber-400 flex items-center justify-center font-bold text-lg">
              🧠
            </div>
            <h3 className="font-bold text-white text-base">Spaced Repetition (SRS)</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Thuật toán SM-2 nhắc nhở bạn ôn lại từ vựng đúng thời điểm trước khi bạn quên, tối ưu hóa trí nhớ.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Course Preview */}
      {featuredCourse && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Khóa học nổi bật
              </h2>
              <p className="text-sm text-slate-400">
                Bắt đầu hành trình tiếng Hàn của bạn với giáo trình tiêu chuẩn
              </p>
            </div>
            <Link
              href="/courses"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors focus-visible:outline-none focus-visible:underline"
            >
              Xem tất cả ({courses.length}) →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.slice(0, 3).map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                actionText="Chi tiết giáo trình"
                badgeText="Căn bản"
              />
            ))}
          </div>
        </section>
      )}

      {/* Learning Path (Lộ trình học) */}
      <section id="lo-trinh" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/50 border border-slate-800/80 space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Lộ trình 3 giai đoạn nhập môn
            </h2>
            <p className="text-sm text-slate-400">
              Thiết kế tuần tự giúp học viên không bị choáng ngợp và duy trì động lực bền bỉ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-indigo-400">GIAI ĐOẠN 1</span>
              <h3 className="font-bold text-white text-base">Bảng chữ cái Hangul</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Học nhận diện 21 nguyên âm, 19 phụ âm và cách ghép vần. Tự tin đọc mặt chữ sau 3 bài học đầu tiên.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-purple-400">GIAI ĐOẠN 2</span>
              <h3 className="font-bold text-white text-base">Chào hỏi & Giới thiệu bản thân</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Nắm vững câu chào 안녕하세요, giới thiệu tên tuổi, quốc tịch và các đuôi câu lịch sự cơ bản -이에요/예요.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-emerald-400">GIAI ĐOẠN 3</span>
              <h3 className="font-bold text-white text-base">Đồ vật, Không gian & Vị trí</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Học đại từ chỉ định 이것/그것/저것, tiểu từ vị trí -에 있어요/없어요 và giao tiếp nơi chốn thông dụng.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 p-8 sm:p-12 border border-indigo-700/40 text-center space-y-6 shadow-2xl">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Sẵn sàng bắt đầu bài học đầu tiên?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            Tham gia cùng Korean Zero ngay hôm nay. Không học phí, không thủ tục phức tạp.
          </p>
          <div className="pt-2">
            <Link
              href={user ? "/dashboard" : "/dang-ky"}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
            >
              <span>{user ? "Vào Bảng học tập" : "Tạo tài khoản học miễn phí"}</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
