import * as admin from "firebase-admin";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import {
  assertCanAccessChat,
  logCallableRequest,
  requireAuthUid,
} from "../shared";

// admin may already be initialized by another module in this codebase.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

type Timestamp = admin.firestore.Timestamp;

interface RecordTranscriptExportRequest {
  chatId?: unknown;
  firstMessageId?: unknown;
  lastMessageId?: unknown;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// recordTranscriptExport — records a watermark + audit trail entry each time
// a chat transcript is exported.
//
// `lastTranscriptExportedAt` on the chat doc is the timestamp of the last
// MESSAGE ever included in an export; it only ever moves forward (see the
// monotonic guard below) so re-exporting an older range can't regress it.
// `lastTranscriptExportedRunAt` is a separate field for when the export was
// last run, regardless of range.
//
// Input: { chatId, firstMessageId, lastMessageId }
// Output: { lastTranscriptExportedAtMs, messageCount }
export const recordTranscriptExport = onCall(async (request) => {
  logCallableRequest("recordTranscriptExport", request);
  const uid = requireAuthUid(request.auth?.uid);

  const data = request.data as RecordTranscriptExportRequest | undefined;
  const chatId = stringValue(data?.chatId);
  const firstMessageId = stringValue(data?.firstMessageId);
  const lastMessageId = stringValue(data?.lastMessageId);

  if (!chatId || !firstMessageId || !lastMessageId) {
    throw new HttpsError(
        "invalid-argument",
        "chatId, firstMessageId, and lastMessageId are required.");
  }

  await assertCanAccessChat(uid, chatId);

  const chatRef = firestore.collection("chats").doc(chatId);
  const messagesRef = chatRef.collection("messages");

  const [firstDoc, lastDoc] = await Promise.all([
    messagesRef.doc(firstMessageId).get(),
    messagesRef.doc(lastMessageId).get(),
  ]);

  if (!firstDoc.exists) {
    throw new HttpsError(
        "not-found",
        "firstMessageId was not found in this chat.");
  }
  if (!lastDoc.exists) {
    throw new HttpsError(
        "not-found",
        "lastMessageId was not found in this chat.");
  }

  const firstTimestamp = firstDoc.get("timestamp") as Timestamp | undefined;
  const lastTimestamp = lastDoc.get("timestamp") as Timestamp | undefined;

  if (!firstTimestamp || !lastTimestamp) {
    throw new HttpsError(
        "invalid-argument",
        "Both firstMessageId and lastMessageId must have a timestamp.");
  }

  if (firstTimestamp.toMillis() > lastTimestamp.toMillis()) {
    throw new HttpsError(
        "invalid-argument",
        "firstMessageId must not be newer than lastMessageId.");
  }

  // messageCount doesn't feed the watermark read-modify-write below and
  // doesn't need to be transactionally consistent with it, so it's read as
  // a plain aggregate beforehand. (Admin SDK transactions CAN run aggregate
  // queries via transaction.get(), but there's no reason to pay for that
  // here — it would only widen the transaction's read set and retry surface
  // for no benefit, since nothing in step 5 depends on this count.)
  const countSnapshot = await messagesRef
      .where("timestamp", ">=", firstTimestamp)
      .where("timestamp", "<=", lastTimestamp)
      .count()
      .get();
  const messageCount = countSnapshot.data().count;

  const exportedByEmail = request.auth?.token?.email ?? "";

  const lastTranscriptExportedAtMs = await firestore.runTransaction(
      async (transaction) => {
        const chatSnapshot = await transaction.get(chatRef);
        const storedWatermark = chatSnapshot.get(
            "lastTranscriptExportedAt") as Timestamp | undefined;

        // THE correctness property of this function: exporting an older
        // range must never drag the watermark backwards.
        const nextWatermark =
      !storedWatermark || lastTimestamp.toMillis() > storedWatermark.toMillis() ?
        lastTimestamp :
        storedWatermark;

        transaction.set(chatRef, {
          lastTranscriptExportedAt: nextWatermark,
          lastTranscriptExportedBy: uid,
          lastTranscriptExportedRunAt: serverTimestamp(),
        }, {merge: true});

        const exportRef = chatRef.collection("transcriptExports").doc();
        transaction.set(exportRef, {
          exportedByUid: uid,
          exportedByEmail,
          exportedAt: serverTimestamp(),
          rangeStart: firstTimestamp,
          rangeEnd: lastTimestamp,
          messageCount,
          lastMessageId,
        });

        return nextWatermark.toMillis();
      });

  logger.info("recordTranscriptExport committed", {
    uid,
    chatId,
    messageCount,
    lastTranscriptExportedAtMs,
  });

  return {lastTranscriptExportedAtMs, messageCount};
});
