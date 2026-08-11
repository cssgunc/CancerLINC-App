import { useCallback, useEffect, useState } from "react";
import type { TranscriptEntry } from "~/services/transcript_format";
import { fetchTranscriptMessages } from "~/services/transcript_service";

interface UseTranscriptEntriesArgs {
    open: boolean;
    chatId: string;
    // Fired synchronously at the start of every fetch (open, chatId change,
    // or retry) — owned by useTranscriptCopy, so a stale "Copied!"/fallback
    // banner never survives into a freshly (re)loaded transcript.
    onFetchStart: () => void;
    // Fired synchronously in the same fetch .then() as the entries/loading
    // state updates below (not from a later effect), so the initial band
    // selection lands in the SAME render as the entries themselves — owned
    // by useTranscriptSelection.
    onEntriesLoaded: (entries: TranscriptEntry[]) => void;
    // Fired on fetch failure so the selection hook can clear a stale band.
    onFetchError: () => void;
}

/**
 * Owns the one-shot transcript fetch lifecycle: entries, loading, fetchError,
 * hitLimit, and a manual retry trigger. Mirrors useChat.ts's split — this
 * hook owns the fetch, the dialog shell owns the UI built from it.
 */
export function useTranscriptEntries({
    open,
    chatId,
    onFetchStart,
    onEntriesLoaded,
    onFetchError,
}: UseTranscriptEntriesArgs) {
    const [entries, setEntries] = useState<TranscriptEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [hitLimit, setHitLimit] = useState(false);
    const [retryToken, setRetryToken] = useState(0);

    // Fetch is intentionally NOT keyed on lastExportedAtMs — this effect
    // owns the one-shot message fetch, and re-running it every time the
    // parent's watermark prop changes (including from our own onExported
    // call) would refetch and reset the user's in-progress selection for no
    // reason. retryToken is the only manual re-trigger.
    //
    // onFetchStart/onEntriesLoaded/onFetchError must be stable (their
    // caller wraps them in useCallback with empty deps) — if they weren't,
    // adding them here would risk exactly the refetch-on-every-render bug
    // this comment warns against.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        setLoading(true);
        setFetchError(null);
        onFetchStart();

        fetchTranscriptMessages(chatId)
            .then((res) => {
                if (cancelled) return;
                setEntries(res.entries);
                setHitLimit(res.hitLimit);
                setLoading(false);
                onEntriesLoaded(res.entries);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setLoading(false);
                setEntries([]);
                setFetchError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load messages."
                );
                onFetchError();
            });

        return () => {
            cancelled = true;
        };
        // Deliberately not keyed on lastExportedAtMs (see above): a watermark
        // arriving mid-session must not refetch and blow away the user's
        // in-progress selection.
    }, [open, chatId, retryToken, onFetchStart, onEntriesLoaded, onFetchError]);

    const retry = useCallback(() => setRetryToken((t) => t + 1), []);

    return { entries, loading, fetchError, hitLimit, retry };
}
