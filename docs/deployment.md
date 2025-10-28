# Deployment Guide

Complete guide for deploying FileShare to production.

## Overview

FileShare consists of three main components:

1. **PWA (Web Client)** - Static files hosted on CDN
2. **Signaling Server** - WebSocket server for peer discovery
3. **TURN Server** - NAT traversal and relay fallback

## Prerequisites

- Domain name (e.g., fileshare.app)
- TLS certificates (Let's Encrypt recommended)
- Cloud provider account (DigitalOcean, AWS, or GCP)
- Docker & Docker Compose (for local testing)

## Quick Start (DigitalOcean)

### 1. Set Up Infrastructure

```bash
# Clone repo
git clone https://github.com/your-org/fileshare.git
cd fileshare

# Install dependencies
pnpm install

# Set up DigitalOcean droplets
cd packages/infra/terraform/digitalocean
terraform init
terraform apply
```

### 2. Deploy PWA

```bash
# Build PWA
cd packages/web-client
pnpm build

# Deploy to Vercel (or Netlify)
vercel --prod

# Or use your own CDN/nginx
rsync -avz dist/ user@your-server:/var/www/fileshare/
```

### 3. Deploy Signaling Server

```bash
# Build and push Docker image
cd packages/signaling-server
docker build -t your-registry/fileshare-signaling:latest .
docker push your-registry/fileshare-signaling:latest

# SSH into server
ssh user@signaling-server

# Run container
docker run -d \
  --name fileshare-signaling \
  -p 8080:8080 \
  -e PORT=8080 \
  -e NODE_ENV=production \
  your-registry/fileshare-signaling:latest
```

### 4. Deploy TURN Server

```bash
# SSH into TURN server
ssh user@turn-server

# Copy coturn config
scp packages/turn/turnserver.conf user@turn-server:/etc/coturn/

# Start coturn
docker-compose -f packages/turn/docker-compose.yml up -d
```

### 5. Configure DNS

```
# A Records
fileshare.app           → PWA CDN IP
signal.fileshare.app    → Signaling server IP
turn.fileshare.app      → TURN server IP

# SSL/TLS
- Use Let's Encrypt for all domains
- Enable HTTPS/WSS for all services
```

### 6. Test Deployment

```bash
# Test PWA
curl https://fileshare.app

# Test signaling server WebSocket
wscat -c wss://signal.fileshare.app/ws

# Test TURN server
turnutils-uclient -v turn.fileshare.app
```

## Environment Variables

### PWA (.env)

```env
VITE_SIGNALING_URL=wss://signal.fileshare.app/ws
VITE_STUN_URL=stun:stun.l.google.com:19302
VITE_TURN_URL=turn:turn.fileshare.app:3478
VITE_TURN_USERNAME=username
VITE_TURN_CREDENTIAL=password
```

### Signaling Server (.env)

```env
PORT=8080
HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=https://fileshare.app
```

### TURN Server (turnserver.conf)

```conf
external-ip=<YOUR_PUBLIC_IP>
realm=turn.fileshare.app
static-auth-secret=<STRONG_RANDOM_SECRET>
cert=/etc/letsencrypt/live/turn.fileshare.app/fullchain.pem
pkey=/etc/letsencrypt/live/turn.fileshare.app/privkey.pem
```

## Monitoring

### Set Up Monitoring Stack

```bash
cd packages/infra/k8s/monitoring
kubectl apply -f .

# Access Grafana
kubectl port-forward svc/grafana 3000:3000
```

### Key Metrics to Monitor

- Active sessions
- Connection success rate
- TURN usage percentage
- Bandwidth usage
- Error rates
- Transfer completion rate

## Backup & Recovery

### Database Backups (if using)

```bash
# Automated daily backups
0 2 * * * pg_dump fileshare | gzip > /backups/fileshare-$(date +\%Y\%m\%d).sql.gz
```

### Configuration Backups

Store all configs in version control (Git).

## Security Checklist

- [ ] Enable HTTPS/WSS everywhere
- [ ] Use strong TURN auth secrets
- [ ] Enable rate limiting
- [ ] Set up firewall rules
- [ ] Enable DDoS protection (Cloudflare)
- [ ] Regular security updates
- [ ] Monitor for suspicious activity
- [ ] Implement abuse reporting

## Cost Optimization

1. **Minimize TURN usage** - Optimize ICE, use STUN first
2. **Use CDN** - Cache static assets (Cloudflare, etc.)
3. **Auto-scaling** - Scale down during low traffic
4. **Compression** - Enable gzip/brotli
5. **Monitor costs** - Set up billing alerts

## Troubleshooting

### High Latency

- Check server location (deploy closer to users)
- Use CDN for static assets
- Optimize WebSocket connection

### TURN Not Working

- Check firewall rules (ports 3478, 5349, 49152-65535)
- Verify TLS certificates
- Test with turnutils-uclient

### High TURN Usage (>10%)

- Review ICE candidate priority
- Check for symmetric NAT users
- Consider multiple TURN servers

## Scaling Guide

### Stage 1: Single Server (0-1000 users)

- 1 signaling server
- 1 TURN server
- CDN for PWA

**Cost**: ~$50/month

### Stage 2: Multi-Region (1000-10000 users)

- 3 signaling servers (US, EU, Asia)
- 3 TURN servers (geo-distributed)
- Load balancer
- Monitoring stack

**Cost**: ~$200/month

### Stage 3: Enterprise (10000+ users)

- Auto-scaling signaling servers (K8s)
- TURN server cluster
- Managed database
- Comprehensive monitoring
- 24/7 support

**Cost**: $500+/month

## Support

For deployment issues:
- GitHub Issues: https://github.com/your-org/fileshare/issues
- Discord: https://discord.gg/fileshare
- Email: support@fileshare.app
