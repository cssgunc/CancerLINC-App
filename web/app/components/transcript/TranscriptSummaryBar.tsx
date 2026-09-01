import { useMemo } from "react";
import type { TranscriptEntry } from "~/services/transcript_format";
import {
    formatTranscriptTimestampShort,
    pluralizeMessages,
} from "~/services/transcript_format";
import type { Band } from "~/utils/transcript_range";

interface TranscriptSummaryBarProps {
    entries: TranscriptEntry[];
    band: Band | null;
    patientName: string;
    patientEmail: string;
}

// Bottom bar: the derived selection facts (count, range, sender breakdown,
// image note) that used to live in the left rail. It's meant to be rendered
// as a flex sibling of the scroll area above it (not an overlay), so the
// transcript scrolls to make room for it rather than being covered by it.
export default function TranscriptSummaryBar({
    entries,
    band,
    patientName,
    patientEmail,
}: TranscriptSummaryBarProps) {
    const summary = useMemo(() => {
        if (!band) return null;
        const rangeEntries = entries.slice(band.start, band.end + 1);
        const count = rangeEntries.length;
        if (count === 0) {
            return {
                count: 0,
                rangeStartMs: null as number | null,
                rangeEndMs: null as number | null,
                patientCount: 0,
                staffCount: 0,
                imageCount: 0,
            };
        }
        const patientCount = rangeEntries.filter(
            (e) =>
                (patientEmail && e.senderEmail === patientEmail) ||
                (!e.senderEmail && e.senderName === patientName)
        ).length;
        const imageCount = rangeEntries.filter(
            (e) => e.messageType === "image"
        ).length;
        return {
            count,
            rangeStartMs: rangeEntries[0].timestampMs,
            rangeEndMs: rangeEntries[count - 1].timestampMs,
            patientCount,
            staffCount: count - patientCount,
            imageCount,
        };
    }, [entries, band, patientEmail, patientName]);

    return (
        <div className="shrink-0 border-t border-[#D9D9D9] bg-[#FAFAFA] px-4 py-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#666666]">
                <span aria-live="polite" className="font-semibold text-black">
                    {pluralizeMessages(summary?.count ?? 0)}
                </span>
                {summary && summary.count > 0 && (
                    <>
                        <span>
                            {formatTranscriptTimestampShort(
                                summary.rangeStartMs!
                            )}{" "}
                            →{" "}
                            {formatTranscriptTimestampShort(
                                summary.rangeEndMs!
                            )}
                        </span>
                        <span>
                            {summary.patientCount} from {patientName} ·{" "}
                            {summary.staffCount} from staff
                        </span>
                    </>
                )}
                {summary && summary.imageCount > 0 && (
                    <span className="text-[#999999]">
                        {summary.imageCount} image attachment
                        {summary.imageCount === 1 ? "" : "s"} (not included)
                    </span>
                )}
            </div>
        </div>
    );
}
