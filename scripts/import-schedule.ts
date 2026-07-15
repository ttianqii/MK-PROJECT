// Parse a saved URSA room-schedule page (the "Room Schedule" tool at
// ursa2.bu.ac.th/portal/faculty/room/schedule2.cfm) and import its class
// slots into class_schedule — so the schedule browser, plan builder, and
// recommendations show real BU sections instead of the seeded demo catalog.
//
// That page lives behind BU's *faculty* portal (a different login than the
// student checklist), so there's no way to fetch it automatically here: save
// it yourself (open it while signed in, View Source, Save As) and pass the
// saved file to this script. Each page covers one campus/day/semester, so
// save one file per day you want to import.
//
//   DATABASE_URL=mysql://... bun run scripts/import-schedule.ts "/path/to/schedule2.cfm.html"
//
// Idempotent: re-running the same page is a no-op, via the class_schedule
// unique slot index (semester, day, room, start_time, course_code).
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { parseRoomSchedule } from "@/lib/roomSchedule";

const url = process.env.DATABASE_URL ?? "mysql://mk:mkpassword@127.0.0.1:3306/mkproject";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: bun run scripts/import-schedule.ts <path-to-saved-schedule2.cfm.html>");
    process.exit(1);
  }

  // URSA pages are served as windows-874 (Thai).
  const html = new TextDecoder("windows-874").decode(readFileSync(file));
  const entries = parseRoomSchedule(html);

  if (entries.length === 0) {
    console.error(`No class slots found in ${file}. Is it a URSA room-schedule page?`);
    process.exit(1);
  }

  const connection = await mysql.createConnection(url);

  let inserted = 0;
  for (const e of entries) {
    const [res] = await connection.execute(
      `INSERT IGNORE INTO class_schedule
         (campus, semester, day, room, room_capacity, start_time, end_time,
          course_code, course_name, section)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.campus,
        e.semester,
        e.day,
        e.room,
        e.roomCapacity,
        e.startTime,
        e.endTime,
        e.courseCode,
        e.courseName,
        e.section,
      ]
    );
    inserted += (res as mysql.ResultSetHeader).affectedRows;
  }

  await connection.end();

  const { campus, day, semester } = entries[0];
  console.log(
    `Parsed ${entries.length} slots (${campus} / ${day} / ${semester}); ` +
      `inserted ${inserted} new, ${entries.length - inserted} already present.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
