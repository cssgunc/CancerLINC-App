import 'package:cloud_firestore/cloud_firestore.dart';

class ChecklistItem {
  final String text;
  final bool checked;

  const ChecklistItem({
    required this.text,
    required this.checked,
  });

  factory ChecklistItem.fromMap(Map<String, dynamic> data) {
    return ChecklistItem(
      text: (data['text'] as String?) ?? '',
      checked: (data['checked'] as bool?) ?? false,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'text': text,
      'checked': checked,
    };
  }

  ChecklistItem copyWith({
    String? text,
    bool? checked,
  }) {
    return ChecklistItem(
      text: text ?? this.text,
      checked: checked ?? this.checked,
    );
  }
}

class Checklist {
  final String id;
  final String userId;
  final String title;
  final String subtitle;
  final bool archived;
  final List<ChecklistItem> items;
  final Timestamp? createdAt;
  final Timestamp? updatedAt;

  const Checklist({
    required this.id,
    required this.userId,
    required this.title,
    required this.subtitle,
    required this.archived,
    required this.items,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Checklist.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    final rawItems = (data['items'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .toList();

    return Checklist(
      id: doc.id,
      userId: (data['userId'] as String?) ?? '',
      title: (data['title'] as String?) ?? '',
      subtitle: (data['subtitle'] as String?) ?? '',
      archived: (data['archived'] as bool?) ?? false,
      items: rawItems.map(ChecklistItem.fromMap).toList(),
      createdAt: data['createdAt'] as Timestamp?,
      updatedAt: data['updatedAt'] as Timestamp?,
    );
  }
}
