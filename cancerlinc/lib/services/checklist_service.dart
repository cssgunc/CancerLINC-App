import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cancerlinc/models/checklist.dart';

class ChecklistService {
  ChecklistService({
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
  }) : _firestore = firestore ?? FirebaseFirestore.instance,
       _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  static const List<Map<String, dynamic>> _defaultChecklistTemplates = [
    {
      'title': 'Legal Documents',
      'subtitle': 'Key paperwork to keep organized during treatment',
      'items': [
        {'text': 'Save copies of your health insurance card and photo ID', 'checked': false},
        {'text': 'Review any advance directive or medical power of attorney forms', 'checked': false},
        {'text': 'Keep a folder for bills, explanation of benefits, and denial letters', 'checked': false},
        {'text': 'Write down questions for a legal aid or patient advocacy appointment', 'checked': false},
      ],
    },
    {
      'title': 'Financial Health',
      'subtitle': 'Short list to track costs and support options',
      'items': [
        {'text': 'List current medical bills and upcoming treatment expenses', 'checked': false},
        {'text': 'Check whether your providers offer payment plans or charity care', 'checked': false},
        {'text': 'Gather recent pay stubs or income documents for assistance applications', 'checked': false},
        {'text': 'Make a note of transportation, lodging, or food support programs to ask about', 'checked': false},
      ],
    },
  ];

  String? get currentUserId => _auth.currentUser?.uid;

  CollectionReference<Map<String, dynamic>> get _currentUserChecklistsRef {
    final userId = currentUserId;
    if (userId == null || userId.isEmpty) {
      throw StateError('No authenticated user is available for checklists.');
    }

    return _firestore
        .collection('checklists')
        .doc(userId)
        .collection('user_checklists');
  }

  Stream<List<Checklist>> streamCurrentUserChecklists({
    required bool archived,
  }) {
    final userId = currentUserId;
    if (userId == null || userId.isEmpty) {
      return Stream.value(const <Checklist>[]);
    }

    return _firestore
        .collection('checklists')
        .doc(userId)
        .collection('user_checklists')
        .where('archived', isEqualTo: archived)
        .snapshots()
        .map((snapshot) {
          final checklists = snapshot.docs.map(Checklist.fromFirestore).toList();
          checklists.sort((a, b) {
            final aMillis = a.updatedAt?.millisecondsSinceEpoch ??
                a.createdAt?.millisecondsSinceEpoch ??
                0;
            final bMillis = b.updatedAt?.millisecondsSinceEpoch ??
                b.createdAt?.millisecondsSinceEpoch ??
                0;
            return bMillis.compareTo(aMillis);
          });
          return checklists;
        });
  }

  Future<void> ensureDefaultChecklists({
    String? userId,
  }) async {
    final resolvedUserId = userId ?? currentUserId;
    if (resolvedUserId == null || resolvedUserId.isEmpty) return;

    final checklistsRef = _firestore
        .collection('checklists')
        .doc(resolvedUserId)
        .collection('user_checklists');

    final existing = await checklistsRef.limit(1).get();
    if (existing.docs.isNotEmpty) return;

    final batch = _firestore.batch();

    for (final template in _defaultChecklistTemplates) {
      final docRef = checklistsRef.doc();
      batch.set(docRef, {
        'userId': resolvedUserId,
        'title': template['title'],
        'subtitle': template['subtitle'],
        'items': template['items'],
        'archived': false,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
  }


  Future<void> duplicateChecklist(Checklist checklist) async {
    final now = FieldValue.serverTimestamp();

    await _currentUserChecklistsRef.add({
      'userId': currentUserId,
      'title': checklist.title,
      'subtitle': checklist.subtitle,
      'items': checklist.items.map((item) => item.toMap()).toList(),
      'archived': false,
      'createdAt': now,
      'updatedAt': now,
    });
  }


  Future<List<Map<String, dynamic>>> saveChecklists(
    CollectionReference checklistsRef,
    List<Map<String, dynamic>> localChecklists,
  ) async {
    final batch = FirebaseFirestore.instance.batch();
    final List<Map<String, dynamic>> updatedChecklists = [];

    for (final checklist in localChecklists) {
      final docId = checklist['docId'] as String;
      final isNew = docId.startsWith('local_');
      final DocumentReference ref =
          isNew ? checklistsRef.doc() : checklistsRef.doc(docId);

      final data = {
        'title': checklist['title'],
        'subtitle': checklist['subtitle'],
        'items': checklist['items'],
        'archived': checklist['archived'],
      };

      if (isNew) {
        batch.set(ref, data);
      } else {
        batch.update(ref, data);
      }

      updatedChecklists.add({
        ...checklist,
        'docId': ref.id,
      });
    }

    await batch.commit();
    return updatedChecklists;
  }

}
