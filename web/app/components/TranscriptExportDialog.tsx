import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, RefreshCw, X } from "lucide-react";
import type { TranscriptEntry } from "~/services/transcript_format";
import {
    formatTranscriptTimestampShort,
    pluralizeMessages,
} from "~/services/transcript_format";
import { TRANSCRIPT_FETCH_LIMIT } from "~/services/transcript_service";
import { useTranscriptEntries } from "~/hooks/useTranscriptEntries";
import { useTranscriptSelection } from "~/hooks/useTranscriptSelection";
import { useTranscriptCopy } from "~/hooks/useTranscriptCopy";
import {
    dayKeyOf,
    dayLabelOf,
    toDatetimeLocalValue,
    type Band,
} from "~/utils/transcript_range";
import MessageRow, {
    type BandEdgePillProps,
} from "~/components/transcript/TranscriptMessageRow";
import DaySeparator from "~/components/transcript/TranscriptDaySeparator";
import TranscriptRangeControls from "~/components/transcript/TranscriptRangeControls";
import TranscriptSummaryBar from "~/components/transcript/TranscriptSummaryBar";

// ─── Props ─────────────────────────────────────────────────────────────────

interface TranscriptExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    chatId: string;
    patientName: string;
    patientEmail: string;
    currentUserEmail: string;
    currentUserId: string;
    lastExportedAtMs: number | null;
    onExported: (lastMessageTimestampMs: number) => void;
}

// ─── Local types ────────────────────────────────────────────────────────────

// No "band-edge" variant here: the two edge pills are absolutely-positioned
// overlays on the first/last in-band row (see BandEdgePill), not their own
// row. renderItems stays one flat, stably-ordered, stably-keyed list —
// moving a band edge only changes which existing rows are flagged
// in-band/first/last, it never inserts, removes, or re-parents a row. That's
// what keeps every message pinned in place while the band grows/shrinks.
type RenderItem =
    | {
          type: "day";
          key: string;
          label: string;
          dayStart: number;
          dayEnd: number;
      }
    | { type: "message"; index: number };

// A render item's anchor index is what "inside the band" means for it. Day
// separators anchor to the index of the first message they head, so a
// separator sitting exactly at band.start lands inside alongside that
// message — the header never visually detaches from the run it introduces.
function isItemInRange(item: RenderItem, band: Band | null): boolean {
    if (!band) return false;
    const anchorIndex = item.type === "day" ? item.dayStart : item.index;
    return anchorIndex >= band.start && anchorIndex <= band.end;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TranscriptExportDialog({
    open,
    onOpenChange,
    chatId,
    patientName,
    patientEmail,
    currentUserEmail,
    currentUserId,
    lastExportedAtMs,
    onExported,
}: TranscriptExportDialogProps) {
    const listRef = useRef<HTMLDivElement>(null);

    // useTranscriptEntries/useTranscriptSelection/useTranscriptCopy each need
    // something one of the OTHER two hooks produces (copy needs the current
    // band; selection needs a way to clear a stale copy status; entries needs
    // both), but a hook can only consume what an earlier hook call already
    // returned. The "backwards" references are threaded through these stable
    // ref-forwarding callbacks instead — their identity never changes, so
    // they're safe to sit in an effect's dependency array — and are pointed
    // at the real implementation right after all three hooks have run for
    // this render. That preserves the original single-component version's
    // narrow effect dependency lists (see each hook's own comments) with no
    // extra render pass and no risk of the entries fetch re-running on
    // every prop change.
    const resetCopyRef = useRef<() => void>(() => {});
    const initializeRangeRef = useRef<(entries: TranscriptEntry[]) => void>(
        () => {}
    );
    const clearRangeRef = useRef<() => void>(() => {});

    const onFetchStart = useCallback(() => resetCopyRef.current(), []);
    const onEntriesLoaded = useCallback(
        (loadedEntries: TranscriptEntry[]) =>
            initializeRangeRef.current(loadedEntries),
        []
    );
    const onFetchError = useCallback(() => clearRangeRef.current(), []);
    const onSelectionChange = useCallback(() => resetCopyRef.current(), []);

    const { entries, loading, fetchError, hitLimit, retry } =
        useTranscriptEntries({
            open,
            chatId,
            onFetchStart,
            onEntriesLoaded,
            onFetchError,
        });

    const selection = useTranscriptSelection({
        entries,
        lastExportedAtMs,
        open,
        onSelectionChange,
    });

    const copy = useTranscriptCopy({
        open,
        entries,
        band: selection.band,
        patientName,
        patientEmail,
        currentUserEmail,
        chatId,
        onExported,
        setWatermarkMs: selection.setWatermarkMs,
    });

    resetCopyRef.current = copy.resetToIdle;
    initializeRangeRef.current = selection.initializeRange;
    clearRangeRef.current = selection.clearRange;

    // Open scrolled to the newest message, matching the chat itself, instead
    // of the top. Runs after loading finishes and the list has actually
    // rendered (useLayoutEffect, before paint, so there's no visible jump).
    // Keyed on open/loading/entries.length/fetchError rather than anything
    // that changes as the user works the selection (band, mode, ...) — it
    // must fire again on every reopen, but never fight the user's own
    // scrolling once the dialog is up.
    useLayoutEffect(() => {
        if (!open || loading || fetchError || entries.length === 0) return;
        const list = listRef.current;
        if (!list) return;
        list.scrollTop = list.scrollHeight;
    }, [open, loading, fetchError, entries.length]);

    // Bounds for the custom datetime-local inputs' min/max attributes — a
    // hint that steers the native picker into the conversation's real
    // range. Deliberately NOT used to clamp a typed/picked value: the user
    // may legitimately want a window wider than the message data (e.g.
    // midnight-to-midnight boundaries that fall outside it), and that must
    // be preserved exactly — see the range comment in transcript_range.ts.
    const customDatetimeBounds = useMemo(() => {
        if (entries.length === 0) return null;
        return {
            min: toDatetimeLocalValue(entries[0].timestampMs),
            max: toDatetimeLocalValue(entries[entries.length - 1].timestampMs),
        };
    }, [entries]);

    const dayGroups = useMemo(() => {
        const groups: {
            key: string;
            label: string;
            start: number;
            end: number;
        }[] = [];
        for (let i = 0; i < entries.length; i++) {
            const key = dayKeyOf(entries[i].timestampMs);
            const last = groups[groups.length - 1];
            if (last && last.key === key) {
                last.end = i;
            } else {
                groups.push({
                    key,
                    label: dayLabelOf(entries[i].timestampMs),
                    start: i,
                    end: i,
                });
            }
        }
        return groups;
    }, [entries]);

    const renderItems = useMemo<RenderItem[]>(() => {
        const items: RenderItem[] = [];
        let groupPointer = 0;
        for (let i = 0; i < entries.length; i++) {
            const group = dayGroups[groupPointer];
            if (group && group.start === i) {
                items.push({
                    type: "day",
                    key: group.key,
                    label: group.label,
                    dayStart: group.start,
                    dayEnd: group.end,
                });
                groupPointer++;
            }
            items.push({ type: "message", index: i });
        }
        return items;
    }, [entries, dayGroups]);

    // One flat pass over the stable renderItems list, classifying each row
    // as in/out of the band and locating the first and last in-band array
    // positions. This is the ONLY thing an edge move changes — the list
    // itself (order, identity, DOM parent of every row) never changes, which
    // is what lets rows stay mounted and animate their background instead of
    // remounting or reflowing. See the RenderItem comment above.
    const { inRangeFlags, firstInRangeIdx, lastInRangeIdx } = useMemo(() => {
        const flags = renderItems.map((item) =>
            isItemInRange(item, selection.band)
        );
        return {
            inRangeFlags: flags,
            firstInRangeIdx: flags.indexOf(true),
            lastInRangeIdx: flags.lastIndexOf(true),
        };
    }, [renderItems, selection.band]);

    const copyDisabledReason = copy.copyDisabledReason;

    // Pill configs are computed once per render (not per row) and handed to
    // whichever row is currently flagged first/last-in-band. Since no row is
    // ever inserted/removed for the pills themselves (see BandEdgePill),
    // moving an edge just re-targets which row receives the config object —
    // zero reflow.
    const startPillProps: BandEdgePillProps | null = selection.band
        ? {
              valueText: `Start of export: ${formatTranscriptTimestampShort(entries[selection.band.start].timestampMs)}`,
              onKeyDown: (e: React.KeyboardEvent) =>
                  selection.handleEdgeKeyDown("start", e),
          }
        : null;
    const endPillProps: BandEdgePillProps | null = selection.band
        ? {
              valueText: `End of export: ${formatTranscriptTimestampShort(entries[selection.band.end].timestampMs)}`,
              onKeyDown: (e: React.KeyboardEvent) =>
                  selection.handleEdgeKeyDown("end", e),
          }
        : null;

    const renderListItem = useCallback(
        (item: RenderItem, arrayIdx: number) => {
            const inRange = inRangeFlags[arrayIdx];
            const isFirstInBand = arrayIdx === firstInRangeIdx;
            const isLastInBand = arrayIdx === lastInRangeIdx;
            const startPill = isFirstInBand ? startPillProps : undefined;
            const endPill = isLastInBand ? endPillProps : undefined;
            if (item.type === "day") {
                return (
                    <DaySeparator
                        key={`day-${item.key}`}
                        label={item.label}
                        inRange={inRange}
                        isFirstInBand={isFirstInBand}
                        isLastInBand={isLastInBand}
                        startPill={startPill}
                        endPill={endPill}
                        onSelectDay={() =>
                            selection.selectDay(
                                entries[item.dayStart].timestampMs
                            )
                        }
                    />
                );
            }
            const entry = entries[item.index];
            return (
                <MessageRow
                    key={entry.messageId}
                    entry={entry}
                    index={item.index}
                    isMine={entry.senderId === currentUserId}
                    inRange={inRange}
                    isFirstInBand={isFirstInBand}
                    isLastInBand={isLastInBand}
                    startPill={startPill}
                    endPill={endPill}
                    onRowClick={selection.handleRowClick}
                    onStartHere={selection.setStartEdge}
                    onEndHere={selection.setEndEdge}
                />
            );
        },
        [
            entries,
            currentUserId,
            selection.selectDay,
            selection.handleRowClick,
            selection.setStartEdge,
            selection.setEndEdge,
            inRangeFlags,
            firstInRangeIdx,
            lastInRangeIdx,
            startPillProps,
            endPillProps,
        ]
    );

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 grid h-[85vh] w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 grid-cols-[280px_1fr] overflow-hidden rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)] focus:outline-none">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="absolute right-4 top-4 z-10 rounded p-1 text-[#999999] transition-colors hover:bg-[#F0F0F0] hover:text-black"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    {/* ── Left rail ──────────────────────────────────── */}
                    <aside className="flex flex-col overflow-hidden border-r border-[#D9D9D9]">
                        <div className="flex-1 space-y-6 overflow-y-auto p-5">
                            <div>
                                <Dialog.Title className="text-sm font-semibold uppercase tracking-[0.16em] text-[#666666]">
                                    Export transcript
                                </Dialog.Title>
                                <Dialog.Description className="sr-only">
                                    Select a range of messages from the
                                    conversation with {patientName} to copy for
                                    pasting into an email.
                                </Dialog.Description>
                                <p className="mt-2 text-base font-semibold text-black">
                                    {patientName}
                                </p>
                                <p className="text-sm text-[#666666]">
                                    {patientEmail}
                                </p>
                            </div>

                            {!loading && !fetchError && entries.length > 0 && (
                                <TranscriptRangeControls
                                    watermarkMs={selection.watermarkMs}
                                    mode={selection.mode}
                                    newSinceDisabled={
                                        selection.newSinceDisabled
                                    }
                                    onSelectQuickRange={
                                        selection.selectQuickRange
                                    }
                                    onSelectCustomMode={
                                        selection.selectCustomMode
                                    }
                                    customStartValue={
                                        selection.customStartValue
                                    }
                                    customEndValue={selection.customEndValue}
                                    onCustomStartChange={
                                        selection.handleCustomStartChange
                                    }
                                    onCustomEndChange={
                                        selection.handleCustomEndChange
                                    }
                                    minDatetimeValue={customDatetimeBounds?.min}
                                    maxDatetimeValue={customDatetimeBounds?.max}
                                />
                            )}

                            {/* The derived selection facts (count, range,
                                breakdown, image note) live in the bottom bar
                                on the right panel now — this rail keeps only
                                controls and the export watermark. */}
                            {!loading && !fetchError && (
                                <p className="border-t border-[#D9D9D9] pt-4 text-xs text-[#999999]">
                                    {selection.watermarkMs != null
                                        ? `Last exported: ${formatTranscriptTimestampShort(selection.watermarkMs)}`
                                        : "Never exported"}
                                </p>
                            )}
                        </div>

                        {!loading && !fetchError && entries.length > 0 && (
                            <div className="shrink-0 border-t border-[#D9D9D9] p-4">
                                {copy.copyStatus.kind === "fallback" ? (
                                    <p className="text-xs text-[#666666]">
                                        Select the text on the right and press
                                        ⌘A then ⌘C to copy it manually.
                                    </p>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={copy.handleCopy}
                                            disabled={
                                                copyDisabledReason != null ||
                                                copy.copyStatus.kind ===
                                                    "copying"
                                            }
                                            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {copy.copyStatus.kind === "copied"
                                                ? `✓ Copied — ${pluralizeMessages(copy.copyStatus.count)}`
                                                : copy.copyStatus.kind ===
                                                    "record-failed"
                                                  ? `✓ Copied — ${pluralizeMessages(copy.copyStatus.count)}`
                                                  : copy.copyStatus.kind ===
                                                      "copying"
                                                    ? "Copying…"
                                                    : "Copy"}
                                        </button>
                                        {copyDisabledReason && (
                                            <p className="mt-2 text-xs text-[#999999]">
                                                {copyDisabledReason}
                                            </p>
                                        )}
                                        {copy.copyStatus.kind === "copied" &&
                                            copy.copyStatus.flavor ===
                                                "plain" && (
                                                <p className="mt-2 text-xs text-[#666666]">
                                                    Copied as plain text
                                                </p>
                                            )}
                                        {copy.copyStatus.kind ===
                                            "record-failed" && (
                                            <p className="mt-2 text-xs text-amber-700">
                                                Copied, but couldn&apos;t record
                                                the export date. Try again to
                                                update it.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </aside>

                    {/* ── Right pane: the transcript ─────────────────── */}
                    <div className="flex flex-col overflow-hidden">
                        {hitLimit && (
                            <div className="shrink-0 border-b border-[#D9D9D9] bg-[#FAFAFA] px-4 py-2 text-xs text-[#666666]">
                                Showing the most recent{" "}
                                {TRANSCRIPT_FETCH_LIMIT.toLocaleString("en-US")}{" "}
                                messages.
                            </div>
                        )}

                        {copy.copyStatus.kind === "fallback" ? (
                            <div className="flex flex-1 flex-col gap-2 overflow-hidden p-4">
                                <p className="text-sm text-[#666666]">
                                    We couldn&apos;t write to your clipboard.
                                    Press ⌘A then ⌘C to copy the transcript
                                    below manually.
                                </p>
                                <textarea
                                    ref={copy.fallbackTextareaRef}
                                    readOnly
                                    value={copy.copyStatus.text}
                                    className="flex-1 resize-none rounded-lg border border-[#D9D9D9] bg-[#FAFAFA] p-3 text-sm text-black focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={copy.handleCopy}
                                    className="self-start rounded-lg border border-[#D9D9D9] px-3 py-1.5 text-xs font-medium text-[#666666] transition-colors hover:bg-[#F0F0F0]"
                                >
                                    Try clipboard again
                                </button>
                            </div>
                        ) : loading ? (
                            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[#999999]">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading messages…
                            </div>
                        ) : fetchError ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                                <p className="text-sm text-[#666666]">
                                    {fetchError}
                                </p>
                                <button
                                    type="button"
                                    onClick={retry}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9D9D9] px-3 py-1.5 text-xs font-medium text-[#666666] transition-colors hover:bg-[#F0F0F0]"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Retry
                                </button>
                            </div>
                        ) : entries.length === 0 ? (
                            <div className="flex flex-1 items-center justify-center text-sm text-[#999999]">
                                No messages in this chat yet.
                            </div>
                        ) : (
                            <div
                                ref={listRef}
                                role="listbox"
                                aria-multiselectable="true"
                                aria-label="Transcript messages"
                                className="flex-1 overflow-y-auto p-4"
                            >
                                {/* One flat, stably-ordered, stably-keyed
                                    list — every row (message or day
                                    separator) renders here exactly once, in
                                    the same DOM position, for the life of
                                    the dialog. The band is communicated
                                    entirely through each row's own
                                    inRange/isFirstInBand/isLastInBand props
                                    (background + rounding) and the
                                    start/end pills those flags unlock — never
                                    by moving rows between containers. */}
                                {renderItems.map((item, i) =>
                                    renderListItem(item, i)
                                )}
                            </div>
                        )}

                        {/* Bottom bar: the derived selection facts that used
                            to live in the left rail. It's a flex sibling of
                            the scroll area above (not an overlay), so the
                            transcript scrolls to make room for it rather
                            than being covered by it. */}
                        {!loading && !fetchError && (
                            <TranscriptSummaryBar
                                entries={entries}
                                band={selection.band}
                                patientName={patientName}
                                patientEmail={patientEmail}
                            />
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
