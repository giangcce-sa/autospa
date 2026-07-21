import { CalendarCheck, ChatCircleDots, FirstAidKit, Flame, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { HubPage } from "@/components/modules/hubs/HubPage";

export default function CustomersPage() {
  return <HubPage title="Khách hàng" description="Theo dõi hội thoại, khách hàng tiềm năng và lịch hẹn trong một quy trình chăm sóc thống nhất." primary={[
    { title: "Tin nhắn", description: "Phản hồi các cuộc hội thoại đang chờ.", href: "/inbox", icon: ChatCircleDots },
    { title: "Khách cần tư vấn", description: "Ưu tiên những khách có khả năng đặt lịch cao.", href: "/sale", icon: Flame },
    { title: "Hồ sơ khách hàng", description: "Xem thông tin và lịch sử tương tác của từng khách.", href: "/crm", icon: UsersThree },
    { title: "Lịch hẹn", description: "Xác nhận các yêu cầu đặt lịch mới.", href: "/appointments", icon: CalendarCheck },
  ]} tools={[{ title: "Chăm sóc lại", description: "Theo dõi những khách đã đến lịch liên hệ lại.", href: "/care", icon: FirstAidKit }]} />;
}
