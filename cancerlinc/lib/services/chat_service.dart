import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';

class ChatService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  String get currentUserId => _auth.currentUser!.uid;

  void _debugLog(String message) {
    if (kDebugMode) {
      debugPrint('[ChatService] $message');
    }
  }

  Future<User> _requireCallableAuth(String operation) async {
    final user = _auth.currentUser;
    _debugLog(
      '$operation auth preflight: hasUser=${user != null}, '
      'uid=${user?.uid}, emailVerified=${user?.emailVerified}',
    );

    if (user == null) {
      throw FirebaseAuthException(
        code: 'unauthenticated',
        message: 'You must be signed in.',
      );
    }

    final token = await user.getIdTokenResult(true);
    _debugLog(
      '$operation token ready: uid=${user.uid}, '
      'emailVerified=${user.emailVerified}, '
      'tokenEmailVerified=${token.claims?['email_verified']}, '
      'issuedAt=${token.issuedAtTime}, expiresAt=${token.expirationTime}, '
      'signInProvider=${token.signInProvider}',
    );

    return user;
  }

  Future<HttpsCallableResult<dynamic>> _callFunction(
    String name, [
    Map<String, dynamic>? data,
  ]) async {
    final user = await _requireCallableAuth(name);
    _debugLog('$name callable start: uid=${user.uid}');

    try {
      final result = await _functions.httpsCallable(name).call(data);
      _debugLog('$name callable success: uid=${user.uid}');
      return result;
    } on FirebaseFunctionsException catch (e) {
      _debugLog(
        '$name callable failed: uid=${user.uid}, code=${e.code}, '
        'message=${e.message}, details=${e.details}',
      );
      rethrow;
    } catch (e) {
      _debugLog('$name callable failed unexpectedly: uid=${user.uid}, error=$e');
      rethrow;
    }
  }

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
    final result = await _callFunction('createUserChat');
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
    await _callFunction('sendChatMessage', {
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
    await _requireCallableAuth('sendChatImageMessage upload');
    final storageRef = FirebaseStorage.instance.ref().child(
      'chatAttachments/$chatId/${DateTime.now().millisecondsSinceEpoch}_$fileName',
    );

    final snapshot = await storageRef.putFile(imageFile);
    final imageUrl = await snapshot.ref.getDownloadURL();

    await _callFunction('sendChatImageMessage', {
      'chatId': chatId,
      'imageUrl': imageUrl,
      'imagePath': storageRef.fullPath,
      'imageFileName': fileName,
      'imageMimeType': 'image/jpeg',
      'imageSizeBytes': await imageFile.length(),
    });
  }
}
