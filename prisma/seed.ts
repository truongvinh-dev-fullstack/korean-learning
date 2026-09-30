import "dotenv/config";
import { prisma } from "../src/shared/db/prisma";
import { ContentStatus, BlockType, QuestionType } from "@prisma/client";

async function main() {
  console.log("Starting deterministic seed for Korean Zero...");

  // 1. Course
  const courseId = "c0000000-0000-4000-a000-000000000001";
  const course = await prisma.course.upsert({
    where: { id: courseId },
    update: {
      title: "Tiếng Hàn từ con số 0",
      description:
        "Khóa học nền tảng tiếng Hàn toàn diện: từ bảng chữ cái Hangeul, cách ghép âm, từ vựng thiết yếu đến ngữ pháp và phản xạ giao tiếp cơ bản.",
      level: "BEGINNER",
      status: ContentStatus.PUBLISHED,
      displayOrder: 1,
    },
    create: {
      id: courseId,
      slug: "tieng-han-tu-con-so-0",
      title: "Tiếng Hàn từ con số 0",
      description:
        "Khóa học nền tảng tiếng Hàn toàn diện: từ bảng chữ cái Hangeul, cách ghép âm, từ vựng thiết yếu đến ngữ pháp và phản xạ giao tiếp cơ bản.",
      level: "BEGINNER",
      status: ContentStatus.PUBLISHED,
      displayOrder: 1,
    },
  });
  console.log(`Course: ${course.title} (${course.slug})`);

  // 2. Chapters
  const chapter1Id = "c1000000-0000-4000-a000-000000000001";
  const chapter2Id = "c1000000-0000-4000-a000-000000000002";
  const chapter3Id = "c1000000-0000-4000-a000-000000000003";

  await prisma.chapter.upsert({
    where: { id: chapter1Id },
    update: {
      title: "Chương 1: Bảng chữ cái Hangeul & Phát âm căn bản",
      description: "Làm chủ 21 nguyên âm, 19 phụ âm và quy tắc ghép âm trong tiếng Hàn.",
      displayOrder: 1,
      status: ContentStatus.PUBLISHED,
    },
    create: {
      id: chapter1Id,
      courseId: course.id,
      slug: "chuong-1-bang-chu-cai-hangeul",
      title: "Chương 1: Bảng chữ cái Hangeul & Phát âm căn bản",
      description: "Làm chủ 21 nguyên âm, 19 phụ âm và quy tắc ghép âm trong tiếng Hàn.",
      displayOrder: 1,
      status: ContentStatus.PUBLISHED,
    },
  });

  await prisma.chapter.upsert({
    where: { id: chapter2Id },
    update: {
      title: "Chương 2: Lời chào hỏi & Giới thiệu bản thân",
      description: "Các mẫu câu chào hỏi thông dụng, phép lịch sự và cách giới thiệu họ tên, quốc tịch.",
      displayOrder: 2,
      status: ContentStatus.PUBLISHED,
    },
    create: {
      id: chapter2Id,
      courseId: course.id,
      slug: "chuong-2-loi-chao-hoi-va-gioi-thieu",
      title: "Chương 2: Lời chào hỏi & Giới thiệu bản thân",
      description: "Các mẫu câu chào hỏi thông dụng, phép lịch sự và cách giới thiệu họ tên, quốc tịch.",
      displayOrder: 2,
      status: ContentStatus.PUBLISHED,
    },
  });

  await prisma.chapter.upsert({
    where: { id: chapter3Id },
    update: {
      title: "Chương 3: Đồ vật & Không gian quanh ta",
      description: "Chỉ định đồ vật gần xa và cách hỏi, trả lời vị trí đồ vật, địa điểm.",
      displayOrder: 3,
      status: ContentStatus.PUBLISHED,
    },
    create: {
      id: chapter3Id,
      courseId: course.id,
      slug: "chuong-3-do-vat-va-khong-gian",
      title: "Chương 3: Đồ vật & Không gian quanh ta",
      description: "Chỉ định đồ vật gần xa và cách hỏi, trả lời vị trí đồ vật, địa điểm.",
      displayOrder: 3,
      status: ContentStatus.PUBLISHED,
    },
  });
  console.log("Seeded 3 Chapters.");

  // 3. Lessons (8 lessons across 3 chapters)
  const lessonsData = [
    // Chapter 1
    {
      id: "l0000000-0000-4000-a000-000000000001",
      chapterId: chapter1Id,
      slug: "bai-1-nguyen-am-co-ban",
      title: "Bài 1: 10 Nguyên âm cơ bản (ㅏ, ㅓ, ㅗ, ㅜ, ㅡ, ㅣ, ㅑ, ㅕ, ㅛ, ㅠ)",
      summary: "Học phát âm và thứ tự nét viết của 10 nguyên âm căn bản nhất.",
      estimatedMinutes: 15,
      displayOrder: 1,
    },
    {
      id: "l0000000-0000-4000-a000-000000000002",
      chapterId: chapter1Id,
      slug: "bai-2-phu-am-co-ban",
      title: "Bài 2: 10 Phụ âm cơ bản & Ghép âm (ㄱ, ㄴ, ㄷ, ㄹ, ㅁ, ㅂ, ㅅ, ㅇ, ㅈ, ㅎ)",
      summary: "Nhận biết phụ âm đầu và cách kết hợp với nguyên âm tạo thành âm tiết hoàn chỉnh.",
      estimatedMinutes: 20,
      displayOrder: 2,
    },
    {
      id: "l0000000-0000-4000-a000-000000000003",
      chapterId: chapter1Id,
      slug: "bai-3-phu-am-cuoi-batchim",
      title: "Bài 3: Phụ âm cuối (Batchim - 받침) & Quy tắc nối âm",
      summary: "Khám phá 7 âm đại diện của Batchim và hiện tượng nối âm khi phát âm.",
      estimatedMinutes: 20,
      displayOrder: 3,
    },
    // Chapter 2
    {
      id: "l0000000-0000-4000-a000-000000000004",
      chapterId: chapter2Id,
      slug: "bai-4-cac-cau-chao-hoi-thong-dung",
      title: "Bài 4: Các câu chào hỏi thông dụng (안녕하세요, 감사합니다)",
      summary: "Các cách chào buổi sáng, tạm biệt, cảm ơn và xin lỗi chuẩn người Hàn.",
      estimatedMinutes: 15,
      displayOrder: 1,
    },
    {
      id: "l0000000-0000-4000-a000-000000000005",
      chapterId: chapter2Id,
      slug: "bai-5-gioi-thieu-ban-than-tro-tu-un-neun",
      title: "Bài 5: Giới thiệu bản thân & Trợ từ chủ đề 은/는",
      summary: "Cấu trúc câu giới thiệu tên, nghề nghiệp và cách sử dụng trợ từ 은/는.",
      estimatedMinutes: 20,
      displayOrder: 2,
    },
    {
      id: "l0000000-0000-4000-a000-000000000006",
      chapterId: chapter2Id,
      slug: "bai-6-duoi-cau-nhan-dinh-i-e-yo-ye-yo",
      title: "Bài 6: Đuôi câu nhận định thân mật lịch sự '-이에요 / -예요'",
      summary: "Khẳng định danh từ 'Là cái gì / Là ai' với đuôi câu 이에요 / 예요.",
      estimatedMinutes: 15,
      displayOrder: 3,
    },
    // Chapter 3
    {
      id: "l0000000-0000-4000-a000-000000000007",
      chapterId: chapter3Id,
      slug: "bai-7-dai-tu-chi-dinh-i-geot-geu-geot-jeo-geot",
      title: "Bài 7: Đại từ chỉ định: Cái này, cái đó, cái kia (이것, 그것, 저것)",
      summary: "Hỏi và trả lời về các đồ vật xung quanh bạn.",
      estimatedMinutes: 15,
      displayOrder: 1,
    },
    {
      id: "l0000000-0000-4000-a000-000000000008",
      chapterId: chapter3Id,
      slug: "bai-8-vi-tri-va-noi-chon",
      title: "Bài 8: Vị trí và Nơi chốn (여기, 저기, 어디, 있어요/없어요)",
      summary: "Hỏi đường, hỏi vị trí đồ vật và cấu trúc có/không có ở đâu.",
      estimatedMinutes: 20,
      displayOrder: 2,
    },
  ];

  for (const l of lessonsData) {
    await prisma.lesson.upsert({
      where: { id: l.id },
      update: {
        title: l.title,
        summary: l.summary,
        estimatedMinutes: l.estimatedMinutes,
        displayOrder: l.displayOrder,
        status: ContentStatus.PUBLISHED,
      },
      create: {
        id: l.id,
        chapterId: l.chapterId,
        slug: l.slug,
        title: l.title,
        summary: l.summary,
        estimatedMinutes: l.estimatedMinutes,
        displayOrder: l.displayOrder,
        status: ContentStatus.PUBLISHED,
      },
    });
  }
  console.log("Seeded 8 Lessons.");

  // Clean existing blocks, vocabularies, exercises for idempotent re-runs
  await prisma.lessonBlock.deleteMany();
  await prisma.vocabulary.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.exercise.deleteMany();

  // Clean non-baseline lessons and progress created during tests/admin CMS runs
  await prisma.lessonProgress.deleteMany({
    where: { lessonId: { notIn: lessonsData.map((l) => l.id) } },
  });
  await prisma.lesson.deleteMany({
    where: { id: { notIn: lessonsData.map((l) => l.id) } },
  });

  // 4. Complete Content for Lesson 1 (10 Nguyên âm cơ bản)
  const lesson1Id = lessonsData[0].id;
  await prisma.lessonBlock.createMany({
    data: [
      {
        id: "b0000000-0000-4000-a000-000000000001",
        lessonId: lesson1Id,
        type: BlockType.TEXT,
        displayOrder: 1,
        content: {
          title: "Triết lý sáng tạo chữ Hangeul",
          markdown:
            "Bảng chữ cái tiếng Hàn (Hangeul - 한글) do vua Sejong sáng tạo vào năm 1443. Các nguyên âm cơ bản được hình thành từ 3 yếu tố triết học: Trời (ㆍ - chấm tròn), Đất (ㅡ - nét ngang) và Con người (ㅣ - nét đứng).",
        },
      },
      {
        id: "b0000000-0000-4000-a000-000000000002",
        lessonId: lesson1Id,
        type: BlockType.HANGUL,
        displayOrder: 2,
        content: {
          title: "10 Nguyên âm cơ bản",
          description: "Gồm 6 nguyên âm đơn (ㅏ, ㅓ, ㅗ, ㅜ, ㅡ, ㅣ) và 4 nguyên âm y-kép (ㅑ, ㅕ, ㅛ, ㅠ).",
          characters: [
            { char: "ㅏ", romanization: "a", strokeCount: 2, soundHint: "Phát âm như chữ 'a' trong tiếng Việt." },
            { char: "ㅓ", romanization: "eo", strokeCount: 2, soundHint: "Mở miệng vừa phải, phát âm như chữ 'ơ' hơi nghiêng về 'o'." },
            { char: "ㅗ", romanization: "o", strokeCount: 2, soundHint: "Tròn môi, phát âm giống chữ 'ô'." },
            { char: "ㅜ", romanization: "u", strokeCount: 2, soundHint: "Chu môi, phát âm giống chữ 'u'." },
            { char: "ㅡ", romanization: "eu", strokeCount: 1, soundHint: "Kéo mép môi sang hai bên, phát âm như chữ 'ư'." },
            { char: "ㅣ", romanization: "i", strokeCount: 1, soundHint: "Mỉm cười nhẹ, phát âm như chữ 'i'." },
            { char: "ㅑ", romanization: "ya", strokeCount: 3, soundHint: "Kết hợp [y] + [a] thành 'da' / 'ya'." },
            { char: "ㅕ", romanization: "yeo", strokeCount: 3, soundHint: "Kết hợp [y] + [eo] thành 'dơ' / 'yeo'." },
            { char: "ㅛ", romanization: "yo", strokeCount: 3, soundHint: "Kết hợp [y] + [o] thành 'dô' / 'yo'." },
            { char: "ㅠ", romanization: "yu", strokeCount: 3, soundHint: "Kết hợp [y] + [u] thành 'du' / 'yu'." },
          ],
        },
      },
      {
        id: "b0000000-0000-4000-a000-000000000003",
        lessonId: lesson1Id,
        type: BlockType.VOCABULARY,
        displayOrder: 3,
        content: {
          title: "Từ vựng cấu tạo từ nguyên âm",
          items: [
            { hangul: "아이", romanization: "ai", vietnamese: "Em bé, đứa trẻ", english: "Child, baby" },
            { hangul: "오이", romanization: "oi", vietnamese: "Quả dưa chuột", english: "Cucumber" },
            { hangul: "우유", romanization: "uyu", vietnamese: "Sữa tươi", english: "Milk" },
            { hangul: "이유", romanization: "iyu", vietnamese: "Lý do", english: "Reason" },
            { hangul: "여우", romanization: "yeou", vietnamese: "Con cáo", english: "Fox" },
          ],
        },
      },
      {
        id: "b0000000-0000-4000-a000-000000000004",
        lessonId: lesson1Id,
        type: BlockType.AUDIO,
        displayOrder: 4,
        content: {
          title: "Luyện nghe phát âm 10 nguyên âm",
          audioUrl: "/audio/lessons/lesson-1-vowels.mp3",
          caption: "Nghe và nhắc lại theo giọng phát âm chuẩn Seoul.",
          transcript: "ㅏ, ㅑ, ㅓ, ㅕ, ㅗ, ㅛ, ㅜ, ㅠ, ㅡ, ㅣ",
        },
      },
      {
        id: "b0000000-0000-4000-a000-000000000005",
        lessonId: lesson1Id,
        type: BlockType.CALLOUT,
        displayOrder: 5,
        content: {
          variant: "tip",
          title: "Mẹo nhớ khẩu hình ㅓ (eo) vs ㅗ (o)",
          message:
            "Nguyên âm ㅓ miệng mở tự nhiên theo chiều dọc, môi không tròn. Còn ㅗ miệng phải chúm tròn như chữ 'ô'. Luyện tập trước gương để thấy sự khác biệt!",
        },
      },
    ],
  });

  // 5. Complete Content for Lesson 2 (10 Phụ âm cơ bản & Ghép âm)
  const lesson2Id = lessonsData[1].id;
  await prisma.lessonBlock.createMany({
    data: [
      {
        id: "b0000000-0000-4000-a000-000000000006",
        lessonId: lesson2Id,
        type: BlockType.TEXT,
        displayOrder: 1,
        content: {
          title: "Nguyên tắc kết hợp Phụ âm + Nguyên âm",
          markdown:
            "Trong tiếng Hàn, một nguyên âm không bao giờ đứng lẻ loi tạo thành chữ viết. Khi nguyên âm đứng đầu âm tiết, ta bắt buộc phải thêm phụ âm câm **'ㅇ'** phía trước (với nguyên âm đứng như ㅏ $\\to$ 아) hoặc phía trên (với nguyên âm nằm ngang như ㅗ $\\to$ 오).",
        },
      },
      {
        id: "b0000000-0000-4000-a000-000000000007",
        lessonId: lesson2Id,
        type: BlockType.HANGUL,
        displayOrder: 2,
        content: {
          title: "10 Phụ âm cơ bản",
          characters: [
            { char: "ㄱ", name: "giyeok", romanization: "g/k", strokeCount: 1, soundHint: "Phát âm giữa [g] và [k]." },
            { char: "ㄴ", name: "nieun", romanization: "n", strokeCount: 1, soundHint: "Phát âm như chữ 'n'." },
            { char: "ㄷ", name: "digeut", romanization: "d/t", strokeCount: 2, soundHint: "Phát âm giữa [d] và [t]." },
            { char: "ㄹ", name: "rieul", romanization: "r/l", strokeCount: 3, soundHint: "Đầu âm tiết rung nhẹ [r], cuối âm tiết uốn lưỡi [l]." },
            { char: "ㅁ", name: "mieum", romanization: "m", strokeCount: 3, soundHint: "Phát âm như chữ 'm'." },
            { char: "ㅂ", name: "bieup", romanization: "b/p", strokeCount: 4, soundHint: "Phát âm giữa [b] và [p]." },
            { char: "ㅅ", name: "siot", romanization: "s", strokeCount: 2, soundHint: "Phát âm nhẹ như chữ 's'." },
            { char: "ㅇ", name: "ieung", romanization: "ng", strokeCount: 1, soundHint: "Đầu âm tiết là âm câm không đọc; cuối âm đọc là [ng]." },
            { char: "ㅈ", name: "jieut", romanization: "j/ch", strokeCount: 2, soundHint: "Phát âm giữa [ch] và [gi]." },
            { char: "ㅎ", name: "hieut", romanization: "h", strokeCount: 3, soundHint: "Thở nhẹ ra như chữ 'h'." },
          ],
        },
      },
      {
        id: "b0000000-0000-4000-a000-000000000008",
        lessonId: lesson2Id,
        type: BlockType.VOCABULARY,
        displayOrder: 3,
        content: {
          title: "Từ vựng ghép vần cơ bản",
          items: [
            { hangul: "나무", romanization: "namu", vietnamese: "Cái cây", english: "Tree" },
            { hangul: "모자", romanization: "moja", vietnamese: "Cái mũ", english: "Hat" },
            { hangul: "바지", romanization: "baji", vietnamese: "Cái quần", english: "Pants" },
            { hangul: "사자", romanization: "saja", vietnamese: "Con sư tử", english: "Lion" },
            { hangul: "고기", romanization: "gogi", vietnamese: "Thịt", english: "Meat" },
            { hangul: "구두", romanization: "gudu", vietnamese: "Giày da", english: "Leather shoes" },
          ],
        },
      },
      {
        id: "b0000000-0000-4000-a000-000000000009",
        lessonId: lesson2Id,
        type: BlockType.CALLOUT,
        displayOrder: 4,
        content: {
          variant: "note",
          title: "Phụ âm câm 'ㅇ'",
          message:
            "Khi ghép vần: ㅇ + ㅏ = 아 (đọc là 'a', phụ âm ㅇ hoàn toàn im lặng). Khi có phụ âm khác thay thế: ㄱ + ㅏ = 가 (đọc là 'ga').",
        },
      },
    ],
  });

  // 6. Complete Content for Lesson 3 (Batchim & Nối âm)
  const lesson3Id = lessonsData[2].id;
  await prisma.lessonBlock.createMany({
    data: [
      {
        id: "b0000000-0000-4000-a000-000000000010",
        lessonId: lesson3Id,
        type: BlockType.TEXT,
        displayOrder: 1,
        content: {
          title: "Phụ âm cuối (Batchim - 받침) là gì?",
          markdown:
            "Batchim là phụ âm nằm ở vị trí đáy của một khối âm tiết tiếng Hàn. Mặc dù có nhiều phụ âm có thể làm Batchim, khi phát âm đơn lẻ, chúng chỉ được quy về **7 âm đại diện chuẩn**.",
        },
      },
      {
        id: "b0000000-0000-4000-a000-000000000011",
        lessonId: lesson3Id,
        type: BlockType.HANGUL,
        displayOrder: 2,
        content: {
          title: "7 Âm đại diện của Batchim",
          characters: [
            { char: "ㄱ", name: "Âm [k]", romanization: "k", soundHint: "Bao gồm: ㄱ, ㅋ, ㄲ. Ví dụ: 책 [chaek]." },
            { char: "ㄴ", name: "Âm [n]", romanization: "n", soundHint: "Bao gồm: ㄴ. Ví dụ: 눈 [nun]." },
            { char: "ㄷ", name: "Âm [t]", romanization: "t", soundHint: "Bao gồm: ㄷ, ㅅ, ㅈ, ㅊ, ㅌ, ㅎ, ㅆ. Ví dụ: 옷 [ot]." },
            { char: "ㄹ", name: "Âm [l]", romanization: "l", soundHint: "Bao gồm: ㄹ. Ví dụ: 물 [mul]." },
            { char: "ㅁ", name: "Âm [m]", romanization: "m", soundHint: "Bao gồm: ㅁ. Ví dụ: 밤 [bam]." },
            { char: "ㅂ", name: "Âm [p]", romanization: "p", soundHint: "Bao gồm: ㅂ, ㅍ. Ví dụ: 밥 [bap]." },
            { char: "ㅇ", name: "Âm [ng]", romanization: "ng", soundHint: "Bao gồm: ㅇ. Ví dụ: 강 [gang]." },
          ],
        },
      },
      {
        id: "b0000000-0000-4000-a000-000000000012",
        lessonId: lesson3Id,
        type: BlockType.GRAMMAR,
        displayOrder: 3,
        content: {
          title: "Quy tắc nối âm (연음 법칙)",
          formula: "Âm tiết trước có Batchim + Âm tiết sau bắt đầu bằng 'ㅇ' -> Batchim chuyển sang thay thế 'ㅇ'",
          explanation:
            "Khi âm tiết trước kết thúc bằng một phụ âm cuối và âm tiết liền sau bắt đầu bằng nguyên âm (có phụ âm câm 'ㅇ'), phụ âm cuối sẽ nối sang đọc cùng nguyên âm sau.",
          examples: [
            { korean: "한국어", vietnamese: "Phát âm là [한구거] (Hàn Quốc ngữ / Tiếng Hàn)", note: "ㄱ nối sang 어" },
            { korean: "밥을", vietnamese: "Phát âm là [바블] (cơm + trợ từ)", note: "ㅂ nối sang 을" },
            { korean: "음악", vietnamese: "Phát âm là [으막] (âm nhạc)", note: "ㅁ nối sang 악" },
          ],
        },
      },
      {
        id: "b0000000-0000-4000-a000-000000000013",
        lessonId: lesson3Id,
        type: BlockType.DIALOGUE,
        displayOrder: 4,
        content: {
          title: "Hội thoại ứng dụng quy tắc nối âm",
          lines: [
            { speaker: "Minho", korean: "한국어 공부해요?", vietnamese: "Bạn học tiếng Hàn hả?" },
            { speaker: "Lan", korean: "네, 한국어 책을 읽어요.", vietnamese: "Vâng, tôi đang đọc sách tiếng Hàn." },
          ],
        },
      },
      {
        id: "b0000000-0000-4000-a000-000000000014",
        lessonId: lesson3Id,
        type: BlockType.CALLOUT,
        displayOrder: 5,
        content: {
          variant: "warning",
          title: "Ngoại lệ nối âm với chữ 'ㅎ'",
          message:
            "Nếu Batchim là 'ㅎ' và âm sau bắt đầu bằng 'ㅇ', chữ 'ㅎ' thường bị nuốt âm (không đọc). Ví dụ: 좋아요 đọc là [조아요], không đọc là [조하요].",
        },
      },
    ],
  });
  console.log("Seeded complete blocks for Lessons 1, 2, 3.");

  // 7. Seed at least 20 Vocabulary entries in the Vocabulary table
  const vocabularies = [
    // Lesson 1
    { lessonId: lesson1Id, hangul: "아이", romanization: "ai", vietnameseMeaning: "Em bé, đứa trẻ", englishMeaning: "Child, baby", displayOrder: 1 },
    { lessonId: lesson1Id, hangul: "오이", romanization: "oi", vietnameseMeaning: "Quả dưa chuột", englishMeaning: "Cucumber", displayOrder: 2 },
    { lessonId: lesson1Id, hangul: "우유", romanization: "uyu", vietnameseMeaning: "Sữa tươi", englishMeaning: "Milk", displayOrder: 3 },
    { lessonId: lesson1Id, hangul: "이유", romanization: "iyu", vietnameseMeaning: "Lý do", englishMeaning: "Reason", displayOrder: 4 },
    { lessonId: lesson1Id, hangul: "여우", romanization: "yeou", vietnameseMeaning: "Con cáo", englishMeaning: "Fox", displayOrder: 5 },
    // Lesson 2
    { lessonId: lesson2Id, hangul: "나무", romanization: "namu", vietnameseMeaning: "Cái cây", englishMeaning: "Tree", displayOrder: 1 },
    { lessonId: lesson2Id, hangul: "모자", romanization: "moja", vietnameseMeaning: "Cái mũ", englishMeaning: "Hat", displayOrder: 2 },
    { lessonId: lesson2Id, hangul: "바지", romanization: "baji", vietnameseMeaning: "Cái quần", englishMeaning: "Pants", displayOrder: 3 },
    { lessonId: lesson2Id, hangul: "사자", romanization: "saja", vietnameseMeaning: "Con sư tử", englishMeaning: "Lion", displayOrder: 4 },
    { lessonId: lesson2Id, hangul: "고기", romanization: "gogi", vietnameseMeaning: "Thịt", englishMeaning: "Meat", displayOrder: 5 },
    { lessonId: lesson2Id, hangul: "구두", romanization: "gudu", vietnameseMeaning: "Giày da", englishMeaning: "Shoes", displayOrder: 6 },
    // Lesson 3
    { lessonId: lesson3Id, hangul: "한국", romanization: "hanguk", vietnameseMeaning: "Hàn Quốc", englishMeaning: "Korea", displayOrder: 1 },
    { lessonId: lesson3Id, hangul: "물", romanization: "mul", vietnameseMeaning: "Nước uống", englishMeaning: "Water", displayOrder: 2 },
    { lessonId: lesson3Id, hangul: "밥", romanization: "bap", vietnameseMeaning: "Cơm, bữa ăn", englishMeaning: "Rice, meal", displayOrder: 3 },
    { lessonId: lesson3Id, hangul: "책", romanization: "chaek", vietnameseMeaning: "Quyển sách", englishMeaning: "Book", displayOrder: 4 },
    { lessonId: lesson3Id, hangul: "집", romanization: "jip", vietnameseMeaning: "Ngôi nhà", englishMeaning: "House", displayOrder: 5 },
    { lessonId: lesson3Id, hangul: "눈", romanization: "nun", vietnameseMeaning: "Mắt / Tuyết", englishMeaning: "Eye / Snow", displayOrder: 6 },
    { lessonId: lesson3Id, hangul: "손", romanization: "son", vietnameseMeaning: "Bàn tay", englishMeaning: "Hand", displayOrder: 7 },
    { lessonId: lesson3Id, hangul: "밤", romanization: "bam", vietnameseMeaning: "Ban đêm / Hạt dẻ", englishMeaning: "Night / Chestnut", displayOrder: 8 },
    // Lesson 4
    { lessonId: lessonsData[3].id, hangul: "안녕하세요", romanization: "annyeonghaseyo", vietnameseMeaning: "Xin chào", englishMeaning: "Hello", displayOrder: 1 },
    { lessonId: lessonsData[3].id, hangul: "감사합니다", romanization: "gamsahamnida", vietnameseMeaning: "Xin cảm ơn", englishMeaning: "Thank you", displayOrder: 2 },
    { lessonId: lessonsData[3].id, hangul: "죄송합니다", romanization: "joesonghamnida", vietnameseMeaning: "Xin lỗi", englishMeaning: "Sorry", displayOrder: 3 },
    // Lesson 5
    { lessonId: lessonsData[4].id, hangul: "학생", romanization: "haksaeng", vietnameseMeaning: "Học sinh", englishMeaning: "Student", displayOrder: 1 },
    { lessonId: lessonsData[4].id, hangul: "선생님", romanization: "seonsaengnim", vietnameseMeaning: "Giáo viên", englishMeaning: "Teacher", displayOrder: 2 },
  ];

  await prisma.vocabulary.createMany({
    data: vocabularies.map((v, idx) => ({
      id: `v0000000-0000-4000-a000-${String(idx + 1).padStart(12, "0")}`,
      lessonId: v.lessonId,
      hangul: v.hangul,
      romanization: v.romanization,
      vietnameseMeaning: v.vietnameseMeaning,
      englishMeaning: v.englishMeaning,
      audioUrl: `/audio/vocab/${v.romanization}.mp3`,
      displayOrder: v.displayOrder,
    })),
  });
  console.log(`Seeded ${vocabularies.length} Vocabulary records.`);

  // 8. Seed Exercises & Questions across 4 QuestionTypes (at least 10 questions)
  const exercise1 = await prisma.exercise.create({
    data: {
      id: "e0000000-0000-4000-a000-000000000001",
      lessonId: lesson1Id,
      title: "Luyện tập: 10 Nguyên âm cơ bản",
      description: "Kiểm tra khả năng nhận biết mặt chữ và phát âm nguyên âm.",
      displayOrder: 1,
      status: ContentStatus.PUBLISHED,
    },
  });

  const exercise2 = await prisma.exercise.create({
    data: {
      id: "e0000000-0000-4000-a000-000000000002",
      lessonId: lesson2Id,
      title: "Luyện tập: Phụ âm & Ghép vần",
      description: "Luyện tập ghép phụ âm với nguyên âm và nhận diện từ vựng.",
      displayOrder: 1,
      status: ContentStatus.PUBLISHED,
    },
  });

  const exercise3 = await prisma.exercise.create({
    data: {
      id: "e0000000-0000-4000-a000-000000000003",
      lessonId: lesson3Id,
      title: "Luyện tập: Phụ âm cuối Batchim",
      description: "Luyện tập quy tắc 7 âm đại diện và quy tắc nối âm.",
      displayOrder: 1,
      status: ContentStatus.PUBLISHED,
    },
  });

  // Question 1: MULTIPLE_CHOICE
  await prisma.question.create({
    data: {
      id: "q0000000-0000-4000-a000-000000000001",
      exerciseId: exercise1.id,
      type: QuestionType.MULTIPLE_CHOICE,
      prompt: "Từ nào sau đây có nghĩa là 'Quả dưa chuột'?",
      explanation: "오이 (oi) có nghĩa là quả dưa chuột. 아이 là em bé, 우유 là sữa tươi.",
      displayOrder: 1,
      options: {
        create: [
          { id: "o0000000-0000-4000-a000-000000000001", text: "오이", isCorrect: true, displayOrder: 1 },
          { id: "o0000000-0000-4000-a000-000000000002", text: "아이", isCorrect: false, displayOrder: 2 },
          { id: "o0000000-0000-4000-a000-000000000003", text: "우유", isCorrect: false, displayOrder: 3 },
          { id: "o0000000-0000-4000-a000-000000000004", text: "이유", isCorrect: false, displayOrder: 4 },
        ],
      },
    },
  });

  // Question 2: MULTIPLE_CHOICE
  await prisma.question.create({
    data: {
      id: "q0000000-0000-4000-a000-000000000002",
      exerciseId: exercise1.id,
      type: QuestionType.MULTIPLE_CHOICE,
      prompt: "Nguyên âm nào dưới đây có cách phát âm là [o] (chúm tròn môi)?",
      explanation: "ㅗ phát âm là 'o' (ô), trong khi ㅓ phát âm mở miệng tự nhiên 'eo' (ơ).",
      displayOrder: 2,
      options: {
        create: [
          { id: "o0000000-0000-4000-a000-000000000005", text: "ㅗ", isCorrect: true, displayOrder: 1 },
          { id: "o0000000-0000-4000-a000-000000000006", text: "ㅓ", isCorrect: false, displayOrder: 2 },
          { id: "o0000000-0000-4000-a000-000000000007", text: "ㅏ", isCorrect: false, displayOrder: 3 },
          { id: "o0000000-0000-4000-a000-000000000008", text: "ㅜ", isCorrect: false, displayOrder: 4 },
        ],
      },
    },
  });

  // Question 3: FILL_BLANK
  await prisma.question.create({
    data: {
      id: "q0000000-0000-4000-a000-000000000003",
      exerciseId: exercise1.id,
      type: QuestionType.FILL_BLANK,
      prompt: "Điền chữ cái còn thiếu: 'Sữa tươi' trong tiếng Hàn là 우___ (uyu).",
      correctAnswer: "유",
      explanation: "우유 (uyu) = sữa tươi.",
      displayOrder: 3,
    },
  });

  // Question 4: LISTENING_CHOICE
  await prisma.question.create({
    data: {
      id: "q0000000-0000-4000-a000-000000000004",
      exerciseId: exercise1.id,
      type: QuestionType.LISTENING_CHOICE,
      prompt: "Nghe đoạn âm thanh và chọn nguyên âm bạn nghe được:",
      audioUrl: "/audio/exercises/audio-vowel-a.mp3",
      explanation: "Âm thanh phát âm là 'a' tương ứng với chữ cái 'ㅏ'.",
      displayOrder: 4,
      options: {
        create: [
          { id: "o0000000-0000-4000-a000-000000000009", text: "ㅏ", isCorrect: true, displayOrder: 1 },
          { id: "o0000000-0000-4000-a000-000000000010", text: "ㅓ", isCorrect: false, displayOrder: 2 },
          { id: "o0000000-0000-4000-a000-000000000011", text: "ㅗ", isCorrect: false, displayOrder: 3 },
          { id: "o0000000-0000-4000-a000-000000000012", text: "ㅣ", isCorrect: false, displayOrder: 4 },
        ],
      },
    },
  });

  // Question 5: MULTIPLE_CHOICE
  await prisma.question.create({
    data: {
      id: "q0000000-0000-4000-a000-000000000005",
      exerciseId: exercise2.id,
      type: QuestionType.MULTIPLE_CHOICE,
      prompt: "Từ '나무' (namu) có nghĩa là gì?",
      explanation: "나무 có nghĩa là cái cây. Cái mũ là 모자, con sư tử là 사자.",
      displayOrder: 1,
      options: {
        create: [
          { id: "o0000000-0000-4000-a000-000000000013", text: "Cái cây", isCorrect: true, displayOrder: 1 },
          { id: "o0000000-0000-4000-a000-000000000014", text: "Cái mũ", isCorrect: false, displayOrder: 2 },
          { id: "o0000000-0000-4000-a000-000000000015", text: "Con sư tử", isCorrect: false, displayOrder: 3 },
          { id: "o0000000-0000-4000-a000-000000000016", text: "Cái quần", isCorrect: false, displayOrder: 4 },
        ],
      },
    },
  });

  // Question 6: FILL_BLANK
  await prisma.question.create({
    data: {
      id: "q0000000-0000-4000-a000-000000000006",
      exerciseId: exercise2.id,
      type: QuestionType.FILL_BLANK,
      prompt: "Điền chữ còn thiếu: Con sư tử trong tiếng Hàn là 사____ (saja).",
      correctAnswer: "자",
      explanation: "사자 = con sư tử.",
      displayOrder: 2,
    },
  });

  // Question 7: ARRANGE_SENTENCE
  await prisma.question.create({
    data: {
      id: "q0000000-0000-4000-a000-000000000007",
      exerciseId: exercise2.id,
      type: QuestionType.ARRANGE_SENTENCE,
      prompt: "Sắp xếp các khối từ sau để tạo thành câu hoàn chỉnh: 'Tôi uống sữa' (저는 / 우유를 / 마셔요)",
      correctAnswer: "저는 우유를 마셔요",
      explanation: "Trật tự câu tiếng Hàn: Chủ ngữ (저는) + Tân ngữ (우유를) + Động từ (마셔요).",
      displayOrder: 3,
      options: {
        create: [
          { id: "o0000000-0000-4000-a000-000000000017", text: "저는", isCorrect: false, displayOrder: 1 },
          { id: "o0000000-0000-4000-a000-000000000018", text: "우유를", isCorrect: false, displayOrder: 2 },
          { id: "o0000000-0000-4000-a000-000000000019", text: "마셔요", isCorrect: false, displayOrder: 3 },
        ],
      },
    },
  });

  // Question 8: MULTIPLE_CHOICE
  await prisma.question.create({
    data: {
      id: "q0000000-0000-4000-a000-000000000008",
      exerciseId: exercise3.id,
      type: QuestionType.MULTIPLE_CHOICE,
      prompt: "Trong từ '한국', âm tiết '국' có phụ âm cuối (Batchim) là gì?",
      explanation: "국 có phụ âm đầu là ㄱ, nguyên âm là ㅜ, phụ âm cuối (Batchim) là ㄱ.",
      displayOrder: 1,
      options: {
        create: [
          { id: "o0000000-0000-4000-a000-000000000020", text: "ㄱ", isCorrect: true, displayOrder: 1 },
          { id: "o0000000-0000-4000-a000-000000000021", text: "ㄴ", isCorrect: false, displayOrder: 2 },
          { id: "o0000000-0000-4000-a000-000000000022", text: "ㄷ", isCorrect: false, displayOrder: 3 },
          { id: "o0000000-0000-4000-a000-000000000023", text: "ㅁ", isCorrect: false, displayOrder: 4 },
        ],
      },
    },
  });

  // Question 9: FILL_BLANK
  await prisma.question.create({
    data: {
      id: "q0000000-0000-4000-a000-000000000009",
      exerciseId: exercise3.id,
      type: QuestionType.FILL_BLANK,
      prompt: "Điền từ tiếng Hàn có nghĩa là 'Cơm / bữa ăn' (bap):",
      correctAnswer: "밥",
      explanation: "밥 (bap) = cơm hoặc bữa ăn.",
      displayOrder: 2,
    },
  });

  // Question 10: LISTENING_CHOICE
  await prisma.question.create({
    data: {
      id: "q0000000-0000-4000-a000-000000000010",
      exerciseId: exercise3.id,
      type: QuestionType.LISTENING_CHOICE,
      prompt: "Nghe từ vựng sau và chọn nghĩa tiếng Việt chính xác:",
      audioUrl: "/audio/exercises/audio-mul.mp3",
      explanation: "Từ phát âm là '물' (mul) có nghĩa là Nước.",
      displayOrder: 3,
      options: {
        create: [
          { id: "o0000000-0000-4000-a000-000000000024", text: "Nước uống", isCorrect: true, displayOrder: 1 },
          { id: "o0000000-0000-4000-a000-000000000025", text: "Quyển sách", isCorrect: false, displayOrder: 2 },
          { id: "o0000000-0000-4000-a000-000000000026", text: "Cơm", isCorrect: false, displayOrder: 3 },
          { id: "o0000000-0000-4000-a000-000000000027", text: "Ngôi nhà", isCorrect: false, displayOrder: 4 },
        ],
      },
    },
  });

  // Question 11: ARRANGE_SENTENCE
  await prisma.question.create({
    data: {
      id: "q0000000-0000-4000-a000-000000000011",
      exerciseId: exercise3.id,
      type: QuestionType.ARRANGE_SENTENCE,
      prompt: "Sắp xếp câu nối âm: 'Tôi đọc sách' (저는 / 책을 / 읽어요)",
      correctAnswer: "저는 책을 읽어요",
      explanation: "책을 phát âm nối âm là [채글]. Câu hoàn chỉnh: 저는 책을 읽어요.",
      displayOrder: 4,
      options: {
        create: [
          { id: "o0000000-0000-4000-a000-000000000028", text: "저는", isCorrect: false, displayOrder: 1 },
          { id: "o0000000-0000-4000-a000-000000000029", text: "책을", isCorrect: false, displayOrder: 2 },
          { id: "o0000000-0000-4000-a000-000000000030", text: "읽어요", isCorrect: false, displayOrder: 3 },
        ],
      },
    },
  });

  console.log("Seeded 3 Exercises and 11 Questions across all 4 supported types.");
  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
