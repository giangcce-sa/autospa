import { Archive, CalendarBlank, FilmSlate, ImageSquare, NotePencil, Stack, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { HubPage } from "@/components/modules/hubs/HubPage";

export default function CreativePage() {
  return <HubPage title="Sáng tạo" description="Tạo, duyệt và lên lịch bài viết, hình ảnh và video trong cùng một khu vực." primary={[
    { title: "Viết bài", description: "Tạo nội dung tự nhiên theo giọng thương hiệu.", href: "/content", icon: NotePencil },
    { title: "Tạo hình ảnh", description: "Dùng bộ nhận diện và ảnh nhân viên làm mẫu tham chiếu.", href: "/images", icon: ImageSquare },
    { title: "Xưởng video", description: "Từ kịch bản đến giọng đọc, khẩu hình và dựng video.", href: "/video-studio", icon: FilmSlate },
    { title: "Đăng và lịch", description: "Duyệt nội dung và phân phối lên các kênh.", href: "/publish", icon: CalendarBlank },
  ]} tools={[
    { title: "Thư viện", description: "Tìm lại nội dung và tài nguyên đã tạo.", href: "/library", icon: Archive },
    { title: "Hình ảnh nhân viên", description: "Quản lý ảnh nhân viên dùng làm mẫu tham chiếu.", href: "/staff-visuals", icon: UserCircle },
    { title: "Tạo hàng loạt", description: "Sản xuất nhiều nội dung theo một kế hoạch.", href: "/bulk", icon: Stack },
  ]} />;
}
