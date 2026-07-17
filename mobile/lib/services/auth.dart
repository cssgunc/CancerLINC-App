import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  User? get currentUser => _auth.currentUser;

  Stream<User?> authStateChanges() => _auth.authStateChanges();

  Future<UserCredential> signIn(String email, String password) async {
    final credential = await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
    final user = credential.user;
    if (user?.emailVerified == true) {
      await _mirrorEmailVerification(user!);
    }

    return credential;
  }

  Future<UserCredential> register(
    String email,
    String password, {
    String? firstName,
    String? lastName,
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
}
