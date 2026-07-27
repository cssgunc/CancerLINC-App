import 'package:cloud_firestore/cloud_firestore.dart';

class Event {
  final String id;
  final String title;
  final String description;
  final List<String> tags;
  final DateTime start;
  final DateTime end;

  const Event({
    required this.id,
    required this.title,
    required this.description,
    required this.tags,
    required this.start,
    required this.end,
  });

  factory Event.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};

    final dateStr = (data['date'] as String?) ?? '';
    final startTimeStr = (data['startTime'] as String?) ?? '00:00';
    final endTimeStr = (data['endTime'] as String?) ?? startTimeStr;

    final rawTags = (data['tags'] as List<dynamic>? ?? const <dynamic>[]);

    return Event(
      id: doc.id,
      title: (data['title'] as String?) ?? '',
      description: (data['description'] as String?) ?? '',
      tags: rawTags.whereType<String>().toList(),
      start: _combine(dateStr, startTimeStr),
      end: _combine(dateStr, endTimeStr),
    );
  }

  // builds timestamp
  static DateTime _combine(String dateStr, String timeStr) {
    try {
      final dateParts = dateStr.split('-').map(int.parse).toList();
      final timeParts = timeStr.split(':').map(int.parse).toList();
      return DateTime(
        dateParts[0],
        dateParts[1],
        dateParts[2],
        timeParts.isNotEmpty ? timeParts[0] : 0,
        timeParts.length > 1 ? timeParts[1] : 0,
      );
    } catch (_) {
      return DateTime.fromMillisecondsSinceEpoch(0);
    }
  }
}

// list of supported event tags
const List<String> kSupportedEventTags = [
  'Support Group',
  'Workshop',
  'Clinic',
  'Webinar',
  'Community',
  'Fundraiser',
  'Appointment',
  'Info Session',
];
