import { useEffect, useState } from "react";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { db } from "~/services/firebase_app";
import type { Checklist, ChecklistItem } from "~/types/checklist";

function checklistsCollection(patientId: string) {
    return collection(db, "checklists", patientId, "user_checklists");
}

function sortTimeOf(checklist: Checklist): number {
    return (
        checklist.updatedAt?.toMillis() ?? checklist.createdAt?.toMillis() ?? 0
    );
}

/**
 * Live view of a patient's active (non-archived) checklists.
 *
 * Sorting is done client-side to match the mobile app and to avoid needing a
 * composite index for `archived` + `updatedAt`.
 */
export function useChecklists(patientId: string) {
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!patientId) {
            setChecklists([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = query(
            checklistsCollection(patientId),
            where("archived", "==", false)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const next = snapshot.docs.map((d) => {
                    const data = d.data();
                    const rawItems = Array.isArray(data.items)
                        ? (data.items as unknown[])
                        : [];

                    return {
                        id: d.id,
                        userId: (data.userId as string) ?? patientId,
                        title: (data.title as string) ?? "",
                        subtitle: (data.subtitle as string) ?? "",
                        archived: (data.archived as boolean) ?? false,
                        items: rawItems
                            .filter(
                                (item): item is Record<string, unknown> =>
                                    typeof item === "object" && item !== null
                            )
                            .map((item) => ({
                                text: (item.text as string) ?? "",
                                checked: (item.checked as boolean) ?? false,
                            })),
                        createdAt: data.createdAt,
                        updatedAt: data.updatedAt,
                    } as Checklist;
                });

                next.sort((a, b) => sortTimeOf(b) - sortTimeOf(a));
                setChecklists(next);
                setError(null);
                setLoading(false);
            },
            (err: unknown) => {
                console.error("Error fetching checklists:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [patientId]);

    return { checklists, loading, error };
}

export async function addChecklist(
    patientId: string,
    data: { title: string; subtitle?: string; items?: ChecklistItem[] }
): Promise<string> {
    const docRef = await addDoc(checklistsCollection(patientId), {
        userId: patientId,
        title: data.title,
        subtitle: data.subtitle ?? "",
        items: data.items ?? [],
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
}

export async function updateChecklistDetails(
    patientId: string,
    checklistId: string,
    data: { title?: string; subtitle?: string }
): Promise<void> {
    await updateDoc(
        doc(db, "checklists", patientId, "user_checklists", checklistId),
        {
            ...data,
            updatedAt: serverTimestamp(),
        }
    );
}

export async function deleteChecklist(
    patientId: string,
    checklistId: string
): Promise<void> {
    await deleteDoc(
        doc(db, "checklists", patientId, "user_checklists", checklistId)
    );
}

/**
 * Items live in an array on the checklist document, so every item mutation is a
 * rewrite of the whole array. Callers pass the items they last rendered, which
 * means a concurrent edit by another admin can be overwritten.
 */
export async function setChecklistItems(
    patientId: string,
    checklistId: string,
    items: ChecklistItem[]
): Promise<void> {
    await updateDoc(
        doc(db, "checklists", patientId, "user_checklists", checklistId),
        {
            items: items.map((item) => ({
                text: item.text,
                checked: item.checked,
            })),
            updatedAt: serverTimestamp(),
        }
    );
}

export async function addChecklistItem(
    patientId: string,
    checklist: Checklist,
    text: string
): Promise<void> {
    await setChecklistItems(patientId, checklist.id, [
        ...checklist.items,
        { text, checked: false },
    ]);
}

export async function editChecklistItem(
    patientId: string,
    checklist: Checklist,
    index: number,
    text: string
): Promise<void> {
    const items = checklist.items.map((item, i) =>
        i === index ? { ...item, text } : item
    );
    await setChecklistItems(patientId, checklist.id, items);
}

export async function toggleChecklistItem(
    patientId: string,
    checklist: Checklist,
    index: number
): Promise<void> {
    const items = checklist.items.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
    );
    await setChecklistItems(patientId, checklist.id, items);
}

export async function deleteChecklistItem(
    patientId: string,
    checklist: Checklist,
    index: number
): Promise<void> {
    const items = checklist.items.filter((_, i) => i !== index);
    await setChecklistItems(patientId, checklist.id, items);
}
