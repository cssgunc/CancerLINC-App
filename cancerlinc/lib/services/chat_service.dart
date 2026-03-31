import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class ChatService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  String get currentUserId => _auth.currentUser!.uid;

  /// Returns the chat document for the current user (doc ID = currentUserId),
  /// or null if it doesn't exist yet.
  Future<DocumentSnapshot?> getUserChat() async {
    final doc = await _db.collection('chats').doc(currentUserId).get();
    return doc.exists ? doc : null;
  }

  /// Finds the current user's chat or creates one with the first other user
  /// found in the `users` collection. Returns the chatId (= currentUserId).
  Future<String> findOrCreateUserChat() async {
    final existing = await getUserChat();
    if (existing != null) return existing.id;

    final usersQuery = await _db
        .collection('users')
        .where(FieldPath.documentId, isNotEqualTo: currentUserId)
        .limit(1)
        .get();

    if (usersQuery.docs.isEmpty) throw Exception('No other user found to chat with.');

    return createChat(usersQuery.docs.first.id);
  }

  /// Creates a new chat document with ID = currentUserId.
  Future<String> createChat(String otherUserId) async {
    final docRef = _db.collection('chats').doc(currentUserId);

    await docRef.set({
      'chatId': currentUserId,
      'participants': [currentUserId, otherUserId],
      'lastMessage': '',
      'lastMessageTimestamp': FieldValue.serverTimestamp(),
    });

    return currentUserId;
  }

  /// Streams messages for [chatId] ordered oldest-first.
  Stream<QuerySnapshot> streamMessages(String chatId) {
    return _db
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', descending: false)
        .snapshots();
  }

  /// Adds a message to [chatId] and updates the chat's lastMessage fields.
  Future<void> sendMessage(String chatId, String content) async {
    final messagesRef =
        _db.collection('chats').doc(chatId).collection('messages');

    final messageDoc = messagesRef.doc();

    await messageDoc.set({
      'messageId': messageDoc.id,
      'content': content,
      'senderId': currentUserId,
      'isRead': false,
      'timestamp': FieldValue.serverTimestamp(),
    });

    await _db.collection('chats').doc(chatId).update({
      'lastMessage': content,
      'lastMessageTimestamp': FieldValue.serverTimestamp(),
    });
  }
}
