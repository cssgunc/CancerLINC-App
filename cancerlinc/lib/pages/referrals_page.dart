import 'package:flutter/material.dart';
import 'package:cancerlinc/components/referral_card.dart';

class Referral {
  final String doctorName;
  final String credentials;
  final String phoneNumber;
  final String email;
  final String hospitalName;
  final String clinicName;
  final String referredBy;
  final String websiteUrl;

  Referral({
    required this.doctorName,
    required this.credentials,
    required this.phoneNumber,
    required this.email,
    required this.hospitalName,
    required this.clinicName,
    required this.referredBy,
    required this.websiteUrl,
  });
}

// Mock data - replace with API call in the future
final List<Referral> _mockReferrals = [
  Referral(
    doctorName: 'DoctorDoctor',
    credentials: 'MD, MPH',
    phoneNumber: '(111) 234-5678',
    email: 'DocterDocter@gmail.com',
    hospitalName: 'UNC Hospital',
    clinicName: 'Oncology Clinic',
    referredBy: 'Emily Chen',
    websiteUrl: 'https://www.example.com',
  ),
  Referral(
    doctorName: 'NurseNurse',
    credentials: 'MD, MPH',
    phoneNumber: '(111) 234-5678',
    email: 'NurseNurse@gmail.com',
    hospitalName: 'UNC Hospitals Hillsborough...',
    clinicName: '',
    referredBy: 'Jake Morrison',
    websiteUrl: 'https://www.example.com',
  ),
  Referral(
    doctorName: 'RadiologistRadiogist',
    credentials: 'MD, MPH',
    phoneNumber: '(111) 234-5678',
    email: 'Radiologist65432@gmail.com',
    hospitalName: 'Duke University Hospital',
    clinicName: '',
    referredBy: 'Emily Chen',
    websiteUrl: 'https://www.example.com',
  ),
  Referral(
    doctorName: 'DoctorDoctor2',
    credentials: 'MD, MPH',
    phoneNumber: '(111) 234-5678',
    email: 'DocterDocter2@gmail.com',
    hospitalName: 'UNC Hospitals Neurology Clinic',
    clinicName: '',
    referredBy: 'Jake Morrison',
    websiteUrl: 'https://www.example.com',
  ),
];

class ReferralsPage extends StatelessWidget {
  const ReferralsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      child: ListView.builder(
        padding: EdgeInsets.zero,
        itemCount: _mockReferrals.length,
        itemBuilder: (context, index) {
          final referral = _mockReferrals[index];
          return ReferralCard(
            doctorName: referral.doctorName,
            credentials: referral.credentials,
            phoneNumber: referral.phoneNumber,
            email: referral.email,
            hospitalName: referral.hospitalName,
            clinicName: referral.clinicName,
            referredBy: referral.referredBy,
            websiteUrl: referral.websiteUrl,
            onWebsiteTap: () {
              // TODO: Implement website navigation
              },
            onPhoneTap: () {
              // TODO: Implement phone call functionality
            },
            onEmailTap: () {
              // TODO: Implement email functionality
            },
          );
        },
      ),
    );
  }
}
