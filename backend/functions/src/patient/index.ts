import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getStorage } from "firebase-admin/storage";

// Keep the existing re-exports from shared.
export {
  createUserChat,
  sendChatMessage,
  sendChatImageMessage,
} from "../shared";

const firestore = getFirestore();

// Matches the invoker option used by the shared callables (createUserChat,
// etc.) so this can be called by any signed-in patient.
const publicCallableOptions = { invoker: "public" } as const;

function requireAuthUid(request: CallableRequest<unknown>): string {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  return uid;
}

/**
 * Recursively deletes every document in a (sub)collection in batches.
 * Firestore does not cascade-delete subcollections when a parent doc is
 * deleted, so chats/{uid}/messages and checklists/{uid}/user_checklists
 * need to be cleared out explicitly.
 */
async function deleteCollectionRecursively(
  collectionRef: FirebaseFirestore.CollectionReference,
  batchSize = 300
): Promise<void> {
  const query = collectionRef.limit(batchSize);
  await new Promise<void>((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(
  query: FirebaseFirestore.Query,
  resolve: () => void
): Promise<void> {
  const snapshot = await query.get();
  if (snapshot.size === 0) {
    resolve();
    return;
  }
  const batch = firestore.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  process.nextTick(() => {
    deleteQueryBatch(query, resolve).catch((err) => {
      logger.error("deleteQueryBatch failed", { err });
    });
  });
}

export const deleteOwnAccount = onCall(publicCallableOptions, async (request) => {
  const uid = requireAuthUid(request);
  logger.info("deleteOwnAccount: starting", { uid });

  // ---- 1. Delete the Auth account -----------------------------------------
  try {
    await getAuth().deleteUser(uid);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/user-not-found") {
      logger.error("deleteOwnAccount: failed to delete auth user", { uid, err });
      throw new HttpsError(
        "internal",
        "We couldn't delete your account. Please try again, or contact " +
        "support if this keeps happening."
      );
    }
  }

  // ---- 2. Clean up Firestore data ------------------------------------------
  try {
    await firestore.collection("users").doc(uid).delete();

    await deleteCollectionRecursively(
      firestore.collection("checklists").doc(uid).collection("user_checklists")
    );
    await firestore.collection("checklists").doc(uid).delete().catch(() => undefined);

    await deleteCollectionRecursively(
      firestore.collection("referrals").doc(uid).collection("referrals")
    );
    await firestore.collection("referrals").doc(uid).delete().catch(() => undefined);

    await deleteCollectionRecursively(
      firestore.collection("chats").doc(uid).collection("messages")
    );
    await firestore.collection("chats").doc(uid).delete().catch(() => undefined);
  } catch (err) {
    logger.error("deleteOwnAccount: Firestore cleanup failed", { uid, err });
  }

  // ---- 3. Clean up Storage (chat image attachments) ------------------------
  try {
    await getStorage().bucket().deleteFiles({ prefix: `chatAttachments/${uid}/` });
  } catch (err) {
    logger.error("deleteOwnAccount: Storage cleanup failed", { uid, err });
  }

  logger.info("deleteOwnAccount: completed", { uid });
  return { success: true };
});