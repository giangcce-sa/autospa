"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sparkle, UserCircle } from "@phosphor-icons/react";

export function SetupForm() {
  const router = useRouter();

  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Mật khẩu nhập lại không khớp");
      return;
    }
    if (form.password.length < 6) {
      setError("Mật khẩu tối thiểu 6 ký tự");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Không tạo được tài khoản"); return; }

      // Auto sign in
      await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      router.push("/");
      router.refresh();
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3"
            style={{
              background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)",
              boxShadow: "0 4px 12px rgba(45,106,79,0.35)",
            }}
          >
            <Sparkle size={22} weight="fill" color="white" />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Tạo tài khoản đầu tiên</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Bạn sẽ là Owner — toàn quyền với tool</p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Tên hiển thị"
              placeholder="VD: Quyết"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
            />
            <Input
              label="Email"
              type="email"
              placeholder="ban@spa.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Mật khẩu (tối thiểu 6 ký tự)"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <Input
              label="Nhập lại mật khẩu"
              type="password"
              placeholder="••••••••"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
            />
            {error && (
              <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>
            )}
            <Button type="submit" loading={loading} className="w-full">
              <UserCircle size={14} weight="fill" /> Tạo tài khoản Owner
            </Button>
          </form>
        </div>

        <p className="text-[11px] text-center mt-4" style={{ color: "var(--text-muted)" }}>
          Trang này chỉ hiển thị lần đầu khi chưa có account nào.
        </p>
      </div>
    </div>
  );
}
