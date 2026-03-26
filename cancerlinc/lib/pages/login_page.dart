// lib/login_page.dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:cancerlinc/pages/forgot_password.dart';
import 'package:cancerlinc/pages/create_account.dart';
import 'package:cancerlinc/pages/home_page.dart';
import 'package:cancerlinc/components/bottom_bar.dart';
import 'package:cancerlinc/services/auth.dart';

class LoginPage extends StatefulWidget {
    const LoginPage({Key? key}) : super(key: key);

    @override
    State<LoginPage> createState() => _LoginPageState();
  }

  class _LoginPageState extends State<LoginPage> {
    final AuthService _authService = AuthService();
    final TextEditingController _emailController = TextEditingController(); //email controller
    final TextEditingController _passwordController = TextEditingController(); //password controller
    bool _rememberMe = false;
    String? _errorMessage;

    @override
    void dispose() { //get rid of controllers when not needed
      _emailController.dispose();
      _passwordController.dispose();
      super.dispose();
    }

    @override
    Widget build(BuildContext context) {
      return Scaffold(
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: 8),
                SizedBox(
                  height: 160,
                  child: Center(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(80), // keep it circular
                      child: Image.asset(
                        'assets/images/logo.png',
                        width: 160,
                        height: 160,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 24),
                const TextButton(
                  onPressed: null,
                  child: Text(
                    'Login',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.black),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Enter your email address and\npassword to access your account.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: Colors.black),
                ),

                const SizedBox(height: 24),

                // email field
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

                const SizedBox(height: 16),

                // password field
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Password',
                    style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                  ),
                ),

                const SizedBox(height: 8),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.lock_outline, size: 20),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                    contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                ),
                if (_errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        border: Border.all(color: Colors.red.shade300),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.error_outline, color: Colors.red, size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(
                                color: Colors.red,
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 12),

                // remember me and forgot password
                Row(
                  children: [
                    Row(
                      children: [
                        Checkbox(
                          value: _rememberMe,
                          onChanged: (v) => setState(() => _rememberMe = v ?? false),
                        ),
                        const Text('Remember Me?'),
                      ],
                    ),
                    const Spacer(),
                    TextButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => ForgotPassword(email: _emailController.text)),
                          );
                        },
                      child: const Text(
                        'Forgot Password?',
                        style: TextStyle(decoration: TextDecoration.underline),
                      ),
                    )
                  ],
                ),

                const SizedBox(height: 8),

                // login button
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: () async {
                      try {
                        final userCredential = await _authService.signIn(
                          _emailController.text.trim(),
                          _passwordController.text.trim(),
                        );
                        if (mounted) {
                          Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(builder: (context) => const BottomBar()),
                          );
                        }
                      } on FirebaseAuthException catch (e) {
                        setState(() {
                          _errorMessage = 'Incorrect Email or Password Entered';
                        });
                      }
                    },

                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.black,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    ),
                    child: const Text('LOGIN', style: TextStyle(color: Colors.white)),
                  ),
                ),

                const SizedBox(height: 12),
                // or separator
                Center(child: Text('- OR -', style: TextStyle(color: Colors.grey))),

                const SizedBox(height: 12),

                // Create account button
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => CreateAccountPage()),
                          );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.black,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    ),
                    child: const Text('CREATE AN ACCOUNT', style: TextStyle(color: Colors.white)),
                  ),
                ),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      );
    }
  }
