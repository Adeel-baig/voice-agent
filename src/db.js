const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "..", "data.sqlite"));

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30
  );

  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,      -- YYYY-MM-DD
    time TEXT NOT NULL,      -- HH:MM (24h)
    is_booked INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    phone TEXT,
    service TEXT,
    date TEXT,
    time TEXT,
    status TEXT DEFAULT 'confirmed', -- confirmed | cancelled
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id TEXT,
    caller_number TEXT,
    summary TEXT,
    transcript TEXT,
    ended_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed services once
const serviceCount = db.prepare("SELECT COUNT(*) AS c FROM services").get().c;
if (serviceCount === 0) {
  const insert = db.prepare(
    "INSERT INTO services (name, duration_minutes) VALUES (?, ?)"
  );
  insert.run("General Consultation", 30);
  insert.run("Follow-up Visit", 15);
  insert.run("Full Assessment", 60);
}

// Seed next 7 days of slots (9am-5pm, hourly), skipping already-seeded dates
function seedSlots() {
  const today = new Date();
  for (let d = 0; d < 7; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dateStr = date.toISOString().slice(0, 10);

    const existing = db
      .prepare("SELECT COUNT(*) AS c FROM slots WHERE date = ?")
      .get(dateStr).c;
    if (existing > 0) continue;

    const insert = db.prepare(
      "INSERT INTO slots (date, time, is_booked) VALUES (?, ?, 0)"
    );
    for (let hour = 9; hour <= 16; hour++) {
      insert.run(dateStr, `${String(hour).padStart(2, "0")}:00`);
    }
  }
}
seedSlots();

module.exports = db;
