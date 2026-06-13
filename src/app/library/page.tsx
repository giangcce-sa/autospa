import { LibraryView } from "@/components/modules/library/LibraryView";
import { PageHeader } from "@/components/ui/PageHeader";

export default function LibraryPage() {
  return (
    <>
      <PageHeader
        title="Thư viện & Lịch"
        description="Tất cả bài viết đã tạo — nháp, lên lịch, đã đăng"
      />
      <LibraryView />
    </>
  );
}
