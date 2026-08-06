import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:cancerlinc/pages/auth_gate.dart';

class VerifyEmail extends StatefulWidget {
  final String email;
  final bool isSignup;
  const VerifyEmail({super.key, required this.email, this.isSignup = false});

  @override
  State<VerifyEmail> createState() => _VerifyEmailState();
}

class _VerifyEmailState extends State<VerifyEmail> {
  Timer? _timer;
  bool _isCompletingSignup = false;

  Future<bool> _waitForUserDocument(String uid) async {
    final deadline = DateTime.now().add(const Duration(seconds: 10));
    final docRef = FirebaseFirestore.instance.collection('users').doc(uid);

    while (DateTime.now().isBefore(deadline)) {
      final snapshot = await docRef.get();
      if (snapshot.exists) return true;
      await Future<void>.delayed(const Duration(milliseconds: 500));
    }

    return false;
  }

  @override
  void initState() {
    super.initState();
    if (widget.isSignup) {
      _timer = Timer.periodic(const Duration(seconds: 3), (_) async {
        if (_isCompletingSignup) return;

        try {
          await FirebaseAuth.instance.currentUser?.reload();
        } on FirebaseAuthException catch (e) {
          debugPrint('reload() failed: ${e.code} ${e.message}');
          return;
        }
        final user = FirebaseAuth.instance.currentUser;
        if (user?.emailVerified == true) {
          _isCompletingSignup = true;
          _timer?.cancel();
          // Wait for onAuthUserCreated to write users/{uid} so AuthGate can
          // read the approval flag instead of briefly failing closed on a
          // missing document.
          await _waitForUserDocument(user!.uid);
          if (mounted) {
            // AuthGate, not BottomBar: a freshly email-verified patient still
            // needs client-services approval before entering the app.
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const AuthGate()),
              (route) => false,
            );
          }
        }
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              InkWell(
                onTap: () => Navigator.pop(context),
                borderRadius: BorderRadius.circular(6),
                child: const Padding(
                  padding: EdgeInsets.only(top: 30.0, bottom: 8.0),
                  child: Row(children: [
                    Padding(padding: EdgeInsets.only(left: 8.0)),
                    Icon(Icons.arrow_back_ios, color: Color(0xFF43474F)),
                    Text("Back", style: TextStyle(color: Color(0xFF43474F))),
                  ]),
                ),
              ),

              const SizedBox(height: 80),

              Center(
                child: Column(
                  children: [
                    Text(
                      widget.isSignup ? 'Verify Your Email' : 'Email Sent',
                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      widget.isSignup
                          ? 'A verification link was sent to\n${widget.email}.'
                          : 'Email sent. Please check your inbox\nto change your password.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 14, color: Colors.black54),
                    ),
                    if (widget.isSignup) ...[
                      const SizedBox(height: 24),
                      const Text.rich(
                        TextSpan(
                          text: "Can't find it? Check your ",
                          children: [
                            TextSpan(
                              text: 'spam',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            TextSpan(text: ' or '),
                            TextSpan(
                              text: 'junk',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            TextSpan(text: ' folder.'),
                          ],
                        ),
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: Colors.black38),
                      ),
                      // const SizedBox(height: 12),
                      // const Text('Waiting for verification...', style: TextStyle(fontSize: 13, color: Colors.black38)),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 40),

              if (widget.isSignup)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: OutlinedButton(
                      onPressed: () =>
                          FirebaseAuth.instance.currentUser?.sendEmailVerification(),
                      style: OutlinedButton.styleFrom(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                        overlayColor: Colors.black,
                        splashFactory: InkRipple.splashFactory,
                      ),
                      child: const Text('RESEND EMAIL', style: TextStyle(color: Color(0xFF43474F))),
                    ),
                  ),
                ),

              SizedBox(
                width: double.infinity,
                height: 46,
                child: ElevatedButton(
                  onPressed: () => Navigator.popUntil(context, (route) => route.isFirst),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFA1CD3A),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    // overlayColor: Colors.white,
                    splashFactory: InkRipple.splashFactory,
                  ),
                  child: const Text('RETURN TO LOGIN', style: TextStyle(color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
