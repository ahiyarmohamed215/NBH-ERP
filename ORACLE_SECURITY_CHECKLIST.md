# NBH ERP — Oracle Cloud Infrastructure Security Checklist

This checklist defines the defense-in-depth security configuration for hosting NBH ERP on an Oracle Cloud Infrastructure (OCI) Always Free `VM.Standard.A1.Flex` instance (ARM64, 2 OCPUs, 12 GB RAM, 50 GB boot volume, Ubuntu 24.04 LTS), utilizing the continuous usage Always Free allocation.

---

## 1. Network & Cloud Perimeter Security (OCI VCN & NSG)

### Ingress Rules (Network Security Group / Security List)
| Protocol | Destination Port | Source CIDR | Purpose | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TCP** | `443` | `0.0.0.0/0` | HTTPS web traffic (React, REST API, SSE) | [ ] Required |
| **TCP** | `80` | `0.0.0.0/0` | HTTP traffic (forwards 301 to HTTPS & ACME challenge) | [ ] Required |
| **TCP** | `22` | `YOUR_ADMIN_IP/32` (or OCI Bastion Service) | Secure administrative SSH access | [ ] Recommended |
| **TCP** | `3306` | **BLOCKED / NEVER OPENED** | MySQL database (Strictly loopback only) | [x] Enforced |
| **TCP** | `8080` | **BLOCKED / NEVER OPENED** | Spring Boot backend (Strictly loopback only) | [x] Enforced |

> [!CRITICAL]
> **Zero Direct Database Exposure:** Never add an ingress rule for port 3306 or 8080 in OCI Security Lists or Network Security Groups. All database and application requests must traverse through the local NGINX reverse proxy or SSH tunnels.
>
> [!TIP]
> **OCI Bastion Service:** Oracle Cloud Always Free includes OCI Bastion Service at zero cost. By using OCI Bastion, you can eliminate public SSH port 22 completely and manage the instance via ephemeral, identity-authenticated sessions.

---

## 2. Host Operating System Hardening (Ubuntu 24.04 LTS ARM64)

### SSH Configuration (`/etc/ssh/sshd_config.d/99-hardened.conf`)
- [ ] Disable password authentication: `PasswordAuthentication no`
- [ ] Enforce public key authentication only: `PubkeyAuthentication yes`
- [ ] Disable root login: `PermitRootLogin no`
- [ ] Set SSH idle timeout: `ClientAliveInterval 300` and `ClientAliveCountMax 2`
- [ ] Install and enable Fail2Ban: `sudo apt-get install fail2ban -y`

### Host Firewall (UFW / OCI Default iptables)
OCI Ubuntu images include pre-configured `iptables` rules. Ensure Oracle Cloud's local firewall allows traffic through NGINX while blocking internal ports:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw enable
```

### Dedicated Service User
- [ ] Create an unprivileged system user for the application:
  ```bash
  sudo useradd -r -s /usr/sbin/nologin -d /opt/erp erp
  ```
- [ ] Application processes (`java`) must run exclusively under `User=erp, Group=erp`.

### OS Maintenance
- [ ] Enable automated security patching:
  ```bash
  sudo apt-get install unattended-upgrades -y
  sudo dpkg-reconfigure --priority=low unattended-upgrades
  ```

---

## 3. Database Security Hardening (MySQL 8)

### Network Isolation
- [ ] Verify MySQL binds exclusively to loopback:
  Check `/etc/mysql/mysql.conf.d/99-nbh-erp.cnf`:
  ```ini
  [mysqld]
  bind-address           = 127.0.0.1
  mysqlx-bind-address    = 127.0.0.1
  ```
- [ ] Verify binding with ss:
  ```bash
  sudo ss -tulpn | grep 3306
  # Must output: 127.0.0.1:3306 (NOT 0.0.0.0:3306)
  ```

### ACID Durability Compliance
- [ ] Ensure full ACID transaction durability is configured:
  ```ini
  innodb_flush_log_at_trx_commit = 1
  ```
  *(Never use value 2 in production ERP environments, as power failure or kernel panics can lose up to 1 second of committed sales invoices or inventory adjustments).*

### User & Privilege Isolation
- [ ] Run initial hardening: `sudo mysql_secure_installation`
  - Remove anonymous users
  - Disallow root login remotely
  - Remove test database
- [ ] Create dedicated application user locked to `127.0.0.1` with least privilege:
  ```sql
  CREATE DATABASE nbhdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE DATABASE nbhdb_drill CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'nbh_erp'@'127.0.0.1' IDENTIFIED BY 'STRONG_SECRET_AT_LEAST_32_CHARS';
  GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON nbhdb.* TO 'nbh_erp'@'127.0.0.1';
  GRANT ALL PRIVILEGES ON nbhdb_drill.* TO 'nbh_erp'@'127.0.0.1';
  FLUSH PRIVILEGES;
  ```
- [ ] Verify that NO user exists with host `'%'` (wildcard):
  ```sql
  SELECT user, host FROM mysql.user WHERE host = '%';
  ```

---

## 4. Application Configuration & Secret Management

### Environment File Permissions
- [ ] Production environment file stored at `/opt/erp/config/erp.env`.
- [ ] Restrict file permissions so only the `erp` user and `root` can read it:
  ```bash
  sudo chown erp:erp /opt/erp/config/erp.env
  sudo chmod 600 /opt/erp/config/erp.env
  ```
- [ ] Verify that Git repository ignores all `.env` files and no secrets exist in source code.

### Cryptographic Keys & Session Policies
- [ ] Generate a cryptographically secure Base64-encoded 256-bit JWT secret:
  ```bash
  openssl rand -base64 32
  ```
  *(Do NOT use hex encoding, as the ERP authentication provider strictly decodes Base64).*
- [ ] Enforce 30-minute token and session expiration policies in `/opt/erp/config/erp.env`:
  ```ini
  # 15 minutes access token
  JWT_ACCESS_TOKEN_EXPIRATION_MS=900000
  # 30 minutes refresh token
  JWT_REFRESH_TOKEN_EXPIRATION_MS=1800000
  # Clean Flyway tracking
  DB_BASELINE_ON_MIGRATE=false
  ```
- [ ] Set `COOKIE_SECURE=true` in `erp.env` to enforce HTTPS-only cookies.
- [ ] Set `COOKIE_SAME_SITE=Lax` to prevent cross-site request forgery.
- [ ] Set `CORS_ALLOWED_ORIGINS=https://erp.example.com` matching your exact domain.
- [ ] Set `INITIAL_ADMIN_ENABLED=false` after initial bootstrap.

---

## 5. Web Server & Transport Security (NGINX + TLS)

### SSL/TLS Configuration
- [ ] Obtain Let's Encrypt certificate:
  ```bash
  sudo certbot certonly --nginx -d erp.example.com
  ```
- [ ] Verify automated certificate renewal:
  ```bash
  sudo certbot renew --dry-run
  sudo systemctl is-active certbot.timer
  ```
- [ ] Verify TLS protocols are restricted to `TLSv1.2 TLSv1.3` (SSLv3, TLSv1.0, TLSv1.1 disabled).
- [ ] Ensure HTTP port 80 strictly issues `301 Moved Permanently` to `https://$host$request_uri`.

### HTTP Security Headers
Verify headers using `curl -I https://erp.example.com`:
- [ ] `Strict-Transport-Security: max-age=31536000` (without `preload` or `includeSubDomains`)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- [ ] `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ...`
- [ ] Single `Cache-Control` header (no duplicate `max-age` from `expires`)
- [ ] Security headers explicitly preserved on `/assets/`, static media, and `/index.html`
- [ ] `Server` banner tokens hidden (`server_tokens off;`).

---

## 6. Real-Time SSE Security & Resource Protection

- [ ] Authenticated Event Stream: Verify `/api/v1/events` requires a valid JWT Bearer token in the `Authorization` header.
- [ ] Unbuffered Proxy: Confirm `proxy_buffering off;` and `chunked_transfer_encoding on;` in NGINX.
- [ ] Emitter Timeout Safety: Confirm that stale or disconnected SSE clients are cleaned up cleanly without leaking server threads or file descriptors.
- [ ] File Descriptor Limits: Verify `LimitNOFILE=65536` in `/etc/systemd/system/nbh-erp.service`.

---

## 7. Backup, Disaster Recovery & Restoration Verification

### Daily Automated Database Backups
- [ ] Deploy backup script at `/opt/erp/scripts/backup-db.sh` running via cron daily at 02:30 AM UTC.
- [ ] Verify streaming pipeline (mysqldump -> gzip -> openssl enc) leaves no plaintext files in `/tmp`.
- [ ] Verify HMAC-SHA256 authentication tag generation (`.hmac`) for ciphertext verification.
- [ ] Store MySQL backup credentials in `/opt/erp/config/.mysql_backup.cnf` with `chmod 600`.
- [ ] Off-server backup transfer configured and verified before declaring Disaster Recovery ready.

### Disaster Recovery Restoration Drill
- [ ] Run scheduled automated restoration drill via `/opt/erp/scripts/verify-backup.sh`:
  - Verifies ciphertext HMAC integrity prior to decryption.
  - Streams decryption directly into isolated test database (`nbhdb_drill`).
  - Audits table count, Flyway schema migration history, and record sanity.
  - Never touches production database `nbhdb`.

### OCI Always Free Block Volume Backups
- [ ] Configure OCI Boot Volume automated backup policy:
  - OCI Console -> Compute -> Instances -> Boot Volume -> Backup Policies -> Assign `Gold` or `Silver` Always Free policy (OCI allows up to 5 volume backups within 200 GB total free storage).

---

## Pre-Production Sign-off Matrix

| Verification Item | Tested By | Date | Result |
| :--- | :--- | :--- | :--- |
| External Port Scan (nmap only sees 22, 80, 443) | | | [ ] PASS |
| SSH Key Authentication Only (Password rejected) | | | [ ] PASS |
| MySQL Loopback Binding (Direct connection fails) | | | [ ] PASS |
| Spring Boot Loopback Binding (Direct connection fails) | | | [ ] PASS |
| SSL Labs Test (Score A or A+) | | | [ ] PASS |
| 30-Minute Idle Inactivity Auto-Logout | | | [ ] PASS |
| 30-Minute Refresh Token Sliding Expiration on Activity | | | [ ] PASS |
| Base64 JWT Secret Validation | | | [ ] PASS |
| Flyway Baseline On Migrate Disabled | | | [ ] PASS |
| MySQL ACID Durability (`innodb_flush_log_at_trx_commit = 1`) | | | [ ] PASS |
| Atomic Frontend Deployment (No 404 ChunkLoadErrors) | | | [ ] PASS |
| Database Restore Drill Verification | | | [ ] PASS |
