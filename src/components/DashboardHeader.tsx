"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import StudentBanner from "./StudentBanner";

const NAV = [
  { href: "/dashboard", label: "Study Info" },
  { href: "/dashboard/plan", label: "My Plan" },
  { href: "/dashboard/registration", label: "Registration Result" },
];

export interface HeaderStudent {
  studentId: string;
  nameEn: string;
  photo: string;
}

export default function DashboardHeader({ student }: { student: HeaderStudent }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:px-6">
        {/* Logo, tabs, and profile all on one row */}
        <span className="shrink-0 text-lg font-black uppercase leading-none tracking-tight text-gray-900">
          Study Plan
        </span>

        <nav className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
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
                className={`whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
                  active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <StudentBanner
            studentId={student.studentId}
            nameEn={student.nameEn}
            photo={student.photo}
          />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
