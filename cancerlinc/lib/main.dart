import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'firebase_options.dart';
import 'package:cancerlinc/pages/login_page.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final app = Firebase.apps.isEmpty
      ? await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        )
      : Firebase.app();

  if (kDebugMode) {
    debugPrint(
      'Firebase initialized: app=${app.name}, project=${app.options.projectId}, appId=${app.options.appId}',
    );
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CancerLINC-App',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const LoginPage(),
    );
  }
}