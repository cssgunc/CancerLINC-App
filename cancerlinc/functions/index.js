const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendMessageNotification = onDocumentCreated(
    // Watches for any new document created inside chat message subcollection
    "chats/{chatId}/messages/{messageId}",
    async (event) => {
      // The new message data
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

      const patientDoc = await admin.firestore()
      // look up the patient's FCM token from user document
      // NotificationService._saveTokenToFirestore() saves this
          .collection("users")
          .doc(patientId)
          .get();

      if (!patientDoc.exists) {
        console.log("Patient document not found:", patientId);
        return null;
      }

      const fcmToken = patientDoc.data().fcmToken;

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
        // (Android specific)ensures notification arrives
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
