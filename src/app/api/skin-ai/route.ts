import { NextRequest, NextResponse } from "next/server";
import { generateContent } from "@/lib/claude";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "analyze-text") {
      const { symptoms, age, skinType, concerns } = body;
      const analysis = await generateContent(
        `Khách hàng spa cần tư vấn da:\n- Tuổi: ${age || "không rõ"}\n- Loại da: ${skinType || "không rõ"}\n- Vấn đề mô tả: ${symptoms}\n- Mối quan tâm chính: ${concerns || "không có"}\n\nPhân tích và gợi ý:\n1. Tình trạng da có thể mắc phải\n2. Nguyên nhân có thể\n3. Dịch vụ spa phù hợp (2-3 dịch vụ)\n4. Lời khuyên chăm sóc tại nhà (3-4 điểm)\n5. Lưu ý quan trọng\n\nViết chuyên nghiệp, dễ hiểu, bằng tiếng Việt. Dưới 300 chữ.`,
        "Bạn là chuyên gia da liễu thẩm mỹ, tư vấn cho spa. Chỉ tư vấn mỹ phẩm và chăm sóc spa, không chẩn đoán y tế."
      );
      return NextResponse.json({ data: { analysis } });
    }

    if (action === "recommend-services") {
      const { skinProfile } = body;
      const services = await prisma.service.findMany({ where: { active: true }, take: 10 });
      const serviceList = services.map((s: { name: string; description: string | null }) => `- ${s.name}: ${s.description || "không có mô tả"}`).join("\n");
      const recommendation = await generateContent(
        `Hồ sơ da của khách hàng: ${skinProfile}\n\nDanh sách dịch vụ spa hiện có:\n${serviceList || "Chưa có dịch vụ"}\n\nGợi ý 2-3 dịch vụ phù hợp nhất và giải thích ngắn gọn vì sao phù hợp. Nếu không có dịch vụ phù hợp, gợi ý dịch vụ cơ bản nhất.`,
        "Bạn là chuyên gia tư vấn spa."
      );
      return NextResponse.json({ data: { recommendation } });
    }

    if (action === "skin-quiz") {
      const { answers } = body;
      const quizResult = await generateContent(
        `Khách hàng trả lời bài kiểm tra da:\n${Object.entries(answers).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\nXác định:\n1. Loại da (khô/dầu/hỗn hợp/nhạy cảm/bình thường)\n2. Tình trạng hiện tại\n3. 3 sản phẩm/thành phần nên dùng\n4. 2 điều nên tránh\n\nTrả lời ngắn gọn, thực tế.`,
        "Bạn là chuyên gia da liễu thẩm mỹ."
      );
      return NextResponse.json({ data: { result: quizResult } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
