/*Use:
* CallButton(phoneNumber: 'phone #')
*/
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// CancerLINC support line, shown to blocked patients in the chat page.
const String cancerLincSupportPhone = '804-562-0371';

/// When the Social Worker team is reachable. Shown as a notice on the chat
/// page so patients know when to expect a reply. Deliberately static copy
/// rather than a computed "open now / closed now" indicator: that needs real
/// US Eastern DST handling, which `DateTime` can't do without a timezone
/// database, and would be wrong for half the year if approximated.
const String socialWorkerHours =
    'Social workers are available 9:00 a.m. to 5:00 p.m. Eastern Time, '
    'Monday through Friday, excluding holidays.';

class CallButton extends StatelessWidget {
  final String phoneNumber;

  const CallButton({super.key, required this.phoneNumber});

  Future<void> _makePhoneCall() async {
    final uri = Uri.parse('tel:$phoneNumber');

    await launchUrl(
      uri,
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: _makePhoneCall,
      child: Text(
        phoneNumber,
        style: const TextStyle(
          color: Colors.blue,
        ),
      ),
    );
  }
}

