import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {CallableRequest, HttpsError, onCall} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions";
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import type {Message} from "firebase-admin/messaging";

admin.initializeApp();

const firestore = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

const inactiveAfterMs = 7 * 24 * 60 * 60 * 1000;
const staleBatchSize = 400;
const imageOnlySummary = "Sent a photo";
const imageWithTextSuffix = " (photo attached)";
const publicCallableOptions = {invoker: "public"} as const;

const defaultChecklistTemplates = [
  {
    title: "Legal Documents",
    subtitle: "Key paperwork to keep organized during treatment",
    items: [
      {
        text: "Save copies of your health insurance card and photo ID",
        checked: false,
      },
      {
        text: "Review any advance directive or medical power of attorney forms",
        checked: false,
      },
      {
        text: "Keep a folder for bills, explanation of benefits, and denial letters",
        checked: false,
      },
      {
        text: "Write down questions for a legal aid or patient advocacy appointment",
        checked: false,
      },
    ],
  },
  {
    title: "Financial Health",
    subtitle: "Short list to track costs and support options",
    items: [
      {
        text: "List current medical bills and upcoming treatment expenses",
        checked: false,
      },
      {
        text: "Check whether your providers offer payment plans or charity care",
        checked: false,
      },
      {
        text: "Gather recent pay stubs or income documents for assistance applications",
        checked: false,
      },
      {
        text: "Make a note of transportation, lodging, or food support programs to ask about",
        checked: false,
      },
    ],
  },
];

type ChatMessage = {
  senderId?: string;
  senderName?: string;
  messageType?: string;
  content?: string;
};

type SendMessageRequest = {
  chatId?: unknown;
  content?: unknown;
};

type SendImageMessageRequest = {
  chatId?: unknown;
  imageUrl?: unknown;
  imagePath?: unknown;
  imageFileName?: unknown;
  imageMimeType?: unknown;
  imageSizeBytes?: unknown;
};

function dataKeys(data: unknown): string[] {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  return Object.keys(data as Record<string, unknown>);
}

function hasHeader(request: CallableRequest<unknown>, name: string): boolean {
  const value = request.rawRequest.header(name);
  return typeof value === "string" && value.length > 0;
}

function logCallableRequest(
    callable: string,
    request: CallableRequest<unknown>): void {
  logger.info("Callable request received", {
    callable,
    hasAuth: request.auth !== undefined,
    uid: request.auth?.uid ?? null,
    tokenEmailVerified: request.auth?.token.email_verified ?? null,
    signInProvider: request.auth?.token.firebase?.sign_in_provider ?? null,
    hasAppCheck: request.app !== undefined,
    appId: request.app?.appId ?? null,
    hasAuthorizationHeader: hasHeader(request, "authorization"),
    hasFirebaseInstanceIdToken: hasHeader(
        request,
        "firebase-instance-id-token",
    ),
    contentType: request.rawRequest.header("content-type") ?? null,
    dataKeys: dataKeys(request.data),
  });
}

function requireAuthUid(uid?: string): string {
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  return uid;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitName(rawName?: string): {firstName: string; lastName: string} {
  const cleaned = (rawName ?? "").trim();
  if (!cleaned) {
    return {firstName: "", lastName: ""};
  }

  const parts = cleaned.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return {firstName: "", lastName: ""};
  }

  if (parts.length === 1) {
    return {firstName: parts[0], lastName: ""};
  }

  return {firstName: parts[0], lastName: parts.slice(1).join(" ")};
}

function buildMessageSummary(
    content: string,
    messageType: string | undefined): string {
  if (messageType === "image") {
    return content ? `${content}${imageWithTextSuffix}` : imageOnlySummary;
  }

  return content;
}

async function ensureDefaultChecklists(userId: string): Promise<void> {
  const checklistsRef = firestore
      .collection("checklists")
      .doc(userId)
      .collection("user_checklists");
  const existing = await checklistsRef.limit(1).get();
  if (!existing.empty) {
    return;
  }

  const batch = firestore.batch();
  for (const template of defaultChecklistTemplates) {
    const docRef = checklistsRef.doc();
    batch.set(docRef, {
      userId,
      title: template.title,
      subtitle: template.subtitle,
      items: template.items,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

async function getSenderName(uid: string): Promise<string> {
  const userDoc = await firestore.collection("users").doc(uid).get();
  const data = userDoc.data() ?? {};
  const firstName = stringValue(data.firstName);
  const lastName = stringValue(data.lastName);
  const fullName = [firstName, lastName]
      .filter((part) => part.length > 0)
      .join(" ");

  return fullName || "CancerLINC user";
}

async function findChatParticipant(patientId: string): Promise<string> {
  const patientDoc = await firestore.collection("users").doc(patientId).get();
  const patientData = patientDoc.data() ?? {};
  const assignedSocialWorkerId = stringValue(patientData.assignedSocialWorkerId);

  if (assignedSocialWorkerId) {
    return assignedSocialWorkerId;
  }

  const socialWorkerQuery = await firestore
      .collection("users")
      .where("role", "in", ["socialWorker", "social_worker"])
      .limit(1)
      .get();

  if (!socialWorkerQuery.empty) {
    return socialWorkerQuery.docs[0].id;
  }

  const fallbackUserQuery = await firestore.collection("users").limit(20).get();
  const fallbackUser = fallbackUserQuery.docs.find((doc) => doc.id !== patientId);

  if (fallbackUser) {
    return fallbackUser.id;
  }

  throw new HttpsError(
      "failed-precondition",
      "No available user was found to create a chat.");
}

async function assertCanSendMessage(uid: string, chatId: string): Promise<void> {
  const chatDoc = await firestore.collection("chats").doc(chatId).get();
  if (!chatDoc.exists) {
    throw new HttpsError("not-found", "Chat not found.");
  }

  const participants = chatDoc.data()?.participants;
  if (!Array.isArray(participants) || !participants.includes(uid)) {
    throw new HttpsError(
        "permission-denied",
        "You are not a participant in this chat.");
  }
}

export const onAuthUserCreated = functions.auth.user().onCreate(async (user) => {
  const fallbackNameParts = splitName(user.displayName ?? user.email);
  const firstName = fallbackNameParts.firstName;
  const lastName = fallbackNameParts.lastName;
  const docRef = firestore.collection("users").doc(user.uid);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    await docRef.set({
      uid: user.uid,
      email: user.email ?? "",
      firstName,
      lastName,
      lastNameLower: lastName.toLowerCase(),
      assignedSocialWorkerId: "",
      assignedSocialWorkerName: "",
      hospital: "",
      phoneNumber: "",
      profilePhotoUrl: user.photoURL ?? "",
      role: "patient",
      status: "follow-up",
      // New patients start unapproved and stay gated out of the app until
      // client services accepts them in the staff console. This is approval
      // state, NOT email verification — see firestore.rules users/{uid}.
      // Only runs when the doc doesn't already exist, so patients created
      // before this gate keep whatever isVerified they already had.
      isVerified: false,
      isBanned: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastContactTimestamp: serverTimestamp(),
    });
  }

  await ensureDefaultChecklists(user.uid);
});

export const createUserChat = onCall(publicCallableOptions, async (request) => {
  logCallableRequest("createUserChat", request);
  const uid = requireAuthUid(request.auth?.uid);
  const chatRef = firestore.collection("chats").doc(uid);
  const existing = await chatRef.get();

  if (existing.exists) {
    logger.info("createUserChat returning existing chat", {uid});
    return {chatId: uid};
  }

  const otherUserId = await findChatParticipant(uid);
  await chatRef.set({
    chatId: uid,
    participants: [uid, otherUserId],
    lastMessage: "",
    lastMessageTimestamp: serverTimestamp(),
  });

  logger.info("createUserChat created chat", {uid, otherUserId});
  return {chatId: uid};
});

export const sendChatMessage = onCall(
    publicCallableOptions,
    async (request) => {
      logCallableRequest("sendChatMessage", request);
      const uid = requireAuthUid(request.auth?.uid);
      const data = request.data as SendMessageRequest | undefined;
      const chatId = stringValue(data?.chatId);
      const content = stringValue(data?.content);

      logger.info("sendChatMessage parsed request", {
        uid,
        chatId,
        hasContent: content.length > 0,
        contentLength: content.length,
      });

      if (!chatId || !content) {
        throw new HttpsError(
            "invalid-argument",
            "chatId and content are required.");
      }

      await assertCanSendMessage(uid, chatId);

      const messagesRef = firestore
          .collection("chats")
          .doc(chatId)
          .collection("messages");
      const messageRef = messagesRef.doc();
      const senderName = await getSenderName(uid);
      const batch = firestore.batch();

      batch.set(messageRef, {
        messageId: messageRef.id,
        content,
        senderName,
        senderId: uid,
        isRead: false,
        timestamp: serverTimestamp(),
      });
      batch.update(firestore.collection("chats").doc(chatId), {
        lastMessage: content,
        lastMessageTimestamp: serverTimestamp(),
      });

      await batch.commit();

      logger.info("sendChatMessage committed", {
        uid,
        chatId,
        messageId: messageRef.id,
      });
      return {messageId: messageRef.id};
    });

export const sendChatImageMessage = onCall(
    publicCallableOptions,
    async (request) => {
      logCallableRequest("sendChatImageMessage", request);
      const uid = requireAuthUid(request.auth?.uid);
      const data = request.data as SendImageMessageRequest | undefined;
      const chatId = stringValue(data?.chatId);
      const imageUrl = stringValue(data?.imageUrl);
      const imagePath = stringValue(data?.imagePath);
      const imageFileName = stringValue(data?.imageFileName);
      const imageMimeType = stringValue(data?.imageMimeType) || "image/jpeg";
      const imageSizeBytes = typeof data?.imageSizeBytes === "number" ?
    data.imageSizeBytes :
    0;

      logger.info("sendChatImageMessage parsed request", {
        uid,
        chatId,
        hasImageUrl: imageUrl.length > 0,
        imagePath,
        imageMimeType,
        imageSizeBytes,
      });

      if (!chatId || !imageUrl || !imagePath || !imageFileName) {
        throw new HttpsError(
            "invalid-argument",
            "chatId and image metadata are required.");
      }

      if (!imagePath.startsWith(`chatAttachments/${chatId}/`)) {
        throw new HttpsError(
            "invalid-argument",
            "Image path does not belong to this chat.");
      }

      await assertCanSendMessage(uid, chatId);

      const messagesRef = firestore
          .collection("chats")
          .doc(chatId)
          .collection("messages");
      const messageRef = messagesRef.doc();
      const senderName = await getSenderName(uid);
      const batch = firestore.batch();

      batch.set(messageRef, {
        messageId: messageRef.id,
        content: "",
        messageType: "image",
        senderName,
        imageUrl,
        imagePath,
        imageFileName,
        imageMimeType,
        imageSizeBytes,
        senderId: uid,
        isRead: false,
        timestamp: serverTimestamp(),
      });
      batch.update(firestore.collection("chats").doc(chatId), {
        lastMessage: "Sent a photo",
        lastMessageTimestamp: serverTimestamp(),
      });

      await batch.commit();

      logger.info("sendChatImageMessage committed", {
        uid,
        chatId,
        messageId: messageRef.id,
      });
      return {messageId: messageRef.id};
    });

export const onMessageCreated = onDocumentCreated(
    "chats/{chatId}/messages/{messageId}",
    async (event) => {
      const snapshot = event.data;
      if (!snapshot) {
        return;
      }

      const chatId = event.params.chatId;
      const message = snapshot.data() as ChatMessage;
      const senderId = message.senderId ?? "";
      const content = message.content ?? "";
      const patientRef = firestore.collection("users").doc(chatId);

      await firestore.runTransaction(async (transaction) => {
        const patientSnapshot = await transaction.get(patientRef);
        if (!patientSnapshot.exists) {
          return;
        }

        const currentStatus = patientSnapshot.get("status");
        const nextStatus = currentStatus === "urgent" ? "urgent" : "active";

        transaction.set(
            patientRef,
            {
              status: nextStatus,
              awaitingReply: senderId === chatId,
              lastMessageText: buildMessageSummary(
                  content,
                  message.messageType),
              lastContactTimestamp: serverTimestamp(),
            },
            {merge: true});
      });
    });

export const deactivateStaleChats = onSchedule(
    "every 24 hours",
    async () => {
      const cutoff = admin.firestore.Timestamp.fromMillis(
          Date.now() - inactiveAfterMs);
      const staleQuery = firestore
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
      for (let i = 0; i < snapshot.docs.length; i += staleBatchSize) {
        const batch = firestore.batch();
        for (const doc of snapshot.docs.slice(i, i + staleBatchSize)) {
          batch.update(doc.ref, {status: "inactive"});
          updated += 1;
        }
        await batch.commit();
      }

      logger.info(
          `deactivateStaleChats: set ${updated} patient(s) to inactive`);
    });

export const sendMessageNotification = onDocumentCreated(
    // Watches for any new document created inside chat message subcollection
    "chats/{chatId}/messages/{messageId}",
    async (event) => {
      if (!event.data) {
        console.log("No message data, skipping notification");
        return null;
      }

      const message = event.data.data() as ChatMessage;
      const chatId = event.params.chatId; // chatId = patient's uid
      const senderId = message.senderId;
      const senderName = message.senderName || "Your social worker";
      const content = message.messageType === "image" ?
      "Sent you a photo" :
      (message.content || "New message");

      // look up the patient's FCM token
      const patientId = chatId;

      // if sender is the patient don't send a notification
      if (senderId === patientId) {
        console.log("Sender is patient, skipping notification");
        return null;
      }

      const patientDoc = await firestore
      // look up the patient's FCM token from user document
      // NotificationService._saveTokenToFirestore() saves this
          .collection("users")
          .doc(patientId)
          .get();

      if (!patientDoc.exists) {
        console.log("Patient document not found:", patientId);
        return null;
      }

      const patientData = patientDoc.data();
      const fcmToken = patientData?.fcmToken;

      // no token >> no permission to send push notification, skip
      if (!fcmToken) {
        console.log("No FCM token for patient:", patientId);
        return null;
      }

      // build and send the notification with FCM
      const fcmMessage: Message = {
        token: fcmToken,
        notification: {
          title: senderName, // shows as the notification title
          body: content, // shows as the notification body text
        },
        // (Android specific) ensures notification arrives
        android: {
          priority: "high",
          notification: {
            channelId: "chat_messages", // match the channel id
            sound: "default",
          },
        },
        // iOS specific settings
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1, // shows red dot on app icon
            },
          },
          headers: {
            "apns-priority": "10",
          },
        },
      };

      try {
        const response = await admin.messaging().send(fcmMessage);
        console.log("Notification sent successfully:", response);
      } catch (error) {
        console.error("Error sending notification:", error);
      }

      return null;
    });
