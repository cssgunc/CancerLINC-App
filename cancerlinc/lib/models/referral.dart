import 'package:cloud_firestore/cloud_firestore.dart';

class Referral {
  final String id;
  final String patientId;
  final String socialWorkerId;
  final String referralFirstName;
  final String referralLastName;
  final String referralTitle;
  final String referralPhone;
  final String referralEmail;
  final String status;
  final String type;
  final String notes;
  final String websiteUrl;
  final bool isDeleted;
  final Timestamp? dateSubmitted;
  final Timestamp? lastUpdated;

  const Referral({
    required this.id,
    required this.patientId,
    required this.socialWorkerId,
    required this.referralFirstName,
    required this.referralLastName,
    required this.referralTitle,
    required this.referralPhone,
    required this.referralEmail,
    required this.status,
    required this.type,
    required this.notes,
    required this.websiteUrl,
    required this.isDeleted,
    required this.dateSubmitted,
    required this.lastUpdated,
  });

  String get fullName {
    final parts = [referralFirstName.trim(), referralLastName.trim()]
        .where((part) => part.isNotEmpty)
        .toList();
    return parts.join(' ');
  }

  factory Referral.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};

    return Referral(
      id: doc.id,
      patientId: (data['patientId'] as String?) ?? '',
      socialWorkerId: (data['socialWorkerId'] as String?) ?? '',
      referralFirstName: (data['referralFirstName'] as String?) ?? '',
      referralLastName: (data['referralLastName'] as String?) ?? '',
      referralTitle: (data['referralTitle'] as String?) ?? '',
      referralPhone: (data['referralPhone'] as String?) ?? '',
      referralEmail: (data['referralEmail'] as String?) ?? '',
      status: (data['status'] as String?) ?? '',
      type: (data['type'] as String?) ?? '',
      notes: (data['notes'] as String?) ?? '',
      websiteUrl: (data['websiteUrl'] as String?) ?? '',
      isDeleted: (data['isDeleted'] as bool?) ?? false,
      dateSubmitted: data['dateSubmitted'] as Timestamp?,
      lastUpdated: data['lastUpdated'] as Timestamp?,
    );
  }
}
