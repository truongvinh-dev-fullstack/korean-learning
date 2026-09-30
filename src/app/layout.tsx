import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";

export const metadata: Metadata = {
  title: "Korean Zero (한국어 제로) - Nền tảng học tiếng Hàn tương tác",
  description:
    "Học tiếng Hàn từ con số 0: Hangul, từ vựng, ngữ pháp, bài tập tương tác và Spaced Repetition (SRS).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full" suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white"
        suppressHydrationWarning
      >
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
