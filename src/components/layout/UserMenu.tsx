"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { SignOut, User } from "@phosphor-icons/react";

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  if (!session?.user) return null;

  const name = session.user.name || session.user.email || "User";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-opacity hover:opacity-80"
        style={{ background: "var(--accent)", color: "white" }}
        title={name}
      >
        {initial}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute bottom-full mb-2 right-0 w-44 rounded-xl overflow-hidden z-50"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
          >
            <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{name}</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{session.user.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80 transition-opacity"
              style={{ color: "var(--rose)" }}
            >
              <SignOut size={12} weight="bold" /> Đăng xuất
            </button>
          </div>
        </>
      )}
    </div>
  );
}
