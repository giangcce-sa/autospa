import { ImageGenerator } from "@/components/modules/images/ImageGenerator";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ImagesPage() {
  return (
    <>
      <PageHeader
        title="Tạo Hình ảnh"
        description="AI tạo ảnh marketing chuyên nghiệp theo dịch vụ spa"
      />
      <ImageGenerator />
    </>
  );
}
