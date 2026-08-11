import { useEffect, useRef, useState } from "react";
import { formatTranscriptTimestampShort } from "~/services/transcript_format";
import type { QuickRangeMode } from "~/utils/transcript_range";

interface QuickRangeOptionProps {
    label: string;
    selected: boolean;
    disabled?: boolean;
    helperText?: string;
    onSelect: () => void;
}

function QuickRangeOption({
    label,
    selected,
    disabled,
    helperText,
    onSelect,
}: QuickRangeOptionProps) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={onSelect}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selected
                    ? "border-black bg-black/5 font-medium text-black"
                    : "border-[#D9D9D9] text-[#666666] hover:bg-[#F0F0F0]"
            } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
        >
            {label}
            {helperText && (
                <span className="mt-0.5 block text-xs font-normal text-[#999999]">
                    {helperText}
                </span>
            )}
        </button>
    );
}

interface DraftDatetimeInputProps {
    /** The range's actual startMs/endMs, formatted verbatim — exactly what
     * will be exported. Authoritative whenever the user isn't actively
     * editing this field. */
    committedValue: string;
    /** Parses `value`; a no-op if it doesn't yet resolve to a complete,
     * valid datetime (e.g. mid-edit). When it does, sets the range edge to
     * that EXACT millisecond value — never snapped to a message. */
    onCommit: (value: string) => void;
    min?: string;
    max?: string;
}

// A `datetime-local` input can't be a plain controlled input here, even
// though `committedValue` is now the range's raw value (not snapped to any
// message — see the TranscriptRange comment in transcript_range.ts): a
// partially-typed value ("09", mid-segment) never parses to a complete
// datetime, so a controlled onChange has nothing valid to commit and bails —
// React re-renders with the OLD `value`, and the keystroke gets wiped before
// the field can be completed. `datetime-local` is especially sensitive to
// this: re-setting `value` mid-edit resets segment-by-segment typing in
// Chrome.
//
// Fix: this input owns its own draft string, independent of the range.
// `onChange` always writes the raw string to the draft, unconditionally —
// never rejecting or normalizing a keystroke — which is what lets typing
// work at all. The draft is only ever overwritten from `committedValue`
// (a) on blur — and since the range now stores exactly what the user
// committed, verbatim, this is a pure formatting no-op in practice, not a
// snap to some other value — or (b) when the range changes from elsewhere
// (a message click, a quick-range preset, "Select just this day") — and
// even then, only while this input isn't focused, via `focusedRef`, or an
// external change would clobber a keystroke the same way the old
// controlled `value` did.
//
// If you're tempted to simplify this back into a controlled input, don't —
// that's precisely the bug this component exists to avoid. And if you're
// tempted to make onCommit "snap" its value to the nearest message for
// consistency with the old behavior, don't do that either — that's the
// exact bug this whole rework exists to fix.
function DraftDatetimeInput({
    committedValue,
    onCommit,
    min,
    max,
}: DraftDatetimeInputProps) {
    const [draft, setDraft] = useState(committedValue);
    const focusedRef = useRef(false);

    useEffect(() => {
        if (!focusedRef.current) setDraft(committedValue);
    }, [committedValue]);

    return (
        <input
            type="datetime-local"
            value={draft}
            min={min}
            max={max}
            onFocus={() => {
                focusedRef.current = true;
            }}
            onChange={(e) => {
                const value = e.target.value;
                // Always write the raw string, unconditionally — see the
                // comment above. onCommit itself no-ops until `value`
                // parses to a complete datetime, so this is safe to call
                // on every keystroke.
                setDraft(value);
                onCommit(value);
            }}
            onBlur={() => {
                focusedRef.current = false;
                // Re-sync from the range's actual value, so the field never
                // lingers showing a half-typed or rejected string once the
                // user has moved on. Since the range holds exactly what the
                // user committed (no snapping), this only ever reformats —
                // it never rewrites the value to something the user didn't
                // type or pick.
                setDraft(committedValue);
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1 text-sm text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
    );
}

interface TranscriptRangeControlsProps {
    watermarkMs: number | null;
    mode: QuickRangeMode;
    newSinceDisabled: boolean;
    onSelectQuickRange: (mode: Exclude<QuickRangeMode, "custom">) => void;
    onSelectCustomMode: () => void;
    customStartValue: string;
    customEndValue: string;
    onCustomStartChange: (value: string) => void;
    onCustomEndChange: (value: string) => void;
    /** datetime-local strings for the first/last entry timestamps, so the
     * native picker steers users into the conversation's real range. */
    minDatetimeValue?: string;
    maxDatetimeValue?: string;
}

/** Left rail: quick-range radios, plus the Custom From/To datetime-local
 * inputs when "Custom" is selected. */
export default function TranscriptRangeControls({
    watermarkMs,
    mode,
    newSinceDisabled,
    onSelectQuickRange,
    onSelectCustomMode,
    customStartValue,
    customEndValue,
    onCustomStartChange,
    onCustomEndChange,
    minDatetimeValue,
    maxDatetimeValue,
}: TranscriptRangeControlsProps) {
    return (
        <div role="radiogroup" aria-label="Quick ranges" className="space-y-2">
            {watermarkMs != null && (
                <QuickRangeOption
                    label="New since last export"
                    selected={mode === "new"}
                    disabled={newSinceDisabled}
                    helperText={
                        newSinceDisabled
                            ? `No new messages since ${formatTranscriptTimestampShort(watermarkMs)}`
                            : undefined
                    }
                    onSelect={() => onSelectQuickRange("new")}
                />
            )}
            <QuickRangeOption
                label="Everything"
                selected={mode === "everything"}
                onSelect={() => onSelectQuickRange("everything")}
            />
            <QuickRangeOption
                label="Last 7 days"
                selected={mode === "7d"}
                onSelect={() => onSelectQuickRange("7d")}
            />
            <QuickRangeOption
                label="Last 30 days"
                selected={mode === "30d"}
                onSelect={() => onSelectQuickRange("30d")}
            />
            <QuickRangeOption
                label="Custom"
                selected={mode === "custom"}
                onSelect={onSelectCustomMode}
            />
            {mode === "custom" && (
                <div className="space-y-2 rounded-lg border border-[#D9D9D9] bg-[#FAFAFA] p-3">
                    <label className="block text-xs font-medium text-[#666666]">
                        From
                        <DraftDatetimeInput
                            committedValue={customStartValue}
                            onCommit={onCustomStartChange}
                            min={minDatetimeValue}
                            max={maxDatetimeValue}
                        />
                    </label>
                    <label className="block text-xs font-medium text-[#666666]">
                        To
                        <DraftDatetimeInput
                            committedValue={customEndValue}
                            onCommit={onCustomEndChange}
                            min={minDatetimeValue}
                            max={maxDatetimeValue}
                        />
                    </label>
                </div>
            )}
        </div>
    );
}
