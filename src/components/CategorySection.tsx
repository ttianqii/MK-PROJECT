"use client";

import type { Category, Course, CourseGroup } from "@/lib/checklist";
import CollapsibleSection from "./CollapsibleSection";

// Shared column widths so every group table lines up. Percentages scale with
// the container and let text wrap inside its cell instead of overflowing the
// card at any viewport width.
function Cols() {
  return (
    <colgroup>
      <col className="w-[13%]" />
      <col className="w-[44%]" />
      <col className="w-[9%]" />
      <col className="w-[10%]" />
      <col className="w-[24%]" />
    </colgroup>
  );
}

function gradeBadge(grade: string) {
  const g = grade.trim().toUpperCase();
  if (!g) {
    return <span className="text-gray-300">—</span>;
  }
  let cls = "bg-green-100 text-green-800"; // passing
  if (g === "F") cls = "bg-red-100 text-red-800";
  else if (g === "W" || g === "I" || g === "U") cls = "bg-amber-100 text-amber-800";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{grade.trim()}</span>
  );
}

function isPassing(grade: string) {
  const g = grade.trim().toUpperCase();
  return g !== "" && g !== "F" && g !== "W" && g !== "I" && g !== "U";
}

// A group's progress toward its required credits, taken from the "(N หน่วยกิต)"
// in its title. Earned is the sum of passed-course credits, capped at the
// requirement so an over-subscribed group (e.g. 7×3 credits against a 15-credit
// requirement) reads 15 / 15, not 21 / 15. Null when the title states no target.
function groupProgress(group: CourseGroup) {
  const required = Number(group.group.match(/\((\d+)\s*หน่วยกิต\)/)?.[1]);
  if (!required) return null;
  const passed = group.courses.reduce(
    (sum, c) => sum + (isPassing(c.grade) ? Number(c.credit) || 0 : 0),
    0
  );
  const earned = Math.min(passed, required);
  return { earned, required, pct: Math.round((earned / required) * 100) };
}

function CreditBar({ earned, required, pct }: { earned: number; required: number; pct: number }) {
  const done = earned >= required;
  return (
    <span className="flex w-full items-center gap-2.5 pl-8 sm:w-auto sm:pl-0">
      <span className="whitespace-nowrap text-xs text-gray-500 sm:text-sm">
        <span className={`font-semibold ${done ? "text-emerald-600" : "text-gray-900"}`}>{earned}</span>
        {" / "}
        {required} credits
      </span>
      <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 sm:w-24">
        <span
          className="block h-full rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}

function CourseRow({ course }: { course: Course }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-1.5 pr-3 align-top font-mono text-xs text-gray-600 whitespace-nowrap">{course.code}</td>
      <td className="py-1.5 pr-3 align-top text-gray-800">{course.name}</td>
      <td className="py-1.5 pr-3 align-top text-center text-gray-600 whitespace-nowrap">{course.credit}</td>
      <td className="py-1.5 pr-3 align-top text-center whitespace-nowrap">{gradeBadge(course.grade)}</td>
      <td className="py-1.5 align-top text-xs break-words text-gray-400">{course.note}</td>
    </tr>
  );
}

// One course as a stacked card row — the phone-friendly rendering, where a
// five-column table would force sideways scrolling.
function CourseCard({ course }: { course: Course }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 first:pt-1">
      <div className="min-w-0">
        <p className="font-mono text-xs text-gray-500">{course.code}</p>
        <p className="mt-0.5 text-sm leading-snug text-gray-800">{course.name}</p>
        <p className="mt-0.5 text-xs text-gray-400">
          {course.credit} หน่วยกิต
          {course.note ? <span> · {course.note}</span> : null}
        </p>
      </div>
      <div className="shrink-0 pt-0.5">{gradeBadge(course.grade)}</div>
    </li>
  );
}

// One group's courses: stacked cards on phones, a full table from sm up.
function GroupTable({ group }: { group: CourseGroup }) {
  return (
    <>
      {/* Phone: stacked list, no horizontal scrolling. Left padding matches
          the nested collapse header so course rows line up under its label. */}
      <ul className="divide-y divide-gray-100 pb-2 pl-8 pr-4 pt-1 sm:hidden">
        {group.courses.map((c, i) => (
          <CourseCard key={i} course={c} />
        ))}
      </ul>

      {/* Tablet/desktop: the classic table */}
      <div className="hidden overflow-x-auto sm:block">
        <div className="min-w-130 pb-3 pl-8 pr-4 pt-1 sm:pl-10 sm:pr-6">
          <table className="w-full table-fixed text-sm">
            <Cols />
            <thead>
              <tr className="text-left text-xs font-medium text-gray-400">
                <th className="py-2 pr-3 font-medium">รหัสวิชา</th>
                <th className="py-2 pr-3 font-medium">ชื่อวิชา</th>
                <th className="py-2 pr-3 text-center font-medium">หน่วยกิต</th>
                <th className="py-2 pr-3 text-center font-medium">เกรด</th>
                <th className="py-2 font-medium">วิชาพื้นความรู้</th>
              </tr>
            </thead>
            <tbody>
              {group.courses.map((c, i) => (
                <CourseRow key={i} course={c} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// Group names embed a two-level path, "<category> - <sub-group>", e.g.
// "เอกบังคับ - กลุ่มวิชาโครงสร้างพื้นฐานของระบบ". Split on the first " - ".
function splitGroupName(name: string) {
  const idx = name.indexOf(" - ");
  if (idx === -1) return { prefix: "", sub: name };
  return { prefix: name.slice(0, idx).trim(), sub: name.slice(idx + 3).trim() };
}

// Bucket groups by their category prefix, preserving first-seen order.
function bucketByPrefix(groups: CourseGroup[]) {
  const buckets: { prefix: string; groups: CourseGroup[] }[] = [];
  for (const g of groups) {
    const { prefix } = splitGroupName(g.group);
    let b = buckets.find((x) => x.prefix === prefix);
    if (!b) {
      b = { prefix, groups: [] };
      buckets.push(b);
    }
    b.groups.push(g);
  }
  return buckets;
}

function GroupSection({
  group,
  id,
  nested,
  defaultOpen,
  forceOpen,
}: {
  group: CourseGroup;
  id: string;
  nested?: boolean;
  defaultOpen?: boolean;
  forceOpen?: boolean;
}) {
  const p = groupProgress(group);
  const label = nested ? splitGroupName(group.group).sub : group.group;
  return (
    <CollapsibleSection
      id={id}
      nested={nested}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      header={
        <span className={nested ? "font-medium text-gray-800" : "font-semibold text-gray-900"}>
          {group.group === "-" ? "Courses" : label || group.group}
        </span>
      }
      headerRight={p ? <CreditBar {...p} /> : null}
    >
      <GroupTable group={group} />
    </CollapsibleSection>
  );
}

export default function CategorySection({
  category,
  defaultOpen = false,
  forceOpen,
}: {
  category: Category;
  defaultOpen?: boolean;
  forceOpen?: boolean;
}) {
  const title = category.category.replace(/\s*\(Credit earned:.*\)\s*/i, "").trim();

  // The checklist source often has no category headers, so the parser puts
  // every group under one blank ("-") placeholder category. Recover the real
  // two-level hierarchy from the group names: an outer collapsible per category
  // prefix (พื้นฐาน, วิชาแกน, เอกบังคับ, เอกเลือก) with the sub-groups nested
  // inside. Groups without a "<prefix> - " path fall back to a flat section.
  if (!title || title === "-") {
    const buckets = bucketByPrefix(category.groups);
    return (
      <>
        {buckets.map((bucket, bi) =>
          bucket.prefix ? (
            <CollapsibleSection
              key={bi}
              id={`cat-${bi}-${bucket.prefix.replace(/\W+/g, "-")}`}
              defaultOpen={defaultOpen}
              forceOpen={forceOpen}
              header={<span className="font-semibold text-gray-900">{bucket.prefix}</span>}
            >
              {bucket.groups.map((grp, gi) => (
                <GroupSection
                  key={gi}
                  nested
                  group={grp}
                  id={`grp-${bi}-${gi}`}
                  defaultOpen={defaultOpen}
                  forceOpen={forceOpen}
                />
              ))}
            </CollapsibleSection>
          ) : (
            bucket.groups.map((grp, gi) => (
              <GroupSection
                key={`${bi}-${gi}`}
                group={grp}
                id={`grp-${bi}-${gi}`}
                defaultOpen={defaultOpen}
                forceOpen={forceOpen}
              />
            ))
          )
        )}
      </>
    );
  }

  const cReq = category.creditRequired;
  const cEarned = category.creditEarned || 0;

  return (
    <CollapsibleSection
      id={`cat-${title.replace(/\W+/g, "-")}`}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      header={<span className="font-semibold text-gray-900">{title}</span>}
      headerRight={
        cReq != null && cReq > 0 ? (
          <CreditBar earned={cEarned} required={cReq} pct={Math.min(100, Math.round((cEarned / cReq) * 100))} />
        ) : null
      }
    >
      {category.groups.map((grp, gi) =>
        // A "-" group is the parser's placeholder for courses that sit directly
        // under a category with no sub-group header — show its table inline
        // rather than behind a redundant nested toggle.
        grp.group === "-" ? (
          <GroupTable key={gi} group={grp} />
        ) : (
          <GroupSection
            key={gi}
            nested
            group={grp}
            id={`grp-${title.replace(/\W+/g, "-")}-${gi}`}
            defaultOpen={defaultOpen}
            forceOpen={forceOpen}
          />
        )
      )}
    </CollapsibleSection>
  );
}
