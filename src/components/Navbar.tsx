"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { BrandMark } from "@/components/PageHeader";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

interface NavbarProps {
  user: { name: string; email: string; isAdmin: boolean } | null;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/live", label: "Live" },
    { href: "/matches", label: "My picks" },
    { href: "/bracket", label: "Bracket" },
    { href: "/activity", label: "Activity" },
    { href: "/leaderboard", label: "Leaderboard" },
  ];

  if (user?.isAdmin) {
    links.push({ href: "/admin", label: "Admin" });
    links.push({ href: "/admin/picks", label: "Pick history" });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-default bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark size="sm" />
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[color:var(--wc-red)]">
              CODPARTNER
            </p>
            <p className="font-fifa text-sm font-semibold tracking-wide text-foreground">
              WORLD CUP 2026
            </p>
          </div>
        </Link>

        {user && (
          <nav className="flex items-center gap-2 sm:gap-3">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "wc-filter-active shadow-md"
                      : "text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <ThemeSwitcher compact />
            <div className="hidden items-center gap-3 pl-1 sm:flex">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted">{user.email}</p>
              </div>
              <Button size="sm" variant="secondary" onPress={logout}>
                Log out
              </Button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
