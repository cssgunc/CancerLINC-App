import 'package:flutter/services.dart';

// handles haptic feedback consistently throughout app
class AppHaptics {
  static void tap() => HapticFeedback.lightImpact(); // routine buttons
  static void confirm() => HapticFeedback.mediumImpact(); // submit/save actions
  static void warning() =>
      HapticFeedback.heavyImpact(); // destructive/critical actions
  static void select() => HapticFeedback.selectionClick(); // nav/tab switches
}
