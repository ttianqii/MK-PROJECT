"use client";

import { useMemo, useState } from "react";
import type { Category } from "@/lib/checklist";
import CategorySection from "./CategorySection";

export default function ChecklistCategories({ categories }: { categories: Category[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // When searching, keep only courses whose code or name matches, drop empty
  // groups, then drop categories left with no groups.
  const filtered = useMemo(() => {
    if (!q) return null;
    return categories
      .map((cat) => ({
        ...cat,
        groups: cat.groups
          .map((g) => ({
            ...g,
            courses: g.courses.filter(
              (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
            ),
          }))
          .filter((g) => g.courses.length > 0),
      }))
      .filter((cat) => cat.groups.length > 0);
  }, [categories, q]);

  const list = filtered ?? categories;
  const matchCount = filtered
    ? filtered.reduce((n, c) => n + c.groups.reduce((m, g) => m + g.courses.length, 0), 0)
    : null;

  return (
    <div className="space-y-6">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by course code or name…"
          aria-label="Search courses"
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {q ? (
        matchCount === 0 ? (
          <div className="rounded-lg bg-white p-6 text-center text-gray-500 shadow">
            No courses match “{query}”.
          </div>
        ) : (
          <p className="-mt-2 text-sm text-gray-500">
            {matchCount} {matchCount === 1 ? "course" : "courses"} match “{query}”.
          </p>
        )
      ) : null}

      {list.map((cat, ci) => (
        <CategorySection key={`${ci}-${cat.category}`} category={cat} forceOpen={q ? true : undefined} />
      ))}
    </div>
  );
}
