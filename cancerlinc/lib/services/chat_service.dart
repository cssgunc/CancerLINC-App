import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';

class ChatService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  String get currentUserId => _auth.currentUser!.uid;

  /// Returns the chat document for the current user (doc ID = currentUserId),
  /// or null if it doesn't exist yet.
  Future<DocumentSnapshot?> getUserChat() async {
    final doc = await _db.collection('chats').doc(currentUserId).get();
    return doc.exists ? doc : null;
  }

  /// Finds the current user's chat or asks the backend to create one.
  Future<String> findOrCreateUserChat() async {
    final existing = await getUserChat();
    if (existing != null) return existing.id;

    return createChat();
  }

  /// Creates a new chat document with ID = currentUserId on the backend.
  Future<String> createChat() async {
    final result = await _functions.httpsCallable('createUserChat').call();
    final data = Map<String, dynamic>.from(result.data as Map);
    return data['chatId'] as String;
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
    await _functions.httpsCallable('sendChatMessage').call({
      'chatId': chatId,
      'content': content,
    });
  }

  /// Uploads [imageFile] to Firebase Storage and sends an image message.
  Future<void> sendImageMessage(
    String chatId,
    File imageFile,
    String fileName,
  ) async {
    final storageRef = FirebaseStorage.instance.ref().child(
      'chatAttachments/$chatId/${DateTime.now().millisecondsSinceEpoch}_$fileName',
    );

    final snapshot = await storageRef.putFile(imageFile);
    final imageUrl = await snapshot.ref.getDownloadURL();

    await _functions.httpsCallable('sendChatImageMessage').call({
      'chatId': chatId,
      'imageUrl': imageUrl,
      'imagePath': storageRef.fullPath,
      'imageFileName': fileName,
      'imageMimeType': 'image/jpeg',
      'imageSizeBytes': await imageFile.length(),
    });
  }
}
