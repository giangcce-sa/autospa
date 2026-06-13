import { QualityChecker } from "@/components/modules/quality/QualityChecker";
import { PageHeader } from "@/components/ui/PageHeader";

export default function QualityPage() {
  return (
    <>
      <PageHeader
        title="Kiểm soát Chất lượng"
        description="AI kiểm tra bài viết trước khi đăng — chính tả, CTA, chính sách Facebook"
      />
      <QualityChecker />
    </>
  );
}
