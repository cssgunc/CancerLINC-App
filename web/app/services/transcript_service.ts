import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    Timestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { db, functions } from "./firebase_app";
import type { TranscriptEntry } from "./transcript_format";

// ─── Constants ─────────────────────────────────────────────────────────────

// Cap on how many messages a single transcript export will fetch. This is a
// one-shot read for an email export, not the chat page's live pagination, so
// we deliberately pull a large-but-bounded window in one query rather than
// reusing the chat page's paginated listener state.
export const TRANSCRIPT_FETCH_LIMIT = 1000;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FetchTranscriptMessagesResult {
    entries: TranscriptEntry[];
    hitLimit: boolean;
}

export type SenderIdentity = { name: string; email: string };

export type TranscriptCopyResult = {
    ok: boolean;
    flavor: "rich" | "plain" | "none";
};

export interface RecordTranscriptExportInput {
    chatId: string;
    firstMessageId: string;
    lastMessageId: string;
}

export interface RecordTranscriptExportResult {
    lastTranscriptExportedAtMs: number;
    messageCount: number;
}

// ─── Internal doc shape ────────────────────────────────────────────────────

interface TranscriptMessageDoc {
    senderId?: string;
    senderName?: string;
    content?: string;
    messageType?: "text" | "image";
    imageFileName?: string;
    clientBatchId?: string;
    clientOrder?: number;
    timestamp?: Timestamp;
}

// ─── Fetch ─────────────────────────────────────────────────────────────────

// Sorts the same way the live chat view does: by server timestamp first,
// then by clientBatchId/clientOrder to break ties within a single optimistic
// batch write (e.g. a text + image sent together).
function sortAscending(
    docs: { id: string; data: TranscriptMessageDoc; sortMs: number }[]
) {
    return [...docs].sort((a, b) => {
        if (a.sortMs !== b.sortMs) {
            return a.sortMs - b.sortMs;
        }

        const aBatch = a.data.clientBatchId ?? "";
        const bBatch = b.data.clientBatchId ?? "";
        if (aBatch !== bBatch) {
            return aBatch.localeCompare(bBatch);
        }

        return (a.data.clientOrder ?? 0) - (b.data.clientOrder ?? 0);
    });
}

// One-shot fetch of the most recent TRANSCRIPT_FETCH_LIMIT messages for
// chatId (== the patient's UID), oldest-first. This intentionally does NOT
// reuse the chat page's paginated listener/state — the export dialog needs a
// single consistent snapshot, not a live-updating window.
export async function fetchTranscriptMessages(
    chatId: string
): Promise<FetchTranscriptMessagesResult> {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(
        messagesRef,
        orderBy("timestamp", "desc"),
        limit(TRANSCRIPT_FETCH_LIMIT)
    );

    const snapshot = await getDocs(q);
    const hitLimit = snapshot.docs.length === TRANSCRIPT_FETCH_LIMIT;

    const withTimestamp = snapshot.docs
        .map((docSnap) => ({
            id: docSnap.id,
            data: docSnap.data() as TranscriptMessageDoc,
        }))
        // A message whose serverTimestamp() write hasn't resolved yet reads
        // back as null. Skip it rather than sorting it to the epoch, where
        // it would land at the very top of the transcript.
        .filter((m) => m.data.timestamp != null)
        .map((m) => ({
            ...m,
            sortMs: m.data.timestamp!.toMillis(),
        }));

    const ascending = sortAscending(withTimestamp);

    const senderIds = [...new Set(ascending.map((m) => m.data.senderId ?? ""))];
    const identities = await resolveSenderIdentities(senderIds);

    const entries: TranscriptEntry[] = ascending.map((m) => {
        const senderId = m.data.senderId ?? "";
        const identity = identities[senderId] ?? { name: senderId, email: "" };

        return {
            messageId: m.id,
            senderId,
            // Falls through to a literal rather than "" because an
            // unattributed line in an archived transcript is worse
            // than an explicitly unknown one.
            senderName: m.data.senderName || identity.name || "Unknown sender",
            senderEmail: identity.email,
            timestampMs: m.sortMs,
            content: m.data.content ?? "",
            // messageType is absent on mobile-sent text messages; default to
            // "text" rather than treating the field as required.
            messageType: m.data.messageType ?? "text",
            imageFileName: m.data.imageFileName,
        };
    });

    return { entries, hitLimit };
}

// ─── Sender identity resolution ────────────────────────────────────────────

// Message docs don't carry sender email, so it takes a users/{uid} lookup.
// Staff may read any users doc under current rules. A failed or missing
// lookup degrades to { name: uid, email: "" } — it must never throw, since
// one bad id shouldn't sink the whole transcript export.
export async function resolveSenderIdentities(
    senderIds: string[]
): Promise<Record<string, SenderIdentity>> {
    const distinctIds = [...new Set(senderIds.filter(Boolean))];
    const result: Record<string, SenderIdentity> = {};

    await Promise.all(
        distinctIds.map(async (id) => {
            try {
                const snap = await getDoc(doc(db, "users", id));
                if (!snap.exists()) {
                    result[id] = { name: id, email: "" };
                    return;
                }

                const data = snap.data() as {
                    firstName?: string;
                    lastName?: string;
                    username?: string;
                    email?: string;
                };

                // Never return an empty name — attributing every line is the
                // entire point of a transcript.
                const name =
                    `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim() ||
                    data.username ||
                    data.email ||
                    id;

                result[id] = { name, email: data.email ?? "" };
            } catch {
                result[id] = { name: id, email: "" };
            }
        })
    );

    return result;
}

// ─── Clipboard ─────────────────────────────────────────────────────────────

// CRITICAL: this must be callable synchronously from inside a click handler
// with no awaited network call before the clipboard write. Safari (and other
// WebKit browsers) revoke the "user gesture" flag as soon as a microtask
// boundary crosses an await on something like a Firestore/Functions call, and
// a clipboard write outside a user gesture silently fails. Callers must
// already have html/text in hand (e.g. built earlier in the same handler, or
// from a prior fetch) before calling this — do NOT add an await ahead of the
// clipboard write, and do NOT fetch anything inside this function.
export async function copyTranscriptToClipboard(
    html: string,
    text: string
): Promise<TranscriptCopyResult> {
    // Tier 1: rich clipboard write (HTML + plain-text fallback flavor for
    // whatever the paste target accepts).
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([html], { type: "text/html" }),
                    "text/plain": new Blob([text], { type: "text/plain" }),
                }),
            ]);
            return { ok: true, flavor: "rich" };
        } catch {
            // Fall through to the next tier.
        }
    }

    // Tier 2: plain-text clipboard write.
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return { ok: true, flavor: "plain" };
        } catch {
            // Fall through to the next tier.
        }
    }

    // Tier 3: legacy hidden-textarea + execCommand fallback for browsers
    // without (or refusing) the async Clipboard API.
    if (
        typeof document !== "undefined" &&
        typeof document.execCommand === "function"
    ) {
        try {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.top = "0";
            textarea.style.left = "-9999px";
            document.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);
            const succeeded = document.execCommand("copy");
            document.body.removeChild(textarea);
            if (succeeded) {
                return { ok: true, flavor: "plain" };
            }
        } catch {
            // Fall through to the final tier.
        }
    }

    // Tier 4: every fallback failed. Never throw — the UI falls back to a
    // manual-select textarea as the last resort.
    return { ok: false, flavor: "none" };
}

// ─── Callable wrapper ──────────────────────────────────────────────────────

const _recordTranscriptExport = httpsCallable<
    RecordTranscriptExportInput,
    RecordTranscriptExportResult
>(functions, "recordTranscriptExport");

// The client sends only the two endpoint message ids — the function derives
// the exported-at timestamp and message count server-side so an untrusted
// client value can't poison the watermark used to gate re-export prompts.
export async function recordTranscriptExport(
    input: RecordTranscriptExportInput
): Promise<RecordTranscriptExportResult> {
    const result = await _recordTranscriptExport(input);
    return result.data;
}
