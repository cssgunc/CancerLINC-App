import 'package:flutter/material.dart';
import 'package:cancerlinc/pages/login_page.dart';
import 'package:cancerlinc/pages/change_password.dart';

class VerifyEmail extends StatefulWidget {
  final String email; //hold email
  const VerifyEmail({Key? key, required this.email}) : super(key: key);

  @override
  State<VerifyEmail> createState() => _VerifyEmailState();
}

class _VerifyEmailState extends State<VerifyEmail> {
  final TextEditingController _codeController = TextEditingController();

  @override
  void dispose() {
    _codeController.dispose();
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
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const LoginPage()),
                );
              },
              child: const Padding(
                padding: EdgeInsets.only(top: 30.0),
                child: Row(children: [
                  const Padding(padding: EdgeInsets.only(left: 8.0)), 
                  Icon(Icons.arrow_back_ios), 
                  Text("Back to login")]),
              ),
            ),
              Center(
                child: Column(
                  children: [
                    const SizedBox(height: 8),
                    const Text('Verify Email', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 16),
                    Text(
                      'A verification code was sent to\n${widget.email}. Please enter it below.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 14, color: Colors.black54),
                    ),
                    const SizedBox(height: 8),
                    const Text('\nThe code will expire in 10 minutes.', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: Colors.black54)),
                  ],
                ),
              ),

              const SizedBox(height: 32),
              const Text('Enter Verification Code', style: TextStyle(fontSize: 13)),
              const SizedBox(height: 8),
              TextField(
                controller: _codeController,
                decoration: InputDecoration(
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                  contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
                  filled: true,
                  fillColor: Colors.white,
                ),
              ),

              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: ElevatedButton(
                  onPressed: () {
                    final code = _codeController.text.trim();
                    if (code.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please enter the verification code')),
                      );
                      return;
                    }

                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (context) => ChangePasswordPage(code: code)),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  child: const Text('CONTINUE', style: TextStyle(color: Colors.white)),
                ),
              ),

              const SizedBox(height: 16),
              SizedBox(
                height: 46,
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {print("Send Code Again");},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  child: const Text('RESEND CODE', style: TextStyle(color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
 
