import React from "react";
import ReferralsList from "~/components/ReferralsList";
import { useReferrals, deleteReferral } from "~/hooks/useReferrals";

export function meta() {
    return [
        { title: "Referrals — CancerLINC" },
        { name: "description", content: "View and manage patient referrals." },
    ];
}

export default function ReferralsPage() {
    const { referrals, loading, error } = useReferrals();

    const handleDelete = async (id: string) => {
        try {
            await deleteReferral(id);
        } catch (err) {
            console.error("Failed to delete referral:", err);
        }
    };

    return (
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
            <header className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    Referrals
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    Browse and manage patient referrals.
                </p>
            </header>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div
                        className="h-8 w-8 animate-spin rounded-full border-4
                                   border-gray-200 border-t-indigo-600"
                        role="status"
                        aria-label="Loading referrals"
                    />
                </div>
            )}

            {error && (
                <div
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    role="alert"
                >
                    Failed to load referrals: {error}
                </div>
            )}

            {!loading && !error && (
                <ReferralsList referrals={referrals} onDelete={handleDelete} />
            )}
        </main>
    );
}
