# NBH ERP — Oracle Cloud Infrastructure Always Free Deployment Guide

This guide provides comprehensive, production-grade instructions for deploying NBH ERP to **Oracle Cloud Infrastructure (OCI) Always Free** on an Ampere A1 ARM64 Compute instance.

---

## 1. Architecture Summary & Official OCI Always Free Quotas

### Official OCI Always Free Entitlements
Oracle Cloud Infrastructure provides the following compute, storage, and networking quotas permanently free of charge per tenancy:
- **Ampere A1 Compute:** Up to **4 OCPUs** and **24 GB RAM** total (deployable across 1 to 4 instances).
- **Block Volume Storage:** Up to **200 GB total storage** across all boot and block volumes (with up to 5 volume backups).
- **Egress Transfer:** **10 TB / month** outbound data transfer.
- **Public IP:** 1 Ephemeral or Reserved IPv4 address.

### NBH ERP Instance Allocation (VM.Standard.A1.Flex)
| Component | Specification | Resource Consumption |
| :--- | :--- | :--- |
| **Compute Shape** | `VM.Standard.A1.Flex` (Ampere Altra ARM64) | 2 OCPUs (4 vCPUs) (50% of tenant free quota) |
| **System Memory** | 12 GB RAM | 12 GB RAM (50% of tenant free quota) |
| **Boot Volume** | 50 GB NVMe | 50 GB (25% of tenant free quota) |
| **Operating System** | Ubuntu 24.04 LTS ARM64 (Canonical Always Free eligible) | Free standard image |
| **Reverse Proxy** | NGINX with Let's Encrypt TLS (HTTP/2, unbuffered SSE) | Local loopback |
| **Frontend** | React 18 production build served statically via NGINX | Zero application runtime overhead |
| **Backend** | Spring Boot 3.3.4 (Java 21 OpenJDK headless) on `127.0.0.1:8080` | Memory capped at 4 GB heap |
| **Database** | MySQL 8 with InnoDB ACID durability on `127.0.0.1:3306` | Memory capped at 3.5 GB |
| **Target Concurrency** | 20–50 concurrent employees | Ample headroom |
| **Monthly Cost** | **$0.00 / month** | 100% within Always Free tier |

> [!NOTE]
> **Tenancy Headroom:** By sizing NBH ERP to 2 OCPUs and 12 GB RAM, you retain 2 OCPUs, 12 GB RAM, and 150 GB storage in your Oracle tenancy for a separate staging/testing environment or future vertical scaling.

---

## 2. Authentication & 30-Minute Session Policy

The ERP strictly enforces a **30-minute idle inactivity and refresh-token policy**:
1. **Access JWT Lifetime:** 15 minutes (`900,000 ms`), stored exclusively in JavaScript browser memory.
2. **Refresh Token Lifetime:** 30 minutes (`1,800,000 ms`), transported via secure, HttpOnly, same-origin cookie (`nbh_refresh_token`) with Path `/api/v1/auth`.
3. **Sliding Expiration on Activity:** As long as an employee actively uses the ERP, the client rotates the refresh token every ~14.5 minutes, sliding the server session expiration forward another 30 minutes. Active employees are never unexpectedly logged out.
4. **Automatic Idle Logout:** When an employee is inactive (no mouse, keyboard, touch, or scroll events) for 30 minutes (`1,800,000 ms`), the frontend terminates the session, clears all in-memory tokens, purges the TanStack Query and API caches, revokes the refresh session on the backend, and displays the session-expiration notice.
5. **No Silent Restoration of Expired Sessions:** Background heartbeats, polling, and silent refreshes do not count as user activity. An expired refresh token cannot be restored.

> [!IMPORTANT]
> Any references in historical reports to a 7-day refresh token are **superseded**. The production configuration below enforces the 30-minute policy (`JWT_REFRESH_TOKEN_EXPIRATION_MS=1800000`).

---

## 3. OCI Instance Provisioning

1. Log in to the [Oracle Cloud Console](https://cloud.oracle.com/).
2. Navigate to **Compute** &rarr; **Instances** &rarr; Click **Create Instance**.
3. Configure the instance parameters:
   - **Name:** `nbh-erp-production`
   - **Compartment:** Select your root or designated compartment.
   - **Placement:** Any Availability Domain (AD) with Always Free capacity.
   - **Image:** Click **Change Image** &rarr; Select **Canonical Ubuntu** &rarr; Choose **24.04 LTS (aarch64 / ARM64)**.
   - **Shape:** Click **Change Shape** &rarr; Select **Ampere** &rarr; `VM.Standard.A1.Flex`:
     - **OCPUs:** `2`
     - **Memory (GB):** `12`
   - **Networking:**
     - Select **Create new virtual cloud network** (or choose existing VCN).
     - Subnet: Public Subnet.
     - **Assign a public IPv4 address:** Yes.
   - **Add SSH keys:** Generate or upload your public SSH key (`id_ed25519.pub`).
   - **Boot volume:** 50 GB with transit encryption enabled.
4. Click **Create**. Note down the assigned **Public IP Address** once provisioning completes.

---

## 4. OCI Virtual Cloud Network (VCN) Security Ingress

In the OCI Console:
1. Navigate to **Networking** &rarr; **Virtual Cloud Networks** &rarr; Click your VCN &rarr; Click **Security Lists** &rarr; **Default Security List**.
2. Click **Add Ingress Rules**:
   - **Rule 1 (HTTPS):**
     - Source CIDR: `0.0.0.0/0`
     - IP Protocol: `TCP`
     - Destination Port: `443`
     - Description: `HTTPS Production Web Traffic`
   - **Rule 2 (HTTP):**
     - Source CIDR: `0.0.0.0/0`
     - IP Protocol: `TCP`
     - Destination Port: `80`
     - Description: `HTTP Redirect and Let's Encrypt ACME`
   - **Rule 3 (SSH):**
     - Source CIDR: `YOUR_ADMIN_IP/32` (Recommended) or `0.0.0.0/0` with key-only auth
     - IP Protocol: `TCP`
     - Destination Port: `22`
     - Description: `SSH Administrative Access`
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

## 7. MySQL 8 Database Configuration & Tuning (12 GB RAM)

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

Restart MySQL and verify status:
```bash
sudo systemctl restart mysql
sudo systemctl enable mysql
sudo systemctl status mysql --no-pager
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

-- Replace 'YOUR_STRONG_PASSWORD_32_CHARS' with a secure generated password
CREATE USER 'nbh_erp'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY 'YOUR_STRONG_PASSWORD_32_CHARS';

-- Grant required application privileges (avoid granting global DROP privileges)
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON nbhdb.* TO 'nbh_erp'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

---

## 8. Directory Hierarchy & Dedicated Service User

Create an unprivileged system user and application directory structure:

```bash
sudo useradd -r -m -s /usr/sbin/nologin -d /opt/erp erp

# Create directory tree (including versioned release folder for atomic frontend updates)
sudo mkdir -p /opt/erp/{config,scripts}
sudo mkdir -p /var/log/nbh-erp
sudo mkdir -p /var/www/erp/releases
sudo mkdir -p /var/backups/nbh-erp

# Set ownership
sudo chown -R erp:erp /opt/erp
sudo chown -R erp:erp /var/log/nbh-erp
sudo chown -R www-data:www-data /var/www/erp
sudo chmod 750 /opt/erp
sudo chmod 750 /var/log/nbh-erp
```

---

## 9. Application Environment Configuration

Generate a secure Base64 256-bit key:
```bash
openssl rand -base64 32
```

Create `/opt/erp/config/erp.env`:

```bash
sudo tee /opt/erp/config/erp.env > /dev/null << 'EOF'
PORT=8080
SERVER_ADDRESS=127.0.0.1

DB_URL=jdbc:mysql://127.0.0.1:3306/nbhdb?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true&characterEncoding=UTF-8
DB_USERNAME=nbh_erp
DB_PASSWORD=YOUR_STRONG_PASSWORD_32_CHARS
DB_DDL_AUTO=validate
# Must be false so Flyway applies and tracks all schema migrations (V1 to V38)
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

# Replace with your actual domain
CORS_ALLOWED_ORIGINS=https://erp.example.com

INITIAL_ADMIN_ENABLED=false
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=
INITIAL_ADMIN_EMAIL=admin@example.com

APP_WAREHOUSE_PRINT_POLL_MS=5000

COMPANY_NAME="Example Distribution Co."
COMPANY_ADDRESS="123 Example Street, City, Country"
COMPANY_PHONE="+1 555 0100"
EOF
```

Secure the environment file permissions:
```bash
sudo chown erp:erp /opt/erp/config/erp.env
sudo chmod 600 /opt/erp/config/erp.env
```

---

## 10. Building and Deploying Artifacts

### A. Local Machine Build
On your development machine:

1. **Build Backend JAR:**
   ```bash
   ./mvnw clean package -DskipTests
   # Result: target/erp-0.0.1-SNAPSHOT.jar
   ```

2. **Build Frontend Bundle:**
   ```bash
   cd frontend
   npm run build
   # Result: frontend/dist/
   ```

3. **Transfer Artifacts to OCI Server:**
   ```bash
   scp -i ~/.ssh/id_ed25519 target/erp-0.0.1-SNAPSHOT.jar ubuntu@<YOUR_OCI_PUBLIC_IP>:/tmp/nbh-erp.jar
   scp -i ~/.ssh/id_ed25519 -r frontend/dist ubuntu@<YOUR_OCI_PUBLIC_IP>:/tmp/dist
   ```

### B. Install Artifacts on Server (Atomic Releases)
On the OCI Server:
```bash
# 1. Install backend jar
sudo mv /tmp/nbh-erp.jar /opt/erp/nbh-erp.jar
sudo chown erp:erp /opt/erp/nbh-erp.jar
sudo chmod 644 /opt/erp/nbh-erp.jar

# 2. Deploy frontend using atomic versioned directory to prevent 404 ChunkLoadErrors
RELEASE_DIR="/var/www/erp/releases/release_$(date +%Y%m%d_%H%M%S)"
sudo mkdir -p "$RELEASE_DIR"
sudo cp -r /tmp/dist/* "$RELEASE_DIR/"
sudo chown -R www-data:www-data "$RELEASE_DIR"
sudo chmod -R 755 "$RELEASE_DIR"

# Atomically switch the active symlink
sudo ln -sfn "$RELEASE_DIR" /var/www/erp/dist
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

Check backend status and verify Flyway database migrations run cleanly:
```bash
sudo systemctl status nbh-erp.service --no-pager
sudo journalctl -u nbh-erp.service -n 100 --no-pager
```

---

## 12. SSL Certificate & NGINX Setup

1. **Obtain SSL Certificate with Certbot:**
   ```bash
   sudo certbot certonly --nginx -d erp.example.com
   ```

2. **Install NGINX Site Configuration:**
   Copy `ORACLE_NGINX_CONFIG.conf` to `/etc/nginx/sites-available/nbh-erp.conf`:
   ```bash
   sudo cp ORACLE_NGINX_CONFIG.conf /etc/nginx/sites-available/nbh-erp.conf

   # Replace placeholder domain with your real domain
   sudo sed -i 's/erp.example.com/YOUR_ACTUAL_DOMAIN/g' /etc/nginx/sites-available/nbh-erp.conf

   # Enable site and remove default
   sudo ln -sf /etc/nginx/sites-available/nbh-erp.conf /etc/nginx/sites-enabled/nbh-erp.conf
   sudo rm -f /etc/nginx/sites-enabled/default
   ```

3. **Test and Reload NGINX:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## 13. Automated Daily Database Backups

Create `/opt/erp/scripts/backup-db.sh`:
```bash
sudo tee /opt/erp/scripts/backup-db.sh > /dev/null << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/nbh-erp"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/nbhdb_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

# Perform atomic, non-locking mysqldump
mysqldump --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf \
          --single-transaction \
          --quick \
          --routines \
          --triggers \
          nbhdb | gzip -9 > "$BACKUP_FILE"

chmod 600 "$BACKUP_FILE"

# Keep last 14 daily backups
find "$BACKUP_DIR" -type f -name "nbhdb_*.sql.gz" -mtime +14 -delete

echo "[$(date)] MySQL backup completed successfully: $BACKUP_FILE"
EOF

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
echo "30 2 * * * root /opt/erp/scripts/backup-db.sh >> /var/log/nbh-erp-backup.log 2>&1" | sudo tee /etc/cron.d/nbh-backup
```

---

## 14. Disaster Recovery & Database Restoration Runbook

In the event of database corruption or hardware recovery:

### Step 1: Locate the Latest Backup
```bash
ls -lht /var/backups/nbh-erp/nbhdb_*.sql.gz | head -n 5
```

### Step 2: Validate Backup Integrity (Dry-run)
```bash
# Verify gzip archive integrity
gzip -t /var/backups/nbh-erp/nbhdb_YYYYMMDD_HHMMSS.sql.gz
echo "Archive integrity: OK"
```

### Step 3: Execute Restoration
```bash
# Stop the application service to prevent incoming transactions during restoration
sudo systemctl stop nbh-erp.service

# Restore the database from the compressed backup
gunzip < /var/backups/nbh-erp/nbhdb_YYYYMMDD_HHMMSS.sql.gz | mysql --defaults-extra-file=/opt/erp/config/.mysql_backup.cnf nbhdb

# Restart the application service
sudo systemctl start nbh-erp.service
sudo systemctl status nbh-erp.service
```

---

## 15. Minimal-Downtime Rolling Update Procedure

When updating the application, run this safe deployment script with pre-check, atomic symlinking, and health verification:

```bash
sudo tee /opt/erp/scripts/deploy-update.sh > /dev/null << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "==> [1/5] Running pre-deployment database backup..."
/opt/erp/scripts/backup-db.sh

# 1. Update frontend assets atomically
if [ -d "/tmp/dist" ]; then
    echo "==> [2/5] Deploying frontend release..."
    RELEASE_DIR="/var/www/erp/releases/release_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$RELEASE_DIR"
    cp -r /tmp/dist/* "$RELEASE_DIR/"
    chown -R www-data:www-data "$RELEASE_DIR"
    chmod -R 755 "$RELEASE_DIR"
    ln -sfn "$RELEASE_DIR" /var/www/erp/dist
    rm -rf /tmp/dist
    # Prune release directories older than 7 days
    find /var/www/erp/releases -maxdepth 1 -mindepth 1 -type d -mtime +7 -exec rm -rf {} +
fi

# 2. Update backend JAR with rollback safety
if [ -f "/tmp/nbh-erp.jar" ]; then
    echo "==> [3/5] Verifying new JAR archive integrity..."
    unzip -t /tmp/nbh-erp.jar > /dev/null
    
    echo "==> [4/5] Updating backend binary..."
    cp /opt/erp/nbh-erp.jar /opt/erp/nbh-erp.jar.bak
    mv /tmp/nbh-erp.jar /opt/erp/nbh-erp.jar
    chown erp:erp /opt/erp/nbh-erp.jar
    
    echo "==> [5/5] Restarting Spring Boot (5-15s rolling restart)..."
    systemctl restart nbh-erp.service
    
    # Health check polling loop (up to 60 seconds)
    echo "Checking backend health..."
    HEALTHY=0
    for i in {1..30}; do
        if curl -s -f http://127.0.0.1:8080/api/v1/auth/csrf > /dev/null; then
            HEALTHY=1
            echo "Backend is HEALTHY!"
            break
        fi
        sleep 2
    done

    if [ "$HEALTHY" -ne 1 ]; then
        echo "ERROR: Backend failed health check! Initiating automatic rollback..."
        mv /opt/erp/nbh-erp.jar.bak /opt/erp/nbh-erp.jar
        systemctl restart nbh-erp.service
        exit 1
    fi
fi

# Reload NGINX to apply fresh cache rules
systemctl reload nginx

echo "==> Update deployment completed successfully."
EOF

sudo chmod 700 /opt/erp/scripts/deploy-update.sh
```

---

## 16. Verification and Health Checks

1. **Verify Backend Health:**
   ```bash
   curl -I http://127.0.0.1:8080/api/v1/auth/csrf
   ```

2. **Verify Public HTTPS:**
   ```bash
   curl -I https://erp.example.com
   # Should return HTTP/2 200 with security headers
   ```

3. **Verify SSE Connection:**
   Open browser Developer Tools &rarr; Network &rarr; filter `events` &rarr; observe open EventStream connection with real-time heartbeat and data events.
