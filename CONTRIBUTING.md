# Contributing to FileShare

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the FileShare project.

## Code of Conduct

Be respectful, inclusive, and professional. We're building something great together.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Git
- Docker (for TURN server testing)

### Local Development Setup

```bash
# 1. Fork and clone the repo
git clone https://github.com/your-username/fileshare.git
cd fileshare

# 2. Install dependencies
pnpm install

# 3. Start development servers
pnpm dev

# 4. Start signaling server
cd packages/signaling-server
pnpm dev

# 5. Start TURN server (optional, for testing)
cd packages/turn
docker-compose --profile test up
```

### Project Structure

```
fileshare/
├── packages/
│   ├── web-client/         # React PWA
│   ├── signaling-server/   # Node.js WebSocket server
│   ├── turn/               # TURN server configs
│   ├── desktop/            # Tauri desktop app
│   ├── mobile/             # Mobile wrappers
│   ├── utils/              # Shared utilities
│   └── infra/              # Infrastructure as code
├── scripts/                # Development scripts
└── docs/                   # Documentation
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Write clear, concise code
- Follow existing code style
- Add comments for complex logic
- Write tests for new features

### 3. Test Your Changes

```bash
# Run linter
pnpm lint

# Run type check
pnpm typecheck

# Run tests
pnpm test

# Build to verify
pnpm build
```

### 4. Commit Your Changes

Use conventional commit messages:

```bash
git commit -m "feat: add QR code pairing"
git commit -m "fix: resolve WebRTC connection timeout"
git commit -m "docs: update deployment guide"
```

**Commit types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance tasks

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title and description
- Link to related issue (if any)
- Screenshots/videos for UI changes
- Test results

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Define interfaces for complex types
- Use meaningful variable names

```typescript
// Good
interface FileTransferOptions {
  file: File;
  peerId: string;
  onProgress?: (progress: number) => void;
}

// Bad
interface Opts {
  f: any;
  p: string;
  cb?: Function;
}
```

### React

- Use functional components and hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use TypeScript for prop types

```tsx
// Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

### Error Handling

- Always handle errors gracefully
- Log errors for debugging
- Show user-friendly error messages

```typescript
try {
  await transferFile(file);
} catch (error) {
  console.error('Transfer failed:', error);
  showNotification('Failed to transfer file. Please try again.');
}
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { formatBytes } from './helpers';

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test('file transfer completes successfully', async ({ page, context }) => {
  const page1 = await context.newPage();
  const page2 = await context.newPage();

  // Test WebRTC file transfer between two pages
  // ...
});
```

## Documentation

- Update README.md for user-facing changes
- Update docs/ for architecture changes
- Add JSDoc comments for public APIs
- Include examples in documentation

## What to Contribute

### Good First Issues

Look for issues labeled `good first issue`:
- Bug fixes
- Documentation improvements
- UI/UX enhancements
- Test coverage

### Feature Requests

Before implementing a new feature:
1. Check if there's an existing issue
2. Discuss with maintainers first
3. Create a design doc for large features
4. Break into smaller PRs when possible

### Priority Areas

We especially need help with:
- [ ] Mobile app development (React Native/Flutter)
- [ ] E2E test coverage
- [ ] Accessibility improvements
- [ ] Localization/i18n
- [ ] Performance optimizations
- [ ] Security audits

## Code Review Process

1. All PRs require at least one approval
2. CI must pass (lint, tests, build)
3. Maintainers may request changes
4. Be responsive to feedback
5. Once approved, maintainers will merge

## Community

- **GitHub Discussions**: Ask questions, share ideas
- **Discord**: Real-time chat with contributors
- **Twitter**: Follow @fileshare for updates

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

- Open a GitHub Discussion
- Join our Discord
- Email: opensource@fileshare.app

Thank you for contributing! 🎉
