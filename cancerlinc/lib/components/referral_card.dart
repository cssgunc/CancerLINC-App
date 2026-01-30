import 'package:flutter/material.dart';

class ReferralCard extends StatelessWidget {
  final String doctorName;
  final String credentials;
  final String phoneNumber;
  final String email;
  final String hospitalName;
  final String? clinicName;
  final String referredBy;
  final String websiteUrl;
  final VoidCallback? onWebsiteTap;
  final VoidCallback? onPhoneTap;
  final VoidCallback? onEmailTap;

  const ReferralCard({
    super.key,
    required this.doctorName,
    required this.credentials,
    required this.phoneNumber,
    required this.email,
    required this.hospitalName,
    this.clinicName,
    required this.referredBy,
    required this.websiteUrl,
    this.onWebsiteTap,
    this.onPhoneTap,
    this.onEmailTap,
  });

  String get _role {
    final lowerName = doctorName.toLowerCase();
    final lowerCredentials = credentials.toLowerCase();

    if (lowerCredentials.contains('rn') ||
        lowerCredentials.contains('nurse') ||
        lowerName.contains('nurse')) {
      return 'Nurse';
    }
    if (lowerName.contains('radiologist') ||
        lowerCredentials.contains('radiologist')) {
      return 'Radiologist';
    }
    return 'Doctor';
  }

  String get _websiteButtonText {
    return '$_role Website';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE0E0E0), width: 1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 90,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD9D9D9),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        doctorName,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF000000),
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        credentials,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF000000),
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      GestureDetector(
                        onTap: onPhoneTap,
                        child: Text(
                          phoneNumber,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF000000),
                            height: 1.2,
                          ),
                        ),
                      ),
                      const SizedBox(height: 1),
                      GestureDetector(
                        onTap: onEmailTap,
                        child: Text(
                          email,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF000000),
                            height: 1.2,
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        hospitalName,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF000000),
                          height: 1.2,
                        ),
                      ),
                      if (clinicName != null && clinicName!.isNotEmpty) ...[
                        Text(
                          clinicName!,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF000000),
                            height: 1.2,
                          ),
                        ),
                      ],
                      const SizedBox(height: 4),
                      Text(
                        'Referred By: $referredBy',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF000000),
                          height: 1.2,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: 160,
            height: 36,
            child: ElevatedButton(
              onPressed: onWebsiteTap ?? () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF000000),
                foregroundColor: Colors.white,
                padding: EdgeInsets.zero,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                elevation: 0,
              ),
              child: Text(
                _websiteButtonText,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  height: 1.2,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
