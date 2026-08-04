import React, { createContext, useContext } from "react";
import { useNotifications } from "~/hooks/useNotifications";
import { useTabAlert } from "~/hooks/useTabAlert";

type NotificationsContextValue = ReturnType<typeof useNotifications>;

const NotificationsContext = createContext<
    NotificationsContextValue | undefined
>(undefined);

/**
 * Owns the single Firestore notification listener for the authenticated app and
 * shares it with every consumer. Mounted in the app layout so both the bell and
 * the browser-tab alert read the same feed instead of opening duplicate
 * snapshot listeners on the same query.
 */
export function NotificationsProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const feed = useNotifications();

    useTabAlert(feed.items.length);

    return (
        <NotificationsContext.Provider value={feed}>
            {children}
        </NotificationsContext.Provider>
    );
}

export function useNotificationFeed() {
    const ctx = useContext(NotificationsContext);
    if (!ctx) {
        throw new Error(
            "useNotificationFeed must be used within a <NotificationsProvider>."
        );
    }
    return ctx;
}
