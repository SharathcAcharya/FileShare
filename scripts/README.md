# Development Scripts

Utility scripts for development and testing.

## load-test.js

Load testing script for signaling server.

```bash
node scripts/load-test.js --connections 100 --duration 60
```

## seed-data.js

Seed test data for development.

```bash
node scripts/seed-data.js
```

## generate-keys.js

Generate test encryption keys.

```bash
node scripts/generate-keys.js
```

## deploy.sh

Deployment script (use with caution in production).

```bash
./scripts/deploy.sh staging
./scripts/deploy.sh production
```
