"use client";

import { useMemo } from "react";
import {
  DAYS,
  formatMinutes,
  sectionColors,
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

const LANE_H = 26; // px per stacked block
const LANE_GAP = 4;
const ROW_PAD = 9;
const LABEL_W = 56; // px, day-label gutter
const DAY_START = 540; // 09:00, first column of the reference design
const DAY_END = 1260; // 21:00, last column
const TICK = 90; // column width in minutes

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

    // The reference's fixed 09:00–21:00 window, extended by whole columns
    // only when a class falls outside it.
    const start = DAY_START - Math.max(0, Math.ceil((DAY_START - minStart) / TICK)) * TICK;
    const end = DAY_END + Math.max(0, Math.ceil((maxEnd - DAY_END) / TICK)) * TICK;

    const ticks: number[] = [];
    for (let t = start; t <= end; t += TICK) ticks.push(t);

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
  const colors = useMemo(() => sectionColors(sections), [sections]);

  return (
    <div
      className={
        frameless
          ? "overflow-x-auto"
          : "overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      }
    >
      <div className="min-w-80">
        {/* Time header */}
        <div className="flex" style={{ paddingLeft: LABEL_W }}>
          <div className="relative h-6 flex-1">
            {ticks.map((t) => (
              <span
                key={t}
                className={`absolute text-[10px] font-medium text-gray-500 sm:text-xs ${
                  t === end ? "" : "-translate-x-1/2"
                }`}
                style={t === end ? { right: 0 } : { left: pctLeft(t) }}
              >
                {formatMinutes(t)}
              </span>
            ))}
          </div>
        </div>

        {/* Day rows */}
        {rows.map(({ day, placed, lanes }, rowIdx) => {
          const rowH = lanes * LANE_H + (lanes - 1) * LANE_GAP + ROW_PAD * 2;
          return (
            <div
              key={day.full}
              className={`flex items-stretch border-t border-gray-300/70 ${
                rowIdx === rows.length - 1 ? "border-b" : ""
              }`}
            >
              <div
                className="flex items-center text-xs font-semibold tracking-wide text-gray-700"
                style={{ width: LABEL_W }}
              >
                {day.short}
              </div>
              <div className="relative flex-1" style={{ height: rowH }}>
                {/* Vertical gridlines, one per column boundary */}
                {ticks.map((t) => (
                  <div
                    key={t}
                    className="absolute top-0 bottom-0 border-l border-gray-300/70"
                    style={{ left: pctLeft(t) }}
                  />
                ))}
                {/* Class blocks: clean colored pills, details in the tooltip */}
                {placed.map((p, i) => {
                  const color = colors.get(p.section.key) ?? "#7A8290";
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
                      className="absolute rounded-full"
                      style={{
                        left: `calc(${pctLeft(p.startMin)} + 2px)`,
                        width: `calc(${pctWidth(p.startMin, p.endMin)} - 4px)`,
                        top: ROW_PAD + p.lane * (LANE_H + LANE_GAP),
                        height: LANE_H,
                        backgroundColor: color,
                        outline: isConflict ? "2px solid #DC2626" : undefined,
                        outlineOffset: isConflict ? "1px" : undefined,
                      }}
                    />
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
              <SeatIcon color={colors.get(s.key) ?? "#7A8290"} />
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
