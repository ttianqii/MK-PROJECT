"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import LogoutButton from "./LogoutButton";
import StudentBanner from "./StudentBanner";

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/dashboard",
    label: "Study Info",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/plan",
    label: "My Plan",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    href: "/dashboard/registration",
    label: "Registration Result",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
];

export interface HeaderStudent {
  studentId: string;
  nameEn: string;
  photo: string;
}

// Prefix match keeps "My Plan" lit on its /builder subpage.
function isActive(href: string, pathname: string) {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardHeader({ student }: { student: HeaderStudent }) {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-gray-200/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-900 text-white shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3L2 8l10 5 10-5-10-5z" />
                <path d="M6 10.5V15c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
              </svg>
            </span>
            <span className="text-base font-bold tracking-tight text-gray-900 sm:text-lg">
              Study&nbsp;Plan
            </span>
          </Link>

          {/* Desktop tabs, centered */}
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-gray-900 text-white shadow-sm"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <StudentBanner
              studentId={student.studentId}
              nameEn={student.nameEn}
              photo={student.photo}
            />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Phone/tablet: floating pill nav, thumb-reachable at the bottom */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-fit items-center gap-1 rounded-full bg-gray-900/95 p-1.5 shadow-lg shadow-gray-900/20 backdrop-blur md:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              className={`flex items-center gap-2 rounded-full px-4 py-2.5 transition-colors ${
                active ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
              }`}
            >
              {item.icon}
              {active ? (
                <span className="max-w-32 truncate text-xs font-semibold">{item.label}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
