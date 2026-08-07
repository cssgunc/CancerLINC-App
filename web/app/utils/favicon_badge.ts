// Draws an unread-count badge over the site favicon so the tab alert stays
// visible once the tab narrows to icon-only and the title truncates away.
//
// Everything here is best-effort: if the icon can't be decoded onto a canvas,
// the caller's document.title change is still the primary signal, so we fail
// silently rather than surfacing an error.

const ICON_HREF = "/favicon-32.png";
const SIZE = 32;

let originalHref: string | null = null;
let basePromise: Promise<HTMLImageElement> | null = null;

/** The <link rel="icon"> element, created if the document doesn't have one. */
function iconLink(): HTMLLinkElement {
    const existing =
        document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (existing) return existing;

    const link = document.createElement("link");
    link.rel = "icon";
    link.href = ICON_HREF;
    document.head.appendChild(link);
    return link;
}

/** Loads the untouched favicon once and reuses it for every redraw. */
function baseIcon(): Promise<HTMLImageElement> {
    if (!basePromise) {
        basePromise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("favicon failed to load"));
            img.src = originalHref ?? ICON_HREF;
        });
    }
    return basePromise;
}

function drawBadge(ctx: CanvasRenderingContext2D, count: number) {
    const label = count > 9 ? "9+" : String(count);
    const r = SIZE * 0.34;
    const cx = SIZE - r;
    const cy = r;

    // White ring keeps the dot legible against dark or busy icons.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
    ctx.fillStyle = "#dc2626"; // matches the bell's bg-red-600 badge
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(r * (label.length > 1 ? 0.95 : 1.2))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy + 0.5);
}

/**
 * Overlays `count` on the favicon. A count of zero restores the original icon.
 */
export function setFaviconBadge(count: number) {
    if (typeof document === "undefined") return;

    try {
        const link = iconLink();
        if (originalHref === null) originalHref = link.href;

        if (count <= 0) {
            link.href = originalHref;
            return;
        }

        void baseIcon()
            .then((img) => {
                const canvas = document.createElement("canvas");
                canvas.width = SIZE;
                canvas.height = SIZE;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                ctx.drawImage(img, 0, 0, SIZE, SIZE);
                drawBadge(ctx, count);
                iconLink().href = canvas.toDataURL("image/png");
            })
            .catch(() => {
                // Title change carries the alert on its own.
            });
    } catch {
        // Same — never let icon painting break the caller.
    }
}

/** Puts the untouched favicon back. */
export function clearFaviconBadge() {
    setFaviconBadge(0);
}
