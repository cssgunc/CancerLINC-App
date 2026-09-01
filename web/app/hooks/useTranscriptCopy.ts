import { useCallback, useEffect, useRef, useState } from "react";
import type {
    TranscriptEntry,
    TranscriptMeta,
} from "~/services/transcript_format";
import {
    buildTranscriptHtml,
    buildTranscriptText,
} from "~/services/transcript_format";
import {
    copyTranscriptToClipboard,
    recordTranscriptExport,
} from "~/services/transcript_service";
import type { Band } from "~/utils/transcript_range";

export type TranscriptCopyStatus =
    | { kind: "idle" }
    | { kind: "copying" }
    | { kind: "copied"; flavor: "rich" | "plain"; count: number }
    | { kind: "record-failed"; count: number }
    | { kind: "fallback"; text: string };

interface UseTranscriptCopyArgs {
    open: boolean;
    entries: TranscriptEntry[];
    band: Band | null;
    patientName: string;
    patientEmail: string;
    currentUserEmail: string;
    chatId: string;
    onExported: (lastMessageTimestampMs: number) => void;
    setWatermarkMs: (ms: number | null) => void;
}

/**
 * Owns the copy status state machine, the click-to-copy handler, and the
 * recordTranscriptExport call that follows a successful copy.
 */
export function useTranscriptCopy({
    open,
    entries,
    band,
    patientName,
    patientEmail,
    currentUserEmail,
    chatId,
    onExported,
    setWatermarkMs,
}: UseTranscriptCopyArgs) {
    const [copyStatus, setCopyStatus] = useState<TranscriptCopyStatus>({
        kind: "idle",
    });

    const fallbackTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Ephemeral copy/fallback UI shouldn't survive a close — reopening
    // should always start clean.
    useEffect(() => {
        if (!open) setCopyStatus({ kind: "idle" });
    }, [open]);

    useEffect(() => {
        if (copyStatus.kind === "fallback" && fallbackTextareaRef.current) {
            fallbackTextareaRef.current.focus();
            fallbackTextareaRef.current.select();
        }
    }, [copyStatus]);

    const resetToIdle = useCallback(() => {
        setCopyStatus({ kind: "idle" });
    }, []);

    const copyDisabledReason =
        entries.length === 0
            ? null
            : !band || band.end - band.start + 1 <= 0
              ? "Select at least one message"
              : null;

    // ─── The copy action ─────────────────────────────────────────────────
    const handleCopy = useCallback(async () => {
        if (!band || entries.length === 0) return;
        const rangeEntries = entries.slice(band.start, band.end + 1);
        if (rangeEntries.length === 0) return;

        const meta: TranscriptMeta = {
            patientName,
            patientEmail,
            rangeStartMs: rangeEntries[0].timestampMs,
            rangeEndMs: rangeEntries[rangeEntries.length - 1].timestampMs,
            exportedAtMs: Date.now(),
            exportedByEmail: currentUserEmail,
            messageCount: rangeEntries.length,
        };

        // CRITICAL ORDERING: html/text are built synchronously from data
        // already sitting in `entries` (state, in memory — no I/O). Nothing
        // above this line awaits anything, and nothing may be added above
        // it that does. navigator.clipboard.write must run inside the same
        // task as the click event; Safari revokes the "user gesture" flag
        // the instant this handler crosses a microtask/await boundary, and
        // a clipboard write outside the gesture fails silently. Do NOT
        // "clean this up" by hoisting an await (e.g. re-fetching, or
        // awaiting anything) above the copyTranscriptToClipboard call.
        const html = buildTranscriptHtml(rangeEntries, meta);
        const text = buildTranscriptText(rangeEntries, meta);

        setCopyStatus({ kind: "copying" });
        const result = await copyTranscriptToClipboard(html, text);

        if (!result.ok) {
            // Every clipboard tier failed (e.g. permission denied). Fall
            // back to a manually-selectable textarea rather than dead-
            // ending the export.
            setCopyStatus({ kind: "fallback", text });
            return;
        }

        setCopyStatus({
            kind: "copied",
            flavor: result.flavor === "plain" ? "plain" : "rich",
            count: rangeEntries.length,
        });

        const firstEntry = rangeEntries[0];
        const lastEntry = rangeEntries[rangeEntries.length - 1];

        try {
            const recordResult = await recordTranscriptExport({
                chatId,
                firstMessageId: firstEntry.messageId,
                lastMessageId: lastEntry.messageId,
            });
            // Both the local display and the parent take the SERVER's
            // stored watermark, not this range's end. The function applies a
            // monotonic guard, so re-exporting an older range leaves the
            // stored value untouched — reporting lastEntry.timestampMs here
            // would regress the header's "Last exported" line and contradict
            // what the backend actually kept.
            setWatermarkMs(recordResult.lastTranscriptExportedAtMs);
            onExported(recordResult.lastTranscriptExportedAtMs);
        } catch {
            // The copy already succeeded — the user has the transcript in
            // hand. This must never be reported as a copy failure.
            setCopyStatus({
                kind: "record-failed",
                count: rangeEntries.length,
            });
            return;
        }

        window.setTimeout(() => {
            setCopyStatus((prev) =>
                prev.kind === "copied" ? { kind: "idle" } : prev
            );
        }, 2000);
    }, [
        band,
        entries,
        patientName,
        patientEmail,
        currentUserEmail,
        chatId,
        onExported,
        setWatermarkMs,
    ]);

    return {
        copyStatus,
        fallbackTextareaRef,
        handleCopy,
        resetToIdle,
        copyDisabledReason,
    };
}
