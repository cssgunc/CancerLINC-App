import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cancerlinc/pages/calendar_page.dart';
import 'package:cancerlinc/pages/chat_page.dart';
import 'package:cancerlinc/pages/checklist_page.dart';
import 'package:cancerlinc/pages/home_page.dart';
import 'package:cancerlinc/pages/login_page.dart';
import 'package:cancerlinc/pages/referrals_page.dart';

class BottomBar extends StatefulWidget {
  const BottomBar({super.key});

  @override
  State<BottomBar> createState() => BottomBarState();
}

class BottomBarState extends State<BottomBar> {
  int _currentIndex = 0;
  bool _isScrolled = false;
  static const _dividerColor = Color(0xFFD9D9D9);
  static const _appBarBase = Colors.white;
  static const _appBarScrollTint = Color(0xFFF2F2F2);
  bool _checklistHasUnsavedChanges = false;
  final GlobalKey<ChecklistPageState> _checklistKey =
      GlobalKey<ChecklistPageState>();

  void _goToTab(int index) {
    final leavingChecklist = _currentIndex == 2 && index != 2;
    if (leavingChecklist && _checklistHasUnsavedChanges) {
      _showUnsavedChangesDialog(index);
    } else {
      setState(() {
        _currentIndex = index;
        _isScrolled = false;
      });
    }
  }

  void _showUnsavedChangesDialog(int targetIndex) {
    showAdaptiveDialog(
      context: context,
      builder: (_) => AlertDialog.adaptive(
        title: const Text('Unsaved Changes'),
        content: const Text('You have unsaved changes in your checklist.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                _checklistHasUnsavedChanges = false;
                _currentIndex = targetIndex;
                _isScrolled = false;
              });
            },
            child: const Text('Discard'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await _checklistKey.currentState?.save();
              setState(() {
                _currentIndex = targetIndex;
                _isScrolled = false;
              });
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  /// Shared post-auth-change navigation, used by both [_logout] and
  /// [_deleteAccount]. BottomBar is reached via an imperative push (not
  /// purely AuthGate's reactive StreamBuilder), so leaving it also has to
  /// be imperative — clearing the route stack and pushing LoginPage, same
  /// as the app already did for a normal logout.
  Future<void> _navigateToLoginPage() {
    return Navigator.of(context).pushAndRemoveUntil(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            const LoginPage(),
        transitionDuration: const Duration(milliseconds: 240),
        reverseTransitionDuration: const Duration(milliseconds: 240),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          final slideInFromLeft = Tween<Offset>(
            begin: const Offset(-0.08, 0),
            end: Offset.zero,
          ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOut));

          final fadeIn = Tween<double>(
            begin: 0.92,
            end: 1,
          ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOut));

          return SlideTransition(
            position: slideInFromLeft,
            child: FadeTransition(opacity: fadeIn, child: child),
          );
        },
      ),
      (route) => false,
    );
  }

  Future<void> _logout() async {
    await FirebaseAuth.instance.signOut();
    if (!mounted) return;
    await _navigateToLoginPage();
  }

/// Permanently deletes the signed-in user's account.
  ///
  /// ORDER MATTERS: the `deleteOwnAccount` Cloud Function is called FIRST,
  /// while the caller still holds a valid ID token — the function trusts
  /// only `request.auth.uid`, never anything the client sends, so there is
  /// no way to delete the wrong account. `signOut()` (a purely local
  /// operation — it does not hit the network, so it cannot fail because
  /// the account no longer exists server-side) only runs after the
  /// function call succeeds, followed by the exact same navigation as
  /// [_logout].
  ///
  /// If the function call throws, this rethrows so the caller (HomePage's
  /// confirmation dialog) can show an error — the user stays signed in and
  /// nothing is torn down, so they can safely retry.
  Future<void> _deleteAccount() async {
    final user = FirebaseAuth.instance.currentUser;
    debugPrint(
      '[deleteAccount] preflight: hasUser=${user != null}, uid=${user?.uid}',
    );

    if (user == null) {
      throw FirebaseAuthException(
        code: 'unauthenticated',
        message: 'You must be signed in.',
      );
    }

    // Force-refresh the token, same as ChatService does, so we're not
    // sending a stale token to a security-sensitive callable.
    final token = await user.getIdTokenResult(true);
    debugPrint(
      '[deleteAccount] token ready: uid=${user.uid}, '
      'emailVerified=${user.emailVerified}, '
      'issuedAt=${token.issuedAtTime}, expiresAt=${token.expirationTime}',
    );

    try {
      final callable = FirebaseFunctions.instance.httpsCallable(
        'deleteOwnAccount',
      );
      debugPrint('[deleteAccount] calling deleteOwnAccount...');
      final result = await callable.call();
      debugPrint('[deleteAccount] callable success: ${result.data}');
    } on FirebaseFunctionsException catch (e) {
      debugPrint(
        '[deleteAccount] callable FAILED: code=${e.code}, '
        'message=${e.message}, details=${e.details}',
      );
      rethrow;
    } catch (e) {
      debugPrint('[deleteAccount] callable FAILED unexpectedly: $e');
      rethrow;
    }

    await FirebaseAuth.instance.signOut();
    if (!mounted) return;
    await _navigateToLoginPage();
  }

  late final List<Widget> _pages; // pages cannot be static due to callback

  @override
  void initState() {
    super.initState();
    _pages = [
      HomePage(onTabChange: _goToTab, onDeleteAccount: _deleteAccount),
      const ChatPage(),
      ChecklistPage(
        key: _checklistKey,
        onUnsavedChanges: (hasChanges) {
          setState(() => _checklistHasUnsavedChanges = hasChanges);
        },
      ),
      const ReferralsPage(),
      const CalendarPage(),
    ];
  }

  static const List<String> _titles = [
    'Home',
    'Chat',
    'Checklist',
    'Referrals',
    'Calendar',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: (_currentIndex == 1 || _currentIndex == 2 || _currentIndex == 4)
          ? null
          : AppBar(
              backgroundColor: Colors.transparent,
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 0,
              shadowColor: Colors.transparent,
              flexibleSpace: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOut,
                color: _isScrolled ? _appBarScrollTint : _appBarBase,
              ),
              title: Row(
                children: [
                  SizedBox(width: 12),
                  Text(
                    _titles[_currentIndex],
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 36,
                      letterSpacing: 0.6,
                    ),
                  ),
                ],
              ),
              actions: _currentIndex == 0
                  ? [
                      IconButton(
                        onPressed: _logout,
                        tooltip: 'Log out',
                        icon: const Icon(Icons.logout, color: Colors.black87),
                      ),
                    ]
                  : null,
              centerTitle: false,
            ),
      body: NotificationListener<ScrollNotification>(
        onNotification: (notification) {
          if (_currentIndex != 0 && _currentIndex != 3) return false;
          final shouldBeScrolled = notification.metrics.pixels > 0;
          if (shouldBeScrolled != _isScrolled) {
            setState(() => _isScrolled = shouldBeScrolled);
          }
          return false;
        },
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 120),
          child: KeyedSubtree(
            key: ValueKey(_currentIndex),
            child: _pages[_currentIndex],
          ),
        ),
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(height: 1, color: _dividerColor),
          BottomNavigationBar(
            type: BottomNavigationBarType.fixed,
            backgroundColor: Colors.white,
            selectedItemColor: const Color.fromARGB(255, 37, 183, 81),
            unselectedItemColor: Colors.grey,
            currentIndex: _currentIndex,
            onTap: _goToTab,
            items: const [
              BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
              BottomNavigationBarItem(icon: Icon(Icons.chat), label: 'Chat'),
              BottomNavigationBarItem(
                icon: Icon(Icons.checklist),
                label: 'Checklist',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.contacts),
                label: 'Referrals',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.calendar_today),
                label: 'Calendar',
              ),
            ],
          ),
        ],
      ),
    );
  }
}
