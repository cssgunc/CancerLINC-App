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
  State<BottomBar> createState() => _BottomBarState();
}

class _BottomBarState extends State<BottomBar> {
  int _currentIndex = 0;
  bool _isScrolled = false;
  static const _dividerColor = Color(0xFFD9D9D9);
  static const _appBarBase = Colors.white;
  static const _appBarScrollTint = Color(0xFFF2F2F2);

  void _goToTab(int index) =>
      setState(() {
        _currentIndex = index;
        _isScrolled = false;
      });

  Future<void> _logout() async {
    await FirebaseAuth.instance.signOut();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
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
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 36, letterSpacing: 0.6),
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
            child: [
              HomePage(onTabChange: _goToTab),
              const ChatPage(),
              const ChecklistPage(),
              const ReferralsPage(),
              const CalendarPage(),
            ][_currentIndex],
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
