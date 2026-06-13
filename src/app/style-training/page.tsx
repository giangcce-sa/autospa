import { StyleTraining } from "@/components/modules/style-training/StyleTraining";
import { PageHeader } from "@/components/ui/PageHeader";

export default function StyleTrainingPage() {
  return (
    <>
      <PageHeader
        title="Style Training"
        description="Dạy AI học văn phong riêng của bạn từ các bài mẫu"
      />
      <StyleTraining />
    </>
  );
}
