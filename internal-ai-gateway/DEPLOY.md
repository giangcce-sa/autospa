# VPS Deployment

Target shape:

- VPS: 2 vCPU, 8 GB RAM
- OS: Ubuntu 22.04/24.04 LTS
- Public ports: 80, 443
- Gateway runs behind Caddy, not exposed directly
- 9router runs inside Docker and binds only to VPS localhost port 20128
- Local production DB starts as SQLite volume

## 1. DNS

Point a domain or subdomain to the VPS:

```text
gateway.yourdomain.com -> VPS public IPv4
```

## 2. VPS packages

On the VPS:

```bash
apt update
apt install -y ca-certificates curl gnupg ufw fail2ban rsync
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## 3. Create app dir

```bash
mkdir -p /opt/internal-ai-gateway
```

## 4. First deploy

From local machine:

```bash
chmod +x scripts/deploy-vps.sh
scripts/deploy-vps.sh root@YOUR_VPS_IP /opt/internal-ai-gateway
```

The first run will stop if `.env` does not exist.

On VPS:

```bash
cd /opt/internal-ai-gateway
cp .env.vps.example .env
nano .env
```

Minimum required values:

```env
GATEWAY_DOMAIN=gateway.yourdomain.com
ADMIN_TOKEN=<long-random-secret>
KEY_PEPPER=<long-random-secret>
NINEROUTER_BASE_URL=http://nine-router:20128/v1
NINEROUTER_INITIAL_PASSWORD=<long-dashboard-password>
NINEROUTER_JWT_SECRET=<long-random-secret>
NINEROUTER_API_KEY_SECRET=<long-random-secret>
NINEROUTER_MACHINE_ID_SALT=<long-random-secret>
```

Keep the gateway database on SQLite for this build:

```env
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./data/gateway.db
TRUST_PROXY=true
PROVIDER_ALERT_COOLDOWN_SECONDS=300
MAX_MEDIA_BASE64_BYTES=6291456
```

`DATABASE_PROVIDER=postgres` is blocked at startup until the gateway has a real Postgres adapter and migration layer.

The 9Router dashboard is bound to `127.0.0.1:20128` and is intended to be opened through an SSH tunnel. For that loopback HTTP flow, `NINEROUTER_AUTH_COOKIE_SECURE=false` is intentional. Do not expose port `20128` publicly. Docker Compose now refuses to start when any required 9Router secret is missing.

For 2 vCPU / 8 GB RAM:

```env
KIRO_MAX_CONCURRENCY=1
KIRO_QUEUE_MAX_PENDING=10
```

Run deploy again:

```bash
scripts/deploy-vps.sh root@YOUR_VPS_IP /opt/internal-ai-gateway
```

## 5. Verify

```bash
curl https://gateway.yourdomain.com/health
curl https://gateway.yourdomain.com/ready
```

Admin dashboard:

```text
https://gateway.yourdomain.com/admin
```

Paste `ADMIN_TOKEN` into the dashboard to manage users, clients, API keys, policies, audit logs, and usage.

## 6. 9router Dashboard

9router is not public by default. Open an SSH tunnel:

```bash
ssh -i ~/.ssh/google_ai_annhuspa -L 20128:127.0.0.1:20128 quyetluu05@35.240.135.21
```

Then open:

```text
http://127.0.0.1:20128/dashboard
```

Configure providers/models in 9router there. Gateway calls it internally at:

```text
http://nine-router:20128/v1/chat/completions
```

After 9router is configured, create a 9router API key from its dashboard and add it to the gateway `.env`:

```env
NINEROUTER_API_KEY=sk-...
```

Then restart:

```bash
docker compose -f docker-compose.prod.yml up -d gateway
```

## 7. Backup

SQLite backup endpoint:

```bash
curl -X POST https://gateway.yourdomain.com/admin/api/database/backup \
  -H "x-admin-token: $ADMIN_TOKEN"
```

Backups are written inside the Docker volume under:

```text
/app/data/backups
```

To inspect volumes:

```bash
docker volume ls
docker compose -f docker-compose.prod.yml exec gateway ls -lah /app/data/backups
```
