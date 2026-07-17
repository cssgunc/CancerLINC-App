import 'package:flutter/material.dart';
import 'package:cancerlinc/pages/verify_email.dart';

import '../services/auth.dart';

class ForgotPassword extends StatefulWidget {
  final String? email;
  const ForgotPassword({super.key, this.email});

  @override
  State<ForgotPassword> createState() => _ForgotPasswordState();
}

class _ForgotPasswordState extends State<ForgotPassword> {
  late TextEditingController _emailController;
  final AuthService _authService = AuthService();
  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.email ?? '');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            children: [
            InkWell(
              onTap: () {
                Navigator.pop(context);
              },
              borderRadius: BorderRadius.circular(6),
              child: const Padding(
                padding: EdgeInsets.only(top: 30.0, bottom: 8.0),
                child: Row(children: [
                  const Padding(padding: EdgeInsets.only(left: 8.0)),
                  Icon(Icons.arrow_back_ios, color: Color(0xFF43474F)),
                  Text("Back to login", style: TextStyle(color: Color(0xFF43474F)))]),
              ),
            ),
            const Spacer(flex: 1),
            const Center(
              child: Text(
                "Forgot Password?",
                style: TextStyle(
                  fontSize: 25,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),

            Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Email Address',
                    style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.email_outlined, size: 20),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                    contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                ),
                const SizedBox(height: 12),

                // continue button (send code and go to verify)
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: () {
                      _authService.resetPassword(_emailController.text);
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => VerifyEmail(email: _emailController.text)),
                      );

                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF43474F),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      overlayColor: Colors.white,
                      splashFactory: InkRipple.splashFactory,
                    ),
                    child: const Text('CONTINUE', style: TextStyle(color: Colors.white)),
                  ),
                ),
            const Spacer(flex: 3),
          ],
        ),
      ),
      )
    );
  }
}