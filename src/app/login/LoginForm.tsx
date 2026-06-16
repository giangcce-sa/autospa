"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sparkle, SignIn } from "@phosphor-icons/react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("Email hoặc mật khẩu không đúng");
        return;
      }
      router.push(from);
      router.refresh();
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 logo-icon"
            style={{
              background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)",
              boxShadow: "0 4px 12px rgba(45,106,79,0.35)",
            }}
          >
            <Sparkle size={22} weight="fill" color="white" />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>AutoSpa</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Marketing AI cho spa</p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Email"
              type="email"
              placeholder="ban@spa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
            <Input
              label="Mật khẩu"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {error && (
              <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>
            )}
            <Button type="submit" loading={loading} className="w-full" disabled={!email || !password}>
              <SignIn size={14} weight="fill" /> Đăng nhập
            </Button>
          </form>
        </div>

        <p className="text-[11px] text-center mt-4" style={{ color: "var(--text-muted)" }}>
          AutoSpa Marketing AI · v2.3
        </p>
      </div>
    </div>
  );
}
