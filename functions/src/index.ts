import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

initializeApp();
const db = getFirestore();

const INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_BATCH_SIZE = 400;

const IMAGE_ONLY_SUMMARY = "Sent a photo";
const IMAGE_WITH_TEXT_SUFFIX = " (photo attached)";

function buildMessageSummary(
    content: string,
    messageType: string | undefined
): string {
    if (messageType === "image") {
        return content
            ? `${content}${IMAGE_WITH_TEXT_SUFFIX}`
            : IMAGE_ONLY_SUMMARY;
    }
    return content;
}

/**
 * New patient docs start "closed" (status only set if the doc is a patient and
 * has no status yet). Patients are created from mobile; web signup makes staff.
 */
export const onUserCreated = onDocumentCreated(
    "users/{userId}",
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const data = snapshot.data();
        if (data.role !== "patient" || data.status) return;

        await snapshot.ref.update({
            status: "closed",
            awaitingReply: false,
        });
    }
);

/**
 * Every new message reactivates the conversation (unless it's Urgent) and
 * maintains the denormalized signal the notification bell reads off the patient
 * doc: awaitingReply, lastMessageText, lastContactTimestamp.
 */
export const onMessageCreated = onDocumentCreated(
    "chats/{chatId}/messages/{messageId}",
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const chatId = event.params.chatId;
        const message = snapshot.data();
        const senderId: string = message.senderId ?? "";
        const content: string = message.content ?? "";
        const messageType: string | undefined = message.messageType;

        // The patient is the chat owner: chatId === patient uid.
        const awaitingReply = senderId === chatId;
        const lastMessageText = buildMessageSummary(content, messageType);
        const patientRef = db.doc(`users/${chatId}`);

        await db.runTransaction(async (tx) => {
            const patientSnap = await tx.get(patientRef);
            if (!patientSnap.exists) return;

            const currentStatus = patientSnap.get("status");
            const nextStatus = currentStatus === "urgent" ? "urgent" : "active";

            tx.set(
                patientRef,
                {
                    status: nextStatus,
                    awaitingReply,
                    lastMessageText,
                    lastContactTimestamp: FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
        });
    }
);

/**
 * Daily sweep: patients that have been "active" with no message for 7+ days
 * become "inactive". Urgent and closed are left untouched.
 */
export const deactivateStaleChats = onSchedule("every 24 hours", async () => {
    const cutoff = Timestamp.fromMillis(Date.now() - INACTIVITY_MS);

    const staleQuery = db
        .collection("users")
        .where("role", "==", "patient")
        .where("status", "==", "active")
        .where("lastContactTimestamp", "<=", cutoff);

    const snapshot = await staleQuery.get();
    if (snapshot.empty) {
        logger.info("deactivateStaleChats: no stale patients");
        return;
    }

    let updated = 0;
    for (let i = 0; i < snapshot.docs.length; i += STALE_BATCH_SIZE) {
        const batch = db.batch();
        for (const doc of snapshot.docs.slice(i, i + STALE_BATCH_SIZE)) {
            batch.update(doc.ref, { status: "inactive" });
            updated += 1;
        }
        await batch.commit();
    }

    logger.info(`deactivateStaleChats: set ${updated} patient(s) to inactive`);
});
