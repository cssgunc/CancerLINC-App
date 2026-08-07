import { useEffect } from "react";
import { clearFaviconBadge, setFaviconBadge } from "~/utils/favicon_badge";

/** Tab name when nothing needs attention. Mirrors the `meta()` in root.tsx. */
export const BASE_TITLE = "CancerLINC Admin";

/**
 * Mirrors the pending-notification count into the browser tab, Gmail-style:
 * the title becomes "(N) Someone needs your attention" and the favicon picks up
 * a red count badge. Because the underlying feed is a live Firestore snapshot
 * listener, this updates while the tab sits in the background.
 */
export function useTabAlert(count: number) {
    useEffect(() => {
        document.title =
            count > 0 ? `(${count}) Someone needs your attention` : BASE_TITLE;
        setFaviconBadge(count);

        return () => {
            document.title = BASE_TITLE;
            clearFaviconBadge();
        };
    }, [count]);
}
