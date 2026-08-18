import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cancerlinc/services/auth.dart';
import 'package:cancerlinc/pages/login_page.dart';
import 'package:cancerlinc/pages/pending_verification.dart';
import 'package:cancerlinc/components/bottom_bar.dart';

/// Routes the app between [LoginPage], [PendingVerificationScreen] and
/// [BottomBar]. A patient reaches the main app only when all three hold:
///
///   1. signed in,
///   2. email verified (Firebase Auth's own `emailVerified` claim), and
///   3. approved by CancerLINC client services (`users/{uid}.isVerified`).
///
/// `isVerified` is approval state, written only by staff — it is NOT a mirror
/// of email verification. The two are tracked separately on purpose; see the
/// note on users/{uid} in firestore.rules.
///
/// This is the ONLY place the approval check lives, so every route into the
/// app must funnel through here rather than pushing [BottomBar] directly.
///
/// The approval check subscribes to the user document rather than reading it
/// once, so a patient approved (or declined) by staff mid-session moves to the
/// right screen without needing to restart the app.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  static const Widget _loading = Scaffold(
    body: Center(child: CircularProgressIndicator()),
  );

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: AuthService().authStateChanges(),
      builder: (context, snapshot) {
        // While the auth stream is resolving, show a neutral loading screen
        // to prevent a login-page flash on cold start or hot restart.
        if (snapshot.connectionState == ConnectionState.waiting) {
          return _loading;
        }

        final user = snapshot.data;

        // Unauthenticated or email not yet verified → login flow.
        if (user == null || !user.emailVerified) {
          return const LoginPage();
        }

        return _ApprovalGate(uid: user.uid);
      },
    );
  }
}

/// Holds the main app behind the client-services approval flag on the
/// patient's own user document.
class _ApprovalGate extends StatelessWidget {
  final String uid;

  const _ApprovalGate({required this.uid});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return AuthGate._loading;
        }

        // If the document can't be read we cannot confirm approval, so fail
        // closed rather than letting an unapproved patient through. The same
        // applies before the doc exists at all: onAuthUserCreated writes it
        // asynchronously just after signup, and this rebuilds once it lands.
        final data = snapshot.data?.data();
        if (data == null) {
          return const PendingVerificationScreen();
        }

        // Declined patients get their own copy — telling someone client
        // services has already turned down to "wait for a call" would be a lie.
        if (data['isBanned'] == true) {
          return const PendingVerificationScreen(isDenied: true);
        }

        if (data['isVerified'] != true) {
          return const PendingVerificationScreen();
        }

        return const BottomBar();
      },
    );
  }
}
