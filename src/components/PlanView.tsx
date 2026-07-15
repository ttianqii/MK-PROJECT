"use client";

// The saved-plan screen: student header, editable plan name, and one card per
// saved schedule (timetable grid, seat chips, ♥, and REGISTER) — echoing the
// reference mobile design.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import type { PlanSection } from "@/lib/timetable";
import TimetableGrid from "./TimetableGrid";
import StudentBanner from "./StudentBanner";
import PopUpAlert from "./PopUpAlert";

export interface PlanViewSchedule {
  id: number;
  liked: boolean;
  sections: PlanSection[];
}

/** "2023-05-06T14:49:00Z" -> "6/5/23 14:49" (matches the reference header). */
function formatUpdated(iso: string): string {
  const d = new Date(iso);
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}/${d.getMonth() + 1}/${yy} ${hh}:${mm}`;
}

export default function PlanView({
  student,
  planName,
  updatedAt,
  schedules,
}: {
  student: { studentId: string; nameEn: string; photo: string };
  planName: string;
  updatedAt: string;
  schedules: PlanViewSchedule[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(planName);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Optimistic ♥ state so the heart flips instantly.
  const [likedOverride, setLikedOverride] = useState<Record<number, boolean>>({});

  const saveName = async () => {
    setEditing(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === planName) {
      setName(planName);
      return;
    }
    const res = await fetch("/api/plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      setName(planName);
      PopUpAlert("Rename failed", "Could not rename the plan.", "error");
    }
  };

  const toggleLike = async (s: PlanViewSchedule) => {
    const next = !(likedOverride[s.id] ?? s.liked);
    setLikedOverride((o) => ({ ...o, [s.id]: next }));
    const res = await fetch(`/api/plan/schedules/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liked: next }),
    });
    if (!res.ok) {
      setLikedOverride((o) => ({ ...o, [s.id]: !next }));
      PopUpAlert("Oops", "Could not update the favorite.", "error");
    }
  };

  const removeSchedule = async (id: number, label: string) => {
    const confirm = await Swal.fire({
      title: `Delete ${label}?`,
      text: "This removes the saved schedule from your plan.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#BE123C",
      confirmButtonText: "Delete",
    });
    if (!confirm.isConfirmed) return;

    const res = await fetch(`/api/plan/schedules/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else PopUpAlert("Oops", "Could not delete the schedule.", "error");
  };

  const register = async (id: number, label: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/plan/schedules/${id}/register`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        PopUpAlert("Registration failed", data.message ?? "Please try again.", "error");
        return;
      }
      await Swal.fire({
        title: "Registered!",
        text: `${label} was submitted as your registration.`,
        icon: "success",
        timer: 1600,
        showConfirmButton: false,
      });
      router.push(data.redirectTo ?? "/dashboard/registration");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <StudentBanner
        studentId={student.studentId}
        nameEn={student.nameEn}
        photo={student.photo}
      />

      {/* Plan name + updated at */}
      <div className="mt-5 flex items-center gap-3">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setName(planName);
                setEditing(false);
              }
            }}
            maxLength={100}
            aria-label="Plan name"
            className="w-56 rounded-md border border-gray-300 bg-white px-2 py-1 text-3xl font-light text-gray-900 focus:border-blue-500 focus:outline-none"
          />
        ) : (
          <h1 className="text-3xl font-light text-gray-900">{name}</h1>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Rename plan"
          className="text-gray-700 hover:text-gray-900"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </button>
      </div>
      <p className="mt-1 text-sm uppercase tracking-wide text-gray-400">
        Updated at {formatUpdated(updatedAt)} hrs.
      </p>

      {/* Schedule cards */}
      <div className="mt-6 space-y-6">
        {schedules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">No saved schedules yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              Build one in{" "}
              <Link href="/dashboard/plan" className="font-medium text-blue-600 hover:underline">
                Plan next term
              </Link>{" "}
              and press “Save to My Plan”.
            </p>
          </div>
        ) : (
          schedules.map((s, i) => {
            const label = `Schedule ${i + 1}`;
            const liked = likedOverride[s.id] ?? s.liked;
            return (
              <section key={s.id} className="rounded-2xl bg-gray-200/60 p-4 shadow-sm sm:p-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-xl font-bold uppercase tracking-wide text-gray-800">
                    {label}
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <rect x="3" y="5" width="18" height="16" rx="2" />
                        <path d="M8 3v4M16 3v4M3 9h18" />
                        <path d="M7.5 12.5h.01M11 12.5h.01M14.5 12.5h.01M7.5 16h.01M11 16h.01M14.5 16h.01" strokeLinecap="round" strokeWidth="2.4" stroke="#DC2626" />
                      </svg>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleLike(s)}
                      aria-label={liked ? `Unlike ${label}` : `Like ${label}`}
                      aria-pressed={liked}
                      className="transition-transform hover:scale-110"
                    >
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill={liked ? "#BE123C" : "none"}
                        stroke={liked ? "#BE123C" : "#9CA3AF"}
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M12 21s-7.5-4.7-10-9.3C.6 8.4 2.6 4.5 6.4 4.5c2.2 0 3.9 1.2 5.6 3.3 1.7-2.1 3.4-3.3 5.6-3.3 3.8 0 5.8 3.9 4.4 7.2C19.5 16.3 12 21 12 21z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSchedule(s.id, label)}
                      aria-label={`Delete ${label}`}
                      title="Delete schedule"
                      className="px-1 text-gray-500 hover:text-red-600"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="12" cy="5" r="1.8" />
                        <circle cx="12" cy="12" r="1.8" />
                        <circle cx="12" cy="19" r="1.8" />
                      </svg>
                    </button>
                  </div>
                </div>

                {s.sections.length === 0 ? (
                  <p className="rounded-lg bg-white p-4 text-sm text-gray-500">
                    The classes saved in this schedule are no longer offered this term.
                  </p>
                ) : (
                  <TimetableGrid sections={s.sections} frameless />
                )}

                <button
                  type="button"
                  onClick={() => register(s.id, label)}
                  disabled={busyId !== null || s.sections.length === 0}
                  className="mt-4 w-full rounded-full bg-rose-700 py-3 text-lg font-semibold uppercase tracking-wide text-white shadow hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === s.id ? "Registering…" : "Register"}
                </button>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
