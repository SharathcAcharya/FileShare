# Desktop App (Tauri)

Desktop wrapper for FileShare PWA using Tauri.

## Features

- Native file system access (no browser limitations)
- Background seeding for shared files
- System tray integration
- Auto-launch on startup
- Native notifications

## Development

```bash
# Install Tauri CLI
cargo install tauri-cli

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Architecture

The desktop app wraps the web client PWA with additional native capabilities:

- **Native File Picker** - Access files outside browser sandbox
- **Background Process** - Keep seeding files when window closed
- **System Integration** - Tray icon, notifications, deep links

## Building

### Windows

```bash
pnpm tauri build --target x86_64-pc-windows-msvc
```

### macOS

```bash
pnpm tauri build --target x86_64-apple-darwin
pnpm tauri build --target aarch64-apple-darwin
```

### Linux

```bash
pnpm tauri build --target x86_64-unknown-linux-gnu
```

## Distribution

Installers are generated in `src-tauri/target/release/bundle/`:

- Windows: `.msi` and `.exe`
- macOS: `.dmg` and `.app`
- Linux: `.deb`, `.appimage`

## TODO

- [ ] Implement native file picker
- [ ] Add background seeding service
- [ ] System tray with transfer status
- [ ] Auto-update mechanism
- [ ] Deep link handling (fileshare://)
