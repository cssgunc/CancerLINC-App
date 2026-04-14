import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import {
    collection,
    getCountFromServer,
    getDocs,
    type DocumentSnapshot,
    limit,
    orderBy,
    query,
    startAfter,
    where,
} from "firebase/firestore";
import { db } from "~/services/firebase_app";
// search state lives in the URL so it survives navigating back from a member page

// --- Types ---
type Status = "active" | "follow-up" | "pending";

type Patient = {
    id: string; // Firestore uid
    name: string;
    socialWorker: string;
    lastContact: string | null; // ISO date or null if no contact yet
    status: Status;
};

// --- Constants ---
const PAGE_SIZE = 50;

// --- Utilities ---
function formatDate(iso: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    });
}

function statusLabel(status: Status) {
    switch (status) {
        case "active":
            return "Active";
        case "follow-up":
            return "Follow-up";
        case "pending":
            return "Pending";
    }
}

function statusStyles(status: Status) {
    switch (status) {
        case "active":
            return "bg-green-50 text-green-700 ring-1 ring-green-200";
        case "follow-up":
            return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
        case "pending":
            return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
    }
}

// Firestore prefix-range search: matches names that start with the query string
function prefixRange(s: string): [string, string] {
    const lower = s.toLowerCase();
    const upper =
        lower.slice(0, -1) +
        String.fromCharCode(lower.charCodeAt(lower.length - 1) + 1);
    return [lower, upper];
}

// --- Component ---
export default function HomePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Stat card counts (from aggregation queries — independent of pagination)
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [activeCount, setActiveCount] = useState<number | null>(null);
    const [followUpCount, setFollowUpCount] = useState<number | null>(null);

    // Pagination cursors: stack of "last doc of each page" so we can go back
    const cursorStack = useRef<DocumentSnapshot[]>([]);
    const [page, setPage] = useState(0); // 0-indexed current page
    const [hasNextPage, setHasNextPage] = useState(false);

    // Search value comes from the URL (?q=) — written by the shared TopBar in app_layout
    const query2 = searchParams.get("q") ?? "";
    const [debouncedQuery, setDebouncedQuery] = useState(query2);

    // Debounce the URL search param into the Firestore query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query2.trim().toLowerCase());
        }, 300);
        return () => clearTimeout(timer);
    }, [query2]);

    // Fetch stat card counts once on mount
    useEffect(() => {
        const usersRef = collection(db, "users");
        Promise.all([
            getCountFromServer(query(usersRef, where("role", "==", "patient"))),
            getCountFromServer(
                query(
                    usersRef,
                    where("role", "==", "patient"),
                    where("status", "==", "active")
                )
            ),
            getCountFromServer(
                query(
                    usersRef,
                    where("role", "==", "patient"),
                    where("status", "==", "follow-up")
                )
            ),
        ])
            .then(([total, active, followUp]) => {
                setTotalCount(total.data().count);
                setActiveCount(active.data().count);
                setFollowUpCount(followUp.data().count);
            })
            .catch(() => {
                // Non-critical — stat cards just stay blank
            });
    }, []);

    // Fetch patients whenever page or search changes
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        async function fetchPatients() {
            try {
                const usersRef = collection(db, "users");
                const constraints: Parameters<typeof query>[1][] = [
                    where("role", "==", "patient"),
                ];

                if (debouncedQuery.length > 0) {
                    // Prefix search on lastName (case-insensitive via stored lowercase field)
                    const [lo, hi] = prefixRange(debouncedQuery);
                    constraints.push(where("lastNameLower", ">=", lo));
                    constraints.push(where("lastNameLower", "<", hi));
                    constraints.push(orderBy("lastNameLower"));
                } else {
                    constraints.push(orderBy("lastName"));
                }

                // Pagination cursor
                if (page > 0 && cursorStack.current[page - 1]) {
                    constraints.push(startAfter(cursorStack.current[page - 1]));
                }

                constraints.push(limit(PAGE_SIZE + 1)); // fetch one extra to detect next page

                const snap = await getDocs(query(usersRef, ...constraints));

                if (cancelled) return;

                const hasNext = snap.docs.length > PAGE_SIZE;
                const docs = hasNext
                    ? snap.docs.slice(0, PAGE_SIZE)
                    : snap.docs;

                // Save the last doc of this page as cursor (only once per page)
                if (docs.length > 0 && cursorStack.current.length <= page) {
                    cursorStack.current[page] = docs[docs.length - 1];
                }

                const results: Patient[] = docs.map((d) => {
                    const data = d.data();
                    const firstName = data.firstName ?? "";
                    const lastName = data.lastName ?? "";
                    const ts = data.lastContactTimestamp;
                    return {
                        id: d.id,
                        name: `${firstName} ${lastName}`.trim() || data.email,
                        socialWorker: data.assignedSocialWorkerName ?? "—",
                        lastContact: ts
                            ? ts.toDate().toISOString().split("T")[0]
                            : null,
                        status: (data.status as Status) ?? "pending",
                    };
                });

                setPatients(results);
                setHasNextPage(hasNext);
            } catch (e: unknown) {
                if (!cancelled) {
                    setError("Failed to load patients. Please try again.");
                    console.error(e);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchPatients();
        return () => {
            cancelled = true;
        };
    }, [page, debouncedQuery]);

    // Reset to page 0 when search changes
    useEffect(() => {
        cursorStack.current = [];
        setPage(0);
    }, [debouncedQuery]);

    function goToProfile(id: string) {
        navigate(`/member/${encodeURIComponent(id)}`);
    }

    return (
        <>
            <main className="container mx-auto px-6 py-8">
                <h1 className="text-2xl font-semibold text-gray-900">
                    Patient Dashboard
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-gray-600">
                    Manage and view all patients and their assigned social
                    workers. Click on any patient name to view their detailed
                    profile.
                </p>

                {/* Stat Cards */}
                <section className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard label="Total Patients" value={totalCount} />
                    <StatCard label="Active Cases" value={activeCount} />
                    <StatCard label="Follow-ups Needed" value={followUpCount} />
                </section>

                {/* Table */}
                <section className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 text-left text-sm text-gray-600 select-none">
                                <tr>
                                    <th className="px-6 py-4 font-medium">
                                        Patient Name
                                    </th>
                                    <th className="px-6 py-4 font-medium">
                                        Assigned Social Worker
                                    </th>
                                    <th className="px-6 py-4 font-medium">
                                        Last Contact
                                    </th>
                                    <th className="px-6 py-4 font-medium">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 font-medium">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {loading ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-6 py-12 text-center text-gray-400"
                                        >
                                            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-6 py-10 text-center text-sm text-red-600"
                                        >
                                            {error}
                                        </td>
                                    </tr>
                                ) : patients.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-6 py-10 text-center text-sm text-gray-400"
                                        >
                                            No patients found.
                                        </td>
                                    </tr>
                                ) : (
                                    patients.map((p) => (
                                        <tr
                                            key={p.id}
                                            className="hover:bg-gray-50/60"
                                        >
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                <button
                                                    onClick={() =>
                                                        goToProfile(p.id)
                                                    }
                                                    className="text-left hover:underline"
                                                >
                                                    {p.name}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {p.socialWorker}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {formatDate(p.lastContact)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusStyles(p.status)}`}
                                                >
                                                    {statusLabel(p.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() =>
                                                        goToProfile(p.id)
                                                    }
                                                    className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-gray-800"
                                                >
                                                    View Profile
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {!loading && !error && (totalCount ?? 0) > PAGE_SIZE && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-sm text-gray-600">
                            <span>
                                Showing {page * PAGE_SIZE + 1}–
                                {page * PAGE_SIZE + patients.length}
                                {totalCount != null
                                    ? ` of ${totalCount}`
                                    : ""}{" "}
                                patients
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage((p) => p - 1)}
                                    disabled={page === 0}
                                    className="rounded-xl border border-gray-200 px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    ← Previous
                                </button>
                                <button
                                    onClick={() => setPage((p) => p + 1)}
                                    disabled={!hasNextPage}
                                    className="rounded-xl border border-gray-200 px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}

// --- Small components ---
function StatCard({ label, value }: { label: string; value: number | null }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-600">{label}</div>
            <div className="mt-3 text-2xl font-semibold text-gray-900">
                {value == null ? (
                    <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                ) : (
                    value
                )}
            </div>
        </div>
    );
}
