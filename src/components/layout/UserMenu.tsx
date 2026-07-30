"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { SignOut } from "@phosphor-icons/react";
import { Popover } from "@/components/ui/Popover";

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  if (!session?.user) return null;

  const name = session.user.name || session.user.email || "User";
  const initial = name.charAt(0).toUpperCase();

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label="Tài khoản người dùng"
      className="bottom-full top-auto mb-2 w-56"
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-[var(--accent-foreground)] transition-opacity hover:opacity-85"
          aria-label={`Mở menu tài khoản ${name}`}
        >
          {initial}
        </button>
      )}
    >
      <div className="border-b border-[var(--border)] px-4 py-3">
        <p className="truncate text-xs font-semibold text-[var(--text)]">{name}</p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{session.user.email}</p>
      </div>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger-light)]"
      >
        <SignOut size={14} weight="bold" aria-hidden="true" /> Đăng xuất
      </button>
    </Popover>
  );
}
