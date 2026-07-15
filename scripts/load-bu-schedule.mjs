// Load the real Bangkok University class schedule (3,482 scraped sections,
// Rangsit Campus / First Semester 2026 — every faculty and program) into the
// class_schedule table, so the schedule browser, plan builder, and
// recommendations run against real BU offerings instead of the seeded demo
// catalog. This is the same data set the study-plan project ships.
//
//   DATABASE_URL=mysql://user:pass@host:3306/db node scripts/load-bu-schedule.mjs
//
// The data lives in scripts/bu-schedule-data.sql as SQLite-style
//   INSERT INTO class_schedule VALUES(id,'campus',...,created_at);
// rows. We parse each tuple ourselves (course names contain commas,
// parentheses, and '' -escaped apostrophes, so a naive split won't do) and
// re-insert the ten meaningful columns via parameterized queries — letting
// MySQL assign its own id and created_at.
//
// Replaces all existing class_schedule rows, so re-running is safe and always
// leaves exactly this offering in place. Plain JS + mysql2 only, matching the
// other db scripts, so it also runs unchanged inside the Docker runner image.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL ?? "mysql://mk:mkpassword@127.0.0.1:3306/mkproject";

const here = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(here, "bu-schedule-data.sql");

/**
 * Parse one SQLite VALUES tuple body (the text between `VALUES(` and `)`).
 * Returns the values in order: numbers as Number, quoted strings decoded with
 * '' -> ' unescaping.
 */
function parseTuple(inner) {
  const vals = [];
  let i = 0;
  while (i < inner.length) {
    const ch = inner[i];
    if (ch === " " || ch === ",") {
      i++;
      continue;
    }
    if (ch === "'") {
      let s = "";
      i++; // opening quote
      while (i < inner.length) {
        if (inner[i] === "'" && inner[i + 1] === "'") {
          s += "'";
          i += 2;
        } else if (inner[i] === "'") {
          i++; // closing quote
          break;
        } else {
          s += inner[i++];
        }
      }
      vals.push(s);
    } else {
      let n = "";
      while (i < inner.length && inner[i] !== ",") n += inner[i++];
      const t = n.trim();
      vals.push(t.toUpperCase() === "NULL" ? null : Number(t));
    }
  }
  return vals;
}

const raw = readFileSync(DATA_FILE, "utf8");
const lines = raw.split("\n").filter((l) => l.trim().startsWith("INSERT INTO class_schedule"));

const rows = [];
for (const line of lines) {
  const open = line.indexOf("VALUES(");
  if (open < 0) continue;
  const inner = line.slice(open + "VALUES(".length, line.lastIndexOf(")"));
  const v = parseTuple(inner);
  // [id, campus, semester, day, room, room_capacity, start, end, code, name, section, created_at]
  rows.push({
    campus: v[1],
    semester: v[2],
    day: v[3],
    room: v[4],
    roomCapacity: v[5],
    startTime: v[6],
    endTime: v[7],
    courseCode: v[8],
    courseName: v[9],
    section: v[10] ?? null,
  });
}

if (rows.length === 0) {
  console.error(`No class_schedule rows parsed from ${DATA_FILE}.`);
  process.exit(1);
}

const connection = await mysql.createConnection(url);

const [deleted] = await connection.execute("DELETE FROM class_schedule");
if (deleted.affectedRows > 0) {
  console.log(`Cleared ${deleted.affectedRows} existing class_schedule row(s).`);
}

// Bulk insert in batches for speed (3.5k rows).
const BATCH = 200;
let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
  const params = batch.flatMap((r) => [
    r.campus,
    r.semester,
    r.day,
    r.room,
    r.roomCapacity,
    r.startTime,
    r.endTime,
    r.courseCode,
    r.courseName,
    r.section,
  ]);
  const [res] = await connection.query(
    `INSERT IGNORE INTO class_schedule
       (campus, semester, day, room, room_capacity, start_time, end_time,
        course_code, course_name, section)
     VALUES ${placeholders}`,
    params
  );
  inserted += res.affectedRows;
}

await connection.end();

const { campus, semester } = rows[0];
console.log(
  `Loaded ${rows.length} parsed slots (${campus} / ${semester}); inserted ${inserted} new.`
);
