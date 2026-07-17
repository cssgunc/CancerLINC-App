import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cancerlinc/components/referral_card.dart';
import 'package:cancerlinc/models/referral.dart';
import 'package:cancerlinc/services/referral_service.dart';

class ReferralsPage extends StatefulWidget {
  const ReferralsPage({super.key});

  @override
  State<ReferralsPage> createState() => _ReferralsPageState();
}

class _ReferralsPageState extends State<ReferralsPage> {
  final ReferralService _referralService = ReferralService();

  Future<void> _launchUri(Uri uri) async {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _openWebsite(String websiteUrl) async {
    final trimmed = websiteUrl.trim();
    if (trimmed.isEmpty) return;

    final normalized = trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : 'https://$trimmed';

    await _launchUri(Uri.parse(normalized));
  }

  Future<void> _openPhone(String phoneNumber) async {
    final trimmed = phoneNumber.trim();
    if (trimmed.isEmpty) return;
    await _launchUri(Uri.parse('tel:$trimmed'));
  }

  Future<void> _openEmail(String email) async {
    final trimmed = email.trim();
    if (trimmed.isEmpty) return;
    await _launchUri(Uri.parse('mailto:$trimmed'));
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: StreamBuilder<List<Referral>>(
        stream: _referralService.streamCurrentUserReferrals(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const _ReferralsMessageState(
              icon: Icons.error_outline,
              title: 'Unable to load referrals',
              message: 'Please try again in a moment.',
            );
          }

          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final referrals = snapshot.data ?? const <Referral>[];
          if (referrals.isEmpty) {
            return const _ReferralsMessageState(
              icon: Icons.contacts_outlined,
              title: 'No referrals yet',
              message: 'Your care team referrals will appear here once they are added.',
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            itemCount: referrals.length,
            itemBuilder: (context, index) {
              final referral = referrals[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: ReferralCard(
                  referralName: referral.fullName.isNotEmpty ? referral.fullName : 'Unnamed referral',
                  referralTitle: referral.referralTitle,
                  referralType: referral.type,
                  phoneNumber: referral.referralPhone,
                  email: referral.referralEmail,
                  status: referral.status,
                  notes: referral.notes,
                  websiteUrl: referral.websiteUrl,
                  onWebsiteTap: referral.websiteUrl.trim().isEmpty
                      ? null
                      : () => _openWebsite(referral.websiteUrl),
                  onPhoneTap: referral.referralPhone.trim().isEmpty
                      ? null
                      : () => _openPhone(referral.referralPhone),
                  onEmailTap: referral.referralEmail.trim().isEmpty
                      ? null
                      : () => _openEmail(referral.referralEmail),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _ReferralsMessageState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;

  const _ReferralsMessageState({
    required this.icon,
    required this.title,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: Colors.black45),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: const TextStyle(fontSize: 14, color: Colors.black54),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
