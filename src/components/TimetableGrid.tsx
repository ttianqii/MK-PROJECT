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
}: {
  sections: PlanSection[];
  conflictKeys?: Set<string>;
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
    <div className="overflow-x-auto">
      {/* Time header + day rows; the ScheduleCard wrapping this already
          supplies the white background and padding, so no chrome here. */}
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
                className="flex items-center justify-center text-center text-xs font-semibold tracking-wide text-gray-700"
                style={{ width: LABEL_W }}
              >
                {day.short}
              </div>
              <div className="relative flex-1" style={{ height: rowH }}>
                {/* Vertical gridlines, one per column boundary (skip the
                    right edge so the table isn't closed off on that side) */}
                {ticks
                  .filter((t) => t !== end)
                  .map((t) => (
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
        <div className="mt-4 flex flex-wrap gap-2">
          {sections.map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700"
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
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ color }}>
      <path d="M0 0h24v24H0z" fill="none" />
      <rect width="12" height="10" x="6" y="2" fill="currentColor" rx="1" ry="1" />
      <path
        fill="currentColor"
        d="M4 15v2c0 .55.45 1 1 1h1v4h2v-4h8v4h2v-4h1c.55 0 1-.45 1-1v-2c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1"
      />
    </svg>
  );
}
