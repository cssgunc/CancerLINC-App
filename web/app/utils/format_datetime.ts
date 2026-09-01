import type { Timestamp } from "firebase/firestore";

const EASTERN_TIME_ZONE = "America/New_York";

type PersonNameSource = {
    uid?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
};

export function formatPersonName(profile?: Partial<PersonNameSource> | null) {
    if (!profile) return "";
    return (
        `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() ||
        profile.username ||
        profile.email ||
        profile.uid ||
        ""
    );
}

export function formatMessageDateTime(timestamp?: Timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const datePart = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: EASTERN_TIME_ZONE,
    });
    const timePart = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: EASTERN_TIME_ZONE,
        timeZoneName: "short",
    });
    return `${datePart} · ${timePart}`;
}
