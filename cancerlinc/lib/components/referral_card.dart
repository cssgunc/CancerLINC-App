import 'package:flutter/material.dart';

const _dark = Color(0xFF3F454F);
const _green = Color(0xFFA0CC39);
const _border = Color(0xFFD9D9D9);
const _placeholder = Color(0xFF999999);

class ReferralCard extends StatelessWidget {
  final String referralName;
  final String referralTitle;
  final String referralType;
  final String phoneNumber;
  final String email;
  final String status;
  final String notes;
  final String websiteUrl;
  final VoidCallback? onWebsiteTap;
  final VoidCallback? onPhoneTap;
  final VoidCallback? onEmailTap;

  const ReferralCard({
    super.key,
    required this.referralName,
    required this.referralTitle,
    required this.referralType,
    required this.phoneNumber,
    required this.email,
    required this.status,
    required this.notes,
    required this.websiteUrl,
    this.onWebsiteTap,
    this.onPhoneTap,
    this.onEmailTap,
  });

  String get _statusLabel {
    final trimmed = status.trim();
    if (trimmed.isEmpty) return 'Pending';
    return '${trimmed[0].toUpperCase()}${trimmed.substring(1)}';
  }

  Color get _statusBackground {
    switch (status.trim().toLowerCase()) {
      case 'completed':
        return const Color(0xFFE8F5E9);
      case 'in-progress':
        return const Color(0xFFFFF8E1);
      case 'pending':
      default:
        return const Color(0xFFF2F4F7);
    }
  }

  Color get _statusTextColor {
    switch (status.trim().toLowerCase()) {
      case 'completed':
        return const Color(0xFF2E7D32);
      case 'in-progress':
        return const Color(0xFF8D6E00);
      case 'pending':
      default:
        return _dark;
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasWebsite = websiteUrl.trim().isNotEmpty;
    final titleText = referralTitle.trim().isNotEmpty ? referralTitle : referralType;
    final notesText = notes.trim().isNotEmpty ? notes : 'No notes provided';

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
                      referralName,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: _dark,
                      ),
                    ),
                    if (titleText.trim().isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        titleText,
                        style: const TextStyle(fontSize: 14, color: _placeholder),
                      ),
                    ],
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: _statusBackground,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  _statusLabel,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _statusTextColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(color: _border, height: 1),
          const SizedBox(height: 12),
          if (referralType.trim().isNotEmpty) ...[
            _InfoRow(
              icon: Icons.badge_outlined,
              iconColor: _green,
              text: referralType,
            ),
            const SizedBox(height: 6),
          ],
          if (phoneNumber.trim().isNotEmpty) ...[
            GestureDetector(
              onTap: onPhoneTap,
              child: _InfoRow(
                icon: Icons.phone_outlined,
                iconColor: _green,
                text: phoneNumber,
              ),
            ),
            const SizedBox(height: 6),
          ],
          if (email.trim().isNotEmpty) ...[
            GestureDetector(
              onTap: onEmailTap,
              child: _InfoRow(
                icon: Icons.email_outlined,
                iconColor: _green,
                text: email,
              ),
            ),
            const SizedBox(height: 6),
          ],
          _InfoRow(
            icon: Icons.sticky_note_2_outlined,
            iconColor: _green,
            text: notesText,
            textColor: _placeholder,
          ),
          if (hasWebsite) ...[
            const SizedBox(height: 14),
            GestureDetector(
              onTap: onWebsiteTap,
              child: Container(
                height: 40,
                decoration: BoxDecoration(
                  color: _dark,
                  borderRadius: BorderRadius.circular(6),
                ),
                alignment: Alignment.center,
                child: const Text(
                  'Open Website',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
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
      crossAxisAlignment: CrossAxisAlignment.start,
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
