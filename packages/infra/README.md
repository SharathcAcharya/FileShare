# Infrastructure as Code

Terraform and Kubernetes configurations for deploying FileShare.

## Structure

```
infra/
├── terraform/         # Terraform configs for cloud resources
│   ├── aws/          # AWS-specific
│   ├── gcp/          # Google Cloud
│   └── digitalocean/ # DigitalOcean
└── k8s/              # Kubernetes manifests
    ├── signaling/    # Signaling server deployment
    ├── turn/         # TURN server deployment
    └── monitoring/   # Prometheus + Grafana
```

## Quick Deploy

### DigitalOcean (Recommended for MVP)

```bash
cd infra/terraform/digitalocean

# Initialize
terraform init

# Plan
terraform plan

# Apply
terraform apply

# Get outputs
terraform output
```

This creates:
- 1 droplet for signaling server
- 1 droplet for TURN server
- Load balancer
- Managed database (PostgreSQL) - optional
- Spaces (S3-compatible storage) - optional

### Kubernetes

```bash
cd infra/k8s

# Apply all manifests
kubectl apply -f signaling/
kubectl apply -f turn/
kubectl apply -f monitoring/

# Check status
kubectl get pods
```

## Monitoring

Access monitoring dashboards:

- Prometheus: `http://<lb-ip>:9090`
- Grafana: `http://<lb-ip>:3000`

Default Grafana credentials:
- Username: admin
- Password: (check secrets)

## Scaling

### Horizontal Scaling

```bash
# Scale signaling servers
kubectl scale deployment signaling-server --replicas=3

# Scale TURN servers
kubectl scale deployment turn-server --replicas=2
```

### Vertical Scaling

Update resource limits in deployment manifests.

## Cost Estimation

### DigitalOcean (US region)

| Resource | Specs | Monthly Cost |
|----------|-------|--------------|
| Signaling droplet | 2 vCPU, 2GB RAM | $12 |
| TURN droplet | 2 vCPU, 4GB RAM | $24 |
| Load balancer | N/A | $10 |
| **Total** | | **$46/month** |

Additional costs:
- Bandwidth: $0.01/GB (outbound)
- Storage: $0.10/GB/month (optional)

### AWS (Estimated)

| Resource | Specs | Monthly Cost |
|----------|-------|--------------|
| EC2 (signaling) | t3.small | $15 |
| EC2 (TURN) | t3.medium | $30 |
| ALB | N/A | $16 |
| **Total** | | **$61/month** |

Does not include data transfer costs (significant for TURN).

## TODO

- [ ] Complete Terraform configs for all providers
- [ ] Add Kubernetes Helm charts
- [ ] Set up CI/CD pipeline
- [ ] Add auto-scaling policies
- [ ] Configure backup and disaster recovery
- [ ] Add cost monitoring and alerts
