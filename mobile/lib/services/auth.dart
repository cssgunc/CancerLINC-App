import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  User? get currentUser => _auth.currentUser;

  Stream<User?> authStateChanges() => _auth.authStateChanges();

  Future<UserCredential> signIn(String email, String password) async {
    return _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  Future<UserCredential> register(
    String email,
    String password, {
    String? firstName,
    String? lastName,
    String? phoneNumber,
  }) async {
    final credential = await _auth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );

    final trimmedFirstName = firstName?.trim() ?? '';
    final trimmedLastName = lastName?.trim() ?? '';
    final fullName = [
      trimmedFirstName,
      trimmedLastName,
    ].where((part) => part.isNotEmpty).join(' ');

    if (fullName.isNotEmpty) {
      await credential.user?.updateDisplayName(fullName);
      await credential.user?.reload();
    }

    final trimmedPhoneNumber = phoneNumber?.trim() ?? '';
    if (trimmedPhoneNumber.isNotEmpty && credential.user != null) {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(credential.user!.uid)
          .set({
        'phoneNumber': trimmedPhoneNumber,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    }

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

  Future<void> _mirrorEmailVerification(User user) async {
    await user.getIdToken(true);
    await FirebaseFirestore.instance.collection('users').doc(user.uid).update({
      'isVerified': true,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Permanently deletes the current user's account and all associated data.
  ///
  /// Calls the `deleteOwnAccount` Cloud Function, which deletes the Firebase
  /// Auth account and Firestore data server-side using the caller's own
  /// verified uid. This does NOT sign the user out locally — call [signOut]
  /// yourself immediately after this succeeds. (Order matters: if you sign
  /// out first, the ID token needed to authenticate this call is gone.)
  Future<void> deleteAccount() async {
    final callable = FirebaseFunctions.instance.httpsCallable(
      'deleteOwnAccount',
    );
    await callable.call();
  }
  
}
