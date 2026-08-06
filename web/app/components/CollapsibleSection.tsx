import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
    title: React.ReactNode;
    /** Rendered to the right of the title, only while expanded. */
    actions?: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

/**
 * Titled white card that can be collapsed to just its header. Expanded
 * sections grow to share the available column height; collapsed ones shrink.
 */
export default function CollapsibleSection({
    title,
    actions,
    defaultOpen = true,
    children,
}: CollapsibleSectionProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div
            className={`flex min-h-0 flex-col ${open ? "flex-1" : "shrink-0"}`}
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    aria-expanded={open}
                    className="flex min-w-0 items-center gap-2 text-left text-black transition-colors hover:text-gray-600"
                >
                    <ChevronDown
                        className={`h-5 w-5 shrink-0 transition-transform ${
                            open ? "" : "-rotate-90"
                        }`}
                    />
                    <h2 className="truncate text-[24px] font-semibold leading-tight">
                        {title}
                    </h2>
                </button>
                {open && actions ? (
                    <div className="shrink-0">{actions}</div>
                ) : null}
            </div>

            {open ? (
                <section className="flex flex-1 flex-col overflow-hidden bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
                    {children}
                </section>
            ) : null}
        </div>
    );
}
