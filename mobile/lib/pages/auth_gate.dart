import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cancerlinc/services/auth.dart';
import 'package:cancerlinc/pages/login_page.dart';
import 'package:cancerlinc/components/bottom_bar.dart';

/// Routes the app between [LoginPage] and [BottomBar] based solely on
/// Firebase Auth state and the email-verified flag.
///
/// This widget deliberately does NOT consult isVerified (social-worker
/// approval) or isBanned — those checks belong to the pages that need them
/// (e.g. ChatPage). Any authenticated, email-verified user reaches [BottomBar].
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: AuthService().authStateChanges(),
      builder: (context, snapshot) {
        // While the auth stream is resolving, show a neutral loading screen
        // to prevent a login-page flash on cold start or hot restart.
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final user = snapshot.data;

        // Unauthenticated or email not yet verified → login flow.
        if (user == null || !user.emailVerified) {
          return const LoginPage();
        }

        // Authenticated and email-verified → main app.
        return const BottomBar();
      },
    );
  }
}
