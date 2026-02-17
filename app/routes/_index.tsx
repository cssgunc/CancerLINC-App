//This is the home page
import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useAuth } from "~/services/firebase_provider";

// --- Temporary JSON data ---
type Status = "Active" | "Follow-up" | "Pending";
type SortKey = "name" | "socialWorker" | "lastContact" | "status";

type Patient = {
    id: string;
    name: string;
    socialWorker: string;
    lastContact: string; // ISO date (international standard)
    status: Status;
};

// Sample patient data
const PATIENTS: Patient[] = [
    {
        id: "1",
        name: "David Thompson",
        socialWorker: "Emily Chen",
        lastContact: "2025-10-18",
        status: "Active",
    },
    {
        id: "2",
        name: "James Brown",
        socialWorker: "Jake Morrison",
        lastContact: "2025-10-17",
        status: "Follow-up",
    },
    {
        id: "3",
        name: "Jennifer Wilson",
        socialWorker: "Emily Chen",
        lastContact: "2025-10-19",
        status: "Follow-up",
    },
    {
        id: "4",
        name: "Linda Anderson",
        socialWorker: "Jake Morrison",
        lastContact: "2025-10-21",
        status: "Pending",
    },
    {
        id: "5",
        name: "Maria Garcia",
        socialWorker: "Sarah Thompson",
        lastContact: "2025-10-24",
        status: "Active",
    },
];

// --- Utilities ---
function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    });
}

function statusStyles(status: Status) {
    // recommended by someone on Figma document
    switch (status) {
        case "Active":
            return "bg-green-50 text-green-700 ring-1 ring-green-200";
        case "Follow-up":
            return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
        case "Pending":
            return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
    }
}

// --- Component ---
export default function HomePage() {
    const { user, logout } = useAuth();
    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    // Compute totals
    const totals = useMemo(() => {
        const total = PATIENTS.length;
        const active = PATIENTS.filter((p) => p.status === "Active").length;
        const followUps = PATIENTS.filter(
            (p) => p.status === "Follow-up"
        ).length;
        return { total, active, followUps };
    }, []);

    // Filtered patients
    const filtered = useMemo(() => {
        if (!query.trim()) return PATIENTS;
        const q = query.toLowerCase();
        return PATIENTS.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.socialWorker.toLowerCase().includes(q)
        );
    }, [query]);

    // Sorted patients
    const sorted = useMemo(() => {
        const copy = [...filtered];

        const statusOrder: Record<Status, number> = {
            Active: 0,
            "Follow-up": 1,
            Pending: 2,
        };

        // Function to get the value to sort by
        const val = (p: Patient, key: SortKey): string | number => {
            switch (key) {
                case "lastContact":
                    return new Date(p.lastContact).getTime();
                case "status":
                    return statusOrder[p.status];
                case "name":
                    return p.name.toLowerCase();
                case "socialWorker":
                    return p.socialWorker.toLowerCase();
            }
        };

        copy.sort((a, b) => {
            const av = val(a, sortKey);
            const bv = val(b, sortKey);
            if (av < bv) return sortDir === "asc" ? -1 : 1;
            if (av > bv) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

        return copy;
    }, [filtered, sortDir, sortKey]);

    // Toggle sort direction
    function toggleSort(key: SortKey) {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortKey(key);
            setSortDir("asc");
        }
    }

    // Sort Icon Component (uses lucide icons for up/down arrows)
    const SortIcon = ({ active }: { active: boolean }) =>
        active ? (
            sortDir === "asc" ? (
                <ChevronUp className="ml-1 h-4 w-4" />
            ) : (
                <ChevronDown className="ml-1 h-4 w-4" />
            )
        ) : (
            <span className="ml-1 h-4 w-4 inline-block" />
        );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Bar */}
            <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
                <div className="container mx-auto flex items-center gap-4 px-6 py-4">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <img
                            src="/CancerLINC-Logo-1.png"
                            alt="CancerLINC Logo"
                            className="w-16 mb-4"
                        />
                    </div>

                    {/* Search */}
                    <div className="relative mx-4 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search patients or social workers..."
                            className="w-full rounded-2xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600"
                        />
                    </div>

                    {/* Welcome / Logout */}
                    <div className="ml-auto hidden items-center gap-4 text-sm text-gray-600 md:flex">
                        <span>Welcome, {user?.displayName}</span>{" "}
                        <button
                            type="button"
                            onClick={logout}
                            className="font-medium text-gray-900 underline underline-offset-2"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main */}
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
                    <StatCard label="Total Patients" value={totals.total} />
                    <StatCard label="Active Cases" value={totals.active} />
                    <StatCard
                        label="Follow-ups Needed"
                        value={totals.followUps}
                    />
                </section>

                {/* Table */}
                <section className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 text-left text-sm text-gray-600 select-none">
                                <tr>
                                    <th className="px-6 py-4 font-medium">
                                        <button
                                            onClick={() => toggleSort("name")}
                                            className={`inline-flex items-center hover:text-gray-900 ${sortKey === "name" ? "underline underline-offset-2 decoration-1 font-bold" : ""}`}
                                        >
                                            Patient Name
                                            <SortIcon
                                                active={sortKey === "name"}
                                            />
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 font-medium">
                                        <button
                                            onClick={() =>
                                                toggleSort("socialWorker")
                                            }
                                            className={`inline-flex items-center hover:text-gray-900 ${sortKey === "socialWorker" ? "underline underline-offset-2 decoration-1 font-bold" : ""}`}
                                        >
                                            Assigned Social Worker
                                            <SortIcon
                                                active={
                                                    sortKey === "socialWorker"
                                                }
                                            />
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 font-medium">
                                        <button
                                            onClick={() =>
                                                toggleSort("lastContact")
                                            }
                                            className={`inline-flex items-center hover:text-gray-900 ${sortKey === "lastContact" ? "underline underline-offset-2 decoration-1 font-bold" : ""}`}
                                        >
                                            Last Contact
                                            <SortIcon
                                                active={
                                                    sortKey === "lastContact"
                                                }
                                            />
                                        </button>
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
                                {sorted.map((p) => (
                                    <tr
                                        key={p.id}
                                        className="hover:bg-gray-50/60"
                                    >
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            <button className="text-left hover:underline">
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
                                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusStyles(
                                                    p.status
                                                )}`}
                                            >
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() =>
                                                    alert(
                                                        `Open profile for ${p.name}`
                                                    )
                                                }
                                                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-gray-800"
                                            >
                                                View Profile
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
}

// --- Small components ---
function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-600">{label}</div>
            <div className="mt-3 text-2xl font-semibold text-gray-900">
                {value}
            </div>
        </div>
    );
}
