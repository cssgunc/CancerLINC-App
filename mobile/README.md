# CancerLINC Mobile

Flutter mobile app for CancerLINC.

## Setup

The Flutter version is pinned in `.fvmrc` and managed with
[FVM](https://fvm.app). Do not use a system-wide Flutter install — a mismatched
SDK causes the Firebase plugins to crash at launch on iOS.

```sh
brew tap leoafarias/fvm && brew install fvm   # once per machine
fvm install                                   # reads .fvmrc, fetches that exact SDK
fvm flutter pub get
```

Run every Flutter command through `fvm flutter` rather than `flutter`.

### iOS

iOS dependencies go through CocoaPods, not Swift Package Manager:

```sh
fvm flutter config --no-enable-swift-package-manager   # once per machine
cd ios && pod install
```

The Xcode project is SPM-migrated (committed), but the generated Swift package
is left empty by that flag and every plugin resolves through CocoaPods. Leaving
SPM enabled pulls Firebase in via SPM instead, which requires Xcode 16.3+; with
the flag off, Xcode 16.2 works. Keep it disabled so everyone builds the same way.

Building prints a warning that `flutter_local_notifications` does not support
Swift Package Manager. It is harmless — that plugin is built by CocoaPods like
all the others.

### Firebase config

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
fvm flutter run
```

Select a connected device or simulator when prompted, or target one directly:

```sh
fvm flutter run -d <device-id>
```

List available devices with `fvm flutter devices`.

In VS Code, use the "App: dev mode" launch configuration. It picks up the
pinned SDK from `dart.flutterSdkPath` in the workspace settings; reload the
window after a fresh `fvm install` so the Dart extension re-reads it.

## Other commands

```sh
fvm flutter test     # run tests
fvm flutter analyze  # static analysis
fvm flutter build apk    # Android build
fvm flutter build ios    # iOS build
```
