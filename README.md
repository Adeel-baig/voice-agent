# Voice AI Agent — Appointment Booking Assistant

A phone agent that can check availability, book appointments, and cancel them,
backed by a real SQLite database. Built for a time-boxed technical challenge.

**Stack:** Vapi (telephony + STT/TTS) + GPT-4o-mini (LLM) + Node/Express (backend,
function-calling webhook) + SQLite (storage) + Railway (hosting).

## Why this stack
Vapi handles the hard parts (phone number, speech-to-text, text-to-speech,
turn-taking) so all the custom work is business logic in plain Node — the part
that's actually being evaluated. This is the fastest path to a real, dial-in-able
agent within a few hours.

## What's included
- `src/db.js` — SQLite schema + seeds 7 days of hourly slots (9am–5pm) and 3 services
- `src/tools.js` — booking logic: `list_services`, `check_availability`,
  `book_appointment`, `cancel_appointment`
- `src/server.js` — Express server exposing:
  - `POST /webhook` — Vapi calls this for both function/tool calls and the
    end-of-call report (call summary + transcript get logged to `calls` table)
  - `GET /appointments`, `GET /calls`, `GET /slots?date=YYYY-MM-DD` — plain
    JSON views so you (or an evaluator) can verify what happened during a call
  - `GET /health`
- `vapi-assistant-config.json` — full assistant definition (system prompt,
  model, voice, transcriber, tool/function schemas) ready to import

## Setup (local test)
```bash
npm install
cp .env.example .env
npm start
# server runs on http://localhost:3000
curl localhost:3000/health
```

## Deploy (Railway — fastest option)
1. Push this folder to a new GitHub repo.
2. https://railway.app → New Project → Deploy from GitHub repo.
3. Railway auto-detects Node, runs `npm install` then `npm start`. No extra
   config needed — `better-sqlite3` builds fine on Railway's default image.
4. Once deployed, Railway gives you a public URL, e.g.
   `https://your-app.up.railway.app`. Confirm `GET /health` works there.
5. (Optional but recommended) Set an env var `VAPI_WEBHOOK_SECRET` to a random
   string in Railway's dashboard — this lets you verify webhook calls are
   really from Vapi (see `verifySecret` in `server.js`).

SQLite note: Railway's filesystem is ephemeral on redeploys (fine for a demo/
test call). If you need persistence across deploys, attach a Railway volume
mounted at the project root, or swap to a hosted Postgres — the `db.js` file
is the only place that would need to change.

## Wire it up in Vapi
1. Sign up at https://vapi.ai (free tier is enough).
2. Dashboard → Assistants → Create Assistant → switch to the JSON/"Import"
   view if available, and paste in `vapi-assistant-config.json`
   (or recreate the same fields manually: system prompt, model=gpt-4o-mini,
   voice=11labs, transcriber=deepgram nova-2, and the 4 functions).
3. Replace `serverUrl` in the config with your Railway URL + `/webhook`.
4. If you set `VAPI_WEBHOOK_SECRET`, put the same value in the assistant's
   `serverUrlSecret` field so Vapi sends it back on every webhook call.
5. Dashboard → Phone Numbers → get a free Vapi phone number → attach it to
   this assistant. You now have a real dial-in number.
6. Call it. Try: "What times are open tomorrow?" → "Book me in at 2pm,
   name's Ali, phone 0300-1234567" → check `GET /appointments` on your
   Railway URL to confirm it landed in the DB.

## Test checklist
- [ ] `check_availability` returns real open slots for a real date
- [ ] `book_appointment` rejects a double-booked slot
- [ ] `cancel_appointment` frees the slot back up
- [ ] End-of-call report lands in `GET /calls` with a transcript
- [ ] Agent handles an out-of-scope question (e.g. medical advice) gracefully

## Suggested 3-hour time budget
- 0:00–0:20 — repo + backend scaffolding (done above), local smoke test
- 0:20–0:40 — Vapi account, import assistant config, connect phone number
- 0:40–1:10 — deploy backend to Railway, point Vapi at the live webhook URL
- 1:10–1:50 — live test calls, fix prompt/edge cases (date parsing, re-asks,
  interruptions)
- 1:50–2:30 — polish system prompt, add a couple of guardrails (e.g. refuse
  medical advice, handle "I want to speak to a human")
- 2:30–3:00 — record a demo call, write a short README/loom for submission,
  buffer for anything that broke
