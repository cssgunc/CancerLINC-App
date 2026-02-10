import 'package:cancerlinc/pages/login_page.dart';
import 'package:flutter/material.dart';

class ChangePasswordPage extends StatefulWidget {
	final String code; // verification code passed from forgot_password.dart

	const ChangePasswordPage({Key? key, required this.code}) : super(key: key);

	@override
	State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
	final _formKey = GlobalKey<FormState>(); //form
	final TextEditingController _passwordController = TextEditingController();
	final TextEditingController _confirmController = TextEditingController();
	bool _obscure1 = true; //hide password text
	bool _obscure2 = true;

	@override
	void dispose() {
		_passwordController.dispose();
		_confirmController.dispose();
		super.dispose();
	}

	String? _validatePassword(String? value) { //validate password with some basic logic (at least 12 characters, has a number)
		if (value == null || value.isEmpty) return 'Enter a new password';
		if (value.length < 12) return 'Password must be at least 12 characters';
		if (!RegExp(r'[0-9]').hasMatch(value)) return 'Password must include at least one number';
		return null;
	}

	String? _validateConfirm(String? value) { //ensure passwords match
		if (value == null || value.isEmpty) return 'Retype your new password';
		if (value != _passwordController.text) return 'Passwords do not match';
		return null;
	}

	void _onSubmit() {
		// require that the incoming verification code is not empty
		if (widget.code.isEmpty) {
			// shouldn't happen if caller passed a code, but guard anyway
			showDialog<void>(
				context: context,
				builder: (context) => AlertDialog(
					title: const Text('Verification code missing'),
					content: const Text('Please enter the verification code in the previous screen.'),
					actions: [
						TextButton(
							onPressed: () => Navigator.of(context).pop(),
							child: const Text('OK'),
						),
					],
				),
			);
			return;
		}

		if (_formKey.currentState?.validate() ?? false) {
			// at this point we'd call the backend to change the password using
			// the verification code (widget.code) and the new password.
			// for this model, just show a confirmation and pop to login
			showDialog<void>(
				context: context,
				builder: (context) => AlertDialog(
					title: const Text('Password changed'),
					content: const Text('Your password has been updated. You can now log in.'),
					actions: [
						TextButton(
							onPressed: () {
								Navigator.of(context).pop(); // close dialog
								Navigator.of(context).popUntil((route) => route.isFirst);
							},
							child: const Text('OK'),
						),
					],
				),
			);
		}
	}

	@override
	Widget build(BuildContext context) {
		final bool codeMissing = widget.code.isEmpty;

		return Scaffold(
			body: SafeArea(
				child: SingleChildScrollView(
					child: Padding(
						padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 24.0),
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

								const SizedBox(height: 24),

								Center(
									child: Column(
										children: [
											const Text('Change Password',
													style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600)),
											const SizedBox(height: 12),
											const Text(
												'Create a new password. It must include 12 characters and at least one number.',
												textAlign: TextAlign.center,
												style: TextStyle(fontSize: 14, color: Colors.black87),
											),
										],
									),
								),

								const SizedBox(height: 32),

								if (codeMissing) ...[
									const Text(
										'Verification code missing. Go back and enter the code sent to your email.',
										style: TextStyle(color: Colors.red),
									),
									const SizedBox(height: 16),
								],

								Form(
									key: _formKey,
									child: Column(  
										crossAxisAlignment: CrossAxisAlignment.start,
										children: [
											const Text('New Password', style: TextStyle(fontSize: 16)),
											const SizedBox(height: 8),
											TextFormField(
												controller: _passwordController,
												obscureText: _obscure1,
												validator: _validatePassword,
												decoration: InputDecoration(
													border: OutlineInputBorder(borderRadius: BorderRadius.circular(8.0)),
													suffixIcon: IconButton(
														icon: Icon(_obscure1 ? Icons.visibility : Icons.visibility_off),
														onPressed: () => setState(() => _obscure1 = !_obscure1),
													),
													contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
												),
											),

											const SizedBox(height: 20),

											const Text('Retype New Password', style: TextStyle(fontSize: 16)),
											const SizedBox(height: 8),
											TextFormField(
												controller: _confirmController,
												obscureText: _obscure2,
												validator: _validateConfirm,
												decoration: InputDecoration(
													border: OutlineInputBorder(borderRadius: BorderRadius.circular(8.0)),
													suffixIcon: IconButton(
														icon: Icon(_obscure2 ? Icons.visibility : Icons.visibility_off),
														onPressed: () => setState(() => _obscure2 = !_obscure2),
													),
													contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
												),
											),

											const SizedBox(height: 24),

											SizedBox(
												width: double.infinity,
												height: 48,
												child: ElevatedButton(
													style: ElevatedButton.styleFrom(
														backgroundColor: Colors.black,
														shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6.0)),
													),
													onPressed: codeMissing ? null : _onSubmit,
													child: const Text('LOGIN', style: TextStyle(letterSpacing: 1.5, color: Colors.white)),
												),
											),
										],
									),
								),
							],
						),
					),
				),
			),
		);
	}
}

