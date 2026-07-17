# CancerLINC Mobile

Flutter mobile app for CancerLINC.

## Setup

Install the [Flutter SDK](https://docs.flutter.dev/get-started/install), then
fetch dependencies:

```sh
flutter pub get
```

This app connects to the same Firebase project as the backend and web app.
Client config is generated with the FlutterFire CLI and is not committed:

```sh
dart pub global activate flutterfire_cli
flutterfire configure --yes --project=cancerlinc-addb4 --platforms=android,ios
```

This generates `lib/firebase_options.dart`, `android/app/google-services.json`,
and `ios/Runner/GoogleService-Info.plist` for the target Firebase project (see
`firebase.json` for the expected project/app IDs).

## Run

```sh
flutter run
```

Select a connected device or simulator when prompted, or target one directly:

```sh
flutter run -d <device-id>
```

List available devices with `flutter devices`.

## Other commands

```sh
flutter test     # run tests
flutter analyze  # static analysis
flutter build apk    # Android build
flutter build ios    # iOS build
```
