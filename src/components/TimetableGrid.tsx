"use client";

import { useMemo } from "react";
import {
  DAYS,
  formatMinutes,
  sectionColors,
  type PlanSection,
} from "@/lib/timetable";

// A meeting positioned onto one period column, carrying its owning section
// (clipped to that period's bounds) + stacking lane.
interface Placed {
  section: PlanSection;
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

// The registrar's real daily periods (minutes since midnight): a 1hr20min
// lunch break after period 1, 10-min passing breaks between the rest. The
// grid renders one column per period rather than a continuous minute-scale
// axis, so those short passing breaks don't need their own cramped tick.
const PERIODS: [number, number][] = [
  [520, 660], // 8:40–11:00
  [720, 860], // 12:00–14:20
  [870, 1010], // 14:30–16:50
  [1020, 1160], // 17:00–19:20
];

/** Assign overlapping meetings within one period to stacked lanes. */
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
  const rows = useMemo(
    () =>
      DAYS.map((d) => {
        const dayMeetings = sections.flatMap((s) =>
          s.meetings
            .filter((m) => m.day === d.full)
            .map((m) => ({ section: s, startMin: m.startMin, endMin: m.endMin, room: m.room }))
        );

        const periodCols = PERIODS.map(([pStart, pEnd]) => {
          const inPeriod = dayMeetings.filter((m) => m.startMin < pEnd && m.endMin > pStart);
          return { pStart, pEnd, placed: assignLanes(inPeriod) };
        });

        const lanes = periodCols.reduce(
          (n, col) => col.placed.reduce((m, p) => Math.max(m, p.lane + 1), n),
          1
        );
        return { day: d, periodCols, lanes };
      }),
    [sections]
  );

  const colors = useMemo(() => sectionColors(sections), [sections]);

  return (
    <div className="overflow-x-auto">
      {/* Period header + day rows; the ScheduleCard wrapping this already
          supplies the white background and padding, so no chrome here. */}
      <div className="min-w-80">
        {/* Period header */}
        <div className="flex" style={{ paddingLeft: LABEL_W }}>
          {PERIODS.map(([s, e]) => (
            <div
              key={s}
              className="flex-1 px-0.5 text-center text-[10px] font-medium text-gray-500 sm:text-xs"
            >
              {formatMinutes(s)}–{formatMinutes(e)}
            </div>
          ))}
        </div>

        {/* Day rows */}
        {rows.map(({ day, periodCols, lanes }, rowIdx) => {
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
              {periodCols.map(({ pStart, pEnd, placed }, colIdx) => (
                <div
                  key={colIdx}
                  className="relative flex-1 border-l border-gray-300/70"
                  style={{ height: rowH }}
                >
                  {/* Class blocks: clean colored pills, details in the tooltip */}
                  {placed.map((p, i) => {
                    const color = colors.get(p.section.key) ?? "#7A8290";
                    // When the parent supplies conflict keys (time + duplicate
                    // course), let them drive the outline; otherwise fall back
                    // to this period's own time-overlap detection.
                    const isConflict = conflictKeys
                      ? conflictKeys.has(p.section.key)
                      : p.conflict;
                    const left = ((p.startMin - pStart) / (pEnd - pStart)) * 100;
                    const width = ((p.endMin - p.startMin) / (pEnd - pStart)) * 100;
                    return (
                      <div
                        key={i}
                        title={`${p.section.courseCode}${p.section.section ? ` (${p.section.section})` : ""} · ${p.section.courseName}\n${formatMinutes(p.startMin)}–${formatMinutes(p.endMin)} · ${p.room}${isConflict ? "\n⚠ conflict" : ""}`}
                        className="absolute rounded-full"
                        style={{
                          left: `calc(${left}% + 2px)`,
                          width: `calc(${width}% - 4px)`,
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
              ))}
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
