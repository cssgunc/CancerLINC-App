import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/material.dart';

class NotificationService {
  // singleton so that there is only one instance, prevents repeated banners/listeners
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  // initializer flag
  bool _initialized = false;

  // android notification channel setup
  static const _androidChannel = AndroidNotificationChannel(
    'chat_messages',    // id must match what the Cloud Function sends
    'Chat Messages',    // name shown in device Settings
    description: 'Notifications for new messages from your social worker',
    importance: Importance.high,
  );

  //   1. Asks the OS for permission (shows the system popup)
  //   2. Sets up the Android notification channel
  //   3. Saves the device's FCM token to Firestore
  //   4. Starts listening for foreground messages
  Future<bool> requestPermissionAndInit(BuildContext context) async {

    // 1. Ask for permission.
    // "allow notification" popup
    final settings = await _messaging.requestPermission(
      alert: true,   // show notification banners
      badge: true,   // show red number badge on app icon
      sound: true,   // play sound when notification arrives
    );

    final granted =
        settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;

    if (!granted) return false;

    // Only run the rest once even if this method is called again
    if (_initialized) return true;
    _initialized = true;

    // 2. android notification channel.
    // prevents silencing and makes sure notifications pop up
    // ignored for ios
    final androidImpl = _localNotifications.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

    if (androidImpl != null) {
      await androidImpl.createNotificationChannel(_androidChannel);
    }

    // 3. save the FCM token to Firestore
    // determines the device to send notifications to 
    // cloud function uses this
    await _saveTokenToFirestore();

    // save new token whenever something changes (new device, reinstall, etc.)
    _messaging.onTokenRefresh.listen((_) => _saveTokenToFirestore());

    // 4. initialize flutter_local_notifications
    // shows notifications when app is open (in app banner)
    const initSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    );
    await _localNotifications.initialize(initSettings);

    // 5. listen for foreground messages
    // onMessage fires when a push notification arrives AND app is open
    // flutter_local_notifications to show the banner manually
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final notification = message.notification;
      if (notification == null) return;

      _localNotifications.show(
        notification.hashCode,  // unique id for this notification
        notification.title,
        notification.body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _androidChannel.id,
            _androidChannel.name,
            channelDescription: _androidChannel.description,
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
          ),
          iOS: const DarwinNotificationDetails(
            presentAlert: true,  // show banner on iOS even when app is open
            presentBadge: true,
            presentSound: true,
          ),
        ),
      );
    });

    return true;
  }

  // function to save the fcmtoken to firestore
  // used by cloud function to send push notifications to the correct device
  Future<void> _saveTokenToFirestore() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;

    String? token;

    // iOS sometimes needs a moment before the APNS token is ready
    // retry up to 5 times with a 2 second gap between each attempt
    for (int i = 0; i < 5; i++) {
      try {
        token = await _messaging.getToken();
        if (token != null) break; // stop retrying
      } catch (e) {
        debugPrint('FCM token attempt ${i + 1} failed: $e');
        await Future.delayed(const Duration(seconds: 2));
      }
    }

    if (token == null) {
      debugPrint('Could not get FCM token after retries');
      return;
    }

    await FirebaseFirestore.instance.collection('users').doc(uid).update({
      'fcmToken': token,
    });

    debugPrint('FCM token saved to Firestore');
  }

  // determines which bell icon to use (notifications on/off)
  Future<AuthorizationStatus> getPermissionStatus() async {
    final settings = await _messaging.getNotificationSettings();
    return settings.authorizationStatus;
  }
}