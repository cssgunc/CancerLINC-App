// lib/login_page.dart
import 'package:flutter/material.dart';
import 'package:cancerlinc/pages/forgot_password.dart';
import 'package:cancerlinc/pages/create_account.dart';
import 'package:cancerlinc/pages/home_page.dart';
import 'package:cancerlinc/components/bottom_bar.dart';
class LoginPage extends StatefulWidget {
    const LoginPage({Key? key}) : super(key: key);

    @override
    State<LoginPage> createState() => _LoginPageState();
  }

  class _LoginPageState extends State<LoginPage> {
    final TextEditingController _emailController = TextEditingController(); //email controller
    final TextEditingController _passwordController = TextEditingController(); //password controller
    bool _rememberMe = false;

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
                // logo placeholder
                Container(
                  alignment: Alignment.center,
                  child: Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.grey.shade200,
                    ),
                    child: const Center(
                      child: Text(
                        'Logo',
                        style: TextStyle(fontSize: 20, color: Colors.black54),
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
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const BottomBar()),
                      );
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
