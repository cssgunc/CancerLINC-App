import 'package:flutter/material.dart';

const _dark = Color(0xFF3F454F);
const _green = Color(0xFFA0CC39);
const _border = Color(0xFFD9D9D9);
const _placeholder = Color(0xFF999999);

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

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: _border),
        boxShadow: const [
          BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.07),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar + name row
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: _dark,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.person_outline,
                  color: Colors.white,
                  size: 28,
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
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: _dark,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      credentials,
                      style: const TextStyle(fontSize: 14, color: _placeholder),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),
          const Divider(color: _border, height: 1),
          const SizedBox(height: 12),

          // Hospital
          _InfoRow(
            icon: Icons.local_hospital_outlined,
            iconColor: _green,
            text: clinicName != null && clinicName!.isNotEmpty
                ? '$hospitalName · $clinicName'
                : hospitalName,
          ),
          const SizedBox(height: 6),

          // Phone
          GestureDetector(
            onTap: onPhoneTap,
            child: _InfoRow(icon: Icons.phone_outlined, iconColor: _green, text: phoneNumber),
          ),
          const SizedBox(height: 6),

          // Email
          GestureDetector(
            onTap: onEmailTap,
            child: _InfoRow(icon: Icons.email_outlined, iconColor: _green, text: email),
          ),
          const SizedBox(height: 6),

          // Referred by
          _InfoRow(
            icon: Icons.person_add_outlined,
            iconColor: _green,
            text: 'Referred by $referredBy',
            textColor: _placeholder,
          ),

          const SizedBox(height: 14),

          // Website button
          GestureDetector(
            onTap: onWebsiteTap ?? () {},
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: _dark,
                borderRadius: BorderRadius.circular(6),
              ),
              alignment: Alignment.center,
              child: Text(
                '$_role Website',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color textColor;
  final Color iconColor;

  const _InfoRow({
    required this.icon,
    required this.text,
    this.textColor = _dark,
    this.iconColor = _placeholder,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: iconColor),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(fontSize: 14, color: textColor),
          ),
        ),
      ],
    );
  }
}
