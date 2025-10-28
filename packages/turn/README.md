# TURN Server Setup

This directory contains configuration for the TURN server (coturn) used for NAT traversal when direct P2P connection fails.

## Quick Start

### Development / Testing

```bash
# Start TURN server with test configuration
docker-compose --profile test up coturn-test

# Test credentials:
# Username: testuser
# Password: testpassword
# URL: turn:localhost:3478
```

### Production

```bash
# 1. Update turnserver.conf with your settings:
#    - Set external-ip to your public IP
#    - Change static-auth-secret to a strong random value
#    - Add TLS certificates for secure connections

# 2. Start TURN server
docker-compose up -d coturn

# 3. Check logs
docker-compose logs -f coturn
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
TURN_SECRET=your-strong-random-secret-here
EXTERNAL_IP=your.public.ip.address
REALM=turn.yourdomain.com
```

### Generate Auth Secret

```bash
openssl rand -base64 32
```

### TLS Certificates

For production, use Let's Encrypt:

```bash
# Get certificates
certbot certonly --standalone -d turn.yourdomain.com

# Update turnserver.conf:
cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
```

## Testing

Test your TURN server using:

```bash
# Install turnutils (part of coturn)
apt-get install coturn

# Test TURN server
turnutils-uclient -v -u testuser -w testpassword localhost
```

Or use online TURN tester: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

## Firewall Rules

Open these ports:

- **3478** TCP/UDP - TURN (STUN)
- **5349** TCP/UDP - TURNS (TLS)
- **49152-65535** UDP - Relay ports

### UFW (Ubuntu)

```bash
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp
ufw allow 5349/udp
ufw allow 49152:65535/udp
```

### AWS Security Group

- Type: Custom TCP, Port: 3478, Source: 0.0.0.0/0
- Type: Custom UDP, Port: 3478, Source: 0.0.0.0/0
- Type: Custom TCP, Port: 5349, Source: 0.0.0.0/0
- Type: Custom UDP, Port: 5349, Source: 0.0.0.0/0
- Type: Custom UDP, Port Range: 49152-65535, Source: 0.0.0.0/0

## Monitoring

### Check TURN server status

```bash
# Docker logs
docker logs fileshare-turn

# Connection count
docker exec fileshare-turn ps aux | grep turnserver
```

### Metrics

Enable Prometheus metrics (add to turnserver.conf):

```
prometheus
prometheus-port=9641
```

Then scrape metrics from `http://localhost:9641/metrics`

## Cost Optimization

TURN relay is expensive (bandwidth costs). Minimize usage:

1. **Use STUN first** - Most connections succeed with STUN only
2. **Optimize ICE** - Prioritize host and srflx candidates
3. **Monitor usage** - Track % of connections using TURN relay
4. **Rate limiting** - Limit relay bandwidth per user
5. **Geographic distribution** - Deploy TURN servers near users

### Expected TURN Usage

- Well-configured network: 1-5% of connections
- Corporate/restricted networks: 10-20%
- Symmetric NAT scenarios: 30-50%

Target: <5% TURN usage for cost efficiency

## Scaling

### Single Server Limits

One coturn instance can handle:
- ~1000 concurrent sessions
- ~1 Gbps relay traffic

### Multi-Server Setup

For high scale, use:

1. **Multiple TURN servers** with DNS load balancing
2. **Geographic distribution** (US, EU, Asia)
3. **Shared secret** across all servers
4. **Health checks** and auto-failover

Example multi-region setup:

```
turn-us.fileshare.app
turn-eu.fileshare.app
turn-asia.fileshare.app
```

## Security Best Practices

1. ✅ Use strong auth secret (32+ random bytes)
2. ✅ Enable TLS (TURNS) in production
3. ✅ Set quotas (max-bps, user-quota)
4. ✅ Deny private IP ranges (already configured)
5. ✅ Monitor for abuse patterns
6. ✅ Rotate credentials regularly
7. ✅ Use short-term credentials (REST API)

## Troubleshooting

### Connection Failed

```bash
# Check if TURN is running
docker ps | grep coturn

# Check logs
docker logs fileshare-turn --tail 100

# Test connectivity
telnet <your-ip> 3478
```

### High CPU/Memory

- Increase `max-bps` limit
- Add more TURN servers
- Check for abuse (too many connections from one IP)

### Clients Not Using TURN

- Verify ICE servers config in web client
- Check firewall rules
- Verify credentials are correct
- Use browser DevTools → WebRTC internals

## References

- [coturn Documentation](https://github.com/coturn/coturn)
- [WebRTC TURN Guide](https://www.html5rocks.com/en/tutorials/webrtc/infrastructure/)
- [RFC 5766 - TURN](https://tools.ietf.org/html/rfc5766)
