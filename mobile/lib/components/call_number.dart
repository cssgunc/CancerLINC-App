/*Use:
* CallButton(phoneNumber: 'phone #')
*/
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// CancerLINC support line, shown to blocked patients in the chat page.
const String cancerLincSupportPhone = '804-562-0371';

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

