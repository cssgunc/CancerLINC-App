// Pure string-building for the "copy chat transcript" export. No Firebase,
// no React, no DOM — everything here is a plain function of its arguments so
// it can be unit-tested and reused from both the export dialog and (later)
// any server-side archival job without dragging in browser APIs.

// ─── Constants ──────────────────────────────────────────────────────────────

// Matches the convention used elsewhere in the app (see member.tsx /
// _index.tsx) rather than introducing a second name for the same zone.
const EASTERN_TIME_ZONE = "America/New_York";

// Alternating accent colors for consecutive runs, purely for visual
// scannability when skimming a long thread. Not tied to "patient vs staff"
// identity — TranscriptEntry doesn't carry that distinction, and inferring it
// from senderEmail would be unreliable since senderEmail can be "".
const RUN_ACCENT_COLORS = ["#4a7c9e", "#8a8a8a"];

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TranscriptEntry {
    messageId: string;
    senderId: string;
    senderName: string; // resolved upstream, never empty
    senderEmail: string; // resolved upstream; "" if genuinely unavailable
    timestampMs: number;
    content: string;
    messageType: "text" | "image";
    imageFileName?: string;
}

export interface TranscriptMeta {
    patientName: string;
    patientEmail: string;
    rangeStartMs: number;
    rangeEndMs: number;
    exportedAtMs: number;
    exportedByEmail: string;
    messageCount: number;
}

// A "run" is a maximal sequence of consecutive entries from the same sender —
// mirrors the startsChunk/endsChunk grouping already used by the chat UI in
// member.tsx, so the exported transcript reads the same way the chat does.
interface TranscriptRun {
    senderName: string;
    senderEmail: string;
    entries: TranscriptEntry[];
}

// ─── Escaping ───────────────────────────────────────────────────────────────

// Message content is user input (patient/staff chat messages) and must never
// be interpolated into the HTML flavor unescaped.
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Escapes then converts embedded newlines to <br> so a multi-line message
// body still reads as multiple lines once pasted into an HTML composer.
function escapeHtmlMultiline(value: string): string {
    return escapeHtml(value).replace(/\n/g, "<br>");
}

// "1 message" / "2 messages". The count lands in an archived record, so the
// grammar has to be right — this string is read by whoever opens the email
// months later, not just by the person clicking export.
export function pluralizeMessages(count: number): string {
    return `${count} ${count === 1 ? "message" : "messages"}`;
}

// ─── Timestamp formatting ───────────────────────────────────────────────────

// "Jul 3, 2026 2:01 PM EDT" — built from separate date/time formatters
// (rather than a single toLocaleString call) because toLocaleString inserts
// a comma before the time that the target format doesn't want.
export function formatTranscriptTimestamp(ms: number): string {
    const date = new Date(ms);
    const datePart = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: EASTERN_TIME_ZONE,
    });
    const timePart = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
        timeZone: EASTERN_TIME_ZONE,
    });
    return `${datePart} ${timePart}`;
}

// Date-only, no time/timezone — used for the "Exported <date>" summary line
// where the full timestamp would be noise.
function formatTranscriptDateOnly(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: EASTERN_TIME_ZONE,
    });
}

// Time-only, no date/timezone — used for the "[3:40 PM]" prefix on a message
// continuing the same sender's run on the same day.
function formatTranscriptTimeOnly(ms: number): string {
    return new Date(ms).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: EASTERN_TIME_ZONE,
    });
}

// ─── Grouping ───────────────────────────────────────────────────────────────

function groupIntoRuns(entries: TranscriptEntry[]): TranscriptRun[] {
    const runs: TranscriptRun[] = [];
    for (const entry of entries) {
        const currentRun = runs[runs.length - 1];
        if (currentRun && currentRun.entries[0].senderId === entry.senderId) {
            currentRun.entries.push(entry);
        } else {
            runs.push({
                senderName: entry.senderName,
                senderEmail: entry.senderEmail,
                entries: [entry],
            });
        }
    }
    return runs;
}

function imagePlaceholder(entry: TranscriptEntry): string {
    // Deliberately never renders a URL: Firebase download URLs bypass
    // Storage rules, so putting one in an emailed transcript would be a
    // permanent, unrevocable PHI leak. TranscriptEntry has no imageUrl field
    // for exactly this reason.
    return entry.imageFileName
        ? `[Image attachment: ${entry.imageFileName}]`
        : "[Image attachment]";
}

// ─── Timestamp precision ────────────────────────────────────────────────────

// Eastern calendar day, as a sortable "2026-08-11" key. Derived through the
// same time zone the timestamps are rendered in, never from the UTC date: a
// 9 PM EDT message is already the next day in UTC, so a UTC-based comparison
// would restate the date in the middle of an evening and omit it across a
// real midnight.
function easternDayKey(ms: number): string {
    return new Date(ms).toLocaleDateString("en-CA", {
        timeZone: EASTERN_TIME_ZONE,
    });
}

// How much of a timestamp a message needs: the time alone only when it
// continues the same sender's run on the same day, and the full date
// otherwise. Both conditions matter — the shortening is a continuation
// shorthand, so it stops the moment the speaker changes even if the day
// hasn't. Whoever reads the archive shouldn't have to scan upward past
// someone else's block to work out what day a line belongs to.
//
// Run-local by construction: a run breaks on every sender change, so index 0
// is exactly "the speaker just changed" and always states the full date.
// Shared by both flavors so the text and HTML transcripts can never disagree
// about which lines show a date.
function continuationTimestamp(run: TranscriptRun, index: number): string {
    const entry = run.entries[index];
    if (index === 0) {
        return formatTranscriptTimestamp(entry.timestampMs);
    }
    const previous = run.entries[index - 1];
    return easternDayKey(entry.timestampMs) ===
        easternDayKey(previous.timestampMs)
        ? formatTranscriptTimeOnly(entry.timestampMs)
        : formatTranscriptTimestamp(entry.timestampMs);
}

// ─── Plain text ─────────────────────────────────────────────────────────────

function formatSenderPlainText(name: string, email: string): string {
    return email ? `${name} <${email}>` : name;
}

function buildTextHeader(meta: TranscriptMeta): string {
    const patient = formatSenderPlainText(meta.patientName, meta.patientEmail);
    const range = `${formatTranscriptTimestamp(meta.rangeStartMs)} – ${formatTranscriptTimestamp(meta.rangeEndMs)}`;
    const exported = `${formatTranscriptDateOnly(meta.exportedAtMs)} by ${meta.exportedByEmail}`;
    return [
        "CancerLINC chat transcript",
        `Patient: ${patient}`,
        `Range: ${range}`,
        `${pluralizeMessages(meta.messageCount)} · Exported ${exported}`,
    ].join("\n");
}

// The sender line names the run; every message line beneath it then has the
// same shape — timestamp in brackets, message immediately after it. The run's
// first message is not a special case: it gets a bracketed timestamp exactly
// like its continuations, so a reader never has to work out whether a given
// line is carrying its own time or borrowing the header's.
function buildTextRun(run: TranscriptRun): string {
    const headerLine = formatSenderPlainText(run.senderName, run.senderEmail);

    const bodyLines = run.entries.map((entry, index) => {
        const content =
            entry.messageType === "image"
                ? imagePlaceholder(entry)
                : entry.content;
        return `[${continuationTimestamp(run, index)}] ${content}`;
    });

    return [headerLine, ...bodyLines].join("\n");
}

// No box-drawing characters and no leading ">": both mangle once a real mail
// client gets involved — box-drawing glyphs frequently don't survive
// Outlook's plain-text rendering, and a leading ">" gets treated as an
// existing quote marker, so replies end up double-quoting our own text.
// Compact form for dense UI surfaces (the export dialog's message rows and
// its summary bar), where the long form crowds the layout.
//
// Deliberately NOT used in the transcript body itself: the exported record is
// read months later by someone who wasn't there, and "08/09/26" makes them
// infer a century. Density is worth it on screen, never in the archive.
export function formatTranscriptTimestampShort(ms: number): string {
    const date = new Date(ms);
    const datePart = date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "2-digit",
        timeZone: EASTERN_TIME_ZONE,
    });
    const timePart = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
        timeZone: EASTERN_TIME_ZONE,
    });
    return `${datePart} ${timePart}`;
}

export function buildTranscriptText(
    entries: TranscriptEntry[],
    meta: TranscriptMeta
): string {
    const header = buildTextHeader(meta);
    const runs = groupIntoRuns(entries);
    if (runs.length === 0) {
        return header;
    }
    const body = runs.map(buildTextRun).join("\n\n");
    return `${header}\n\n${body}`;
}

// ─── HTML ───────────────────────────────────────────────────────────────────

function formatSenderHtml(name: string, email: string): string {
    const escapedName = `<strong style="color:#1a1a1a;font-size:13px;">${escapeHtml(name)}</strong>`;
    if (!email) {
        return escapedName;
    }
    return `${escapedName} <span style="color:#666666;font-size:13px;">&lt;${escapeHtml(email)}&gt;</span>`;
}

function buildHtmlHeader(meta: TranscriptMeta): string {
    const patient = formatSenderHtml(meta.patientName, meta.patientEmail);
    const range = `${formatTranscriptTimestamp(meta.rangeStartMs)} – ${formatTranscriptTimestamp(meta.rangeEndMs)}`;
    const exported = `${formatTranscriptDateOnly(meta.exportedAtMs)} by ${escapeHtml(meta.exportedByEmail)}`;

    // Every text-bearing element carries explicit color + font-size, never
    // inherited: Outlook's Word-based rendering engine drops inheritance on
    // paste and will otherwise silently produce black-on-black or invisible
    // text.
    return `
<div style="margin-bottom:16px;">
    <div style="font-size:16px;font-weight:bold;color:#1a1a1a;">CancerLINC chat transcript</div>
    <div style="font-size:13px;color:#333333;margin-top:4px;">Patient: ${patient}</div>
    <div style="font-size:13px;color:#333333;margin-top:2px;">Range: ${range}</div>
    <div style="font-size:12px;color:#666666;margin-top:2px;">${pluralizeMessages(meta.messageCount)} &middot; Exported ${exported}</div>
</div>`.trim();
}

function buildHtmlRun(run: TranscriptRun, accentColor: string): string {
    const sender = formatSenderHtml(run.senderName, run.senderEmail);

    // Same shape as the text flavor: sender heads the run, then every message
    // line leads with its own bracketed timestamp. The timestamp stays inline
    // ahead of the message rather than on a line of its own, so the pair
    // survives as one unit through a mail client's html-to-plain-text
    // downgrade, which drops standalone-line structure far more readily than
    // it drops intra-line order.
    const bodyLines = run.entries.map((entry, index) => {
        const content =
            entry.messageType === "image"
                ? escapeHtml(imagePlaceholder(entry))
                : escapeHtmlMultiline(entry.content);
        const timestamp = continuationTimestamp(run, index);
        return `<span style="color:#999999;font-size:12px;">[${timestamp}]</span> ${content}`;
    });

    // border-left (not background-color) for the sender accent: Outlook
    // desktop's rendering engine strips div background-colors on paste, so a
    // background accent degrades to nothing, while a border degrades
    // gracefully to a plain rule.
    return `
<div style="border-left:3px solid ${accentColor};padding-left:12px;margin-bottom:16px;">
    <div style="margin-bottom:4px;">${sender}</div>
    <div style="font-size:14px;color:#1a1a1a;line-height:1.5;">
        ${bodyLines.join("<br>\n        ")}
    </div>
</div>`.trim();
}

// The HTML must survive being fed through a rich composer's own
// html-to-plain-text downgrade (Gmail/Outlook generate the plain-text MIME
// alternative from this markup, not from buildTranscriptText's output), so
// it is written as a linear sequence of div/p/strong/br — deliberately no
// tables, since tabular markup is exactly what downgrades into mangled
// column runs and lost line breaks for what is really just a linear
// document. Everything is inline-styled: mail clients strip <style> blocks
// on paste, and inline is the only thing that reliably survives.
export function buildTranscriptHtml(
    entries: TranscriptEntry[],
    meta: TranscriptMeta
): string {
    const runs = groupIntoRuns(entries);
    const runsHtml = runs
        .map((run, index) =>
            buildHtmlRun(
                run,
                RUN_ACCENT_COLORS[index % RUN_ACCENT_COLORS.length]
            )
        )
        .join("\n");

    return `
<div style="max-width:640px;margin:0 auto;font-family:-apple-system, 'Segoe UI', Arial, sans-serif;color:#1a1a1a;font-size:14px;">
${buildHtmlHeader(meta)}
${runsHtml}
</div>`.trim();
}
