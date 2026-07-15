// Seed the MariaDB database with self-contained demo data: one demo student,
// their study-plan checklist, and a full week of class-schedule slots. No data
// is fetched from any external system.
//
//   DATABASE_URL=mysql://user:pass@host:3306/db node scripts/seed.mjs
//
// Idempotent: skips any student that already exists and inserts schedule slots
// with INSERT IGNORE against the unique slot index, so re-running is safe.
// Plain JS + mysql2 only, so the same script runs unchanged inside the Docker
// runner image (no TypeScript toolchain needed there).
import { randomBytes, scryptSync } from "node:crypto";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL ?? "mysql://mk:mkpassword@127.0.0.1:3306/mkproject";

// Same format as src/lib/passwords.ts: `scrypt:<salt hex>:<hash hex>`.
function hashPassword(plain) {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(plain, salt, 64).toString("hex")}`;
}

// ── Demo student ─────────────────────────────────────────────────────────────
// Credits are consistent with the checklist below: 30 (GenEd) + 36 (Major) + 3
// (Free electives) = 69 earned of 30 + 88 + 9 = 127 required.

const STUDENT = {
  username: "demo.student",
  password: "demo1234",
  nameTh: "นายสมชาย ใจดี",
  nameEn: "MR. SOMCHAI JAIDEE",
  studentId: "1650705566",
  photo: "/avatar.svg",
  gpa: "3.42",
  totalCredits: "127",
  creditsEarned: "69",
  creditsTransferred: "-",
  info: [
    { label: "หลักสูตร", value: "วิทยาการคอมพิวเตอร์ (Computer Science)" },
    { label: "คณะ", value: "คณะเทคโนโลยีสารสนเทศและนวัตกรรม" },
    { label: "ชั้นปี", value: "3" },
    { label: "สถานภาพนักศึกษา", value: "ปกติ" },
    { label: "อาจารย์ที่ปรึกษา", value: "ผศ.ดร. วิชัย เก่งกาจ" },
    { label: "เทียบโอน", value: "-" },
  ],
};

// category → groups → courses. Group titles carry "(N หน่วยกิต)" so the UI can
// draw its per-group progress bars; a group of "-" renders inline (no toggle).
const CHECKLIST = [
  {
    name: "หมวดวิชาศึกษาทั่วไป (Credit earned:30/30)",
    creditEarned: 30,
    creditRequired: 30,
    groups: [
      {
        name: "กลุ่มวิชาภาษาอังกฤษ (9 หน่วยกิต)",
        courses: [
          ["EN101", "English for Everyday Communication", "3", "B+", ""],
          ["EN102", "English for Social Communication", "3", "A", ""],
          ["EN201", "English for Academic Purposes", "3", "B", "EN102"],
        ],
      },
      {
        name: "กลุ่มวิชาบังคับ (15 หน่วยกิต)",
        courses: [
          ["GE101", "Critical Thinking and Problem Solving", "3", "A", ""],
          ["GE102", "Digital Citizenship", "3", "B+", ""],
          ["GE103", "Life Skills for the Modern World", "3", "B", ""],
          ["GE104", "Thai Language for Communication", "3", "A", ""],
          ["GE105", "Aesthetics and Well-Being", "3", "B+", ""],
        ],
      },
      {
        name: "กลุ่มวิชาเลือก (6 หน่วยกิต)",
        courses: [
          ["GE201", "Entrepreneurial Mindset", "3", "B+", ""],
          ["GE202", "Environment and Sustainability", "3", "A", ""],
        ],
      },
    ],
  },
  {
    name: "หมวดวิชาเฉพาะ (Credit earned:36/88)",
    creditEarned: 36,
    creditRequired: 88,
    groups: [
      {
        name: "วิชาแกน (12 หน่วยกิต)",
        courses: [
          ["MA101", "Calculus for Computing", "3", "C+", ""],
          ["MA102", "Discrete Mathematics", "3", "B", ""],
          ["ST201", "Probability and Statistics", "3", "B+", ""],
          ["PH101", "Physics for Information Technology", "3", "C", ""],
        ],
      },
      {
        name: "เอกบังคับ (52 หน่วยกิต)",
        courses: [
          ["CS101", "Introduction to Programming", "3", "A", ""],
          ["CS102", "Object-Oriented Programming", "3", "B+", "CS101"],
          ["CS201", "Data Structures", "3", "B", "CS102"],
          ["CS202", "Algorithm Design and Analysis", "3", "C+", "CS201"],
          ["CS203", "Computer Organization and Architecture", "3", "B", ""],
          ["CS204", "Database Systems", "3", "A", "CS201"],
          ["CS210", "Programming Languages and Paradigms", "3", "B+", "CS102"],
          ["CS301", "Operating Systems", "3", "F", "CS203"],
          ["CS302", "Software Engineering", "3", "W", "CS204"],
          ["CS303", "Computer Networks", "3", "", "CS203"],
          ["CS304", "Web Application Development", "3", "", "CS204"],
          ["CS305", "Theory of Computation", "3", "", "MA102"],
          ["CS401", "Senior Project I", "3", "", "3rd year standing"],
          ["CS402", "Senior Project II", "3", "", "CS401"],
        ],
      },
      {
        name: "เอกเลือก (24 หน่วยกิต)",
        courses: [
          ["CS315", "UX/UI Design", "3", "B+", ""],
          ["CS311", "Mobile Application Development", "3", "", "CS102"],
          ["CS312", "Machine Learning Fundamentals", "3", "", "ST201"],
          ["CS313", "Cloud Computing", "3", "", "CS303"],
          ["CS314", "Introduction to Cybersecurity", "3", "", "CS303"],
        ],
      },
    ],
  },
  {
    name: "หมวดวิชาเลือกเสรี (Credit earned:3/9)",
    creditEarned: 3,
    creditRequired: 9,
    groups: [
      {
        name: "-",
        courses: [
          ["BA101", "Introduction to Entrepreneurship", "3", "B+", ""],
          ["JP101", "Japanese I", "3", "", ""],
        ],
      },
    ],
  },
];

// ── Demo class schedule ──────────────────────────────────────────────────────
// "First Semester 2026" on Main Campus. Includes sections for every course the
// demo student still needs (so the plan page's recommendations light up) plus
// filler courses so the schedule browser has something to browse.

const CAMPUS = "Main Campus";
const SEMESTER = "First Semester 2026";

const ROOMS = {
  A301: 60,
  A302: 45,
  B205: 40,
  B206: 40,
  C101: 120,
  LAB1: 30,
  LAB2: 30,
};

// [code, name, section, [day, start, end, room][]]
const SECTIONS = [
  ["CS301", "Operating Systems", "421A", [["Monday", "9.00", "10.30", "A301"], ["Wednesday", "9.00", "10.30", "A301"]]],
  ["CS301", "Operating Systems", "421B", [["Tuesday", "13.00", "14.30", "A302"], ["Thursday", "13.00", "14.30", "A302"]]],
  ["CS302", "Software Engineering", "421A", [["Monday", "10.40", "12.10", "B205"], ["Wednesday", "10.40", "12.10", "B205"]]],
  ["CS302", "Software Engineering", "421B", [["Friday", "9.00", "12.00", "B206"]]],
  ["CS303", "Computer Networks", "421A", [["Tuesday", "9.00", "10.30", "A301"], ["Thursday", "9.00", "10.30", "A301"]]],
  ["CS304", "Web Application Development", "421A", [["Monday", "13.00", "16.00", "LAB1"]]],
  ["CS304", "Web Application Development", "421B", [["Wednesday", "13.00", "16.00", "LAB1"]]],
  ["CS305", "Theory of Computation", "421A", [["Friday", "13.00", "14.30", "A302"]]],
  ["CS401", "Senior Project I", "421A", [["Friday", "15.00", "17.00", "B205"]]],
  ["CS311", "Mobile Application Development", "421A", [["Monday", "13.00", "16.00", "LAB2"]]],
  ["CS312", "Machine Learning Fundamentals", "421A", [["Tuesday", "10.40", "12.10", "C101"], ["Thursday", "10.40", "12.10", "C101"]]],
  ["CS313", "Cloud Computing", "421A", [["Wednesday", "13.00", "16.00", "LAB2"]]],
  ["CS314", "Introduction to Cybersecurity", "421A", [["Thursday", "13.00", "16.00", "LAB2"]]],
  ["JP101", "Japanese I", "101A", [["Saturday", "9.00", "12.00", "C101"]]],
  ["JP101", "Japanese I", "101B", [["Tuesday", "16.00", "17.30", "B206"], ["Thursday", "16.00", "17.30", "B206"]]],
  // Filler courses from other programs, for browsing/search.
  ["EN305", "Business English", "331A", [["Monday", "10.40", "12.10", "C101"]]],
  ["MK201", "Principles of Marketing", "251A", [["Saturday", "13.00", "16.00", "C101"]]],
  ["MA201", "Linear Algebra", "271A", [["Tuesday", "8.40", "10.10", "B205"], ["Friday", "8.40", "10.10", "B205"]]],
  ["GE210", "Mindfulness and Modern Life", "111A", [["Wednesday", "16.00", "17.30", "A301"]]],
  ["BA210", "Business Statistics", "261A", [["Monday", "16.00", "17.30", "A302"], ["Thursday", "16.00", "17.30", "A302"]]],
];

// ── Seeding ──────────────────────────────────────────────────────────────────

const connection = await mysql.createConnection(url);

const [existing] = await connection.execute(
  "SELECT id FROM students WHERE username = ?",
  [STUDENT.username]
);

if (existing.length > 0) {
  console.log(`Student "${STUDENT.username}" already exists — skipping student seed.`);
} else {
  const [res] = await connection.execute(
    `INSERT INTO students
       (username, password_hash, name_th, name_en, student_id, photo, gpa,
        total_credits, credits_earned, credits_transferred, info)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      STUDENT.username,
      hashPassword(STUDENT.password),
      STUDENT.nameTh,
      STUDENT.nameEn,
      STUDENT.studentId,
      STUDENT.photo,
      STUDENT.gpa,
      STUDENT.totalCredits,
      STUDENT.creditsEarned,
      STUDENT.creditsTransferred,
      JSON.stringify(STUDENT.info),
    ]
  );
  const studentId = res.insertId;

  for (const [catPos, cat] of CHECKLIST.entries()) {
    const [catRes] = await connection.execute(
      `INSERT INTO checklist_categories (student_id, position, name, credit_earned, credit_required)
       VALUES (?, ?, ?, ?, ?)`,
      [studentId, catPos, cat.name, cat.creditEarned, cat.creditRequired]
    );
    const categoryId = catRes.insertId;

    let coursePos = 0;
    for (const group of cat.groups) {
      for (const [code, name, credit, grade, note] of group.courses) {
        await connection.execute(
          `INSERT INTO checklist_courses (category_id, position, group_name, code, name, credit, grade, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [categoryId, coursePos++, group.name, code, name, credit, grade, note]
        );
      }
    }
  }
  console.log(`Seeded student "${STUDENT.username}" (password: ${STUDENT.password}) with checklist.`);
}

let inserted = 0;
let slots = 0;
for (const [code, name, section, meetings] of SECTIONS) {
  for (const [day, start, end, room] of meetings) {
    slots++;
    const [res] = await connection.execute(
      `INSERT IGNORE INTO class_schedule
         (campus, semester, day, room, room_capacity, start_time, end_time,
          course_code, course_name, section)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [CAMPUS, SEMESTER, day, room, ROOMS[room] ?? null, start, end, code, name, section]
    );
    inserted += res.affectedRows;
  }
}
console.log(
  `Schedule: ${slots} slots (${CAMPUS} / ${SEMESTER}); inserted ${inserted} new, ${slots - inserted} already present.`
);

await connection.end();
