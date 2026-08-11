import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { TranscriptEntry } from "~/services/transcript_format";
import {
    type Band,
    dayRangeMs,
    fromDatetimeLocalValue,
    indicesForRange,
    indicesForTimeRange,
    type QuickRangeMode,
    quickRangeBounds,
    resolveRangeToEntries,
    toDatetimeLocalValue,
    type TranscriptRange,
} from "~/utils/transcript_range";

export type Edge = "start" | "end";

interface UseTranscriptSelectionArgs {
    entries: TranscriptEntry[];
    lastExportedAtMs: number | null;
    open: boolean;
    // Called from every leaf edge-move so a stale "Copied!"/fallback banner
    // never survives a range change — owned by useTranscriptCopy.
    onSelectionChange: () => void;
}

/**
 * Owns the range/mode/lastMovedEdge selection state and every path that can
 * move a range edge: nearest-edge row clicks, shift-click, the "Start
 * here"/"End here" ghost buttons, arrow keys on the edge pills, "Select this
 * day", the quick-range radios, and the custom datetime inputs.
 *
 * `range` ({ startMs, endMs }) is the ONLY selection state — see the
 * TranscriptRange comment in transcript_range.ts. `band` (a pair of
 * `entries` indices) is derived from it on every render purely for
 * rendering/export; nothing here ever stores indices as state.
 */
export function useTranscriptSelection({
    entries,
    lastExportedAtMs,
    open,
    onSelectionChange,
}: UseTranscriptSelectionArgs) {
    const [mode, setMode] = useState<QuickRangeMode>("everything");
    const [range, setRange] = useState<TranscriptRange | null>(null);
    const [lastMovedEdge, setLastMovedEdge] = useState<Edge>("end");

    const [watermarkMs, setWatermarkMs] = useState<number | null>(
        lastExportedAtMs
    );

    // Freezing "now" at open time (rather than a moving Date.now() on every
    // render) keeps "Last 7 days" / "Last 30 days" stable for the life of
    // the modal instead of quietly shifting the boundary as the clock ticks.
    const nowMs = useMemo(() => Date.now(), [open]);

    // Re-sync the displayed watermark whenever the dialog (re)opens, in case
    // the parent's lastExportedAtMs changed since the last time it was
    // shown.
    useEffect(() => {
        if (open) setWatermarkMs(lastExportedAtMs);
    }, [open, lastExportedAtMs]);

    // The DERIVED index pair for the current range — see the module doc
    // comment and the TranscriptRange comment in transcript_range.ts. This
    // is what the dialog/rows/summary/copy hook actually render and export
    // against; `range` above never leaves this file except via the
    // datetime-input values, which are formatted straight from it.
    const band: Band | null = useMemo(
        () => (range ? indicesForRange(entries, range) : null),
        [entries, range]
    );

    const clampIndex = useCallback(
        (idx: number) =>
            Math.min(Math.max(idx, 0), Math.max(entries.length - 1, 0)),
        [entries.length]
    );

    // The two ms-based edge-setters are the single unambiguous path for
    // moving a range boundary to an EXACT millisecond value — reused by
    // every index-based entry point below (row clicks, ghost buttons, arrow
    // keys) via setStartEdge/setEndEdge, and directly by the datetime-local
    // inputs. Each carries the other edge along rather than ever producing
    // an inverted range: if the new value would land past the opposite
    // edge, that edge moves to match instead of the commit being rejected
    // or the values silently swapped.
    const setStartMs = useCallback(
        (ms: number) => {
            setRange((prev) => ({
                startMs: ms,
                endMs: prev == null ? ms : Math.max(prev.endMs, ms),
            }));
            setMode("custom");
            setLastMovedEdge("start");
            onSelectionChange();
        },
        [onSelectionChange]
    );

    const setEndMs = useCallback(
        (ms: number) => {
            setRange((prev) => ({
                endMs: ms,
                startMs: prev == null ? ms : Math.min(prev.startMs, ms),
            }));
            setMode("custom");
            setLastMovedEdge("end");
            onSelectionChange();
        },
        [onSelectionChange]
    );

    // Index-based edge setters — used by row clicks, the "Start here"/"End
    // here" ghost buttons, and the edge-pill arrow keys. They resolve the
    // clicked/targeted message's EXACT timestamp and hand off to
    // setStartMs/setEndMs, so a message-anchored move and a typed datetime
    // move go through the identical carry-the-other-edge-along logic.
    const setStartEdge = useCallback(
        (idx: number) => {
            const entry = entries[clampIndex(idx)];
            if (!entry) return;
            setStartMs(entry.timestampMs);
        },
        [clampIndex, entries, setStartMs]
    );

    const setEndEdge = useCallback(
        (idx: number) => {
            const entry = entries[clampIndex(idx)];
            if (!entry) return;
            setEndMs(entry.timestampMs);
        },
        [clampIndex, entries, setEndMs]
    );

    // Nearest-edge click resolution (computed from the DERIVED band, not
    // stored indices):
    //  - no band yet (no range, or a range with zero messages in it) ->
    //    clicked row becomes a fresh single-message range.
    //  - shift+click -> ALWAYS moves the edge opposite the one last moved,
    //    ignoring proximity entirely (this is the one path that doesn't use
    //    the heuristic).
    //  - click strictly above the band -> can only sensibly extend start
    //    (moving end there would invert the range), so start moves.
    //  - click strictly below the band -> symmetric, end moves.
    //  - click inside the band -> contracts to the nearer edge; exactly-tied
    //    distance resolves toward start.
    const handleRowClick = useCallback(
        (index: number, shiftKey: boolean) => {
            if (band == null) {
                const entry = entries[index];
                if (!entry) return;
                setRange({
                    startMs: entry.timestampMs,
                    endMs: entry.timestampMs,
                });
                setMode("custom");
                setLastMovedEdge("end");
                onSelectionChange();
                return;
            }
            if (shiftKey) {
                if (lastMovedEdge === "start") setEndEdge(index);
                else setStartEdge(index);
                return;
            }
            if (index < band.start) {
                setStartEdge(index);
                return;
            }
            if (index > band.end) {
                setEndEdge(index);
                return;
            }
            const distStart = index - band.start;
            const distEnd = band.end - index;
            if (distStart <= distEnd) setStartEdge(index);
            else setEndEdge(index);
        },
        [
            band,
            entries,
            lastMovedEdge,
            setStartEdge,
            setEndEdge,
            onSelectionChange,
        ]
    );

    const handleEdgeKeyDown = useCallback(
        (edge: Edge, e: KeyboardEvent) => {
            if (!band) return;
            if (e.key === "ArrowUp") {
                e.preventDefault();
                if (edge === "start") setStartEdge(band.start - 1);
                else setEndEdge(band.end - 1);
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                if (edge === "start") setStartEdge(band.start + 1);
                else setEndEdge(band.end + 1);
            }
        },
        [band, setStartEdge, setEndEdge]
    );

    // "Select just this day" sets real America/New_York midnight-to-
    // midnight bounds for the day containing `dayMs` — NOT that day's
    // first/last message timestamps — so the range matches the button's
    // label exactly even on a day with sparse or no activity.
    const selectDay = useCallback(
        (dayMs: number) => {
            setRange(dayRangeMs(dayMs));
            setMode("custom");
            setLastMovedEdge("end");
            onSelectionChange();
        },
        [onSelectionChange]
    );

    const selectQuickRange = useCallback(
        (newMode: Exclude<QuickRangeMode, "custom">) => {
            const bounds = quickRangeBounds(newMode, watermarkMs, nowMs);
            setMode(newMode);
            setRange(resolveRangeToEntries(entries, bounds));
            setLastMovedEdge("end");
            onSelectionChange();
        },
        [entries, watermarkMs, nowMs, onSelectionChange]
    );

    const selectCustomMode = useCallback(() => {
        // "Custom" is just a view over whatever range already exists — it
        // doesn't reset the selection, it just reveals the editable inputs.
        setMode("custom");
        onSelectionChange();
    }, [onSelectionChange]);

    // The datetime-local inputs set startMs/endMs DIRECTLY and EXACTLY from
    // whatever the user typed or picked — no snapping to a message
    // timestamp, ever. See setStartMs/setEndMs above for the
    // carry-the-other-edge-along behavior on an inverted commit.
    const handleCustomStartChange = useCallback(
        (value: string) => {
            const ms = fromDatetimeLocalValue(value);
            if (ms == null) return;
            setStartMs(ms);
        },
        [setStartMs]
    );

    const handleCustomEndChange = useCallback(
        (value: string) => {
            const ms = fromDatetimeLocalValue(value);
            if (ms == null) return;
            setEndMs(ms);
        },
        [setEndMs]
    );

    // Formatted STRAIGHT from `range` — never from a message's timestamp —
    // so the field is always an honest reflection of exactly what will be
    // exported, and never gets rewritten to something the user didn't type.
    const customStartValue = useMemo(
        () => (range ? toDatetimeLocalValue(range.startMs) : ""),
        [range]
    );
    const customEndValue = useMemo(
        () => (range ? toDatetimeLocalValue(range.endMs) : ""),
        [range]
    );

    const newSinceDisabled = useMemo(() => {
        if (watermarkMs == null) return false;
        const bounds = quickRangeBounds("new", watermarkMs, nowMs);
        if (!bounds) return true;
        return (
            indicesForTimeRange(entries, bounds.startMs, bounds.endMs) == null
        );
    }, [entries, watermarkMs, nowMs]);

    // Chooses the initial range once a fetch resolves: "New since last
    // export" when there's anything new, otherwise the whole conversation.
    // This is the same logic that used to run inline in the fetch effect's
    // .then() — it's called directly (not from an effect reacting to
    // `entries` changing) from useTranscriptEntries's onEntriesLoaded, so it
    // lands in the SAME render/batch as the entries themselves and there's
    // no in-between frame where the range is stale or empty.
    const initializeRange = useCallback(
        (loadedEntries: TranscriptEntry[]) => {
            const newBounds = quickRangeBounds("new", lastExportedAtMs, nowMs);
            const newRange = resolveRangeToEntries(loadedEntries, newBounds);
            const hasNewMessages =
                newRange != null &&
                indicesForRange(loadedEntries, newRange) != null;

            if (hasNewMessages) {
                setMode("new");
                setRange(newRange);
            } else {
                setMode("everything");
                setRange(
                    resolveRangeToEntries(
                        loadedEntries,
                        quickRangeBounds("everything", null, nowMs)
                    )
                );
            }
            setLastMovedEdge("end");
        },
        [lastExportedAtMs, nowMs]
    );

    // Mirrors the original fetch-error handler's setRange(null).
    const clearRange = useCallback(() => {
        setRange(null);
    }, []);

    return {
        band,
        mode,
        lastMovedEdge,
        watermarkMs,
        setWatermarkMs,
        newSinceDisabled,
        customStartValue,
        customEndValue,
        handleRowClick,
        handleEdgeKeyDown,
        setStartEdge,
        setEndEdge,
        selectDay,
        selectQuickRange,
        selectCustomMode,
        handleCustomStartChange,
        handleCustomEndChange,
        initializeRange,
        clearRange,
    };
}
