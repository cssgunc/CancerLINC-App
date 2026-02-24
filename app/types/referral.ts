import type { Timestamp } from "firebase/firestore";

export interface Referral {
    id: string;
    dateSubmitted: Timestamp;
    isDeleted: boolean;
    lastUpdated: Timestamp;
    notes: string;
    patientId: string;
    socialWorkerId: string;
    status: string;
    type: string;
}
