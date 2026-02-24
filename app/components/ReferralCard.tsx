import React from "react";
import { Trash2 } from "lucide-react";
import type { Referral } from "~/types/referral";

interface ReferralCardProps {
    referral: Referral;
    onDelete: (id: string) => void;
}

/** Map status values to badge colour classes. */
function statusStyles(status: string): string {
    switch (status.toLowerCase()) {
        case "approved":
        case "completed":
            return "bg-green-50 text-green-700 ring-1 ring-green-200";
        case "pending":
            return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
        case "rejected":
        case "cancelled":
            return "bg-red-50 text-red-700 ring-1 ring-red-200";
        default:
            return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
    }
}

/** Format a Firestore Timestamp to a readable date string. */
function formatTimestamp(ts: Referral["dateSubmitted"]): string {
    if (!ts || !ts.toDate) return "—";
    return ts.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    });
}

export default function ReferralCard({
    referral,
    onDelete,
}: ReferralCardProps) {
    return (
        <article
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm
                       transition hover:shadow-md"
        >
            {/* Header row: type + status badge + delete */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-gray-900">
                        {referral.type}
                    </h3>
                    <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5
                                    text-xs font-medium capitalize ${statusStyles(referral.status)}`}
                    >
                        {referral.status}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={() => onDelete(referral.id)}
                    aria-label={`Delete ${referral.type} referral`}
                    className="rounded-lg p-1.5 text-gray-400 transition
                               hover:bg-red-50 hover:text-red-600
                               focus-visible:outline-2 focus-visible:outline-offset-2
                               focus-visible:outline-red-500"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            {/* Notes */}
            {referral.notes && (
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                    {referral.notes}
                </p>
            )}

            {/* Footer: date */}
            <p className="mt-4 text-xs text-gray-400">
                Submitted {formatTimestamp(referral.dateSubmitted)}
            </p>
        </article>
    );
}
