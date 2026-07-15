"use client";

import { useMemo, useState } from "react";
import type { ScheduleData, ScheduleSlot } from "@/lib/scheduleQueries";

export default function ScheduleBrowser({ data }: { data: ScheduleData }) {
  const { days, slots } = data;
  const [day, setDay] = useState(days[0] ?? "");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const visible = useMemo(() => {
    return slots.filter((s) => {
      if (s.day !== day) return false;
      if (!q) return true;
      return (
        s.courseCode.toLowerCase().includes(q) ||
        s.courseName.toLowerCase().includes(q) ||
        s.room.toLowerCase().includes(q) ||
        (s.section?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [slots, day, q]);

  return (
    <div className="space-y-5">
      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {days.map((d) => {
          const active = d === day;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              aria-current={active ? "page" : undefined}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>

      {/* Search */}
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
          placeholder="Filter by course code, name, room, or section…"
          aria-label="Filter schedule"
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <p className="text-sm text-gray-500">
        {visible.length} {visible.length === 1 ? "class" : "classes"} on {day}
        {q ? <> matching “{query}”</> : null}.
      </p>

      {visible.length === 0 ? (
        <div className="rounded-lg bg-white p-6 text-center text-gray-500 shadow">
          No classes {q ? <>match “{query}” on {day}</> : <>on {day}</>}.
        </div>
      ) : (
        <ScheduleTable slots={visible} />
      )}
    </div>
  );
}

function ScheduleTable({ slots }: { slots: ScheduleSlot[] }) {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-4 py-3 font-medium">Section</th>
              <th className="px-4 py-3 font-medium">Room</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {slots.map((s, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-700">
                  {s.startTime}–{s.endTime}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono font-medium text-gray-900">{s.courseCode}</span>
                  <span className="block text-xs text-gray-500">{s.courseName}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                  {s.section ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                  {s.room}
                  {s.roomCapacity != null ? (
                    <span className="text-gray-400"> ({s.roomCapacity})</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
