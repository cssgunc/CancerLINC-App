import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_functions/cloud_functions.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  User? get currentUser => _auth.currentUser;

  Stream<User?> authStateChanges() => _auth.authStateChanges();

  Future<UserCredential> signIn(String email, String password) async {
    final credential = await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );

    await ensureUserDocument(user: credential.user);

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

    final payload = <String, dynamic>{};
    if (firstName != null) payload['firstName'] = firstName;
    if (lastName != null) payload['lastName'] = lastName;

    await _functions.httpsCallable('ensureUserDocument').call(payload);
  }
}
