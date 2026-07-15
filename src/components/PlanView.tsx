"use client";

// The saved-plan screen: "Planner" heading and one card per saved schedule
// (timetable grid, seat chips, ♥, and REGISTER) — echoing the reference
// mobile design.
import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import type { PlanSection } from "@/lib/timetable";
import TimetableGrid from "./TimetableGrid";
import EditableTitle from "./EditableTitle";
import ScheduleCard from "./ScheduleCard";
import PopUpAlert from "./PopUpAlert";

export interface PlanViewSchedule {
  id: number;
  title: string;
  liked: boolean;
  sections: PlanSection[];
}

// Confetti dots for the like-burst: a full ring, varying color/size/travel
// distance/stagger per dot so it reads as an organic explosion rather than
// a uniform circle — echoing Twitter's heart-burst effect. The heart is the
// same 28px at every breakpoint now, so one set of dot sizes covers both.
const BURST_COLORS = ["#E11D48", "#FB923C", "#FBBF24", "#F472B6"];
const BURST_DOTS = Array.from({ length: 12 }, (_, i) => ({
  angle: `${i * 30}deg`,
  color: BURST_COLORS[i % BURST_COLORS.length],
  dist: i % 2 === 0 ? "26px" : "19px",
  size: i % 2 === 0 ? "7px" : "5px",
  delay: `${(i % 3) * 15}ms`,
}));

/** "2023-05-06T14:49:00Z" -> "6/5/23 14:49" (matches the reference header). */
function formatUpdated(iso: string): string {
  const d = new Date(iso);
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}/${d.getMonth() + 1}/${yy} ${hh}:${mm}`;
}

export default function PlanView({
  updatedAt,
  schedules,
}: {
  updatedAt: string;
  schedules: PlanViewSchedule[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  // Optimistic ♥ state so the heart flips instantly.
  const [likedOverride, setLikedOverride] = useState<Record<number, boolean>>({});
  // Which schedule's "⋮" dropdown is open, and which one is being renamed.
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Which heart is mid spring-pop, and which is bursting into confetti
  // (both cleared once their animations finish). Only liking (not
  // unliking) triggers the confetti burst, matching Twitter's heart.
  const [pulseId, setPulseId] = useState<number | null>(null);
  const [burstId, setBurstId] = useState<number | null>(null);

  const saveTitle = async (s: PlanViewSchedule, fallbackLabel: string, next: string) => {
    const title = next === fallbackLabel ? "" : next;
    if (title === s.title) return;

    const res = await fetch(`/api/plan/schedules/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) router.refresh();
    else PopUpAlert("Rename failed", "Could not rename the schedule.", "error");
  };

  const toggleLike = async (s: PlanViewSchedule) => {
    const next = !(likedOverride[s.id] ?? s.liked);
    setLikedOverride((o) => ({ ...o, [s.id]: next }));
    setPulseId(s.id);
    if (next) {
      setBurstId(s.id);
      // Longest-running dot finishes at ~630ms (max stagger + duration).
      setTimeout(() => setBurstId(null), 650);
    }
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
      imageUrl: "/warning.gif",
      imageWidth: 96,
      imageHeight: 96,
      imageAlt: "Warning",
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
        imageUrl: "/save.gif",
        imageWidth: 96,
        imageHeight: 96,
        imageAlt: "Registered",
        timer: 2200,
        showConfirmButton: false,
      });
      router.push(data.redirectTo ?? "/dashboard/registration");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {/* Page title, matching the Registration Result heading style */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-light uppercase tracking-wide text-gray-900">Planner</h1>
        <Link
          href="/dashboard/plan/builder"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-gray-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Plan
        </Link>
      </div>

      <p className="mt-1 text-sm uppercase tracking-wide text-gray-400">
        Updated at {formatUpdated(updatedAt)} hrs.
      </p>

      {/* Schedule cards */}
      <div className="mt-6 space-y-3 sm:space-y-6">
        {schedules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">No saved schedules yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              Press <span className="font-semibold text-gray-600">Add Plan</span> above to build
              one, then “Save to My Plan”.
            </p>
          </div>
        ) : (
          schedules.map((s, i) => {
            const fallbackLabel = `Schedule ${i + 1}`;
            const label = s.title || fallbackLabel;
            const liked = likedOverride[s.id] ?? s.liked;
            return (
              <ScheduleCard key={s.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2">
                  <EditableTitle
                    value={s.title}
                    placeholder={fallbackLabel}
                    onSave={(next) => saveTitle(s, fallbackLabel, next)}
                    editing={editingId === s.id}
                    onEditingChange={(v) => setEditingId(v ? s.id : null)}
                    hideTrigger
                    headingClassName="text-sm font-bold uppercase tracking-wide text-gray-800 sm:text-xl"
                  />
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => toggleLike(s)}
                      aria-label={liked ? `Unlike ${label}` : `Like ${label}`}
                      aria-pressed={liked}
                      className="relative flex h-8 w-8 items-center justify-center hover:scale-110 sm:h-7 sm:w-7"
                    >
                      {burstId === s.id
                        ? BURST_DOTS.map((dot, i) => (
                            <span
                              key={i}
                              aria-hidden="true"
                              className="heart-burst-dot"
                              style={
                                {
                                  "--angle": dot.angle,
                                  "--dist": dot.dist,
                                  "--size": dot.size,
                                  "--delay": dot.delay,
                                  backgroundColor: dot.color,
                                } as CSSProperties
                              }
                            />
                          ))
                        : null}
                      <svg
                        viewBox="0 0 24 24"
                        fill={liked ? "#BE123C" : "none"}
                        stroke={liked ? "#BE123C" : "#9CA3AF"}
                        strokeWidth="2"
                        aria-hidden="true"
                        onAnimationEnd={() => setPulseId(null)}
                        className={`h-7 w-7 transition-colors duration-200 sm:h-7 sm:w-7 ${
                          pulseId === s.id ? "animate-heart-pop" : ""
                        }`}
                      >
                        <path d="M12 21s-7.5-4.7-10-9.3C.6 8.4 2.6 4.5 6.4 4.5c2.2 0 3.9 1.2 5.6 3.3 1.7-2.1 3.4-3.3 5.6-3.3 3.8 0 5.8 3.9 4.4 7.2C19.5 16.3 12 21 12 21z" />
                      </svg>
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId((id) => (id === s.id ? null : s.id))}
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === s.id}
                        aria-label={`More options for ${label}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 sm:h-7 sm:w-7"
                      >
                        <svg className="h-6 w-6 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <circle cx="12" cy="5" r="1.8" />
                          <circle cx="12" cy="12" r="1.8" />
                          <circle cx="12" cy="19" r="1.8" />
                        </svg>
                      </button>
                      {openMenuId === s.id ? (
                        <>
                          {/* Click anywhere outside to dismiss */}
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                            aria-hidden="true"
                          />
                          <div
                            role="menu"
                            className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                setEditingId(s.id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                              </svg>
                              Edit Plan
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                removeSchedule(s.id, label);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {s.sections.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500 sm:bg-white sm:p-4 sm:text-sm">
                    The classes saved in this schedule are no longer offered this term.
                  </p>
                ) : (
                  <TimetableGrid sections={s.sections} />
                )}

                <button
                  type="button"
                  onClick={() => register(s.id, label)}
                  disabled={busyId !== null || s.sections.length === 0}
                  className="mt-3 w-full rounded-full bg-rose-700 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-4 sm:py-3 sm:text-lg"
                >
                  {busyId === s.id ? "Registering…" : "Register"}
                </button>
              </ScheduleCard>
            );
          })
        )}
      </div>
    </div>
  );
}
