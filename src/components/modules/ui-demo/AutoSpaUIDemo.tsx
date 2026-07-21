"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight, Bell, CaretDown, ChartLineUp, Check, CheckCircle,
  FilmSlate, GearSix, House, ImageSquare, MagnifyingGlass, Megaphone,
  NotePencil, Plus, Sparkle, TrendUp, UsersThree,
  VideoCamera, WarningCircle, X,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type View = "today" | "creative" | "customers" | "growth" | "system";
type ContentType = "post" | "image" | "video" | "campaign";

const NAV: Array<{ id: View; label: string; icon: Icon }> = [
  { id: "today", label: "Hôm nay", icon: House },
  { id: "creative", label: "Sáng tạo", icon: NotePencil },
  { id: "customers", label: "Khách hàng", icon: UsersThree },
  { id: "growth", label: "Tăng trưởng", icon: ChartLineUp },
  { id: "system", label: "Hệ thống", icon: GearSix },
];

const CONTENT_TYPES: Array<{ id: ContentType; label: string; description: string; icon: Icon }> = [
  { id: "post", label: "Bài viết", description: "Nội dung và thẻ chủ đề", icon: NotePencil },
  { id: "image", label: "Hình ảnh", description: "Ảnh dịch vụ hoặc nhân viên", icon: ImageSquare },
  { id: "video", label: "Video", description: "Video ngắn có giọng đọc", icon: VideoCamera },
  { id: "campaign", label: "Chiến dịch", description: "Một ý tưởng, nhiều định dạng", icon: Megaphone },
];

const TASKS = [
  { id: 1, title: "Duyệt video phục hồi da", detail: "Video 28 giây · QA 87/100", action: "Xem video", tone: "warning" },
  { id: 2, title: "Trả lời 4 khách đang hỏi giá", detail: "2 khách chờ hơn 15 phút", action: "Mở hộp thư", tone: "danger" },
  { id: 3, title: "Xác nhận lịch đăng cuối tuần", detail: "3 nội dung đã sẵn sàng", action: "Xem lịch", tone: "neutral" },
];

const VIEW_COPY: Record<View, { title: string; description: string }> = {
  today: { title: "Chào buổi sáng, Quyết", description: "Có 3 việc cần bạn xử lý trước 11:00." },
  creative: { title: "Sáng tạo", description: "Quản lý bài viết, ảnh và video trong cùng một luồng." },
  customers: { title: "Khách hàng", description: "Tập trung các cuộc hội thoại cần phản hồi và cơ hội đặt lịch." },
  growth: { title: "Tăng trưởng", description: "Theo dõi quyết định quan trọng, không chỉ nhìn vào số liệu." },
  system: { title: "Hệ thống", description: "Quản lý nhân vật AI, kết nối và cách AutoSpa vận hành." },
};

function NavButton({ item, active, onClick }: { item: (typeof NAV)[number]; active: boolean; onClick: () => void }) {
  const IconComponent = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] font-semibold transition-colors",
        active ? "bg-[#e3eee7] text-[#18573d]" : "text-[#56615a] hover:bg-[#edf0ed] hover:text-[#202722]",
      )}
    >
      <IconComponent size={19} weight={active ? "fill" : "regular"} />
      <span>{item.label}</span>
      {item.id === "today" && <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded bg-[#cf5a48] px-1 text-[11px] font-bold text-white">3</span>}
    </button>
  );
}

function Metric({ label, value, note, positive = true }: { label: string; value: string; note: string; positive?: boolean }) {
  return (
    <div className="min-w-0 border-l border-[#d9ded9] pl-4 first:border-l-0 first:pl-0 sm:pl-5">
      <p className="text-[13px] font-medium text-[#68736b]">{label}</p>
      <p className="mt-1 font-mono text-[23px] font-semibold leading-tight text-[#19221c] sm:text-[26px]">{value}</p>
      <p className={cn("mt-1 text-[12px] font-medium", positive ? "text-[#2d7554]" : "text-[#b35642]")}>{note}</p>
    </div>
  );
}

function TodayView({ completed, setCompleted }: { completed: number[]; setCompleted: (ids: number[]) => void }) {
  const remaining = TASKS.filter((task) => !completed.includes(task.id));
  return (
    <>
      <section className="grid grid-cols-2 gap-x-4 gap-y-6 border-y border-[#d9ded9] py-5 sm:grid-cols-4 sm:gap-x-0">
        <Metric label="Doanh thu hôm nay" value="15,6 tr" note="+8,4% so với hôm qua" />
        <Metric label="Lịch hẹn" value="12" note="9 đã xác nhận" />
        <Metric label="Khách mới" value="23" note="7 cần phản hồi" />
        <Metric label="Chi phí quảng cáo" value="1,2 tr" note="Cao hơn 6,2%" positive={false} />
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]">
        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div><h2 className="text-[19px] font-bold text-[#18211b]">Việc cần làm</h2><p className="mt-1 text-[13px] text-[#6a746d]">Sắp xếp theo mức độ ảnh hưởng</p></div>
            <span className="text-[13px] font-medium text-[#607067]">{remaining.length} chưa xong</span>
          </div>
          <div className="divide-y divide-[#dfe3df] border-y border-[#d9ded9]">
            {remaining.map((task) => (
              <article key={task.id} className="group grid gap-4 py-4 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-center">
                <button
                  aria-label={`Hoàn thành ${task.title}`}
                  onClick={() => setCompleted([...completed, task.id])}
                  className="hidden h-8 w-8 items-center justify-center rounded-md border border-[#cfd6d0] text-[#758078] transition-colors hover:border-[#2f6f54] hover:bg-[#e8f2ec] hover:text-[#2f6f54] sm:flex"
                ><Check size={16} /></button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", task.tone === "danger" ? "bg-[#c75948]" : task.tone === "warning" ? "bg-[#d78a27]" : "bg-[#879188]")} />
                    <h3 className="truncate text-[15px] font-semibold text-[#202722]">{task.title}</h3>
                  </div>
                  <p className="mt-1 pl-4 text-[13px] text-[#737d76]">{task.detail}</p>
                </div>
                <button className="flex items-center gap-2 justify-self-start text-[13px] font-semibold text-[#266247] transition-colors hover:text-[#174b35] sm:justify-self-end">
                  {task.action}<ArrowRight size={15} />
                </button>
              </article>
            ))}
            {remaining.length === 0 && <div className="flex items-center gap-3 py-8 text-[14px] text-[#53705e]"><CheckCircle size={22} weight="fill" />Bạn đã xử lý xong các việc ưu tiên.</div>}
          </div>
        </section>

        <aside className="border-l border-[#d9ded9] pl-6">
          <div className="flex items-center justify-between"><h2 className="text-[19px] font-bold text-[#18211b]">Lịch nội dung</h2><button className="text-[13px] font-semibold text-[#2f6f54]">Mở lịch</button></div>
          <div className="mt-4 space-y-1">
            {[
              ["09:30", "Đã đăng", "5 dấu hiệu da cần phục hồi", "Instagram"],
              ["14:00", "Sẵn sàng", "Video quy trình triệt lạnh", "TikTok"],
              ["19:30", "Chờ duyệt", "Ưu đãi cuối tuần", "Facebook"],
            ].map(([time, status, title, channel]) => (
              <div key={time} className="grid grid-cols-[3.5rem_1fr] gap-3 border-b border-[#e2e5e2] py-3 last:border-0">
                <span className="font-mono text-[13px] font-semibold text-[#445047]">{time}</span>
                <div><p className="text-[14px] font-semibold text-[#273029]">{title}</p><p className="mt-1 text-[12px] text-[#778078]">{channel} · {status}</p></div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className="mt-9">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-[19px] font-bold text-[#18211b]">Đang vận hành</h2><button className="text-[13px] font-semibold text-[#2f6f54]">Xem tất cả</button></div>
        <div className="grid overflow-hidden rounded-lg border border-[#d8ded9] bg-[#d8ded9] md:grid-cols-3">
          {[
            { icon: FilmSlate, title: "Video phục hồi da", meta: "Render · 68%", color: "bg-[#dbe9e1] text-[#246247]" },
            { icon: Megaphone, title: "Quảng cáo inbox tháng 7", meta: "Đang chạy · ROAS 2,7", color: "bg-[#e7e4d8] text-[#72652d]" },
            { icon: UsersThree, title: "Chăm sóc khách cũ", meta: "18/42 khách đã liên hệ", color: "bg-[#e3e7eb] text-[#43596b]" },
          ].map((item) => {
            const ItemIcon = item.icon;
            return <article key={item.title} className="flex min-h-28 items-center gap-4 bg-[#f9faf8] p-4"><div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md", item.color)}><ItemIcon size={21} weight="duotone" /></div><div><h3 className="text-[14px] font-semibold text-[#263029]">{item.title}</h3><p className="mt-1 text-[12px] text-[#747e76]">{item.meta}</p></div></article>;
          })}
        </div>
      </section>
    </>
  );
}

function SectionView({ view, onCreate }: { view: Exclude<View, "today">; onCreate: () => void }) {
  const data = {
    creative: {
      action: "Tạo nội dung", icon: Sparkle,
      rows: [["Video phục hồi da", "Đang dựng", "Cập nhật 8 phút trước"], ["Bài chăm sóc da mùa nóng", "Chờ duyệt", "Instagram · 14:00"], ["Ảnh liệu trình Hydro Glow", "Bản nháp", "Chỉnh sửa hôm qua"]],
    },
    customers: {
      action: "Mở hộp thư", icon: UsersThree,
      rows: [["Nguyễn Thùy Anh", "Hỏi giá triệt lạnh", "Chờ 6 phút"], ["Phạm Ngọc Mai", "Muốn đặt lịch thứ Bảy", "Cần ưu tiên"], ["Lê Thanh Hà", "Hỏi chăm sóc sau liệu trình", "Đã giao Lan"]],
    },
    growth: {
      action: "Xem báo cáo", icon: TrendUp,
      rows: [["Quảng cáo inbox tháng 7", "ROAS 2,7", "Nên tăng ngân sách 15%"], ["Video quy trình thật", "+38% lượt lưu", "Định dạng hiệu quả nhất"], ["Chiến dịch khách cũ", "12 lịch hẹn", "Chi phí 84.000đ/lịch"]],
    },
    system: {
      action: "Kiểm tra hệ thống", icon: GearSix,
      rows: [["Nhân vật số", "4 nhân viên", "1 giấy đồng ý sắp hết hạn"], ["Kết nối", "6/7 hoạt động", "TikTok cần làm mới"], ["Bộ não AutoSpa", "42 kỹ năng", "3 kỹ năng chờ duyệt"]],
    },
  }[view];
  const ActionIcon = data.icon;
  return (
    <section className="mt-4 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d9ded9] pb-5">
        <p className="max-w-xl text-[14px] leading-6 text-[#657068]">Mọi tác vụ liên quan được gom về một nơi. Các cấu hình nâng cao chỉ xuất hiện khi bạn cần.</p>
        <button onClick={view === "creative" ? onCreate : undefined} className="flex h-10 items-center gap-2 rounded-md bg-[#215f43] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#174c35] active:translate-y-px"><ActionIcon size={17} />{data.action}</button>
      </div>
      <div className="mt-7 divide-y divide-[#dde2dd] border-y border-[#d7ddd8]">
        {data.rows.map(([title, status, detail]) => <article key={title} className="grid gap-2 py-5 sm:grid-cols-[minmax(0,1fr)_10rem_13rem_auto] sm:items-center"><h2 className="text-[15px] font-semibold text-[#202822]">{title}</h2><span className="text-[13px] font-medium text-[#476252]">{status}</span><span className="text-[13px] text-[#768078]">{detail}</span><button aria-label={`Mở ${title}`} className="justify-self-start rounded-md p-2 text-[#667169] hover:bg-[#e7ece8] sm:justify-self-end"><ArrowRight size={17} /></button></article>)}
      </div>
    </section>
  );
}

function CreateDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ContentType>("video");
  const selected = CONTENT_TYPES.find((item) => item.id === type)!;
  const SelectedIcon = selected.icon;
  const close = () => { onClose(); setStep(1); };
  return (
    <div className={cn("fixed inset-0 z-50 transition", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <button aria-label="Đóng trình tạo nội dung" onClick={close} className={cn("absolute inset-0 bg-[#14251b]/30 backdrop-blur-[2px] transition-opacity", open ? "opacity-100" : "opacity-0")} />
      <aside className={cn("absolute right-0 top-0 flex h-full w-full max-w-[34rem] flex-col bg-[#fbfcfa] shadow-[-20px_0_50px_rgba(22,42,29,.14)] transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")}>
        <header className="flex h-16 items-center justify-between border-b border-[#dbe0db] px-5 sm:px-7"><div><p className="text-[12px] font-semibold text-[#6c776f]">Bước {step} / 3</p><h2 className="text-[18px] font-bold text-[#1c251f]">Tạo nội dung mới</h2></div><button onClick={close} className="rounded-md p-2 text-[#657067] hover:bg-[#edf0ed]" aria-label="Đóng"><X size={19} /></button></header>
        <div className="h-1 bg-[#e1e5e1]"><div className="h-full bg-[#2f6f54] transition-all duration-300" style={{ width: `${step * 33.333}%` }} /></div>
        <div className="flex-1 overflow-y-auto px-5 py-7 sm:px-7">
          {step === 1 && <><h3 className="text-[21px] font-bold text-[#1c251f]">Bạn muốn tạo gì?</h3><p className="mt-2 text-[14px] text-[#68736b]">Chọn kết quả cần có. AutoSpa sẽ tự chọn công cụ AI phù hợp.</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{CONTENT_TYPES.map((item) => { const ItemIcon = item.icon; const active = item.id === type; return <button key={item.id} onClick={() => setType(item.id)} className={cn("min-h-32 rounded-lg border p-4 text-left transition-all", active ? "border-[#2f6f54] bg-[#e8f2ec] shadow-[0_0_0_1px_#2f6f54]" : "border-[#d9ded9] bg-white hover:border-[#aab5ac]")}><ItemIcon size={24} weight={active ? "fill" : "regular"} className={active ? "text-[#286448]" : "text-[#6c766f]"} /><p className="mt-5 text-[15px] font-bold text-[#202822]">{item.label}</p><p className="mt-1 text-[12px] text-[#6f7972]">{item.description}</p></button>; })}</div></>}
          {step === 2 && <><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e5f0e9] text-[#2b674b]"><SelectedIcon size={24} weight="duotone" /></div><h3 className="mt-5 text-[21px] font-bold text-[#1c251f]">Mục tiêu của {selected.label.toLowerCase()}</h3><div className="mt-6 space-y-5"><label className="block"><span className="mb-2 block text-[13px] font-semibold text-[#3c4740]">Dịch vụ</span><select className="h-11 w-full rounded-md border border-[#ccd3cd] bg-white px-3 text-[14px] text-[#253029]"><option>Phục hồi da chuyên sâu</option><option>Triệt lông lạnh</option><option>Hydro Glow</option></select></label><label className="block"><span className="mb-2 block text-[13px] font-semibold text-[#3c4740]">Mục tiêu</span><select className="h-11 w-full rounded-md border border-[#ccd3cd] bg-white px-3 text-[14px] text-[#253029]"><option>Tăng lịch hẹn</option><option>Tăng tin nhắn</option><option>Giới thiệu dịch vụ</option></select></label><label className="block"><span className="mb-2 block text-[13px] font-semibold text-[#3c4740]">Mô tả ngắn</span><textarea rows={5} defaultValue="Tập trung vào quy trình thật, cảm giác nhẹ nhàng và lời mời tư vấn tự nhiên." className="w-full resize-none rounded-md border border-[#ccd3cd] bg-white p-3 text-[14px] leading-6 text-[#253029]" /></label></div></>}
          {step === 3 && <><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e5f0e9] text-[#2b674b]"><CheckCircle size={25} weight="fill" /></div><h3 className="mt-5 text-[21px] font-bold text-[#1c251f]">Sẵn sàng tạo</h3><p className="mt-2 text-[14px] leading-6 text-[#68736b]">AutoSpa sẽ tạo bản nháp trước. Bạn vẫn là người duyệt nội dung cuối cùng.</p><dl className="mt-7 divide-y divide-[#dfe3df] border-y border-[#d9ded9] text-[14px]"><div className="flex justify-between py-4"><dt className="text-[#6c766f]">Định dạng</dt><dd className="font-semibold text-[#273029]">{selected.label}</dd></div><div className="flex justify-between py-4"><dt className="text-[#6c766f]">Dịch vụ</dt><dd className="font-semibold text-[#273029]">Phục hồi da</dd></div><div className="flex justify-between py-4"><dt className="text-[#6c766f]">Chế độ</dt><dd className="font-semibold text-[#273029]">Tạo bản nháp</dd></div></dl><div className="mt-6 flex gap-3 rounded-md bg-[#f2eee2] p-4 text-[13px] leading-5 text-[#6e6238]"><WarningCircle size={19} className="shrink-0" />Dự kiến dùng 1.20 USD ngân sách AI của dự án.</div></>}
        </div>
        <footer className="flex items-center justify-between border-t border-[#dbe0db] px-5 py-4 sm:px-7"><button onClick={() => step > 1 ? setStep(step - 1) : close()} className="h-10 px-2 text-[14px] font-semibold text-[#5f6b63]">{step > 1 ? "Quay lại" : "Hủy"}</button><button onClick={() => step < 3 ? setStep(step + 1) : close()} className="flex h-10 items-center gap-2 rounded-md bg-[#215f43] px-5 text-[14px] font-semibold text-white hover:bg-[#174c35] active:translate-y-px">{step < 3 ? "Tiếp tục" : "Tạo bản nháp"}{step < 3 ? <ArrowRight size={16} /> : <Sparkle size={16} />}</button></footer>
      </aside>
    </div>
  );
}

export function AutoSpaUIDemo() {
  const [view, setView] = useState<View>("today");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const copy = VIEW_COPY[view];
  const dateLabel = useMemo(() => new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date()), []);
  return (
    <div className="min-h-dvh bg-[#f5f6f3] text-[#1e2721]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[15rem] flex-col border-r border-[#d9ded9] bg-[#fafbf9] px-3 py-4 md:flex">
        <div className="flex h-11 items-center gap-3 px-2"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#205d41] text-white"><Sparkle size={17} weight="fill" /></div><div><p className="text-[16px] font-extrabold leading-tight text-[#172019]">AutoSpa</p><p className="text-[11px] font-medium text-[#7a847d]">Trợ lý cho spa</p></div></div>
        <button className="mt-5 flex h-11 items-center justify-between rounded-md border border-[#d9ded9] bg-white px-3 text-left shadow-[0_1px_2px_rgba(28,47,34,.04)]"><span className="min-w-0"><span className="block truncate text-[13px] font-semibold text-[#273029]">An Như Spa</span><span className="block text-[11px] text-[#7b857d]">Chi nhánh chính</span></span><CaretDown size={14} className="text-[#737e76]" /></button>
        <nav className="mt-7 space-y-1" aria-label="Điều hướng demo">{NAV.slice(0, 4).map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />)}</nav>
        <div className="mt-auto border-t border-[#dde1dd] pt-4"><NavButton item={NAV[4]} active={view === "system"} onClick={() => setView("system")} /><div className="mt-3 flex items-center gap-3 rounded-md px-3 py-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#dfe8e2] text-[12px] font-bold text-[#2e654b]">LQ</div><div className="min-w-0"><p className="truncate text-[13px] font-semibold">Lưu Quyết</p><p className="text-[11px] text-[#7a847d]">Chủ sở hữu</p></div></div></div>
      </aside>

      <div className="md:pl-[15rem]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#d9ded9] bg-[#f8f9f6]/95 px-4 backdrop-blur-md sm:px-7">
          <div className="flex items-center gap-2 md:hidden"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#205d41] text-white"><Sparkle size={15} weight="fill" /></div><span className="font-bold">AutoSpa</span></div>
          <button className="ml-auto hidden h-9 w-64 items-center gap-2 rounded-md border border-[#d7ddd8] bg-white px-3 text-[13px] text-[#7b857e] lg:flex"><MagnifyingGlass size={15} />Tìm khách hàng, nội dung...</button>
          <button aria-label="Thông báo" className="relative ml-auto rounded-md p-2 text-[#606b63] hover:bg-[#e8ece8] lg:ml-0"><Bell size={19} /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-[#f8f9f6] bg-[#c65545]" /></button>
          <button onClick={() => setDrawerOpen(true)} className="flex h-10 items-center gap-2 rounded-md bg-[#205d41] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#174c35] active:translate-y-px"><Plus size={17} weight="bold" />Tạo nội dung</button>
        </header>

        <main className="mx-auto w-full max-w-[86rem] px-4 pb-28 pt-7 sm:px-7 sm:pt-9 md:pb-12 lg:px-10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[13px] font-medium capitalize text-[#748078]">{dateLabel}</p><h1 className="text-[28px] font-extrabold leading-tight text-[#172019] sm:text-[32px]">{copy.title}</h1><p className="mt-2 text-[14px] text-[#69746c]">{copy.description}</p></div>{view === "today" && <div className="flex items-center gap-2 text-[12px] font-medium text-[#657068]"><span className="h-2 w-2 rounded-full bg-[#3b8a63]" />Hệ thống hoạt động bình thường</div>}</div>
          {view === "today" ? <TodayView completed={completed} setCompleted={setCompleted} /> : <SectionView view={view} onCreate={() => setDrawerOpen(true)} />}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#d7dcd7] bg-[#fbfcfa]/96 px-1 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md md:hidden" aria-label="Điều hướng mobile">
        {NAV.map((item) => {
          const MobileIcon = item.icon;
          const active = item.id === view;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold",
                active ? "text-[#226045]" : "text-[#7a847d]",
              )}
            >
              <MobileIcon size={19} weight={active ? "fill" : "regular"} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <CreateDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
