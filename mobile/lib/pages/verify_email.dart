import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:cancerlinc/components/bottom_bar.dart';
import 'package:cancerlinc/utils/haptics.dart';

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

  Future<void> _mirrorEmailVerification(User user) async {
    await user.getIdToken(true);
    await FirebaseFirestore.instance.collection('users').doc(user.uid).update({
      'isVerified': true,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  @override
  void initState() {
    super.initState();
    if (widget.isSignup) {
      _timer = Timer.periodic(const Duration(seconds: 3), (_) async {
        if (_isCompletingSignup) return;

        await FirebaseAuth.instance.currentUser?.reload();
        final user = FirebaseAuth.instance.currentUser;
        if (user?.emailVerified == true) {
          _isCompletingSignup = true;
          _timer?.cancel();
          await _waitForUserDocument(user!.uid);
          await _mirrorEmailVerification(user);
          if (mounted) {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const BottomBar()),
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
                          ? 'A verification link was sent to\n${widget.email}.\nClick the link in your inbox to continue.'
                          : 'Email sent. Please check your inbox\nto change your password.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 14, color: Colors.black54),
                    ),
                    if (widget.isSignup) ...[
                      const SizedBox(height: 8),
                      const Text(
                        "Can't find it? Check your spam or junk folder.",
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: Colors.black38),
                      ),
                      const SizedBox(height: 12),
                      const Text('Waiting for verification...', style: TextStyle(fontSize: 13, color: Colors.black38)),
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
                      onPressed: () {
                        AppHaptics.tap();
                        FirebaseAuth.instance.currentUser
                            ?.sendEmailVerification();
                      },
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
                  onPressed: () {
                    AppHaptics.tap();
                    Navigator.popUntil(context, (route) => route.isFirst);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF43474F),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    overlayColor: Colors.white,
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
