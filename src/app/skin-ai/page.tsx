import { SkinAI } from "@/components/modules/skin-ai/SkinAI";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SkinAIPage() {
  return (
    <>
      <PageHeader title="AI Da Chuyên ngành" description="Phân tích tình trạng da, bài kiểm tra loại da và gợi ý dịch vụ phù hợp" />
      <SkinAI />
    </>
  );
}
