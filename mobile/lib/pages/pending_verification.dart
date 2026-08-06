import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cancerlinc/components/call_number.dart';
import 'package:cancerlinc/pages/login_page.dart';

/// Shown to authenticated patients who have not been approved by CancerLINC
/// client services, in place of the main app. [AuthGate] decides when this
/// appears; see the approval-gate notes there.
///
/// [isDenied] distinguishes the two non-approved states, because they need
/// very different copy: a patient still awaiting review is told to expect a
/// call, while a patient client services has already declined must not be,
/// since no call is coming.
class PendingVerificationScreen extends StatefulWidget {
  final bool isDenied;

  const PendingVerificationScreen({super.key, this.isDenied = false});

  @override
  State<PendingVerificationScreen> createState() =>
      _PendingVerificationScreenState();
}

class _PendingVerificationScreenState extends State<PendingVerificationScreen> {
  bool _checking = false;

  Future<void> _signOut() async {
    // Guarded because this is also reached from _refreshStatus's error path,
    // which may run after the gate has already swapped this screen out.
    if (!mounted) return;
    final navigator = Navigator.of(context);
    await FirebaseAuth.instance.signOut();
    if (!mounted) return;
    navigator.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginPage()),
      (route) => false,
    );
  }

  /// Re-checks account status on demand.
  ///
  /// [AuthGate] already listens to the user document, so an approval normally
  /// lands here on its own. This button covers the cases that listener can't:
  /// a dropped or backgrounded socket, a reply served from the offline cache,
  /// and account-level changes (disabled or deleted) that live in Firebase
  /// Auth rather than in Firestore. It also gives a waiting patient something
  /// to do besides relaunch the app.
  Future<void> _refreshStatus() async {
    if (_checking) return;
    setState(() => _checking = true);

    final messenger = ScaffoldMessenger.of(context);
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return; // AuthGate routes back to login on its own.

      // Surfaces account-level changes; throws if the account was disabled
      // or deleted while the patient sat on this screen.
      await user.reload();

      // Read from the server, not the cache, so "check again" can't report a
      // stale local copy. This also refreshes the cache, which re-fires
      // AuthGate's listener — so on approval the gate moves the patient into
      // the app without this screen having to navigate anywhere itself.
      final snapshot = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .get(const GetOptions(source: Source.server));

      final data = snapshot.data();
      final approved = data?['isVerified'] == true && data?['isBanned'] != true;

      if (!mounted || approved) return;
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            "You're still awaiting review. We'll let you know as soon as "
            'client services has been in touch.',
          ),
        ),
      );
    } on FirebaseAuthException {
      // reload() rejects a disabled or deleted account — don't strand the
      // patient on a screen promising a call that isn't coming.
      await _signOut();
    } catch (_) {
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            "Couldn't check your status just now. Please check your "
            'connection and try again.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDenied = widget.isDenied;
    final title = isDenied ? 'Account Not Approved' : 'Thanks for Your Interest';
    final body = isDenied
        ? "We weren't able to approve your account for app access. If you "
              'think this is a mistake, or if you are a CancerLINC client, '
              'please reach out to us at'
        : "Your account is being reviewed. Once client services contacts "
              "you, you'll have full access to the app. Thank you for your "
              'interest in CancerLINC.\n\nQuestions? Call us at';

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isDenied ? Icons.info_outline : Icons.schedule,
                  size: 56,
                  color: const Color(0xada1cd3a),
                ),
                const SizedBox(height: 24),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF43474F),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  body,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 15,
                    height: 1.5,
                    color: Colors.black54,
                  ),
                ),
                const SizedBox(height: 8),
                const CallButton(phoneNumber: cancerLincSupportPhone),
                if (!isDenied) ...[
                  const SizedBox(height: 24),
                  Text(
                    socialWorkerHours,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 13, color: Colors.black38),
                  ),
                ],
                const SizedBox(height: 40),

                // Only offered while a decision is still pending. A declined
                // patient re-checking would just re-read the same "no", and
                // AuthGate's listener already moves them if staff reverse it.
                if (!isDenied)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: OutlinedButton(
                        onPressed: _checking ? null : _signOut,
                        style: OutlinedButton.styleFrom(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(6),
                          ),
                          overlayColor: Colors.black,
                          splashFactory: InkRipple.splashFactory,
                        ),
                        child: _checking
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFF43474F),
                                ),
                              )
                            : const Text(
                                'RETURN TO LOGIN',
                                style: TextStyle(color: Color(0xFF43474F)),
                              ),
                      ),
                    ),
                  ),

                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: _checking ? null : _refreshStatus,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xF0a1cd3a),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6),
                      ),
                      overlayColor: Colors.white,
                      splashFactory: InkRipple.splashFactory,
                    ),
                    child: const Text(
                      'CHECK AGAIN',
                      style: TextStyle(color: Colors.white),
                    ),
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
