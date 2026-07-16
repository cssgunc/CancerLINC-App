import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cancerlinc/models/referral.dart';

class ReferralService {
  ReferralService({
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
  }) : _firestore = firestore ?? FirebaseFirestore.instance,
       _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  String? get currentUserId => _auth.currentUser?.uid;

  Stream<List<Referral>> streamCurrentUserReferrals() {
    final patientId = currentUserId;
    if (patientId == null || patientId.isEmpty) {
      return Stream.value(const <Referral>[]);
    }

    return _firestore
        .collection('referrals')
        .doc(patientId)
        .collection('referrals')
        .snapshots()
        .map((snapshot) {
          final referrals = snapshot.docs
              .map(Referral.fromFirestore)
              .where((referral) => !referral.isDeleted)
              .toList();

          referrals.sort((a, b) {
            final aMillis = a.lastUpdated?.millisecondsSinceEpoch ??
                a.dateSubmitted?.millisecondsSinceEpoch ??
                0;
            final bMillis = b.lastUpdated?.millisecondsSinceEpoch ??
                b.dateSubmitted?.millisecondsSinceEpoch ??
                0;
            return bMillis.compareTo(aMillis);
          });

          return referrals;
        });
  }
}
