// Pure, React-free helpers for the transcript export selection: turning a
// time window into the pair of `entries` array indices it covers (for
// rendering) and back. Shared by the transcript selection hook and the
// export dialog shell so the two can never drift apart on what a given quick
// range, "select this day", or datetime-local value actually means.

import type { TranscriptEntry } from "~/services/transcript_format";

// ─── Types ──────────────────────────────────────────────────────────────────

// THE SOURCE OF TRUTH for the selection is this millisecond time window, NOT
// a pair of message indices. A message is in the selection iff
// `startMs <= entry.timestampMs <= endMs` (inclusive both ends) — see
// `indicesForTimeRange`.
//
// This is deliberate: an index pair can only ever express "from message X to
// message Y", which forces every datetime-local input to snap to some
// message's exact timestamp the instant it's typed into — the picker fights
// the user. A plain ms window has no such constraint: 8/9 12:00am -> 8/10
// 11:59pm is a perfectly valid range even though no message landed on either
// boundary. Message indices (first/last in-range, in-range flags, the
// highlighted band, the edge pills, firstMessageId/lastMessageId) are all
// DERIVED from this range for rendering/export — never stored separately.
// If you're tempted to go back to storing indices as the selection state
// "for simplicity," don't: that's exactly the bug this type exists to avoid.
export type TranscriptRange = { startMs: number; endMs: number };

// A derived view over `entries`: the tightest [start, end] index pair whose
// timestamps fall inside a TranscriptRange. Purely a rendering/export
// convenience computed FROM the range (see indicesForTimeRange) — never
// itself the selection state.
export type Band = { start: number; end: number };

export type QuickRangeMode = "new" | "everything" | "7d" | "30d" | "custom";

// ─── Constants / pure helpers ───────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const EASTERN_TIME_ZONE = "America/New_York";

// Day-grouping and the day-separator label both key off America/New_York so
// "today" in the transcript matches how the social worker experiences the
// conversation, regardless of what timezone their browser reports.
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});
const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
});

export function dayKeyOf(ms: number): string {
    return dayKeyFormatter.format(new Date(ms));
}

export function dayLabelOf(ms: number): string {
    return dayLabelFormatter.format(new Date(ms));
}

// Finds the tightest [start, end] index pair whose timestamps fall inside
// [startMs, endMs] (inclusive both ends). Returns null when nothing in
// `list` matches — either because the window and the data genuinely don't
// overlap (e.g. "Last 7 days" on a chat that's gone quiet) or because the
// window is legitimately empty (e.g. "Select just this day" on a day with no
// messages). An empty selection is a real, valid state the UI has to render,
// not an error — see the empty-selection handling in TranscriptSummaryBar
// and useTranscriptCopy.
export function indicesForTimeRange(
    list: TranscriptEntry[],
    startMs: number,
    endMs: number
): Band | null {
    let start = -1;
    let end = -1;
    for (let i = 0; i < list.length; i++) {
        const t = list[i].timestampMs;
        if (t >= startMs && start === -1) start = i;
        if (t <= endMs) end = i;
    }
    if (start === -1 || end === -1 || start > end) return null;
    return { start, end };
}

// Convenience wrapper over indicesForTimeRange for the common case of
// already holding a TranscriptRange.
export function indicesForRange(
    list: TranscriptEntry[],
    range: TranscriptRange
): Band | null {
    return indicesForTimeRange(list, range.startMs, range.endMs);
}

// Pure time-window lookup shared by the initial-default computation and the
// quick-range click handler, so the two can never drift apart. Bounds may be
// open-ended (±Infinity) — callers that need a concrete TranscriptRange to
// store as selection state should run the result through
// `resolveRangeToEntries` rather than persisting an Infinity.
export function quickRangeBounds(
    mode: Exclude<QuickRangeMode, "custom">,
    watermarkMs: number | null,
    nowMs: number
): { startMs: number; endMs: number } | null {
    switch (mode) {
        case "everything":
            return { startMs: -Infinity, endMs: Infinity };
        case "new":
            if (watermarkMs == null) return null;
            return { startMs: watermarkMs + 1, endMs: Infinity };
        case "7d":
            return { startMs: nowMs - 7 * DAY_MS, endMs: Infinity };
        case "30d":
            return { startMs: nowMs - 30 * DAY_MS, endMs: Infinity };
    }
}

// Clamps a (possibly open-ended) time window to the actual span of `entries`
// so quick-range presets ("Everything", "Last 7 days", "New since last
// export", ...) never store a literal ±Infinity as selection state — only
// concrete, real timestamps ever live in a TranscriptRange. When the window
// and the data don't overlap at all, the clamp naturally produces
// startMs > endMs, which indicesForTimeRange/indicesForRange already treat
// as "zero messages" — a legitimate empty selection, not a special case here.
export function resolveRangeToEntries(
    entries: TranscriptEntry[],
    bounds: { startMs: number; endMs: number } | null
): TranscriptRange | null {
    if (!bounds || entries.length === 0) return null;
    return {
        startMs: Math.max(bounds.startMs, entries[0].timestampMs),
        endMs: Math.min(bounds.endMs, entries[entries.length - 1].timestampMs),
    };
}

export function toDatetimeLocalValue(ms: number): string {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): number | null {
    if (!value) return null;
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
}

// ─── Timezone-aware day boundaries ──────────────────────────────────────────

// How far "wall-clock time in `timeZone`" is ahead of the UTC instant
// `utcMs` — i.e. the zone's UTC offset (in ms, negative west of UTC) in
// effect at that instant. Used to convert a Y/M/D/H/M/S wall-clock reading
// in a specific zone into the UTC instant it corresponds to, since neither
// `Date` nor `Date.UTC` can construct a date in an arbitrary IANA zone
// directly.
function zoneOffsetMs(utcMs: number, timeZone: string): number {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    const parts = dtf.formatToParts(new Date(utcMs));
    const get = (type: string) =>
        Number(parts.find((p) => p.type === type)?.value ?? 0);
    const asUtc = Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second")
    );
    return asUtc - utcMs;
}

// The UTC instant (ms) at which the wall clock in `timeZone` reads the given
// Y/M/D H:M:S.mmm. Two passes: the first offset guess is taken near the
// naive (UTC-as-if-local) instant, the second re-checks the offset at the
// resulting instant — this self-corrects on days that straddle a DST
// transition, where the offset at the naive guess can differ from the offset
// actually in effect at the real instant.
function zonedTimeToUtcMs(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    ms: number,
    timeZone: string
): number {
    const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    const offset = zoneOffsetMs(naiveUtc, timeZone);
    const firstPass = naiveUtc - offset;
    const offset2 = zoneOffsetMs(firstPass, timeZone);
    return offset2 === offset ? firstPass : naiveUtc - offset2;
}

// Midnight-to-midnight bounds (00:00:00.000 -> 23:59:59.999, inclusive) for
// the America/New_York calendar day containing `ms`. This is what "Select
// just this day" uses — the wall-clock day boundary, NOT the day's first/
// last message timestamps, so it matches the button's label exactly even on
// a day with sparse or no activity.
export function dayRangeMs(ms: number): TranscriptRange {
    const [year, month, day] = dayKeyOf(ms).split("-").map(Number);
    return {
        startMs: zonedTimeToUtcMs(
            year,
            month,
            day,
            0,
            0,
            0,
            0,
            EASTERN_TIME_ZONE
        ),
        endMs: zonedTimeToUtcMs(
            year,
            month,
            day,
            23,
            59,
            59,
            999,
            EASTERN_TIME_ZONE
        ),
    };
}
