import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'firebase_options.dart';
import 'package:cancerlinc/pages/login_page.dart';
import 'package:cancerlinc/components/bottom_bar.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );

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
    // Firebase Auth persists the session locally, so currentUser is available
    // synchronously after initializeApp. Check it here so a hot restart or cold
    // start both land on the correct screen without flashing the login page.
    final user = FirebaseAuth.instance.currentUser;
    final isLoggedIn = user != null && user.emailVerified;

    return MaterialApp(
      title: 'CancerLINC-App',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        scaffoldBackgroundColor: Colors.white,
        canvasColor: Colors.white,
        appBarTheme: const AppBarTheme(
          systemOverlayStyle: SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: Brightness.dark,
            statusBarBrightness: Brightness.light,
          ),
        ),
        colorScheme: ColorScheme.fromSwatch(
          primarySwatch: Colors.blue,
        ).copyWith(surface: Colors.white),
      ),
      home: isLoggedIn ? const BottomBar() : const LoginPage(),
    );
  }
}