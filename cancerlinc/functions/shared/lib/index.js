"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessageNotification = exports.deactivateStaleChats = exports.onMessageCreated = exports.sendChatImageMessage = exports.sendChatMessage = exports.createUserChat = exports.onAuthUserCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_functions_1 = require("firebase-functions");
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const firestore = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
const inactiveAfterMs = 7 * 24 * 60 * 60 * 1000;
const staleBatchSize = 400;
const imageOnlySummary = "Sent a photo";
const imageWithTextSuffix = " (photo attached)";
const publicCallableOptions = { invoker: "public" };
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
function dataKeys(data) {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
        return [];
    }
    return Object.keys(data);
}
function hasHeader(request, name) {
    const value = request.rawRequest.header(name);
    return typeof value === "string" && value.length > 0;
}
function logCallableRequest(callable, request) {
    firebase_functions_1.logger.info("Callable request received", {
        callable,
        hasAuth: request.auth !== undefined,
        uid: request.auth?.uid ?? null,
        tokenEmailVerified: request.auth?.token.email_verified ?? null,
        signInProvider: request.auth?.token.firebase?.sign_in_provider ?? null,
        hasAppCheck: request.app !== undefined,
        appId: request.app?.appId ?? null,
        hasAuthorizationHeader: hasHeader(request, "authorization"),
        hasFirebaseInstanceIdToken: hasHeader(request, "firebase-instance-id-token"),
        contentType: request.rawRequest.header("content-type") ?? null,
        dataKeys: dataKeys(request.data),
    });
}
function requireAuthUid(uid) {
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in.");
    }
    return uid;
}
function stringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}
function splitName(rawName) {
    const cleaned = (rawName ?? "").trim();
    if (!cleaned) {
        return { firstName: "", lastName: "" };
    }
    const parts = cleaned.split(/\s+/).filter((part) => part.length > 0);
    if (parts.length === 0) {
        return { firstName: "", lastName: "" };
    }
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: "" };
    }
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
function buildMessageSummary(content, messageType) {
    if (messageType === "image") {
        return content ? `${content}${imageWithTextSuffix}` : imageOnlySummary;
    }
    return content;
}
async function ensureDefaultChecklists(userId) {
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
async function getSenderName(uid) {
    const userDoc = await firestore.collection("users").doc(uid).get();
    const data = userDoc.data() ?? {};
    const firstName = stringValue(data.firstName);
    const lastName = stringValue(data.lastName);
    const fullName = [firstName, lastName]
        .filter((part) => part.length > 0)
        .join(" ");
    return fullName || "CancerLINC user";
}
async function findChatParticipant(patientId) {
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
    throw new https_1.HttpsError("failed-precondition", "No available user was found to create a chat.");
}
async function assertCanSendMessage(uid, chatId) {
    const chatDoc = await firestore.collection("chats").doc(chatId).get();
    if (!chatDoc.exists) {
        throw new https_1.HttpsError("not-found", "Chat not found.");
    }
    const participants = chatDoc.data()?.participants;
    if (!Array.isArray(participants) || !participants.includes(uid)) {
        throw new https_1.HttpsError("permission-denied", "You are not a participant in this chat.");
    }
}
exports.onAuthUserCreated = functions.auth.user().onCreate(async (user) => {
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
            isVerified: user.emailVerified,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastContactTimestamp: serverTimestamp(),
        });
    }
    await ensureDefaultChecklists(user.uid);
});
exports.createUserChat = (0, https_1.onCall)(publicCallableOptions, async (request) => {
    logCallableRequest("createUserChat", request);
    const uid = requireAuthUid(request.auth?.uid);
    const chatRef = firestore.collection("chats").doc(uid);
    const existing = await chatRef.get();
    if (existing.exists) {
        firebase_functions_1.logger.info("createUserChat returning existing chat", { uid });
        return { chatId: uid };
    }
    const otherUserId = await findChatParticipant(uid);
    await chatRef.set({
        chatId: uid,
        participants: [uid, otherUserId],
        lastMessage: "",
        lastMessageTimestamp: serverTimestamp(),
    });
    firebase_functions_1.logger.info("createUserChat created chat", { uid, otherUserId });
    return { chatId: uid };
});
exports.sendChatMessage = (0, https_1.onCall)(publicCallableOptions, async (request) => {
    logCallableRequest("sendChatMessage", request);
    const uid = requireAuthUid(request.auth?.uid);
    const data = request.data;
    const chatId = stringValue(data?.chatId);
    const content = stringValue(data?.content);
    firebase_functions_1.logger.info("sendChatMessage parsed request", {
        uid,
        chatId,
        hasContent: content.length > 0,
        contentLength: content.length,
    });
    if (!chatId || !content) {
        throw new https_1.HttpsError("invalid-argument", "chatId and content are required.");
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
    firebase_functions_1.logger.info("sendChatMessage committed", {
        uid,
        chatId,
        messageId: messageRef.id,
    });
    return { messageId: messageRef.id };
});
exports.sendChatImageMessage = (0, https_1.onCall)(publicCallableOptions, async (request) => {
    logCallableRequest("sendChatImageMessage", request);
    const uid = requireAuthUid(request.auth?.uid);
    const data = request.data;
    const chatId = stringValue(data?.chatId);
    const imageUrl = stringValue(data?.imageUrl);
    const imagePath = stringValue(data?.imagePath);
    const imageFileName = stringValue(data?.imageFileName);
    const imageMimeType = stringValue(data?.imageMimeType) || "image/jpeg";
    const imageSizeBytes = typeof data?.imageSizeBytes === "number" ?
        data.imageSizeBytes :
        0;
    firebase_functions_1.logger.info("sendChatImageMessage parsed request", {
        uid,
        chatId,
        hasImageUrl: imageUrl.length > 0,
        imagePath,
        imageMimeType,
        imageSizeBytes,
    });
    if (!chatId || !imageUrl || !imagePath || !imageFileName) {
        throw new https_1.HttpsError("invalid-argument", "chatId and image metadata are required.");
    }
    if (!imagePath.startsWith(`chatAttachments/${chatId}/`)) {
        throw new https_1.HttpsError("invalid-argument", "Image path does not belong to this chat.");
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
    firebase_functions_1.logger.info("sendChatImageMessage committed", {
        uid,
        chatId,
        messageId: messageRef.id,
    });
    return { messageId: messageRef.id };
});
exports.onMessageCreated = (0, firestore_1.onDocumentCreated)("chats/{chatId}/messages/{messageId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return;
    }
    const chatId = event.params.chatId;
    const message = snapshot.data();
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
        transaction.set(patientRef, {
            status: nextStatus,
            awaitingReply: senderId === chatId,
            lastMessageText: buildMessageSummary(content, message.messageType),
            lastContactTimestamp: serverTimestamp(),
        }, { merge: true });
    });
});
exports.deactivateStaleChats = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - inactiveAfterMs);
    const staleQuery = firestore
        .collection("users")
        .where("role", "==", "patient")
        .where("status", "==", "active")
        .where("lastContactTimestamp", "<=", cutoff);
    const snapshot = await staleQuery.get();
    if (snapshot.empty) {
        firebase_functions_1.logger.info("deactivateStaleChats: no stale patients");
        return;
    }
    let updated = 0;
    for (let i = 0; i < snapshot.docs.length; i += staleBatchSize) {
        const batch = firestore.batch();
        for (const doc of snapshot.docs.slice(i, i + staleBatchSize)) {
            batch.update(doc.ref, { status: "inactive" });
            updated += 1;
        }
        await batch.commit();
    }
    firebase_functions_1.logger.info(`deactivateStaleChats: set ${updated} patient(s) to inactive`);
});
exports.sendMessageNotification = (0, firestore_1.onDocumentCreated)(
// Watches for any new document created inside chat message subcollection
"chats/{chatId}/messages/{messageId}", async (event) => {
    if (!event.data) {
        console.log("No message data, skipping notification");
        return null;
    }
    const message = event.data.data();
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
    const fcmMessage = {
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
    }
    catch (error) {
        console.error("Error sending notification:", error);
    }
    return null;
});
//# sourceMappingURL=index.js.map