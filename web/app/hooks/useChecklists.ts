import { useEffect, useState } from "react";
import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    query,
    runTransaction,
    serverTimestamp,
    updateDoc,
    where,
    type DocumentData,
} from "firebase/firestore";
import { db } from "~/services/firebase_app";
import type { Checklist, ChecklistItem } from "~/types/checklist";

function checklistsCollection(patientId: string) {
    return collection(db, "checklists", patientId, "user_checklists");
}

function checklistDoc(patientId: string, checklistId: string) {
    return doc(db, "checklists", patientId, "user_checklists", checklistId);
}

/**
 * Items are stored as an untyped array, and the mobile app has written them for
 * longer than this console has read them, so anything malformed is dropped
 * rather than trusted.
 */
function readChecklistItems(data: DocumentData | undefined): ChecklistItem[] {
    const rawItems = Array.isArray(data?.items)
        ? (data.items as unknown[])
        : [];

    return rawItems
        .filter(
            (item): item is Record<string, unknown> =>
                typeof item === "object" && item !== null
        )
        .map((item) => ({
            text: (item.text as string) ?? "",
            checked: (item.checked as boolean) ?? false,
        }));
}

function sortTimeOf(checklist: Checklist): number {
    return (
        checklist.updatedAt?.toMillis() ?? checklist.createdAt?.toMillis() ?? 0
    );
}

/**
 * Raised when the checklist changed underneath an in-flight edit — the patient
 * checked something off on mobile between render and save. The caller's index
 * no longer points at the item they targeted, so the write is abandoned instead
 * of applied to the wrong row.
 */
export class ChecklistConflictError extends Error {
    constructor(
        message = "This checklist changed while you were editing it. Your change was not saved — please try again."
    ) {
        super(message);
        this.name = "ChecklistConflictError";
    }
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

                    return {
                        id: d.id,
                        userId: (data.userId as string) ?? patientId,
                        title: (data.title as string) ?? "",
                        subtitle: (data.subtitle as string) ?? "",
                        archived: (data.archived as boolean) ?? false,
                        items: readChecklistItems(data),
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
    await updateDoc(checklistDoc(patientId, checklistId), {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Checklists are archived rather than deleted: the mobile app streams on
 * `archived == false`, so this hides the checklist from the patient while
 * keeping their history intact.
 */
export async function archiveChecklist(
    patientId: string,
    checklistId: string
): Promise<void> {
    await updateDoc(checklistDoc(patientId, checklistId), {
        archived: true,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Items live in an array on the checklist document, so every item mutation is a
 * rewrite of the whole array. Running it in a transaction means the rewrite is
 * built from the server's copy rather than the one this admin last rendered,
 * so a concurrent edit from the patient's phone is preserved instead of
 * overwritten.
 */
async function mutateChecklistItems(
    patientId: string,
    checklistId: string,
    mutate: (items: ChecklistItem[]) => ChecklistItem[]
): Promise<void> {
    const ref = checklistDoc(patientId, checklistId);

    await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) {
            throw new ChecklistConflictError(
                "This checklist no longer exists."
            );
        }

        const items = mutate(readChecklistItems(snapshot.data()));
        transaction.update(ref, {
            items: items.map((item) => ({
                text: item.text,
                checked: item.checked,
            })),
            updatedAt: serverTimestamp(),
        });
    });
}

/**
 * Items have no stable ids, so an index is only meaningful alongside the text
 * the admin saw at that position. If the server disagrees, the list shifted
 * under them and the index would hit the wrong item.
 */
function assertItemUnchanged(
    items: ChecklistItem[],
    index: number,
    expectedText: string
): void {
    if (items[index]?.text !== expectedText) {
        throw new ChecklistConflictError();
    }
}

export async function addChecklistItem(
    patientId: string,
    checklist: Checklist,
    text: string
): Promise<void> {
    // Appending is safe regardless of what else changed, so there is nothing to
    // check against.
    await mutateChecklistItems(patientId, checklist.id, (items) => [
        ...items,
        { text, checked: false },
    ]);
}

export async function editChecklistItem(
    patientId: string,
    checklist: Checklist,
    index: number,
    text: string
): Promise<void> {
    const expectedText = checklist.items[index]?.text ?? "";

    await mutateChecklistItems(patientId, checklist.id, (items) => {
        assertItemUnchanged(items, index, expectedText);
        return items.map((item, i) => (i === index ? { ...item, text } : item));
    });
}

export async function toggleChecklistItem(
    patientId: string,
    checklist: Checklist,
    index: number
): Promise<void> {
    const expectedText = checklist.items[index]?.text ?? "";
    // Derived from what the admin saw, not from the server copy: clicking a
    // box that the patient has since ticked should be a no-op, not a re-toggle
    // back to unchecked.
    const nextChecked = !checklist.items[index]?.checked;

    await mutateChecklistItems(patientId, checklist.id, (items) => {
        assertItemUnchanged(items, index, expectedText);
        return items.map((item, i) =>
            i === index ? { ...item, checked: nextChecked } : item
        );
    });
}

export async function deleteChecklistItem(
    patientId: string,
    checklist: Checklist,
    index: number
): Promise<void> {
    const expectedText = checklist.items[index]?.text ?? "";

    await mutateChecklistItems(patientId, checklist.id, (items) => {
        assertItemUnchanged(items, index, expectedText);
        return items.filter((_, i) => i !== index);
    });
}
