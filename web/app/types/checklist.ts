import type { Timestamp } from "firebase/firestore";

// Matches the structure written by the mobile app and the
// ensureDefaultChecklists Cloud Function:
// checklists/{patientId}/user_checklists/{checklistId}
export interface ChecklistItem {
    text: string;
    checked: boolean;
}

export interface Checklist {
    id: string;
    userId: string;
    title: string;
    subtitle: string;
    archived: boolean;
    items: ChecklistItem[];
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}
