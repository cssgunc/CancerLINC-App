import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:url_launcher/url_launcher.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  // Dynamic data variables
  final String userName = "Lisa";
  final int newMessageCount = 12;
  final String nextEventDate = "Nov 12";
  final int completedChecklists = 10;
  final int totalChecklists = 12;
  final int activeReferrals = 11;
  final String phoneNumber = "(804) 562-0371";
  final String faxNumber = "(804) 918-0946";
  final String addressLine1 = "200 South 3rd St,";
  final String addressLine2 = "Richmond, VA 23219";

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 0, horizontal: 22),
        child: Column(
          children: [
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
                ),
                _buildCard(
                  label: "Calendar",
                  icon: Icons.calendar_today_outlined,
                  info: "Next: $nextEventDate",
                ),
                _buildCard(
                  label: "Checklists",
                  icon: Icons.check_box_outlined,
                  info: "$completedChecklists of $totalChecklists complete",
                ),
                _buildCard(
                  label: "Referrals",
                  icon: Icons.assignment_ind_outlined,
                  info: "$activeReferrals active",
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
                _buildSmallCard(text: "Employment"),
                _buildSmallCard(text: "Insurance"),
                _buildSmallCard(text: "Housing"),
                _buildSmallCard(text: "Financial"),
                _buildSmallCard(text: "Transportation"),
                _buildSmallCard(text: "Food Access"),
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
                InkWell(
                  onTap: () async {
                    final url = Uri.parse('tel:$phoneNumber');
                    if (await canLaunchUrl(url)) {
                      await launchUrl(url);
                    }
                  },
                  child: Row(
                    children: [
                      Icon(Icons.phone_outlined, size: 20),
                      SizedBox(width: 12),
                      Text(
                        phoneNumber,
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.blue,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ],
                  ),
                ),
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
                    Text(
                      faxNumber,
                      style: TextStyle(fontSize: 14, color: Color(0xFF666666)),
                    ),
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
                              style:
                                  TextStyle(fontSize: 12, color: Color(0xFF666666)),
                            ),
                            Text(
                              "UNC CS + SG",
                              style:
                                  TextStyle(fontSize: 16, color: Colors.black),
                            ),
                          ],
                        )
                      ],
                    ),
                    SizedBox(height: 12),
                    RichText(
                      text: TextSpan(
                        style: TextStyle(fontSize: 12, color: Color(0xFF666666)),
                        children: [
                          TextSpan(
                            text: "UNC Computer Science for Social Good is a student organization dedicated to using our technical skills, time, and resources to make a positive impact on our campus, in our community, and in the world.\n\nWe design and create websites and apps for nonprofits and other organizations to fulfill our mission. Need our help? Check us out at ",
                          ),
                          TextSpan(
                            text: "cssgunc.org",
                            style: TextStyle(
                              color: Color(0xFF666666),
                              decoration: TextDecoration.underline,
                            ),
                            recognizer: TapGestureRecognizer()
                              ..onTap = () async {
                                final url = Uri.parse('https://www.cssgunc.org/');
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
        onTap: onTap ?? () {
          print('$text resource tapped');
        },
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
        onTap: onTap ?? () {
          print('$label card tapped');
        },
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
}
