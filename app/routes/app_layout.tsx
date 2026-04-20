import { Search } from "lucide-react";
import { Outlet, useMatch, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "~/services/firebase_provider";

export default function AppLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const onMemberPage = useMatch("/member/:user");

    const searchValue = searchParams.get("q") ?? "";

    function handleSearchChange(value: string) {
        if (onMemberPage) {
            // On member page: navigate to dashboard with query pre-filled
            if (value) {
                navigate(`/?q=${encodeURIComponent(value)}`);
            } else {
                navigate("/");
            }
        } else {
            // On index: update the URL param in place
            setSearchParams(value ? { q: value } : {}, { replace: true });
        }
    }

    return (
        <div
            className={
                onMemberPage
                    ? "flex h-screen flex-col overflow-hidden bg-gray-50"
                    : "min-h-screen bg-gray-50"
            }
        >
            <header className="shrink-0 border-b bg-white/95 backdrop-blur">
                <div className="container mx-auto flex items-center gap-4 px-6 py-4">
                    {/* Back button — only on member pages */}
                    {onMemberPage ? (
                        <button
                            type="button"
                            onClick={() => navigate("/")}
                            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shrink-0"
                        >
                            ← Back
                        </button>
                    ) : null}

                    {/* Logo */}
                    <img
                        src="/CancerLINC-Logo-1.png"
                        alt="CancerLINC Logo"
                        className="w-16 mb-4 shrink-0"
                    />

                    {/* Search */}
                    <div className="relative mx-4 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <input
                            value={onMemberPage ? "" : searchValue}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder={
                                onMemberPage
                                    ? "Search patients..."
                                    : "Search by last name..."
                            }
                            className="w-full rounded-2xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600"
                        />
                    </div>

                    {/* Welcome / Logout */}
                    <div className="ml-auto hidden items-center gap-4 text-sm text-gray-600 md:flex shrink-0">
                        <span>Welcome, {user?.displayName}</span>
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

            <div
                className={
                    onMemberPage
                        ? "flex flex-1 flex-col overflow-hidden"
                        : undefined
                }
            >
                <Outlet />
            </div>
        </div>
    );
}
