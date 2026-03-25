import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { auth } from "./firebase_app";

type AuthContextValue = {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    // `user` = the currently signed-in Firebase user (or null if signed out)
    const [user, setUser] = useState<User | null>(null);

    // `loading` = true until Firebase tells us what the auth state is
    // (prevents “flash of logged-out UI”)
    const [loading, setLoading] = useState<boolean>(() => {
        // If your app server-renders, `useEffect` won't run on the server.
        // Avoid getting stuck in loading=true on the server render:
        return typeof window === "undefined" ? false : true;
    });

    useEffect(() => {
        // Subscribe once. Firebase calls this immediately with the current user
        // (after it restores the session), and again whenever auth changes.
        const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
            setUser(nextUser);
            setLoading(false);
        });

        // Cleanup so we don't leak listeners during hot reload / route changes
        return unsubscribe;
    }, []);

    // Memoize so consumers don't re-render unnecessarily
    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            loading,
            logout: () => signOut(auth),
        }),
        [user, loading]
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an <AuthProvider>.");
    }
    return ctx;
}
