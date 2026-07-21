import { Brain, Buildings, GearSix, Lightning, Palette, Plugs, Robot, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { HubPage } from "@/components/modules/hubs/HubPage";

export default function SystemPage() {
  return <HubPage title="Hệ thống" description="Cấu hình AutoSpa, dữ liệu thương hiệu và các tính năng trí tuệ nhân tạo. Khu vực này chủ yếu dành cho chủ spa." systemMode primary={[
    { title: "Cài đặt", description: "Kết nối dịch vụ, mạng xã hội và quy tắc tự động.", href: "/settings", icon: GearSix },
    { title: "Thương hiệu", description: "Thông tin spa, giọng nói và kiến thức nền.", href: "/brand", icon: Buildings },
    { title: "Bộ nhận diện", description: "Logo, màu sắc và quy chuẩn hình ảnh.", href: "/brand-kit", icon: Palette },
    { title: "Bộ não AutoSpa", description: "Quản lý kỹ năng và dữ liệu hệ thống đã học.", href: "/brain", icon: Brain },
  ]} tools={[
    { title: "Tự động hóa", description: "Duyệt công việc và chọn mức độ tự động.", href: "/automation", icon: Lightning },
    { title: "Trung tâm điều phối", description: "Theo dõi các công việc AutoSpa đang thực hiện.", href: "/orchestrator", icon: Robot },
    { title: "Danh mục dịch vụ", description: "Quản lý dịch vụ dùng trong nội dung và chăm sóc khách hàng.", href: "/services", icon: Plugs },
    { title: "Hình ảnh nhân viên", description: "Quản lý nhân viên và quyền sử dụng hình ảnh.", href: "/staff-visuals", icon: UsersThree },
  ]} />;
}
