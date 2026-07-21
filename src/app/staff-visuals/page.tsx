import { StaffVisualLibrary } from "@/components/modules/staff-visuals/StaffVisualLibrary";
import { PageHeader } from "@/components/ui/PageHeader";

export default function StaffVisualsPage() {
  return (
    <>
      <PageHeader
        title="Nhân viên mẫu"
        description="Quản lý ảnh tham chiếu, nhận diện và quyền sử dụng cho hình ảnh AI"
      />
      <StaffVisualLibrary />
    </>
  );
}
