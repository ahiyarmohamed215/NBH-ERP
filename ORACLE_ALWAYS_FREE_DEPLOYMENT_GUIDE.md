# NBH ERP — Oracle Cloud Infrastructure Always Free Deployment Guide

This guide provides comprehensive, production-grade instructions for deploying NBH ERP to **Oracle Cloud Infrastructure (OCI) Always Free** on an Ampere A1 ARM64 Compute instance.

---

## 1. Architecture Summary & Official OCI Always Free Limits

### Current Always Free Entitlements (Ampere A1)
According to Oracle Cloud Infrastructure's current Always Free tier documentation, eligible tenancies receive:
- **Ampere A1 Compute:** Up to **2 OCPUs** and **12 GB RAM** total for continuous usage per tenancy.
- **Block Volume Storage:** Up to **200 GB eligible aggregate block/boot storage** (shared across all boot and block volumes), subject to account and service limits.
- **Outbound Data Transfer:** Up to **10 TB / month** free outbound data transfer.
- **Public IP:** 1 Ephemeral or Reserved IPv4 address.

> [!WARNING]
> **Account Sizing & Capacity Notice:**
> Sizing the NBH ERP instance to **2 OCPUs** and **12 GB RAM** utilizes the **entire continuous Always Free Ampere A1 allocation** for your tenancy. It does **not** leave any remaining free Ampere compute capacity.
> You must verify your actual Oracle Cloud account eligibility and Ampere A1 shape availability in your tenancy's home region during manual provisioning, as capacity varies by region and availability domain.

### NBH ERP Instance Allocation (`VM.Standard.A1.Flex`)
| Component | Specification | Resource Consumption |
| :--- | :--- | :--- |
| **Compute Shape** | `VM.Standard.A1.Flex` (Ampere Altra ARM64) | 2 OCPUs (4 vCPUs) (100% of continuous Ampere free quota) |
| **System Memory** | 12 GB RAM | 12 GB RAM (100% of continuous Ampere free quota) |
| **Boot Volume** | 50 GB NVMe | 50 GB (25% of eligible aggregate 200 GB storage) |
| **Operating System** | Ubuntu 24.04 LTS ARM64 (Canonical Always Free eligible) | Free standard image |
| **Reverse Proxy** | NGINX with Let's Encrypt TLS (HTTP/2, unbuffered SSE) | Local loopback |
| **Frontend** | React 18 production build served statically via NGINX | Zero application runtime overhead |
| **Backend** | Spring Boot 3.3.4 (Java 21 OpenJDK headless) on `127.0.0.1:8080` | Memory capped at 4 GB heap |
| **Database** | MySQL 8 with InnoDB ACID durability on `127.0.0.1:3306` | Memory capped at 3.5 GB |
| **Target Concurrency** | 20–50 concurrent employees | Ample throughput |
| **Monthly Cost** | **$0.00 / month** | 100% within Always Free tier |

---

## 2. Authentication & 30-Minute Session Policy

The ERP strictly enforces a **30-minute idle inactivity and refresh-token policy**:
1. **Access JWT Lifetime:** 15 minutes (`900,000 ms`), stored exclusively in JavaScript browser memory.
2. **Refresh Token Lifetime:** 30 minutes (`1,800,000 ms`), transported via secure, HttpOnly, SameSite=Lax cookie (`nbh_refresh_token`) with Path `/api/v1/auth`.
3. **Sliding Expiration on Activity:** As long as an employee actively uses the ERP, the client automatically rotates the refresh token at ~14.5 minutes, sliding the server session expiration forward another 30 minutes. **Active employees are never logged out unexpectedly.**
4. **Automatic Idle Inactivity Logout:** When an employee is inactive (no mouse, keyboard, touch, or scroll events) for 30 minutes (`1,800,000 ms`), the frontend terminates the session, clears all in-memory tokens, purges the TanStack Query and API caches, revokes the refresh session on the backend, and displays the session-expiration notice on the login screen.
5. **No Silent Restoration:** Background SSE heartbeats, TanStack Query background refetches, and periodic timer checks are strictly excluded from resetting user activity. An expired refresh token cannot be restored.

> [!IMPORTANT]
> Any references in historical reports to a 7-day refresh token are **superseded**. The production configuration below enforces the 30-minute policy (`JWT_REFRESH_TOKEN_EXPIRATION_MS=1800000`).

---

## 3. OCI Instance Provisioning

1. Log in to the [Oracle Cloud Console](https://cloud.oracle.com/).
2. Navigate to **Compute** &rarr; **Instances** &rarr; Click **Create Instance**.
3. Configure the instance parameters:
   - **Name:** `nbh-erp-production`
   - **Compartment:** Select your root or designated compartment.
   - **Placement:** Any Availability Domain (AD) with Always Free Ampere capacity.
   - **Image:** Click **Change Image** &rarr; Select **Canonical Ubuntu** &rarr; Choose **24.04 LTS (aarch64 / ARM64)**.
   - **Shape:** Click **Change Shape** &rarr; Select **Ampere** &rarr; `VM.Standard.A1.Flex`:
     - **OCPUs:** `2`
     - **Memory (GB):** `12`
   - **Networking:**
     - Select **Create new virtual cloud network** (or choose existing VCN).
     - Subnet: Public Subnet.
     - **Assign a public IPv4 address:** Yes.
   - **Add SSH keys:** Upload your public SSH key (`id_ed25519.pub`).
   - **Boot volume:** 50 GB with transit encryption enabled.
4. Click **Create**. Note down the assigned **Public IP Address** once provisioning completes.

---

## 4. OCI Virtual Cloud Network (VCN) Security Ingress

In the OCI Console:
1. Navigate to **Networking** &rarr; **Virtual Cloud Networks** &rarr; Click your VCN &rarr; Click **Security Lists** &rarr; **Default Security List**.
2. Click **Add Ingress Rules**:
   - **Rule 1 (HTTPS):**
     - Source CIDR: `0.0.0.0/0` | Protocol: `TCP` | Destination Port: `443` | Description: `HTTPS Production Web Traffic`
   - **Rule 2 (HTTP):**
     - Source CIDR: `0.0.0.0/0` | Protocol: `TCP` | Destination Port: `80` | Description: `HTTP Redirect and Let's Encrypt ACME`
   - **Rule 3 (SSH):**
     - Source CIDR: `YOUR_ADMIN_IP/32` (Recommended) or `0.0.0.0/0` with key-only auth | Protocol: `TCP` | Destination Port: `22` | Description: `SSH Administrative Access`
3. **DO NOT** add ingress rules for port `3306` (MySQL) or `8080` (Spring Boot).

---

## 5. DNS Configuration

Point your public domain (e.g. `erp.example.com`) to the OCI Public IP address via an **A Record** with TTL 300s:

```text
Type: A
Name: erp (or @)
Value: <YOUR_OCI_PUBLIC_IP>
TTL: 300
```

---

## 6. Initial Server Setup & Package Installation

Connect to your instance via SSH:
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@<YOUR_OCI_PUBLIC_IP>
```

Update system packages and install runtime dependencies:
```bash
sudo apt-get update && sudo apt-get upgrade -y

# Install OpenJDK 21 headless, MySQL 8, NGINX, Certbot, font libraries for PDF printing, and utilities
sudo apt-get install -y \
    openjdk-21-jre-headless \
    mysql-server \
    nginx \
    certbot \
    python3-certbot-nginx \
    libfontconfig1 \
    fonts-dejavu-core \
    fail2ban \
    ufw \
    curl \
    git \
    unzip \
    htop
```

Verify Java and MySQL architectures are `aarch64`:
```bash
java -version
uname -m
# Expected: aarch64
```

Configure host firewall (UFW):
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw --force enable
sudo ufw status verbose
```

---

## 7. MySQL 8 Database Configuration & ACID Durability

Create the MySQL configuration at `/etc/mysql/mysql.conf.d/99-nbh-erp.cnf`:

```bash
sudo tee /etc/mysql/mysql.conf.d/99-nbh-erp.cnf > /dev/null << 'EOF'
[mysqld]
# Network Isolation - strictly localhost
bind-address            = 127.0.0.1
mysqlx-bind-address     = 127.0.0.1

# Memory Tuning for 12GB Total Host (Allocating ~3.5GB to MySQL)
innodb_buffer_pool_size        = 2560M
innodb_buffer_pool_instances    = 2
innodb_redo_log_capacity       = 512M
innodb_log_buffer_size         = 64M

# Connection Limits (HikariCP pool size is 25)
max_connections                = 80
thread_cache_size              = 16
table_open_cache               = 2000

# Charset and Collation
character-set-server           = utf8mb4
collation-server               = utf8mb4_unicode_ci

# Full ACID Transaction Durability (Do NOT use 2 in production)
innodb_flush_log_at_trx_commit = 1
innodb_flush_method            = O_DIRECT
innodb_file_per_table          = 1
slow_query_log                 = 1
slow_query_log_file            = /var/log/mysql/mysql-slow.log
long_query_time                = 1
EOF
```

Restart MySQL and enable service:
```bash
sudo systemctl restart mysql
sudo systemctl enable mysql
```

Run MySQL initial security hardening:
```bash
sudo mysql_secure_installation
```

Log in to MySQL as root and initialize the database and application user:
```bash
sudo mysql -u root
```

Execute SQL commands:
```sql
CREATE DATABASE nbhdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE nbhdb_drill CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Replace 'YOUR_STRONG_PASSWORD_32_CHARS' with a secure generated password
CREATE USER 'nbh_erp'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY 'YOUR_STRONG_PASSWORD_32_CHARS';

-- Grant required application privileges on production schema (avoid granting global DROP)
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON nbhdb.* TO 'nbh_erp'@'127.0.0.1';

-- Grant isolated test privileges on drill schema for automated backup restoration verification
GRANT ALL PRIVILEGES ON nbhdb_drill.* TO 'nbh_erp'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

---

## 8. Directory Hierarchy & Dedicated Service User

Create an unprivileged system user and application directory structure:

```bash
sudo useradd -r -m -s /usr/sbin/nologin -d /opt/erp erp

# Create directory tree:
# - /var/www/erp/releases: versioned frontend bundles
# - /var/www/erp/assets: cumulative pool of content-hashed chunks (prevents 404 ChunkLoadErrors for old tabs)
# - /var/www/erp/current: atomic symlink pointing to active release
# - /var/backups/nbh-erp: encrypted database snapshots
sudo mkdir -p /opt/erp/{config,scripts}
sudo mkdir -p /var/log/nbh-erp
sudo mkdir -p /var/www/erp/{releases,assets}
sudo mkdir -p /var/backups/nbh-erp

# Set ownership and permissions
sudo chown -R erp:erp /opt/erp
sudo chown -R erp:erp /var/log/nbh-erp
sudo chown -R www-data:www-data /var/www/erp
sudo chmod 750 /opt/erp
sudo chmod 750 /var/log/nbh-erp
sudo chmod 700 /var/backups/nbh-erp
```

---

## 9. Application Environment Configuration

Generate a secure Base64 256-bit key:
```bash
openssl rand -base64 32
```

Create `/opt/erp/config/erp.env` (Note: Systemd `EnvironmentFile` requires NO inline trailing comments on variable assignment lines):

```bash
sudo tee /opt/erp/config/erp.env > /dev/null << 'EOF'
PORT=8080
SERVER_ADDRESS=127.0.0.1

DB_URL=jdbc:mysql://127.0.0.1:3306/nbhdb?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true&characterEncoding=UTF-8
DB_USERNAME=nbh_erp
DB_PASSWORD=YOUR_STRONG_PASSWORD_32_CHARS
DB_DDL_AUTO=validate
DB_BASELINE_ON_MIGRATE=false

HIKARI_MAX_POOL_SIZE=25
HIKARI_MIN_IDLE=10

# Paste Base64 32-byte secret generated with: openssl rand -base64 32
JWT_SECRET=YOUR_BASE64_32_BYTE_SECRET
JWT_ACCESS_TOKEN_EXPIRATION_MS=900000
JWT_REFRESH_TOKEN_EXPIRATION_MS=1800000

COOKIE_SECURE=true
COOKIE_SAME_SITE=Lax
REFRESH_SESSION_RETENTION_DAYS=1
REFRESH_SESSION_CLEANUP_CRON=0 0 3 * * ?

# Set to your exact production HTTPS domain
CORS_ALLOWED_ORIGINS=https://erp.example.com

INITIAL_ADMIN_ENABLED=false
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=
INITIAL_ADMIN_EMAIL=admin@example.com

# Warehouse & Office Printing Integration
APP_WAREHOUSE_PRINT_POLL_MS=5000

# Company Metadata (bound to app.company.* in Spring Boot)
APP_COMPANY_NAME="Example Distribution Co."
COMPANY_NAME="Example Distribution Co."
APP_COMPANY_ADDRESS="123 Example Street, City, Country"
COMPANY_ADDRESS="123 Example Street, City, Country"
APP_COMPANY_PHONE="+1 555 0100"
COMPANY_PHONE="+1 555 0100"
APP_COMPANY_CURRENCY_SYMBOL="Rs."
COMPANY_CURRENCY_SYMBOL="Rs."

# Business Timezone (defaults to Asia/Colombo if unset)
APP_BUSINESS_TIMEZONE=Asia/Colombo
EOF
```

Secure the environment file permissions:
```bash
sudo chown erp:erp /opt/erp/config/erp.env
sudo chmod 600 /opt/erp/config/erp.env
```

---

## 10. Building and Deploying Artifacts (Initial Deploy)

### A. Local Machine Build
On your development machine:

1. **Build Backend JAR:**
   ```bash
   ./mvnw clean package -DskipTests
   # Output: target/erp-0.0.1-SNAPSHOT.jar
   ```

2. **Build Frontend Bundle:**
   ```bash
   cd frontend
   npm run build
   # Output: frontend/dist/
   ```

3. **Transfer Artifacts to OCI Server:**
   ```bash
   scp -i ~/.ssh/id_ed25519 target/erp-0.0.1-SNAPSHOT.jar ubuntu@<YOUR_OCI_PUBLIC_IP>:/tmp/nbh-erp.jar
   scp -i ~/.ssh/id_ed25519 -r frontend/dist ubuntu@<YOUR_OCI_PUBLIC_IP>:/tmp/dist
   ```

### B. Install Artifacts on Server
On the OCI Server:
```bash
# 1. Install backend JAR
sudo mv /tmp/nbh-erp.jar /opt/erp/nbh-erp.jar
sudo chown erp:erp /opt/erp/nbh-erp.jar
sudo chmod 644 /opt/erp/nbh-erp.jar

# 2. Deploy initial frontend release
RELEASE_DIR="/var/www/erp/releases/release_initial"
sudo mkdir -p "$RELEASE_DIR"
sudo cp -r /tmp/dist/* "$RELEASE_DIR/"

# 3. Copy all hashed assets into the cumulative pool
sudo cp -r /tmp/dist/assets/* /var/www/erp/assets/

# 4. Set permissions
sudo chown -R www-data:www-data /var/www/erp
sudo chmod -R 755 /var/www/erp

# 5. Atomically point the active symlink to this release
sudo ln -sfn "$RELEASE_DIR" /var/www/erp/current
rm -rf /tmp/dist
```

---

## 11. Systemd Service Deployment

Copy `ORACLE_SPRINGBOOT_SYSTEMD.service` to `/etc/systemd/system/nbh-erp.service`:

```bash
sudo cp ORACLE_SPRINGBOOT_SYSTEMD.service /etc/systemd/system/nbh-erp.service
sudo systemctl daemon-reload
sudo systemctl enable nbh-erp.service
sudo systemctl start nbh-erp.service
```

Check backend status and verify Flyway database migrations execute cleanly:
```bash
sudo systemctl status nbh-erp.service --no-pager
sudo journalctl -u nbh-erp.service -n 100 --no-pager
```

---

## 12. SSL Certificate Acquisition & NGINX Setup

To prevent NGINX startup failure caused by missing certificate files, follow this **two-step certificate acquisition procedure**:

### Step 1: Bootstrap NGINX (HTTP only for ACME validation)
Create a temporary bootstrap site:
```bash
sudo mkdir -p /var/www/certbot
sudo tee /etc/nginx/sites-available/bootstrap.conf > /dev/null << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name erp.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    location / {
        return 200 "Certbot bootstrap in progress\n";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/bootstrap.conf /etc/nginx/sites-enabled/bootstrap.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### Step 2: Request Let's Encrypt Certificate
```bash
sudo certbot certonly --webroot -w /var/www/certbot -d erp.example.com
```

### Step 3: Deploy Full Production NGINX Configuration
Once the certificates are issued:
```bash
sudo cp ORACLE_NGINX_CONFIG.conf /etc/nginx/sites-available/nbh-erp.conf

# Replace placeholder domain with your real domain
sudo sed -i 's/erp.example.com/YOUR_ACTUAL_DOMAIN/g' /etc/nginx/sites-available/nbh-erp.conf

# Enable production site and remove bootstrap
sudo ln -sf /etc/nginx/sites-available/nbh-erp.conf /etc/nginx/sites-enabled/nbh-erp.conf
sudo rm -f /etc/nginx/sites-enabled/bootstrap.conf

sudo nginx -t
sudo systemctl reload nginx
```

---

## 13. Encrypted Database Backups & Off-Server Retention

Create a dedicated backup encryption key:
```bash
sudo openssl rand -base64 32 | sudo tee /opt/erp/config/.backup_key > /dev/null
sudo chown root:root /opt/erp/config/.backup_key
sudo chmod 600 /opt/erp/config/.backup_key
```

Create `/opt/erp/scripts/backup-db.sh`:
```bash
sudo tee /opt/erp/scripts/backup-db.sh > /dev/null << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

LABEL="${1:-daily}"
BACKUP_DIR="/var/backups/nbh-erp"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEMP_ENC="${BACKUP_DIR}/nbhdb_${LABEL}_${TIMESTAMP}.sql.gz.enc.tmp"
FINAL_ENC="${BACKUP_DIR}/nbhdb_${LABEL}_${TIMESTAMP}.sql.gz.enc"
FINAL_HMAC="${FINAL_ENC}.hmac"

mkdir -p "$BACKUP_DIR"

# Clean up temporary incomplete files on error
trap 'rm -f "${TEMP_ENC}" "${TEMP_ENC}.hmac"' ERR

# 1. Atomic mysqldump streamed directly into gzip and AES-256-CBC PBKDF2 encryption
# Eliminates insecure plaintext intermediate dumps from the filesystem completely
echo "[$(date)] Starting encrypted database backup for label: $LABEL..."
mysqldump --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf \
          --single-transaction \
          --quick \
          --routines \
          --triggers \
          nbhdb | gzip -9 | \
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
            -pass file:/opt/erp/config/.backup_key \
            -out "${TEMP_ENC}"

# 2. Authenticated Encryption Integrity Tag (HMAC-SHA256)
# Computes cryptographic authentication tag over ciphertext before releasing
openssl dgst -sha256 -hmac "$(cat /opt/erp/config/.backup_key)" "${TEMP_ENC}" | awk '{print $2}' > "${TEMP_ENC}.hmac"

# 3. Atomic commit of encrypted backup and authentication tag
mv "${TEMP_ENC}" "${FINAL_ENC}"
mv "${TEMP_ENC}.hmac" "${FINAL_HMAC}"
chmod 600 "${FINAL_ENC}" "${FINAL_HMAC}"

# 4. Prune local encrypted backups and HMAC tags older than 14 days
find "$BACKUP_DIR" -type f \( -name "nbhdb_*.sql.gz.enc" -o -name "nbhdb_*.sql.gz.enc.hmac" \) -mtime +14 -delete

echo "[$(date)] Local encrypted backup created successfully: $FINAL_ENC"

# 5. Off-Server Replication & Disaster Recovery Status
# True disaster recovery requires successful off-server copy in an independent failure domain
if [ -f "/opt/erp/config/offserver_backup.env" ]; then
    # shellcheck disable=SC1091
    source /opt/erp/config/offserver_backup.env
    if [ -n "${OFFSERVER_DEST:-}" ] && [ -n "${OFFSERVER_KEY:-}" ]; then
        echo "Syncing encrypted backup and HMAC tag to off-server destination: $OFFSERVER_DEST"
        if scp -i "$OFFSERVER_KEY" -B -q "$FINAL_ENC" "$FINAL_HMAC" "$OFFSERVER_DEST/"; then
            echo "[$(date)] Off-server transfer verified. DISASTER RECOVERY STATUS: READY"
        else
            echo "[$(date)] CRITICAL: Off-server backup transfer FAILED!" >&2
            echo "Local backup is intact, but DISASTER RECOVERY IS INCOMPLETE without off-server copy." >&2
            exit 2
        fi
    fi
else
    echo "[$(date)] WARNING: Off-server replication not configured (/opt/erp/config/offserver_backup.env missing)."
    echo "DISASTER RECOVERY IS NOT CERTIFIED without an off-server copy in an independent failure domain."
fi
EOF

sudo chown root:root /opt/erp/scripts/backup-db.sh
sudo chmod 700 /opt/erp/scripts/backup-db.sh
```

Create backup credentials at `/opt/erp/config/.mysql_backup.cnf`:
```bash
sudo tee /opt/erp/config/.mysql_backup.cnf > /dev/null << 'EOF'
[client]
user=nbh_erp
password=YOUR_STRONG_PASSWORD_32_CHARS
host=127.0.0.1
EOF

sudo chown root:root /opt/erp/config/.mysql_backup.cnf
sudo chmod 600 /opt/erp/config/.mysql_backup.cnf
```

Schedule daily backup cron at 02:30 AM:
```bash
echo "30 2 * * * root /opt/erp/scripts/backup-db.sh daily >> /var/log/nbh-erp-backup.log 2>&1" | sudo tee /etc/cron.d/nbh-backup
```

---

## 14. Disaster Recovery & Backup Verification Drill

Create the automated verification script `/opt/erp/scripts/verify-backup.sh`:

```bash
sudo tee /opt/erp/scripts/verify-backup.sh > /dev/null << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/nbh-erp"
DRILL_DB="nbhdb_drill"

# CRITICAL SAFETY ASSERTION: Never run drills against production database
if [ "$DRILL_DB" == "nbhdb" ]; then
    echo "CRITICAL ERROR: Drill database cannot be 'nbhdb'!" >&2
    exit 1
fi

LATEST_ENC=$(ls -t "$BACKUP_DIR"/nbhdb_*.sql.gz.enc 2>/dev/null | head -n 1)

if [ -z "$LATEST_ENC" ]; then
    echo "ERROR: No encrypted backups found in $BACKUP_DIR!"
    exit 1
fi

echo "================================================================"
echo " NBH ERP - Automated Backup Verification Drill"
echo " Target Isolated Database: $DRILL_DB"
echo " Testing Snapshot: $LATEST_ENC"
echo "================================================================"

# 1. Authenticate Ciphertext Integrity (HMAC-SHA256) Prior to Decryption
HMAC_FILE="${LATEST_ENC}.hmac"
if [ ! -f "$HMAC_FILE" ]; then
    echo "CRITICAL ERROR: Missing authentication tag ($HMAC_FILE)!" >&2
    echo "Cannot verify ciphertext authenticity. Aborting drill." >&2
    exit 1
fi

EXPECTED_HMAC=$(cat "$HMAC_FILE")
CALCULATED_HMAC=$(openssl dgst -sha256 -hmac "$(cat /opt/erp/config/.backup_key)" "$LATEST_ENC" | awk '{print $2}')

if [ "$EXPECTED_HMAC" != "$CALCULATED_HMAC" ]; then
    echo "CRITICAL ERROR: Backup integrity authentication FAILED!" >&2
    echo "Ciphertext does not match HMAC signature. File is corrupted or tampered." >&2
    exit 1
fi
echo "==> [1/4] Ciphertext authentication: HMAC-SHA256 VERIFIED"

# 2. Reset Isolated Drill Database
# Removes previous drill tables without requiring global administrative DROP DATABASE privileges
echo "==> [2/4] Resetting isolated test database ($DRILL_DB)..."
EXISTING_TABLES=$(mysql --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf "$DRILL_DB" -sN -e "SHOW TABLES;" 2>/dev/null || true)
if [ -n "$EXISTING_TABLES" ]; then
    DROP_CMDS=$(echo "$EXISTING_TABLES" | awk '{print "DROP TABLE IF EXISTS `" $1 "`;"}')
    mysql --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf "$DRILL_DB" -e "SET FOREIGN_KEY_CHECKS = 0; $DROP_CMDS SET FOREIGN_KEY_CHECKS = 1;"
fi

# 3. Direct Streaming Decryption and Restore into Drill Database
# Eliminates unencrypted intermediate files on disk completely
echo "==> [3/4] Streaming decryption and restore into $DRILL_DB..."
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
            -pass file:/opt/erp/config/.backup_key \
            -in "$LATEST_ENC" | gunzip | \
mysql --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf "$DRILL_DB"

# 4. Verify Database Integrity in Drill Database
echo "==> [4/4] Auditing restored data integrity in $DRILL_DB..."
TABLE_COUNT=$(mysql --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf "$DRILL_DB" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DRILL_DB';")
echo "    - Total Restored Tables: $TABLE_COUNT"

if [ "$TABLE_COUNT" -lt 30 ]; then
    echo "CRITICAL ERROR: Restored table count ($TABLE_COUNT) is below threshold (< 30)!" >&2
    exit 1
fi

RESTORED_VERSION=$(mysql --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf "$DRILL_DB" -sN -e "SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;" 2>/dev/null || echo "unknown")
echo "    - Restored Flyway Migration Version: $RESTORED_VERSION"

USER_COUNT=$(mysql --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf "$DRILL_DB" -sN -e "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
echo "    - Restored Users Count: $USER_COUNT"

# Clean up drill tables after successful drill
DRILL_TABLES=$(mysql --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf "$DRILL_DB" -sN -e "SHOW TABLES;" 2>/dev/null || true)
if [ -n "$DRILL_TABLES" ]; then
    CLEANUP_CMDS=$(echo "$DRILL_TABLES" | awk '{print "DROP TABLE IF EXISTS `" $1 "`;"}')
    mysql --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf "$DRILL_DB" -e "SET FOREIGN_KEY_CHECKS = 0; $CLEANUP_CMDS SET FOREIGN_KEY_CHECKS = 1;"
fi

echo "================================================================"
echo " ==> [SUCCESS] Backup Verification Drill PASSED Completely!"
echo " Ciphertext HMAC: VALID | Streaming: PASS | Schema Integrity: PASS"
echo " Production database was NOT touched."
echo "================================================================"
EOF

sudo chown root:root /opt/erp/scripts/verify-backup.sh
sudo chmod 700 /opt/erp/scripts/verify-backup.sh
```

---

## 15. Safe Rolling Update & Flyway-Aware Rollback Strategy

When deploying application updates, run `/opt/erp/scripts/deploy-update.sh`:

```bash
sudo tee /opt/erp/scripts/deploy-update.sh > /dev/null << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "================================================================"
echo " NBH ERP - Safe Rolling Update (Minimal Downtime: 5-15s)"
echo "================================================================"

# 1. Pre-deployment Archive & Version Check
if [ -f "/tmp/nbh-erp.jar" ]; then
    echo "==> [1/6] Verifying JAR integrity..."
    unzip -t /tmp/nbh-erp.jar > /dev/null
fi

FLYWAY_BEFORE=$(mysql --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf nbhdb -sN -e "SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;" 2>/dev/null || echo "0")
echo "==> [2/6] Current database schema version: $FLYWAY_BEFORE"

# 2. Take Pre-Deployment Database Snapshot
echo "==> [3/6] Creating pre-deployment database backup snapshot..."
/opt/erp/scripts/backup-db.sh "pre_deploy_v${FLYWAY_BEFORE}"

# 3. Deploy Frontend (Atomic Versioned Directory + Cumulative Asset Pool)
if [ -d "/tmp/dist" ]; then
    echo "==> [4/6] Deploying frontend release..."
    RELEASE_DIR="/var/www/erp/releases/release_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$RELEASE_DIR"
    cp -r /tmp/dist/* "$RELEASE_DIR/"
    
    # Cumulative asset pool: copy new chunks without deleting older chunks
    # Ensures old open browser tabs can load older chunks without 404 errors
    cp -r /tmp/dist/assets/* /var/www/erp/assets/
    
    chown -R www-data:www-data "$RELEASE_DIR" /var/www/erp/assets
    chmod -R 755 "$RELEASE_DIR" /var/www/erp/assets
    
    # Record previous release for rollback safety
    PREV_RELEASE=$(readlink /var/www/erp/current || echo "")
    echo "$PREV_RELEASE" > /var/www/erp/releases/.previous_release
    
    # Atomically switch active release
    ln -sfn "$RELEASE_DIR" /var/www/erp/current
    rm -rf /tmp/dist
fi

# 4. Deploy Backend Binary
if [ -f "/tmp/nbh-erp.jar" ]; then
    echo "==> [5/6] Updating backend JAR..."
    cp /opt/erp/nbh-erp.jar /opt/erp/nbh-erp.jar.bak
    mv /tmp/nbh-erp.jar /opt/erp/nbh-erp.jar
    chown erp:erp /opt/erp/nbh-erp.jar
    
    echo "==> [6/6] Restarting Spring Boot..."
    systemctl restart nbh-erp.service
    
    # Health check polling loop (up to 60 seconds)
    # Uses genuine /health/ready endpoint which verifies active MySQL datasource connectivity
    echo "Checking backend health and database readiness via /health/ready..."
    HEALTHY=0
    for i in {1..30}; do
        if curl -s -f http://127.0.0.1:8080/health/ready > /dev/null; then
            HEALTHY=1
            echo "Backend is HEALTHY and database connection is ready!"
            break
        fi
        sleep 2
    done

    if [ "$HEALTHY" -ne 1 ]; then
        echo "CRITICAL: Backend failed to start healthy within 60s!"
        
        # Check if database migrations were applied
        FLYWAY_FAILED=$(mysql --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf nbhdb -sN -e "SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;" 2>/dev/null || echo "0")
        
        if [ "$FLYWAY_FAILED" == "$FLYWAY_BEFORE" ]; then
            echo "No database migrations were applied. Safe to auto-rollback JAR and frontend."
            mv /opt/erp/nbh-erp.jar.bak /opt/erp/nbh-erp.jar
            systemctl restart nbh-erp.service
            if [ -f "/var/www/erp/releases/.previous_release" ]; then
                ln -sfn "$(cat /var/www/erp/releases/.previous_release)" /var/www/erp/current
            fi
            systemctl reload nginx
            echo "Auto-rollback completed. Previous version restored."
            exit 1
        else
            echo "DANGER: Database migrations were applied ($FLYWAY_BEFORE -> $FLYWAY_FAILED)!"
            echo "AUTOMATIC DATABASE ROLLBACK IS STRICTLY INHIBITED TO PREVENT PERMANENT LOSS OF BUSINESS TRANSACTIONS."
            echo "The service has been stopped to protect data integrity."
            echo "Review logs using: sudo journalctl -u nbh-erp.service -n 100 --no-pager"
            echo "If a synchronized full database rollback is explicitly required, run:"
            echo "  sudo /opt/erp/scripts/rollback-full.sh pre_deploy_v${FLYWAY_BEFORE}"
            systemctl stop nbh-erp.service
            exit 1
        fi
    fi
fi

# Reload NGINX to apply fresh cache rules
systemctl reload nginx
echo "==> [SUCCESS] Deployment completed successfully!"
EOF

sudo chown root:root /opt/erp/scripts/deploy-update.sh
sudo chmod 700 /opt/erp/scripts/deploy-update.sh
```

Create `/opt/erp/scripts/rollback-full.sh`:
```bash
sudo tee /opt/erp/scripts/rollback-full.sh > /dev/null << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

SNAPSHOT_LABEL="${1:-}"
if [ -z "$SNAPSHOT_LABEL" ]; then
    echo "Usage: $0 <snapshot_label> (e.g. pre_deploy_v38)"
    exit 1
fi

BACKUP_DIR="/var/backups/nbh-erp"
SNAPSHOT_FILE=$(ls -t "$BACKUP_DIR"/nbhdb_${SNAPSHOT_LABEL}_*.sql.gz.enc 2>/dev/null | head -n 1)

if [ -z "$SNAPSHOT_FILE" ]; then
    echo "ERROR: Could not find snapshot file for label '$SNAPSHOT_LABEL' in $BACKUP_DIR!"
    exit 1
fi

echo "================================================================"
echo " NBH ERP - Manual Synchronized Rollback Procedure"
echo " Target Snapshot: $SNAPSHOT_FILE"
echo "================================================================"

# 1. Authenticate Ciphertext Integrity (HMAC-SHA256) Prior to Restoring
if [ -f "${SNAPSHOT_FILE}.hmac" ]; then
    EXPECTED_HMAC=$(cat "${SNAPSHOT_FILE}.hmac")
    CALCULATED_HMAC=$(openssl dgst -sha256 -hmac "$(cat /opt/erp/config/.backup_key)" "$SNAPSHOT_FILE" | awk '{print $2}')
    if [ "$EXPECTED_HMAC" != "$CALCULATED_HMAC" ]; then
        echo "CRITICAL ERROR: Snapshot HMAC signature verification failed!" >&2
        echo "The snapshot file appears corrupted or altered. Aborting rollback." >&2
        exit 1
    fi
    echo "==> [1/5] Snapshot HMAC authentication: VERIFIED"
fi

# 2. Stop application to prevent concurrent database writes during restoration
echo "==> [2/5] Stopping Spring Boot service..."
systemctl stop nbh-erp.service

# 3. Mandatory Safety Backup of Current Live Database Before Overwriting
# Guarantees that any business transactions recorded since the snapshot are NOT permanently lost
echo "==> [3/5] Taking safety snapshot of current live database before restoration..."
/opt/erp/scripts/backup-db.sh "pre_rollback_safety_$(date +%Y%m%d_%H%M%S)"

# 4. Mandatory Explicit Operator Confirmation
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo "CRITICAL WARNING: MANUAL PRODUCTION DATABASE RESTORATION!"
echo "Restoring snapshot '$SNAPSHOT_LABEL' will OVERWRITE current production tables."
echo "Any sales, payments, or stock movements committed after this snapshot was created"
echo "will be replaced by the snapshot state in 'nbhdb'."
echo "A pre-rollback safety snapshot has been saved to /var/backups/nbh-erp/."
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
read -r -p "Type 'RESTORE-CONFIRM' to proceed with production database overwrite: " CONFIRM_RESTORE
if [ "$CONFIRM_RESTORE" != "RESTORE-CONFIRM" ]; then
    echo "Rollback aborted by operator. Production database was NOT modified."
    exit 1
fi

# 5. Direct Streaming Restore into Production Database
# Eliminates unencrypted intermediate files on disk completely
echo "==> [4/5] Restoring production database from snapshot via streaming decryption..."
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
            -pass file:/opt/erp/config/.backup_key \
            -in "$SNAPSHOT_FILE" | gunzip | \
mysql --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf nbhdb

# 6. Restore Previous Backend JAR and Frontend Release Symlink
echo "==> [5/5] Restoring binaries and web assets..."
if [ -f "/opt/erp/nbh-erp.jar.bak" ]; then
    echo "    - Restoring previous backend JAR..."
    cp /opt/erp/nbh-erp.jar.bak /opt/erp/nbh-erp.jar
fi

if [ -f "/var/www/erp/releases/.previous_release" ]; then
    PREV_DIR=$(cat /var/www/erp/releases/.previous_release)
    if [ -d "$PREV_DIR" ]; then
        echo "    - Restoring previous frontend release: $PREV_DIR"
        ln -sfn "$PREV_DIR" /var/www/erp/current
    fi
fi

# 7. Start Service and Verify Health
echo "Starting Spring Boot and reloading NGINX..."
systemctl start nbh-erp.service
systemctl reload nginx

# Check readiness
sleep 5
if curl -s -f http://127.0.0.1:8080/health/ready > /dev/null; then
    echo "==> [SUCCESS] Full synchronized rollback completed successfully and service is HEALTHY!"
else
    echo "==> [WARNING] Service started but health check did not report UP yet. Inspect journalctl."
fi
systemctl status nbh-erp.service --no-pager
EOF

sudo chown root:root /opt/erp/scripts/rollback-full.sh
sudo chmod 700 /opt/erp/scripts/rollback-full.sh
```

---

## 16. Verification and Health Checks

1. **Verify Backend Health & Database Readiness:**
   ```bash
   curl -i http://127.0.0.1:8080/health/ready
   # Should return HTTP 200 with {"status":"UP"} (validates Spring Boot and MySQL connection pool)
   ```
   *Security Note:* `/health/ready` and `/health/live` are bound strictly to localhost loopback (127.0.0.1:8080) and are NOT exposed to the public internet by NGINX. No sensitive Spring Boot Actuator information, heap dumps, environment variables, or stack traces are ever exposed publicly.

2. **Verify Public HTTPS & Security Headers:**
   ```bash
   curl -I https://erp.example.com
   # Verify that:
   # 1. Strict-Transport-Security: max-age=31536000 (without preload or includeSubDomains)
   # 2. X-Content-Type-Options: nosniff
   # 3. X-Frame-Options: DENY
   # 4. Content-Security-Policy: script-src 'self' (no 'unsafe-inline' for JS)
   # 5. Cache-Control: single header with no duplicate max-age on assets or index.html
   ```

3. **Verify SSE Connection:**
   Open browser Developer Tools &rarr; Network &rarr; filter `events` &rarr; observe open EventStream connection with real-time heartbeat and data events.
