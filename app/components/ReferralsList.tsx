import React from "react";
import type { Referral } from "~/types/referral";
import ReferralCard from "~/components/ReferralCard";

interface ReferralsListProps {
    referrals: Referral[];
    onDelete: (id: string) => void;
}

export default function ReferralsList({
    referrals,
    onDelete,
}: ReferralsListProps) {
    if (referrals.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16">
                <p className="text-sm text-gray-500">No referrals found.</p>
            </div>
        );
    }

    return (
        /* Scrollable after ~4 cards (each ≈ 140 px + gap) */
        <div className="max-h-[640px] space-y-4 overflow-y-auto pr-1">
            {referrals.map((referral) => (
                <ReferralCard
                    key={referral.id}
                    referral={referral}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}
