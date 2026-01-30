import 'package:flutter/material.dart';
import 'package:cancerlinc/pages/calendar_page.dart';
import 'package:cancerlinc/pages/chat_page.dart';
import 'package:cancerlinc/pages/checklist_page.dart';
import 'package:cancerlinc/pages/home_page.dart';
import 'package:cancerlinc/pages/referrals_page.dart';

class BottomBar extends StatefulWidget {
  const BottomBar({super.key});

  @override
  State<BottomBar> createState() => _BottomBarState();
}

class _BottomBarState extends State<BottomBar> {
  int _currentIndex = 0;

  static const List<Widget> _pages = [
    HomePage(),
    ChatPage(),
    ChecklistPage(),
    ReferralsPage(),
    CalendarPage(),
  ];

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
      appBar: AppBar(
        title: Row(
          children: [SizedBox(width: 12), Text(_titles[_currentIndex])],
        ),
        centerTitle: false,
      ),
      body: _pages[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        selectedItemColor: const Color.fromARGB(255, 37, 183, 81),
        unselectedItemColor: Colors.grey,
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
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
    );
  }
}
