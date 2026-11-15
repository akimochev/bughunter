"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderSearch, Trophy, UserRound } from "lucide-react";
import { Brand } from "@/components/ui";

const navigation = [
  { href: "/missions", label: "Миссии", icon: FolderSearch },
  { href: "/leaderboard", label: "Рейтинг", icon: Trophy },
  { href: "/profile", label: "Профиль", icon: UserRound },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="main-nav" aria-label="Основная навигация">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={17} />
                <span>{label}</span>
                {href === "/leaderboard" && (
                  <span className="soon-tag">скоро</span>
                )}
              </Link>
            );
          })}
        </nav>
        <span className="header-note">
          <span />
          Учись на ошибках
        </span>
      </div>
    </header>
  );
}
