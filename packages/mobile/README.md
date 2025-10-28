# Mobile App

Mobile wrappers for FileShare.

## Options

### React Native (Recommended for MVP)

Pros:
- Shares code with web client (React)
- Good performance
- Large ecosystem

Cons:
- Larger bundle size than native
- Some platform-specific code still needed

### Flutter

Pros:
- Excellent performance
- Beautiful UI out of the box
- Single codebase

Cons:
- Different language (Dart)
- Larger initial learning curve

### Native (iOS Swift + Android Kotlin)

Pros:
- Best performance
- Full platform API access
- Smallest bundle size

Cons:
- Two separate codebases
- More development time

## Features

### iOS

- Share extension (share files from other apps)
- Background file transfers
- Hotspot detection and pairing
- AirDrop-like experience

### Android

- Share intent handling
- Wi-Fi Direct for local transfers
- Background service
- Quick settings tile

## Development

```bash
# React Native
cd mobile
npx react-native run-ios
npx react-native run-android

# Flutter
cd mobile
flutter run
```

## TODO

- [ ] Choose mobile framework (React Native recommended)
- [ ] Set up project structure
- [ ] Implement camera QR scanner
- [ ] Local network discovery
- [ ] Background transfer service
- [ ] Push notifications for transfer complete
