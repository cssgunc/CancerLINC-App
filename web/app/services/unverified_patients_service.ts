import {
    collection,
    doc,
    getCountFromServer,
    getDocs,
    type DocumentData,
    type DocumentSnapshot,
    type QueryConstraint,
    type QueryDocumentSnapshot,
    limit,
    orderBy,
    query,
    startAfter,
    Timestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { db } from "./firebase_app";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UnverifiedPatient = {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    isBanned: boolean;
    isVerified: boolean;
};

export type PatientCategory = "verified" | "unverified" | "rejected";

export type StatusChecks = {
    verified: boolean;
    unverified: boolean;
    rejected: boolean;
};

export type VerificationCounts = {
    pending: number;
    verified: number;
    rejected: number;
    unverified: number;
};

// Opaque pagination cursor — callers pass it back into fetchPatientsPage as
// `afterDoc` without needing to know it's a Firestore DocumentSnapshot.
export type PageCursor = DocumentSnapshot;

export type PatientsPageResult = {
    patients: UnverifiedPatient[];
    hasNextPage: boolean;
    lastConsumedDoc?: PageCursor;
};

export function getPatientCategory(p: UnverifiedPatient): PatientCategory {
    if (p.isBanned) return "rejected";
    if (p.isVerified) return "verified";
    return "unverified";
}

// ─── Search helpers (prefix-range search for Firestore) ──────────────────────
// Mirrors the same helpers in _index.tsx; reuses existing indexes
// (role, lastNameLower) and (role, firstName)

function prefixRange(s: string): [string, string] {
    const lower = s.toLowerCase();
    const upper =
        lower.slice(0, -1) +
        String.fromCharCode(lower.charCodeAt(lower.length - 1) + 1);
    return [lower, upper];
}

function prefixRangeExactCase(s: string): [string, string] {
    const upper =
        s.slice(0, -1) + String.fromCharCode(s.charCodeAt(s.length - 1) + 1);
    return [s, upper];
}

function firstNameQueryVariants(value: string): string[] {
    const titleCase = value.charAt(0).toUpperCase() + value.slice(1);
    return [...new Set([value, titleCase])].filter(Boolean);
}

function docToPatient(
    d: QueryDocumentSnapshot<DocumentData>
): UnverifiedPatient {
    const data = d.data();
    const email = (data.email as string) || "";
    return {
        id: d.id,
        name:
            `${(data.firstName as string) ?? ""} ${(data.lastName as string) ?? ""}`.trim() ||
            email ||
            d.id,
        email,
        phoneNumber: (data.phoneNumber as string) || "",
        isBanned: data.isBanned === true,
        isVerified: data.isVerified === true,
    };
}

// ─── Counts ────────────────────────────────────────────────────────────────────
// "unverified" (non-verified, non-banned) is derived as pending - rejected
// rather than queried directly, because legacy patient docs often have no
// `isBanned` field at all — Firestore equality filters never match documents
// missing the filtered field, so where("isBanned", "==", false) silently
// excludes them.

export async function fetchVerificationCounts(): Promise<VerificationCounts> {
    const usersRef = collection(db, "users");
    const [pending, verified, rejected] = await Promise.all([
        getCountFromServer(
            query(
                usersRef,
                where("role", "==", "patient"),
                where("isVerified", "==", false)
            )
        ),
        getCountFromServer(
            query(
                usersRef,
                where("role", "==", "patient"),
                where("isVerified", "==", true)
            )
        ),
        getCountFromServer(
            query(
                usersRef,
                where("role", "==", "patient"),
                where("isBanned", "==", true)
            )
        ),
    ]);

    const pendingN = pending.data().count;
    const rejectedN = rejected.data().count;
    return {
        pending: pendingN,
        verified: verified.data().count,
        rejected: rejectedN,
        unverified: pendingN - rejectedN,
    };
}

// ─── Search mode ────────────────────────────────────────────────────────────
// No isVerified/isBanned filter — the caller shows all categories and
// filters status client-side.

export async function searchPatients(
    searchQuery: string,
    pageSize: number
): Promise<UnverifiedPatient[]> {
    const usersRef = collection(db, "users");
    const [lo, hi] = prefixRange(searchQuery);
    const patientQueries = [
        getDocs(
            query(
                usersRef,
                where("role", "==", "patient"),
                where("lastNameLower", ">=", lo),
                where("lastNameLower", "<", hi),
                orderBy("lastNameLower"),
                limit(pageSize)
            )
        ),
    ];

    for (const variant of firstNameQueryVariants(searchQuery)) {
        const [firstLo, firstHi] = prefixRangeExactCase(variant);
        patientQueries.push(
            getDocs(
                query(
                    usersRef,
                    where("role", "==", "patient"),
                    where("firstName", ">=", firstLo),
                    where("firstName", "<", firstHi),
                    orderBy("firstName"),
                    limit(pageSize)
                )
            )
        );
    }

    const patientSnaps = await Promise.all(patientQueries);

    const seen = new Set<string>();
    const merged = patientSnaps
        .flatMap((snap) => snap.docs)
        .filter((d) => {
            if (seen.has(d.id)) return false;
            seen.add(d.id);
            return true;
        })
        .sort((a, b) => {
            const aLast = String(a.data().lastName ?? "");
            const bLast = String(b.data().lastName ?? "");
            return aLast.localeCompare(bLast);
        });

    return merged.map(docToPatient);
}

// ─── Cursor-pagination mode ────────────────────────────────────────────────
// The Firestore query itself only narrows by role, ordered by lastName
// (existing (role, lastName) index) — it does NOT filter by verification
// status, because a composite index covering every status-checkbox
// combination isn't available. Instead we scan raw pages in lastName order
// and keep fetching additional batches, filtering each one by the active
// status checkboxes, until we've accumulated a full page of *matching*
// results (or run out of data). This avoids the old bug where a single raw
// page was fetched and then filtered, which could yield far fewer than
// `pageSize` visible rows even though more matches existed on later raw
// pages.
//
// `afterDoc` is the last raw doc consumed by the previous page (tracked by
// the caller); `shouldAbort` lets the caller bail out early (e.g. because
// its effect was cancelled) without wasting further batch fetches.

export async function fetchPatientsPage(
    params: {
        pageSize: number;
        statusChecks: StatusChecks;
        afterDoc?: PageCursor;
    },
    shouldAbort?: () => boolean
): Promise<PatientsPageResult> {
    const { pageSize, statusChecks, afterDoc } = params;

    if (
        !statusChecks.verified &&
        !statusChecks.unverified &&
        !statusChecks.rejected
    ) {
        return { patients: [], hasNextPage: false };
    }

    const usersRef = collection(db, "users");
    const BATCH_SIZE = Math.max(pageSize, 50);
    const MAX_BATCHES = 40; // safety cap (~2000+ docs scanned)
    const target = pageSize + 1; // +1 lets us detect a next page

    let lastRawDoc: DocumentSnapshot | undefined = afterDoc;
    const matches: { doc: DocumentSnapshot; patient: UnverifiedPatient }[] = [];
    let exhausted = false;

    for (
        let batch = 0;
        batch < MAX_BATCHES && matches.length < target;
        batch++
    ) {
        const constraints: QueryConstraint[] = [
            where("role", "==", "patient"),
            orderBy("lastName"),
        ];
        if (lastRawDoc) {
            constraints.push(startAfter(lastRawDoc));
        }
        constraints.push(limit(BATCH_SIZE));

        const snap = await getDocs(query(usersRef, ...constraints));
        if (shouldAbort?.()) {
            return { patients: [], hasNextPage: false };
        }

        if (snap.docs.length === 0) {
            exhausted = true;
            break;
        }

        for (const d of snap.docs) {
            lastRawDoc = d;
            const patient = docToPatient(d);
            if (statusChecks[getPatientCategory(patient)]) {
                matches.push({ doc: d, patient });
                if (matches.length === target) break;
            }
        }

        if (snap.docs.length < BATCH_SIZE) {
            exhausted = true;
            break;
        }
    }

    const hasNext = matches.length > pageSize;
    const visible = hasNext ? matches.slice(0, pageSize) : matches;

    return {
        patients: visible.map((m) => m.patient),
        hasNextPage: hasNext,
        lastConsumedDoc:
            exhausted || visible.length > 0 ? lastRawDoc : undefined,
    };
}

// ─── Verification actions ──────────────────────────────────────────────────

export async function acceptPatient(id: string): Promise<void> {
    await updateDoc(doc(db, "users", id), {
        isVerified: true,
        isBanned: false,
        updatedAt: Timestamp.now(),
    });
}

export async function rejectPatient(id: string): Promise<void> {
    await updateDoc(doc(db, "users", id), {
        isBanned: true,
        isVerified: false,
        updatedAt: Timestamp.now(),
    });
}
