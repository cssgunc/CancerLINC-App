import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cancerlinc/components/call_number.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cancerlinc/models/event.dart';
import 'package:cancerlinc/services/event_service.dart';

class HomePage extends StatelessWidget {
  final void Function(int) onTabChange;

  /// Deletes the current user's account (Cloud Function call, sign-out,
  /// and navigation back to LoginPage) — implemented by BottomBarState so
  /// it can reuse the exact same navigation logic as its own logout button.
  /// Throws on failure (e.g. network error); on success it navigates away,
  /// tearing down this whole widget tree.
  final Future<void> Function() onDeleteAccount;

  HomePage({
    super.key,
    required this.onTabChange,
    required this.onDeleteAccount,
  });

  static final Uri _resourcesUrl = Uri.parse(
    'https://cancerlinc.org/resources2025/',
  );

  // Dynamic data variables
  String get userName {
    final name = FirebaseAuth.instance.currentUser?.displayName ?? "User";
    return name;
  }

  final int newMessageCount = 12;
  final EventService _eventService = EventService();
  final int completedChecklists = 10;
  final int totalChecklists = 12;
  final int activeReferrals = 11;
  final String faxNumber = "804-918-0946";
  final String phoneNumber = "804-562-0371";
  final String addressLine1 = "200 South 3rd St,";
  final String addressLine2 = "Richmond, VA 23219";

  Future<void> _openResources() async {
    if (await canLaunchUrl(_resourcesUrl)) {
      await launchUrl(_resourcesUrl, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _showDeleteAccountDialog(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text("Are you sure you want to delete your account?"),
          content: const Text(
            "This will permanently delete your account and all of your "
            "data. This cannot be undone.",
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text("Cancel"),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text(
                "Delete Account",
                style: TextStyle(color: Colors.red),
              ),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;
    if (!context.mounted) return;

    await _performAccountDeletion(context);
  }

  Future<void> _performAccountDeletion(BuildContext context) async {
    // Blocking, non-dismissible progress indicator while deletion runs.
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    try {
      // On success, onDeleteAccount also signs the user out and navigates
      // to LoginPage — which tears down this entire widget tree (including
      // the spinner dialog above), so there is nothing further to do here
      // on the success path.
      await onDeleteAccount();
    } catch (e) {
      if (!context.mounted) return;
      Navigator.of(context, rootNavigator: true).pop(); // close the spinner

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "We couldn't delete your account. Please check your connection "
            "and try again.",
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 0, horizontal: 22),
        child: Column(
          children: [
            SizedBox(height: 33),
            Center(
              child: Image.asset(
                'assets/images/cancerlinc-logo.png',
                width: 120,
                height: 120,
              ),
            ),
            SizedBox(height: 33),
            Align(
              alignment: Alignment.centerLeft,
              child: RichText(
                text: TextSpan(
                  style: TextStyle(fontSize: 24, color: Colors.black),
                  children: [
                    TextSpan(text: "Welcome, "),
                    TextSpan(
                      text: "$userName!",
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 24),
            GridView.count(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 1.3,
              children: [
                _buildCard(
                  label: "Chat",
                  icon: Icons.chat_bubble_outline,
                  info: "$newMessageCount new messages",
                  onTap: () => onTabChange(1),
                ),
                _buildCalendarCard(),
                _buildCard(
                  label: "Checklists",
                  icon: Icons.check_box_outlined,
                  info: "$completedChecklists of $totalChecklists complete",
                  onTap: () => onTabChange(2),
                ),
                _buildCard(
                  label: "Referrals",
                  icon: Icons.assignment_ind_outlined,
                  info: "$activeReferrals active",
                  onTap: () => onTabChange(3),
                ),
              ],
            ),
            SizedBox(height: 24),
            Divider(thickness: 1, color: Color(0xFFD9D9D9)),
            SizedBox(height: 33),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                "At CancerLINC, we provide free legal, financial, and community resource assistance to patients in the Greater Richmond area.",
                style: TextStyle(fontSize: 16, color: Color(0xFF666666)),
              ),
            ),
            SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: Card(
                color: Color(0xFFD9D9D9),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: 20,
                    horizontal: 16,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "You are never alone in your journey.",
                        style: TextStyle(
                          fontSize: 16,
                          fontStyle: FontStyle.italic,
                          color: Color(0xFF999999),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SizedBox(height: 35),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                "Available Resources",
                style: TextStyle(fontSize: 20),
              ),
            ),
            SizedBox(height: 16),
            GridView.count(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 16,
              mainAxisSpacing: 12,
              childAspectRatio: 2,
              children: [
                _buildSmallCard(
                  text: "Employment",
                  onTap: () => _openResources(),
                ),
                _buildSmallCard(
                  text: "Insurance",
                  onTap: () => _openResources(),
                ),
                _buildSmallCard(text: "Housing", onTap: () => _openResources()),
                _buildSmallCard(
                  text: "Financial",
                  onTap: () => _openResources(),
                ),
                _buildSmallCard(
                  text: "Transportation",
                  onTap: () => _openResources(),
                ),
                _buildSmallCard(
                  text: "Food Access",
                  onTap: () => _openResources(),
                ),
              ],
            ),
            SizedBox(height: 32),
            Align(
              alignment: Alignment.centerLeft,
              child: Text("Contact Us", style: TextStyle(fontSize: 20)),
            ),
            SizedBox(height: 12),
            GridView.count(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 6,
              mainAxisSpacing: 6,
              childAspectRatio: 7,
              children: [
                CallButton(phoneNumber: phoneNumber),
                Row(
                  children: [
                    Icon(Icons.location_pin, size: 20),
                    SizedBox(width: 12),
                    Text(
                      addressLine1,
                      style: TextStyle(fontSize: 14, color: Color(0xFF666666)),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Icon(Icons.adf_scanner_outlined, size: 20),
                    SizedBox(width: 12),
                    CallButton(phoneNumber: faxNumber),
                  ],
                ),
                Row(
                  children: [
                    SizedBox(width: 32),
                    Text(
                      addressLine2,
                      style: TextStyle(fontSize: 14, color: Color(0xFF666666)),
                    ),
                  ],
                ),
              ],
            ),
            SizedBox(height: 26),
            Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey, width: 1),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  vertical: 20,
                  horizontal: 16,
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.start,
                      children: [
                        Image.asset(
                          'assets/images/cssg-logo.jpg',
                          width: 48,
                          height: 48,
                        ),
                        SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "App built by",
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF666666),
                              ),
                            ),
                            Text(
                              "UNC CS + SG",
                              style: TextStyle(
                                fontSize: 16,
                                color: Colors.black,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    SizedBox(height: 12),
                    RichText(
                      text: TextSpan(
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF666666),
                        ),
                        children: [
                          TextSpan(
                            text:
                                "UNC Computer Science for Social Good is a student organization dedicated to using our technical skills, time, and resources to make a positive impact on our campus, in our community, and in the world.\n\nWe design and create websites and apps for nonprofits and other organizations to fulfill our mission. Need our help? Check us out at ",
                          ),
                          TextSpan(
                            text: "cssgunc.org",
                            style: TextStyle(
                              color: Color(0xFF666666),
                              decoration: TextDecoration.underline,
                            ),
                            recognizer: TapGestureRecognizer()
                              ..onTap = () async {
                                final url = Uri.parse(
                                  'https://www.cssgunc.org/',
                                );
                                if (await canLaunchUrl(url)) {
                                  await launchUrl(url);
                                }
                              },
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 24),
            Center(
              child: TextButton(
                onPressed: () => _showDeleteAccountDialog(context),
                child: Text(
                  "Delete Account",
                  style: TextStyle(
                    color: Colors.red,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            SizedBox(height: 31),
          ],
        ),
      ),
    );
  }

  Widget _buildSmallCard({required String text, VoidCallback? onTap}) {
    return Card(
      color: Color(0xFFD9D9D9),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey, width: 1),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Center(
            child: Text(
              text,
              style: TextStyle(fontSize: 14, color: Color(0xFF666666)),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCard({
    required String label,
    required IconData icon,
    required String info,
    VoidCallback? onTap,
  }) {
    return Card(
      color: Color(0xFFD9D9D9),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 28),
              SizedBox(height: 6),
              Text(label, style: TextStyle(fontSize: 14)),
              SizedBox(height: 18),
              Text(
                info,
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static const List<String> _shortMonths = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  String _formatShortDate(DateTime d) =>
      '${_shortMonths[d.month - 1]} ${d.day}';

  Widget _buildCalendarCard() {
    return StreamBuilder<Event?>(
      stream: _eventService.streamNextEvent(),
      builder: (context, snapshot) {
        String info;
        if (snapshot.connectionState == ConnectionState.waiting) {
          info = "Loading...";
        } else if (snapshot.hasError || snapshot.data == null) {
          info = "No upcoming events";
        } else {
          info = "Next: ${_formatShortDate(snapshot.data!.start)}";
        }
        return _buildCard(
          label: "Calendar",
          icon: Icons.calendar_today_outlined,
          info: info,
          onTap: () => onTabChange(4),
        );
      },
    );
  }
}
