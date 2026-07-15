"use client";

import { useMemo } from "react";
import {
  DAYS,
  colorFor,
  formatMinutes,
  type PlanSection,
} from "@/lib/timetable";

// A meeting positioned onto the grid, carrying its owning section + lane.
interface Placed {
  section: PlanSection;
  day: string;
  startMin: number;
  endMin: number;
  room: string;
  lane: number;
  conflict: boolean;
}

const LANE_H = 30; // px per stacked block
const LANE_GAP = 4;
const ROW_PAD = 8;
const LABEL_W = 56; // px, day-label gutter

/** Assign overlapping meetings on a day to stacked lanes (interval graph). */
function assignLanes(items: Omit<Placed, "lane" | "conflict">[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin);
  const laneEnds: number[] = [];
  const placed: Placed[] = [];

  for (const it of sorted) {
    let lane = laneEnds.findIndex((end) => end <= it.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.endMin);
    } else {
      laneEnds[lane] = it.endMin;
    }
    placed.push({ ...it, lane, conflict: false });
  }

  // Mark any pair that overlaps in time as conflicting.
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (placed[i].startMin < placed[j].endMin && placed[j].startMin < placed[i].endMin) {
        placed[i].conflict = placed[j].conflict = true;
      }
    }
  }
  return placed;
}

export default function TimetableGrid({
  sections,
  conflictKeys,
  frameless = false,
}: {
  sections: PlanSection[];
  conflictKeys?: Set<string>;
  /** Drop the white card chrome so the grid can sit inside another card. */
  frameless?: boolean;
}) {
  const { start, end, ticks, rows } = useMemo(() => {
    const allMeetings = sections.flatMap((s) => s.meetings);
    const minStart = allMeetings.length ? Math.min(...allMeetings.map((m) => m.startMin)) : 540;
    const maxEnd = allMeetings.length ? Math.max(...allMeetings.map((m) => m.endMin)) : 1260;

    // Fixed-ish window, expanded to fit anything unusual; snapped to the hour.
    const start = Math.min(480, Math.floor(minStart / 60) * 60); // ≤ 08:00
    const end = Math.max(1260, Math.ceil(maxEnd / 60) * 60); // ≥ 21:00

    const ticks: number[] = [];
    for (let t = start; t <= end; t += 90) ticks.push(t);

    const rows = DAYS.map((d) => {
      const dayMeetings = sections.flatMap((s) =>
        s.meetings
          .filter((m) => m.day === d.full)
          .map((m) => ({
            section: s,
            day: m.day,
            startMin: m.startMin,
            endMin: m.endMin,
            room: m.room,
          }))
      );
      const placed = assignLanes(dayMeetings);
      const lanes = placed.reduce((n, p) => Math.max(n, p.lane + 1), 1);
      return { day: d, placed, lanes };
    });

    return { start, end, ticks, rows };
  }, [sections]);

  const span = end - start || 1;
  const pctLeft = (min: number) => `${((min - start) / span) * 100}%`;
  const pctWidth = (a: number, b: number) => `${((b - a) / span) * 100}%`;

  return (
    <div
      className={
        frameless
          ? "overflow-x-auto"
          : "overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      }
    >
      <div className="min-w-[720px]">
        {/* Time header */}
        <div className="flex" style={{ paddingLeft: LABEL_W }}>
          <div className="relative h-6 flex-1">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute -translate-x-1/2 text-xs font-medium text-gray-500"
                style={{ left: pctLeft(t) }}
              >
                {formatMinutes(t)}
              </span>
            ))}
          </div>
        </div>

        {/* Day rows */}
        {rows.map(({ day, placed, lanes }) => {
          const rowH = lanes * LANE_H + (lanes - 1) * LANE_GAP + ROW_PAD * 2;
          return (
            <div key={day.full} className="flex items-stretch border-t border-gray-100">
              <div
                className="flex items-center text-sm font-semibold text-gray-600"
                style={{ width: LABEL_W }}
              >
                {day.short}
              </div>
              <div className="relative flex-1" style={{ height: rowH }}>
                {/* Vertical gridlines */}
                {ticks.map((t) => (
                  <div
                    key={t}
                    className="absolute top-0 bottom-0 border-l border-gray-100"
                    style={{ left: pctLeft(t) }}
                  />
                ))}
                {/* Class blocks */}
                {placed.map((p, i) => {
                  const color = colorFor(p.section.key);
                  // When the parent supplies conflict keys (time + duplicate
                  // course), let them drive the outline; otherwise fall back to
                  // this grid's own time-overlap detection.
                  const isConflict = conflictKeys
                    ? conflictKeys.has(p.section.key)
                    : p.conflict;
                  return (
                    <div
                      key={i}
                      title={`${p.section.courseCode}${p.section.section ? ` (${p.section.section})` : ""} · ${p.section.courseName}\n${formatMinutes(p.startMin)}–${formatMinutes(p.endMin)} · ${p.room}${isConflict ? "\n⚠ conflict" : ""}`}
                      className="absolute flex items-center overflow-hidden rounded-full px-2 text-xs font-semibold text-white shadow-sm"
                      style={{
                        left: pctLeft(p.startMin),
                        width: pctWidth(p.startMin, p.endMin),
                        top: ROW_PAD + p.lane * (LANE_H + LANE_GAP),
                        height: LANE_H,
                        backgroundColor: color,
                        outline: isConflict ? "2px solid #DC2626" : undefined,
                        outlineOffset: isConflict ? "-2px" : undefined,
                      }}
                    >
                      <span className="truncate">
                        {p.section.courseCode}
                        {p.section.section ? (
                          <span className="ml-1 font-normal opacity-80">{p.section.section}</span>
                        ) : null}
                        {p.room ? (
                          <span className="ml-1 font-normal opacity-70">@{p.room}</span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend: one seat chip per planned section */}
      {sections.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {sections.map((s) => (
            <span
              key={s.key}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 ${
                frameless ? "bg-white shadow-sm" : "bg-gray-100"
              }`}
              title={`${s.courseCode}${s.section ? ` (${s.section})` : ""} · seats: ${s.capacity ?? "—"}`}
            >
              <SeatIcon color={colorFor(s.key)} />
              {s.capacity ?? "—"}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SeatIcon({ color }: { color: string }) {
  // Simple chair glyph echoing the reference legend.
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
      <path
        d="M4 2.5a1.5 1.5 0 013 0V8h2V2.5a1.5 1.5 0 013 0V9a1 1 0 01-1 1H5a1 1 0 01-1-1V2.5z"
        fill={color}
      />
      <path d="M4.5 10.5h7l-.5 3.5H5l-.5-3.5z" fill={color} />
      <path d="M5 14v3M11 14v3" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
