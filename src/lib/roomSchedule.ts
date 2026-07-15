// Parses the URSA faculty "Room Schedule" page
// (ursa2.bu.ac.th/portal/faculty/room/schedule2.cfm) into structured class
// schedule entries — the same server-side, DOM-free regex approach used by
// buChecklist.ts. This page sits behind BU's faculty portal (not the student
// checklist login), so there's no way to fetch it automatically here; it has
// to be saved manually and imported via scripts/import-schedule.ts.
//
// Page layout (one day of a term, e.g. "Room Schedule [Rangsit Campus] /
// Monday / First Semester 2026"):
//
//   <td ... >RA1402<br>(80)</td>          ← room + capacity
//   <td ... title="Legal Aspects in Entrepreneurship">
//       8.40-11.00<br>EPT404<br>&nbsp;450A   ← time / course code / section
//   </td>
//
// Empty slots carry a title of "…Available" and are skipped.

export interface ScheduleEntry {
  campus: string; // "Rangsit Campus"
  semester: string; // "First Semester 2026"
  day: string; // "Monday"
  room: string; // "RA1402"
  roomCapacity: number | null; // 80
  startTime: string; // "8.40"
  endTime: string; // "11.00"
  courseCode: string; // "EPT404"
  courseName: string; // "Legal Aspects in Entrepreneurship"
  section: string | null; // "450A"
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** The page header: "Room Schedule [Rangsit Campus]", "Monday", "First Semester 2026". */
export function parseScheduleHeader(html: string): {
  campus: string;
  day: string;
  semester: string;
} {
  const campus =
    decodeEntities(html.match(/Room Schedule\s*\[([^\]]+)\]/)?.[1] ?? "").trim() || "Unknown";
  const day =
    decodeEntities(
      html.match(
        /<b>\s*(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s*<\/b>/i
      )?.[1] ?? ""
    ).trim() || "Unknown";
  const semester =
    decodeEntities(
      html.match(/((?:First|Second|Third|Summer)[^<]*Semester[^<]*\d{4})/i)?.[1] ?? ""
    ).trim() || "Unknown";
  return { campus, day, semester };
}

// A room block: <td bgcolor="6699CC" ...>RA1402<br>(80)</td> up to the next
// room block or the end of the input.
const ROOM_BLOCK_RE =
  /<td[^>]*bgcolor="6699CC"[^>]*>[\s\S]*?<font[^>]*>\s*([A-Za-z0-9]+)\s*<br>\s*\((\d+)\)/g;

// An occupied slot cell: title="Course Name" then time / code / section.
const SLOT_RE =
  /title="([^"]*)"[^>]*>\s*<font[^>]*>\s*(\d{1,2}\.\d{2})-(\d{1,2}\.\d{2})\s*<br>\s*([A-Za-z]{2,4}\d{2,4})\s*<br>\s*(?:&nbsp;|\s)*([^<\s][^<]*?)?\s*<\/font>/g;

/** Extract every occupied class slot from a URSA room-schedule page. */
export function parseRoomSchedule(html: string): ScheduleEntry[] {
  const { campus, day, semester } = parseScheduleHeader(html);
  const entries: ScheduleEntry[] = [];

  // Split the document into per-room segments so each slot is attributed to
  // the room whose block precedes it.
  const roomMatches = [...html.matchAll(ROOM_BLOCK_RE)];
  for (let i = 0; i < roomMatches.length; i++) {
    const m = roomMatches[i];
    const room = m[1];
    const roomCapacity = m[2] ? Number(m[2]) : null;
    const start = m.index! + m[0].length;
    const end = i + 1 < roomMatches.length ? roomMatches[i + 1].index! : html.length;
    const segment = html.slice(start, end);

    for (const slot of segment.matchAll(SLOT_RE)) {
      const courseName = decodeEntities(slot[1]).trim();
      // Header/legend cells and free slots ("… Available") aren't classes.
      if (!courseName || /available/i.test(slot[1])) continue;

      const section = slot[5] ? decodeEntities(slot[5]).trim() || null : null;
      entries.push({
        campus,
        semester,
        day,
        room,
        roomCapacity,
        startTime: slot[2],
        endTime: slot[3],
        courseCode: slot[4],
        courseName,
        section,
      });
    }
  }

  return entries;
}
