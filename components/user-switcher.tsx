"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, UserRound } from "lucide-react";

type User = { id: string; name: string; email: string };
type NavigationRequest = (action: () => Promise<boolean>) => void;
type Props = { users: User[]; currentUserId: string; requestNavigation?: NavigationRequest; compact?: boolean };

export function UserSwitcher({ users, currentUserId, requestNavigation, compact = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const currentUser = users.find((user) => user.id === currentUserId) ?? users[0];

  function openAndFocus(index: number) {
    setOpen(true);
    requestAnimationFrame(() => optionRefs.current[index]?.focus());
  }

  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      optionRefs.current[(index + 1) % users.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      optionRefs.current[(index - 1 + users.length) % users.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      optionRefs.current[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      optionRefs.current[users.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function completeSwitch(userId: string) {
    if (userId === currentUserId) {
      setOpen(false);
      return true;
    }
    setLoading(true);
    setOpen(false);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (response.ok) {
        router.push("/");
        router.refresh();
        return true;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not switch user.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
    setOpen(true);
    return false;
  }

  function switchUser(userId: string) {
    if (requestNavigation) requestNavigation(() => completeSwitch(userId));
    else void completeSwitch(userId);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Switch demo user"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={loading}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); openAndFocus(0); }
          if (event.key === "ArrowUp") { event.preventDefault(); openAndFocus(users.length - 1); }
        }}
        className={`flex h-11 items-center gap-2.5 rounded-xl border border-zinc-200 bg-white text-left shadow-sm transition hover:border-zinc-300 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-60 ${compact ? "w-11 justify-center px-0" : "min-w-[180px] px-3.5"}`}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark">
          <UserRound className="h-4 w-4" />
        </span>
        {!compact && <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-800">{loading ? "Switching…" : currentUser?.name}</span>}
        {!compact && <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && (
        <div role="menu" aria-label="Demo users" className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(20,30,25,0.16)]">
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Switch workspace</p>
          {users.map((user, index) => {
            const selected = user.id === currentUserId;
            const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
            return (
              <button
                key={user.id}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => switchUser(user.id)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${selected ? "bg-brand-soft" : "hover:bg-zinc-50"}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${selected ? "bg-brand text-white" : "bg-zinc-100 text-zinc-600"}`}>{initials}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-zinc-900">{user.name}</span><span className="block truncate text-xs text-zinc-500">{user.email}</span></span>
                {selected && <Check className="h-4 w-4 shrink-0 text-brand" />}
              </button>
            );
          })}
          {error && <p role="alert" className="mx-2 mb-2 mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
