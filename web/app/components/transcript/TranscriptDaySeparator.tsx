import {
    BandEdgePill,
    bandContentOpacityClass,
    bandRowClasses,
    type BandEdgePillProps,
} from "~/components/transcript/TranscriptMessageRow";

interface DaySeparatorProps {
    label: string;
    /** True when this separator's day falls inside the selected band. */
    inRange: boolean;
    isFirstInBand: boolean;
    isLastInBand: boolean;
    startPill?: BandEdgePillProps | null;
    endPill?: BandEdgePillProps | null;
    onSelectDay: () => void;
}

// iMessage-style: just a quiet centered label, no rule. The old full-width
// hairline read as too heavy a divider for what's really a soft grouping
// hint. `relative` + `bandRowClasses` let a day header that falls inside the
// band pick up the same background/rounding as its messages, so the band
// has no holes where a day separator interrupts it.
export default function DaySeparator({
    label,
    inRange,
    isFirstInBand,
    isLastInBand,
    startPill,
    endPill,
    onSelectDay,
}: DaySeparatorProps) {
    return (
        <div
            className={`relative flex items-center justify-center gap-2 px-6 py-3 transition-all duration-200 ${bandRowClasses(inRange, isFirstInBand, isLastInBand)}`}
        >
            <span
                className={`whitespace-nowrap text-xs font-medium uppercase tracking-wide text-[#999999] transition-opacity ${bandContentOpacityClass(inRange)}`}
            >
                {label}
            </span>
            {/* Deliberately NOT wrapped in bandContentOpacityClass: this
                button must stay fully legible whether its day is in or out
                of band — see bandRowClasses' comment on TranscriptMessageRow.
                Labeled "just this day" (not "this day") since "this day"
                read as additive — people expected it to add the day to the
                current selection when it actually replaces the whole
                selection. */}
            <button
                type="button"
                onClick={onSelectDay}
                className="rounded-full border border-[#D9D9D9] px-2 py-0.5 text-[10px] font-medium normal-case text-[#666666] transition-colors hover:bg-[#F0F0F0]"
            >
                Select just this day
            </button>
            {startPill && <BandEdgePill edge="start" {...startPill} />}
            {endPill && <BandEdgePill edge="end" {...endPill} />}
        </div>
    );
}
