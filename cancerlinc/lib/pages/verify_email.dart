import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:cancerlinc/services/auth.dart';
import 'package:cancerlinc/components/bottom_bar.dart';

class VerifyEmail extends StatefulWidget {
  final String email;
  final bool isSignup;
  const VerifyEmail({Key? key, required this.email, this.isSignup = false}) : super(key: key);

  @override
  State<VerifyEmail> createState() => _VerifyEmailState();
}

class _VerifyEmailState extends State<VerifyEmail> {
  Timer? _timer;
  final AuthService _authService = AuthService();

  @override
  void initState() {
    super.initState();
    if (widget.isSignup) {
      _timer = Timer.periodic(const Duration(seconds: 3), (_) async {
        await FirebaseAuth.instance.currentUser?.reload();
        if (FirebaseAuth.instance.currentUser?.emailVerified == true) {
          _timer?.cancel();
          if (mounted) {
            Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const BottomBar()));
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
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: const Padding(
                  padding: EdgeInsets.only(top: 30.0),
                  child: Row(children: [
                    Padding(padding: EdgeInsets.only(left: 8.0)),
                    Icon(Icons.arrow_back_ios),
                    Text("Back"),
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
                      onPressed: () => _authService.sendEmailVerification(),
                      style: OutlinedButton.styleFrom(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      ),
                      child: const Text('RESEND EMAIL', style: TextStyle(color: Colors.black)),
                    ),
                  ),
                ),

              SizedBox(
                width: double.infinity,
                height: 46,
                child: ElevatedButton(
                  onPressed: () => Navigator.popUntil(context, (route) => route.isFirst),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
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
