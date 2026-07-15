"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

const NAV = [
  { href: "/dashboard", label: "Study Plan" },
  { href: "/dashboard/plan", label: "My Plan" },
  { href: "/dashboard/registration", label: "Registration Result" },
];

export default function DashboardHeader({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 pt-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="whitespace-nowrap text-lg font-semibold text-gray-900">MK Study Plan</span>
            <span className="truncate text-sm text-gray-400">/ {username}</span>
          </div>
          <LogoutButton />
        </div>
        <nav className="-mx-1 mt-1 flex items-center gap-1 overflow-x-auto px-1 pb-2">
          {NAV.map((item) => {
            // Prefix match keeps "My Plan" lit on its /builder subpage.
            const active =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
