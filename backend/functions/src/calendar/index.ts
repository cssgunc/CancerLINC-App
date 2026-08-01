import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";

// admin may already be initialized by another module in this codebase.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const CALENDAR_TIMEZONE = "America/New_York";

// Canonical US Eastern VTIMEZONE. Emitting wall-clock times with a TZID
// reference lets calendar clients resolve DST themselves, so we never do
// offset math on the stored times.
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${CALENDAR_TIMEZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

interface EventDoc {
  title?: string;
  date?: string; // "YYYY-MM-DD"
  startTime?: string; // "HH:MM"
  endTime?: string; // "HH:MM"
  description?: string;
  tags?: string[];
  location?: string;
  isVirtual?: boolean;
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
}

// Escape a value for use in an ICS TEXT field (RFC 5545 §3.3.11).
function escapeText(value: string): string {
  return value
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r\n|\n|\r/g, "\\n");
}

// Zero-pad to two digits.
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Build a floating "basic format" local timestamp (YYYYMMDDTHHMMSS) from the
// stored date/time strings, optionally shifted by a number of minutes.
// Components are treated as UTC purely for arithmetic so the host server's
// timezone never affects the result.
function localStamp(
    dateStr: string,
    timeStr: string,
    addMinutes = 0,
): string | null {
  const dateParts = dateStr.split("-").map(Number);
  const timeParts = timeStr.split(":").map(Number);
  if (dateParts.length !== 3 || timeParts.length < 2) return null;
  const [y, mo, d] = dateParts;
  const [h, mi] = timeParts;
  if ([y, mo, d, h, mi].some((v) => Number.isNaN(v))) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (addMinutes) dt.setUTCMinutes(dt.getUTCMinutes() + addMinutes);
  return (
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}` +
    `T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00`
  );
}

// All-day DATE value (YYYYMMDD), optionally shifted by whole days.
function dateOnly(dateStr: string, addDays = 0): string | null {
  const dateParts = dateStr.split("-").map(Number);
  if (dateParts.length !== 3) return null;
  const [y, mo, d] = dateParts;
  if ([y, mo, d].some((v) => Number.isNaN(v))) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (addDays) dt.setUTCDate(dt.getUTCDate() + addDays);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}

// Current UTC timestamp as an ICS UTC value (YYYYMMDDTHHMMSSZ).
function utcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

// Fold a content line to <=75 octets per RFC 5545 §3.1, splitting on byte
// boundaries so multi-byte UTF-8 characters are never broken.
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const chunks: Buffer[] = [];
  let start = 0;
  // First line: 75 bytes. Continuation lines start with a space, so they hold
  // 74 bytes of content.
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Don't split in the middle of a multi-byte sequence (continuation bytes
    // are 0b10xxxxxx).
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    chunks.push(bytes.subarray(start, end));
    start = end;
    limit = 74;
  }
  return chunks
      .map((c, i) => (i === 0 ? "" : " ") + c.toString("utf8"))
      .join("\r\n");
}

// True only for a well-formed http(s) URL, so we never emit a bogus join link.
function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function buildEvent(
    id: string,
    ev: EventDoc,
    dtstamp: string,
    projectId: string,
): string[] {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${id}@${projectId}`);
  lines.push(`DTSTAMP:${dtstamp}`);

  const date = ev.date ?? "";
  const start = (ev.startTime ?? "").trim();
  const end = (ev.endTime ?? "").trim();

  if (start) {
    const dtStart = localStamp(date, start);
    if (dtStart) lines.push(`DTSTART;TZID=${CALENDAR_TIMEZONE}:${dtStart}`);
    let dtEnd = end ? localStamp(date, end) : null;
    // Default to a one-hour block when no end time is provided.
    if (!dtEnd) dtEnd = localStamp(date, start, 60);
    if (dtEnd) lines.push(`DTEND;TZID=${CALENDAR_TIMEZONE}:${dtEnd}`);
  } else {
    // All-day event. DTEND is exclusive, so it points at the next day.
    const dtStart = dateOnly(date);
    const dtEnd = dateOnly(date, 1);
    if (dtStart) lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    if (dtEnd) lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
  }

  if (ev.title) lines.push(`SUMMARY:${escapeText(ev.title)}`);

  const location = (ev.location ?? "").trim();
  const format = ev.isVirtual ? "Virtual" : "In Person";
  // Only treat the location as a join link when the event is virtual and the
  // location is actually a URL — otherwise it's a physical address.
  const joinUrl = ev.isVirtual && isHttpUrl(location) ? location : null;

  // Structured LOCATION field: shown only when a location is provided.
  if (location) lines.push(`LOCATION:${escapeText(location)}`);

  // Conference join link so calendar apps render a "Join" button. CONFERENCE
  // is RFC 7986; URL is added for older clients that don't support it. The
  // value is a URI, so it is not TEXT-escaped.
  if (joinUrl) {
    lines.push(`CONFERENCE;VALUE=URI;FEATURE=VIDEO;LABEL=Join:${joinUrl}`);
    lines.push(`URL:${joinUrl}`);
  }

  // DESCRIPTION always carries the format (and location, if any) so the core
  // details survive even if a client drops the structured props above.
  const metaLines = [`Format: ${format}`];
  if (location) metaLines.push(`Location: ${location}`);
  if (ev.tags && ev.tags.length > 0) {
    metaLines.push(`Tags: ${ev.tags.join(", ")}`);
  }
  const descParts: string[] = [];
  if (ev.description) descParts.push(ev.description);
  descParts.push(metaLines.join("\n"));
  lines.push(`DESCRIPTION:${escapeText(descParts.join("\n\n"))}`);

  if (ev.updatedAt) {
    lines.push(`LAST-MODIFIED:${utcStamp(ev.updatedAt.toDate())}`);
  }

  lines.push("END:VEVENT");
  return lines;
}

// Build the full VCALENDAR document from a list of events. Pure and
// side-effect free so it can be unit tested without Firestore.
export function buildCalendar(
    events: Array<EventDoc & { id: string }>,
    projectId: string,
    now: Date = new Date(),
): string {
  const dtstamp = utcStamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CancerLINC//Events Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:CancerLINC Events",
    `X-WR-TIMEZONE:${CALENDAR_TIMEZONE}`,
    ...VTIMEZONE,
  ];

  for (const ev of events) {
    if (!ev.date) continue; // an event with no date cannot be scheduled
    lines.push(...buildEvent(ev.id, ev, dtstamp, projectId));
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// Public HTTPS endpoint that serves the CancerLINC events calendar as a live
// iCalendar (ICS) feed. Calendar clients (Google, Apple, WordPress plugins)
// subscribe to this URL and re-poll it for updates.
export const calendarIcs = onRequest(
    {invoker: "public", cors: true},
    async (req, res) => {
      try {
        const projectId =
        process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "cancerlinc";
        const snapshot = await admin
            .firestore()
            .collection("events")
            .orderBy("date")
            .get();

        const events = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as EventDoc),
        }));
        const body = buildCalendar(events, projectId);

        res.set("Content-Type", "text/calendar; charset=utf-8");
        res.set(
            "Content-Disposition",
            "inline; filename=\"cancerlinc-events.ics\"",
        );
        // Let subscribers and any CDN cache briefly; the feed stays effectively live.
        res.set("Cache-Control", "public, max-age=300");
        res.status(200).send(body);
      } catch (err) {
        console.error("Failed to build ICS feed", err);
        res.status(500).send("Failed to build calendar feed");
      }
    },
);
