import type { KeyboardEvent } from "react";
import type { TranscriptEntry } from "~/services/transcript_format";
import { formatTranscriptTimestampShort } from "~/services/transcript_format";
import type { Edge } from "~/hooks/useTranscriptSelection";

// Shared row background/rounding for MessageRow and DaySeparator so the band
// reads as one seamless, holeless region: touching in-band rows share the
// same translucent background, and only the very first/last row's OUTER
// corners are rounded so interior seams between rows are invisible. Rows
// that are out of the band get a normal all-around rounding instead (there's
// no seam to protect there — nothing to hide, and it looks right under the
// keyboard focus ring).
//
// Deliberately carries NO opacity — dimming out-of-band rows used to live
// here, but CSS opacity applies to an entire subtree, and this class lands
// on the row container that also hosts the Start here/End here ghost
// buttons (and the day separator's "Select just this day" button). Putting
// dimming here would dim those buttons too, even when revealed at full
// strength on hover/focus. Dimming instead lives on the specific text/
// bubble elements via bandContentOpacityClass below — see MessageRow and
// DaySeparator for where it's applied.
//
// IMPORTANT: all vertical/horizontal spacing between and within rows must
// come from padding *inside* a row's own classes, never from a margin or a
// `gap`/`space-y-*` on the list. Adjacent in-band rows have to visually
// *touch* for their backgrounds to merge into one region — any inter-row
// gap would show as a seam (or a hole) in the band. If you're tempted to
// "tidy" row spacing into `space-y-*`, don't: it will silently break this.
export function bandRowClasses(
    inRange: boolean,
    isFirstInBand: boolean,
    isLastInBand: boolean
): string {
    if (!inRange) return "rounded-2xl";
    // Alpha kept low (rather than e.g. /60) so message text stays legible
    // while the band is still an obviously contiguous highlighted region.
    return `bg-indigo-50/40 ${
        isFirstInBand ? "rounded-t-2xl" : ""
    } ${isLastInBand ? "rounded-b-2xl" : ""}`.trim();
}

// Dimming for a row's own content (header text, bubble, day-separator
// label) when its row is out of band. Applied directly to those elements —
// never to the row container itself — so it never touches the ghost
// buttons that live alongside them. See the note on bandRowClasses above.
export function bandContentOpacityClass(inRange: boolean): string {
    return inRange ? "opacity-100" : "opacity-40";
}

// Configuration for an edge pill — everything except which edge it is
// (start/end determines label + top/bottom placement). Handed down from the
// dialog shell to whichever row is currently first/last-in-band; see
// startPillProps/endPillProps in TranscriptExportDialog.
export interface BandEdgePillProps {
    valueText: string;
    onKeyDown: (e: KeyboardEvent) => void;
}

// The band edges as absolutely-positioned overlays on the first/last
// in-band row's top/bottom edge — NOT their own row in the list. Because
// they consume no layout space, moving an edge (which just re-targets which
// row renders a pill) causes zero reflow of the message list. Purely a
// visual boundary + keyboard target, same as before: no drag handling here
// on purpose — the click-to-move and ghost-button paths are the only ways
// the band edges move.
export function BandEdgePill({
    edge,
    valueText,
    onKeyDown,
}: BandEdgePillProps & { edge: Edge }) {
    return (
        <div
            role="slider"
            tabIndex={0}
            aria-valuetext={valueText}
            aria-orientation="vertical"
            onKeyDown={onKeyDown}
            className={`absolute left-1/2 z-10 -translate-x-1/2 cursor-default whitespace-nowrap rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                edge === "start" ? "-top-3" : "-bottom-3"
            }`}
        >
            {edge === "start" ? "Start of export" : "End of export"}
        </div>
    );
}

interface MessageRowProps {
    entry: TranscriptEntry;
    index: number;
    /** senderId === currentUserId — mirrors MessageBubble/useChat's "sent". */
    isMine: boolean;
    inRange: boolean;
    isFirstInBand: boolean;
    isLastInBand: boolean;
    startPill?: BandEdgePillProps | null;
    endPill?: BandEdgePillProps | null;
    onRowClick: (index: number, shiftKey: boolean) => void;
    onStartHere: (index: number) => void;
    onEndHere: (index: number) => void;
}

// Mirrors the real chat's bubble vocabulary (see MessageBubble.tsx) so this
// preview reads like the conversation it's exporting, while still keeping
// the export-critical sender/timestamp line on screen as a header above the
// bubble. Sender EMAIL is deliberately NOT shown here — it stays in the
// exported transcript (built in transcript_format.ts) and in the patient's
// email in the left rail; this header is UI-only and was too long with it.
export default function MessageRow({
    entry,
    index,
    isMine,
    inRange,
    isFirstInBand,
    isLastInBand,
    startPill,
    endPill,
    onRowClick,
    onStartHere,
    onEndHere,
}: MessageRowProps) {
    const timestampLabel = formatTranscriptTimestampShort(entry.timestampMs);
    return (
        <div
            role="option"
            aria-selected={inRange}
            tabIndex={0}
            onClick={(e) => onRowClick(index, e.shiftKey)}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick(index, e.shiftKey);
                }
            }}
            className={`group relative flex cursor-pointer px-6 py-3 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isMine ? "justify-end" : "justify-start"
            } ${bandRowClasses(inRange, isFirstInBand, isLastInBand)}`}
        >
            <div
                className={`flex max-w-[75%] flex-col ${
                    isMine ? "items-end" : "items-start"
                }`}
            >
                {/* Header line: name · time · Start here/End here. The
                    ghost buttons are laid out inline (not absolutely
                    positioned in the gutter) so they sit right next to the
                    timestamp instead of floating opposite the bubble.
                    `flex-row-reverse` on the "mine" side keeps the name
                    anchored to the row's true right edge — with a plain
                    justify-end the invisible reserved button space would
                    sit at the outer edge instead, leaving the name/time
                    looking detached from it. */}
                <div
                    className={`mb-2 flex items-center gap-1.5 text-xs ${
                        isMine ? "flex-row-reverse" : ""
                    }`}
                >
                    <span
                        className={`min-w-0 truncate font-medium text-[#666666] transition-opacity ${bandContentOpacityClass(inRange)}`}
                    >
                        {entry.senderName}
                    </span>
                    <span
                        className={`shrink-0 whitespace-nowrap font-normal text-[#999999] transition-opacity ${bandContentOpacityClass(inRange)}`}
                    >
                        · {timestampLabel}
                    </span>
                    {/* Reserved via opacity (never hidden/flex) in both
                        states so revealing on hover/focus never nudges the
                        name or timestamp — a width/display toggle here
                        would shift everything to its left.
                        Deliberately NOT wrapped in bandContentOpacityClass:
                        these buttons must render at full strength whenever
                        revealed, in or out of band — see bandRowClasses'
                        comment. Revealed on `focus-visible` (via
                        `:has()`), not plain `focus-within`, so a mouse
                        click that leaves focus on the row doesn't leave
                        them stuck visible — only real keyboard focus
                        (Tab) does, keeping them keyboard-reachable. */}
                    <span
                        className={`flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 ${
                            isMine ? "flex-row-reverse" : ""
                        }`}
                    >
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onStartHere(index);
                            }}
                            className="rounded-full border border-[#D9D9D9] bg-white px-2 py-0.5 text-[10px] font-medium text-[#666666] transition-colors hover:bg-[#F0F0F0]"
                        >
                            Start here
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEndHere(index);
                            }}
                            className="rounded-full border border-[#D9D9D9] bg-white px-2 py-0.5 text-[10px] font-medium text-[#666666] transition-colors hover:bg-[#F0F0F0]"
                        >
                            End here
                        </button>
                    </span>
                </div>
                <div
                    className={`rounded-2xl px-4 py-3 text-[16px] transition-opacity ${bandContentOpacityClass(inRange)} ${
                        isMine
                            ? "bg-black text-white"
                            : "bg-[#F0F0F0] text-black"
                    }`}
                >
                    {entry.messageType === "image"
                        ? `[Image attachment: ${entry.imageFileName ?? "image"}]`
                        : entry.content}
                </div>
            </div>
            {startPill && <BandEdgePill edge="start" {...startPill} />}
            {endPill && <BandEdgePill edge="end" {...endPill} />}
        </div>
    );
}
