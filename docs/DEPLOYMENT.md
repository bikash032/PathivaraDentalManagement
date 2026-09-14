# Deployment — Pathivara Dental Clinic

Covers Phase 16 (clinic deployment) and Phase 17 (secure remote access).

**Status: plan ready to execute.** Nothing here has been run yet — it needs the
actual clinic machine. Decisions still needed from the clinic are flagged
as **[DECIDE]**.

---

## 1. Recommended shape

```
            Clinic LAN (private)
 ┌──────────────────────────────────────────┐
 │  Reception PC ─┐                         │
 │  Doctor PC  ───┼──► Clinic server        │
 │  Admin PC   ───┘      ├── Next.js (app)  │
 │                       └── PostgreSQL     │
 └──────────────────────────────────────────┘
                      ▲
                      │ encrypted VPN tunnel only
                      │
              Authorized remote laptop
```

Non-negotiables:

- **PostgreSQL is never exposed to the internet.** It listens on localhost (or
  the LAN interface only) and is reached by the app on the same machine.
- **No port forwarding for remote access.** Remote users join a private network
  (see §6); nothing is published to the public internet.
- The clinic server is the single source of truth and the thing that gets
  backed up.

## 2. Server requirements

Modest — this is a single-clinic workload:

- 2 CPU cores, 4 GB RAM, 50 GB SSD is comfortable
- Ubuntu Server LTS (recommended) or any machine that stays on during clinic hours
- UPS strongly recommended — Nepal's power cuts are the most likely cause of
  an unclean database shutdown
- Static LAN IP (e.g. `192.168.1.50`) so clients have a stable address

**[DECIDE]** Dedicated server PC in the clinic vs. a small VPS. A clinic PC keeps
patient data physically on-premise (simpler for privacy) but makes uptime and
off-site backup your responsibility. A VPS is more reliable but puts patient
data with a third party and depends on the clinic's internet being up.

## 3. Install

```bash
# 1. System packages
sudo apt update && sudo apt install -y postgresql nginx git curl
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Database + app role (use a strong, unique password — not the dev one)
sudo -u postgres psql <<'SQL'
CREATE ROLE pathivara_app WITH LOGIN PASSWORD '<strong-password>';
CREATE DATABASE pathivara_dental OWNER pathivara_app;
SQL

# 3. Application
sudo mkdir -p /opt/pathivara && sudo chown "$USER" /opt/pathivara
git clone <repo-url> /opt/pathivara && cd /opt/pathivara
npm ci

# 4. Configuration
cp .env.example .env
#    edit .env:
#      DATABASE_URL="postgresql://pathivara_app:<strong-password>@localhost:5432/pathivara_dental?schema=public"
#      AUTH_SECRET="$(openssl rand -base64 32)"   <- generate fresh, never reuse dev
#      APP_URL="https://clinic.local"
chmod 600 .env

# 5. Schema + seed (seed creates roles/permissions and the first Super Admin)
npx prisma migrate deploy
npx prisma generate
npx prisma db seed

# 6. Build
npm run build
```

Note `migrate deploy` (not `migrate dev`) in production — it applies existing
migrations without generating new ones and never needs a shadow database.
After the first deploy, revoke the shadow-database privilege if it was ever
granted: `ALTER ROLE pathivara_app NOCREATEDB;`

## 4. Run as a service

`/etc/systemd/system/pathivara.service`:

```ini
[Unit]
Description=Pathivara Dental Clinic Management
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=pathivara
WorkingDirectory=/opt/pathivara
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/pathivara/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pathivara
sudo systemctl status pathivara
```

`Restart=always` plus `enable` means the app comes back by itself after a power
cut — important given the UPS caveat above.

## 5. HTTPS on the LAN

The session cookie is marked `secure` in production, so **the app must be served
over HTTPS or logins will not persist.** On a LAN there is no public DNS to
validate, so use one of:

- **Internal CA / self-signed certificate** installed once on each clinic PC —
  no internet dependency, good for an air-gapped clinic.
- **A real domain + Let's Encrypt via DNS-01** if the clinic owns a domain —
  gives a certificate browsers trust with no warnings, but needs internet.

nginx reverse proxy in front of the app:

```nginx
server {
    listen 443 ssl;
    server_name clinic.local;

    ssl_certificate     /etc/ssl/certs/clinic.crt;
    ssl_certificate_key /etc/ssl/private/clinic.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name clinic.local;
    return 301 https://$host$request_uri;
}
```

`X-Forwarded-For` matters: the app reads it to record the IP on audit log
entries and to key login rate limiting.

**[DECIDE]** Which certificate approach — depends on whether the clinic has a
domain name and reliable internet.

## 6. Secure remote access (Phase 17)

Do **not** forward ports or publish the app. Put remote machines on a private
overlay network instead:

**Recommended: Tailscale** (WireGuard-based, no port forwarding, works behind
the CGNAT common on Nepali ISPs).

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Install on the clinic server and on each authorized remote laptop. The remote
machine then reaches the server at its Tailscale address as if on the LAN.
Tighten with Tailscale ACLs so only named devices/users can reach the server,
and enable device approval so a new device can't self-join.

Alternative: self-hosted **WireGuard** — no third-party dependency, but you
manage keys and need a reachable endpoint, which CGNAT can complicate.

Additional controls for remote access specifically:

- Restrict which staff accounts may be used remotely (policy, plus keep the
  remote device list short).
- Consider adding 2FA before enabling wide remote use (noted in SECURITY.md).
- Remote access still goes through the same login, RBAC and audit logging — a
  remote session is not privileged differently.

## 7. Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 443 proto tcp   # clinic LAN only
sudo ufw allow in on tailscale0                                 # VPN peers
sudo ufw enable
```

PostgreSQL's 5432 is deliberately absent — it is reached only from localhost.
Confirm with `sudo ss -tlnp | grep 5432` that it binds to `127.0.0.1`.

## 8. Go-live checklist

- [ ] Fresh `AUTH_SECRET`, strong unique DB password, `.env` is `chmod 600`
- [ ] Seeded Super Admin password changed at first login; real staff accounts
      created with appropriate roles; the seed account's credentials removed
      from `.env`
- [ ] HTTPS working; login persists across page loads (proves `secure` cookie)
- [ ] `ALTER ROLE pathivara_app NOCREATEDB;` applied
- [ ] PostgreSQL bound to localhost only; firewall enabled; 5432 not reachable
      from another machine
- [ ] `systemctl enable` confirmed by rebooting the server and seeing the app
      come back
- [ ] Nightly backup scheduled **and one restore actually tested** (BACKUP.md)
- [ ] Off-site backup destination configured; `BACKUP_PASSPHRASE` stored
      separately from the backups
- [ ] Clinic profile filled in under Settings so receipts print correct details
- [ ] Treatment catalog priced to match the clinic's real price list
- [ ] Staff walked through: login, register patient, book appointment, record
      visit, create invoice, take payment, print receipt

## 9. Updating the app later

```bash
cd /opt/pathivara
BACKUP_PASSPHRASE='<passphrase>' ./scripts/backup.sh   # always back up first
git pull
npm ci
npx prisma migrate deploy
npm run build
sudo systemctl restart pathivara
```

Do this outside clinic hours, and check the app loads before walking away.
