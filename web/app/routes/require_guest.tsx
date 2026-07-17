import { Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "../services/firebase_provider";
import { useEffect, useState } from "react";

export default function RequireGuest() {
    const { user, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Prevent redirects during the server/StaticRouter render
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => setHydrated(true), []);

    useEffect(() => {
        if (!hydrated) return;
        if (loading) return;

        if (user && user.emailVerified) {
            navigate("/", { replace: true, state: { from: location } });
        }
        if (user && !user.emailVerified) {
            navigate("/verify-email", {
                replace: true,
                state: { from: location },
            });
        }
    }, [hydrated, loading, user, navigate, location]);

    if (!hydrated || loading) return <div>Loading...</div>;
    if (user) return null; // navigation effect will run

    return <Outlet />;
}
