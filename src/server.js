require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const { registry } = require("./tools");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;

// Optional shared-secret check (set VAPI_WEBHOOK_SECRET in env + Vapi dashboard to enable)
function verifySecret(req, res, next) {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected) return next(); // no secret configured -> skip check
  const got = req.headers["x-vapi-secret"];
  if (got !== expected) return res.status(401).json({ error: "unauthorized" });
  next();
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Main Vapi webhook: handles tool/function calls + end-of-call reports
app.post("/webhook", verifySecret, (req, res) => {
  try {
    const message = req.body.message || req.body;
    const type = message?.type;

    if (type === "tool-calls" || message?.toolCallList) {
      const toolCallList = message.toolCallList || message.toolCalls || [];
      const results = toolCallList.map((call) => {
        const fnName = call.function?.name || call.name;
        let args = call.function?.arguments || call.arguments || {};
        if (typeof args === "string") {
          try {
            args = JSON.parse(args);
          } catch {
            args = {};
          }
        }
        const handler = registry[fnName];
        let result;
        if (!handler) {
          result = { error: `Unknown function: ${fnName}` };
        } else {
          try {
            result = handler(args);
          } catch (err) {
            result = { error: err.message };
          }
        }
        return {
          toolCallId: call.id || call.toolCallId,
          result: JSON.stringify(result),
        };
      });
      return res.json({ results });
    }

    if (type === "end-of-call-report") {
      const call = message.call || {};
      db.prepare(
        `INSERT INTO calls (call_id, caller_number, summary, transcript, ended_reason)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        call.id || null,
        call.customer?.number || null,
        message.summary || null,
        message.transcript || null,
        message.endedReason || null
      );
      return res.json({ received: true });
    }

    // Unhandled message types (status-update, transcript, speech-update, etc.) - just ack
    return res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Simple views for demoing / verifying data during the test call
app.get("/appointments", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM appointments ORDER BY created_at DESC")
    .all();
  res.json(rows);
});

app.get("/calls", (req, res) => {
  const rows = db.prepare("SELECT * FROM calls ORDER BY created_at DESC").all();
  res.json(rows);
});

app.get("/slots", (req, res) => {
  const date = req.query.date;
  const rows = date
    ? db.prepare("SELECT * FROM slots WHERE date = ? ORDER BY time").all(date)
    : db.prepare("SELECT * FROM slots ORDER BY date, time").all();
  res.json(rows);
});

app.listen(PORT, () => {
  console.log(`Voice agent backend running on port ${PORT}`);
});
