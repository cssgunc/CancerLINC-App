import { useEffect, useState } from "react";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
} from "firebase/firestore";
import { db } from "~/firebase";
import type { Referral } from "~/types/referral";

/**
 * Real-time hook that fetches non-deleted referrals ordered by dateSubmitted descending.
 */
export function useReferrals() {
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const q = query(
            collection(db, "referrals"),
            where("isDeleted", "==", false),
            orderBy("dateSubmitted", "desc")
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const docs = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                })) as Referral[];
                setReferrals(docs);
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching referrals:", err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return { referrals, loading, error };
}

/**
 * Soft-deletes a referral by setting isDeleted to true.
 */
export async function deleteReferral(referralId: string): Promise<void> {
    const ref = doc(db, "referrals", referralId);
    await updateDoc(ref, { isDeleted: true });
}
