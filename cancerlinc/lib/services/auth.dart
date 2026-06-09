import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cancerlinc/services/checklist_service.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final ChecklistService _checklistService = ChecklistService();

  User? get currentUser => _auth.currentUser;

  Stream<User?> authStateChanges() => _auth.authStateChanges();

  Future<UserCredential> signIn(
      String email, String password) async {
    final credential = await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );

    await ensureUserDocument(
      user: credential.user,
    );

    return credential;
  }


  Future<UserCredential> register(
      String email, String password, {
        String? firstName,
        String? lastName,
      }) async {
    final credential = await _auth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );

    final trimmedFirstName = firstName?.trim() ?? '';
    final trimmedLastName = lastName?.trim() ?? '';
    final fullName = [trimmedFirstName, trimmedLastName]
        .where((part) => part.isNotEmpty)
        .join(' ');

    if (fullName.isNotEmpty) {
      await credential.user?.updateDisplayName(fullName);
      await credential.user?.reload();
    }

    await ensureUserDocument(
      user: _auth.currentUser ?? credential.user,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
    );

    return credential;
  }

  Future<void> signOut() {
    return _auth.signOut();
  }

  Future<void> resetPassword(String email) {
    return _auth.sendPasswordResetEmail(email: email);
  }

  Future<void> sendEmailVerification() async {
    await _auth.currentUser?.sendEmailVerification();
  }

  Future<void> ensureUserDocument({
    User? user,
    String? firstName,
    String? lastName,
  }) async {
    final firebaseUser = user ?? _auth.currentUser;
    if (firebaseUser == null) return;

    final docRef = _firestore.collection('users').doc(firebaseUser.uid);
    final snapshot = await docRef.get();
    final now = FieldValue.serverTimestamp();

    final fallbackNameParts = _splitName(
      firebaseUser.displayName ?? firebaseUser.email,
    );
    final resolvedFirstName =
        (firstName?.trim().isNotEmpty ?? false) ? firstName!.trim() : fallbackNameParts.firstName;
    final resolvedLastName =
        (lastName?.trim().isNotEmpty ?? false) ? lastName!.trim() : fallbackNameParts.lastName;

    final defaults = <String, dynamic>{
      'uid': firebaseUser.uid,
      'email': firebaseUser.email ?? '',
      'firstName': resolvedFirstName,
      'lastName': resolvedLastName,
      'lastNameLower': resolvedLastName.toLowerCase(),
      'assignedSocialWorkerId': '',
      'assignedSocialWorkerName': '',
      'hospital': '',
      'phoneNumber': '',
      'profilePhotoUrl': firebaseUser.photoURL ?? '',
      'role': 'patient',
      'status': 'follow-up',
      'isVerified': firebaseUser.emailVerified,
      'updatedAt': now,
    };

    if (!snapshot.exists) {
      await docRef.set({
        ...defaults,
        'createdAt': now,
        'lastContactTimestamp': now,
      });
      await _checklistService.ensureDefaultChecklists(
        userId: firebaseUser.uid,
      );
      return;
    }

    final existingData = snapshot.data() ?? <String, dynamic>{};
    final backfill = <String, dynamic>{
      for (final entry in defaults.entries)
        if (!_hasMeaningfulValue(existingData[entry.key])) entry.key: entry.value,
      'isVerified': firebaseUser.emailVerified,
      'updatedAt': now,
    };

    if (backfill.isNotEmpty) {
      await docRef.set(backfill, SetOptions(merge: true));
    }
  }

  bool _hasMeaningfulValue(dynamic value) {
    if (value == null) return false;
    if (value is String) return value.trim().isNotEmpty;
    return true;
  }

  ({String firstName, String lastName}) _splitName(String? rawName) {
    final cleaned = (rawName ?? '').trim();
    if (cleaned.isEmpty) {
      return (firstName: '', lastName: '');
    }

    final parts = cleaned
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();

    if (parts.isEmpty) {
      return (firstName: '', lastName: '');
    }

    if (parts.length == 1) {
      return (firstName: parts.first, lastName: '');
    }

    return (
      firstName: parts.first,
      lastName: parts.sublist(1).join(' '),
    );
  }
}
