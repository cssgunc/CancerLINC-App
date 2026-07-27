import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cancerlinc/models/event.dart';

class EventService {
  final CollectionReference<Map<String, dynamic>> _events = FirebaseFirestore
      .instance
      .collection('events');

  static const List<String> _months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];

  // formatting for event card
  String _dateString(DateTime d) {
    final mm = d.month.toString().padLeft(2, '0');
    final dd = d.day.toString().padLeft(2, '0');
    return '${d.year}-$mm-$dd';
  }

  // fetches events within center date window
  Stream<List<Event>> streamEventsAround({
    DateTime? centerDate,
    int daysBefore = 30,
    int daysAfter = 90,
  }) {
    final center = centerDate ?? DateTime.now();
    final start = center.subtract(Duration(days: daysBefore));
    final end = center.add(Duration(days: daysAfter));

    final startStr = _dateString(start);
    final endStr = _dateString(end);

    return _events
        .where('date', isGreaterThanOrEqualTo: startStr)
        .where('date', isLessThanOrEqualTo: endStr)
        .orderBy('date')
        .orderBy('startTime')
        .snapshots()
        .map((snapshot) => snapshot.docs.map(Event.fromFirestore).toList());
  }

  // fetches the single next upcoming (or currently in-progress) event
  Stream<Event?> streamNextEvent() {
    final now = DateTime.now();
    final todayStr = _dateString(now);
    return _events
        .where('date', isGreaterThanOrEqualTo: todayStr)
        .orderBy('date')
        .orderBy('startTime')
        .limit(5) // small buffer in case today's events have already ended
        .snapshots()
        .map((snapshot) {
          final events = snapshot.docs.map(Event.fromFirestore).toList();
          final upcoming = events.where((e) => e.end.isAfter(now)).toList();
          if (upcoming.isEmpty) return null;
          upcoming.sort((a, b) => a.start.compareTo(b.start));
          return upcoming.first;
        });
  }
}
