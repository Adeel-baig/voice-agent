const db = require("./db");

function listServices() {
  const services = db.prepare("SELECT name, duration_minutes FROM services").all();
  return { services };
}

function checkAvailability({ date }) {
  if (!date) return { error: "Please provide a date in YYYY-MM-DD format." };

  const slots = db
    .prepare("SELECT time FROM slots WHERE date = ? AND is_booked = 0 ORDER BY time")
    .all(date);

  if (slots.length === 0) {
    return {
      date,
      available: false,
      message: `No open slots found for ${date}. Try another date.`,
    };
  }

  return {
    date,
    available: true,
    open_times: slots.map((s) => s.time),
  };
}

function bookAppointment({ customer_name, phone, service, date, time }) {
  if (!customer_name || !phone || !date || !time) {
    return {
      success: false,
      message:
        "Missing required info. Need customer_name, phone, date (YYYY-MM-DD), and time (HH:MM).",
    };
  }

  const slot = db
    .prepare("SELECT * FROM slots WHERE date = ? AND time = ?")
    .get(date, time);

  if (!slot) {
    return {
      success: false,
      message: `${time} on ${date} is not a valid slot. Check availability first.`,
    };
  }
  if (slot.is_booked) {
    return {
      success: false,
      message: `Sorry, ${time} on ${date} was just booked by someone else. Please pick another time.`,
    };
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE slots SET is_booked = 1 WHERE id = ?").run(slot.id);
    const info = db
      .prepare(
        `INSERT INTO appointments (customer_name, phone, service, date, time, status)
         VALUES (?, ?, ?, ?, ?, 'confirmed')`
      )
      .run(customer_name, phone, service || "General Consultation", date, time);
    return info.lastInsertRowid;
  });

  const appointmentId = tx();

  return {
    success: true,
    appointment_id: appointmentId,
    message: `Booked ${service || "General Consultation"} for ${customer_name} on ${date} at ${time}.`,
  };
}

function lastDigits(str, n = 10) {
  return (str || "").replace(/\D/g, "").slice(-n);
}

function cancelAppointment({ phone, date }) {
  if (!phone) return { success: false, message: "Need a phone number to find the booking." };

  const targetDigits = lastDigits(phone);

  const rows = date
    ? db.prepare("SELECT * FROM appointments WHERE date = ? AND status = 'confirmed'").all(date)
    : db.prepare("SELECT * FROM appointments WHERE status = 'confirmed' ORDER BY date DESC").all();

  const appt = rows.find((r) => lastDigits(r.phone) === targetDigits);

  if (!appt) {
    return { success: false, message: "No matching confirmed appointment found." };
  }
  const tx = db.transaction(() => {
    db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(appt.id);
    db.prepare("UPDATE slots SET is_booked = 0 WHERE date = ? AND time = ?").run(
      appt.date,
      appt.time
    );
  });
  tx();

  return {
    success: true,
    message: `Cancelled the appointment on ${appt.date} at ${appt.time}.`,
  };
}

// Registry: maps Vapi function name -> handler
const registry = {
  list_services: listServices,
  check_availability: checkAvailability,
  book_appointment: bookAppointment,
  cancel_appointment: cancelAppointment,
};

module.exports = { registry };
