import { ChartBar, ChartLineUp, Eye, Megaphone, Tag, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { HubPage } from "@/components/modules/hubs/HubPage";

export default function GrowthPage() {
  return <HubPage title="Tăng trưởng" description="Tập trung vào quyết định cần thực hiện từ quảng cáo, nội dung và tín hiệu thị trường." primary={[
    { title: "Báo cáo", description: "Doanh thu, khách hàng tiềm năng và hiệu quả theo từng kênh.", href: "/reports", icon: ChartLineUp },
    { title: "Quảng cáo Facebook", description: "Theo dõi và tối ưu chiến dịch có kiểm soát.", href: "/facebook-ads", icon: Megaphone },
    { title: "Phân tích", description: "So sánh hiệu quả nội dung và chiến dịch.", href: "/analytics", icon: ChartBar },
    { title: "Khuyến mãi", description: "Tạo ưu đãi theo công suất và mục tiêu.", href: "/promotions", icon: Tag },
  ]} tools={[
    { title: "Đối thủ", description: "Quan sát nội dung và xu hướng cạnh tranh.", href: "/competitors", icon: TrendUp },
    { title: "Lắng nghe mạng xã hội", description: "Phát hiện cảnh báo và tín hiệu từ thị trường.", href: "/listening", icon: Eye },
  ]} />;
}
