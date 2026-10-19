# NBH ERP — Oracle Cloud Infrastructure Always Free Deployment Guide

This guide provides end-to-end instructions for deploying NBH ERP to **Oracle Cloud Infrastructure (OCI) Always Free** on an Ampere A1 ARM64 Compute instance.

---

## Architecture Summary

| Component | Specification |
| :--- | :--- |
| **Compute Shape** | `VM.Standard.A1.Flex` (Ampere Altra ARM64) |
| **Resources** | **2 OCPUs** (4 vCPUs), **12 GB RAM**, **50 GB Boot Volume** |
| **Operating System** | Ubuntu 24.04 LTS ARM64 (Canonical Always Free eligible) |
| **Reverse Proxy** | NGINX with Let's Encrypt TLS (HTTP/2, unbuffered SSE) |
| **Frontend** | React 18 production build served statically by NGINX |
| **Backend** | Spring Boot 3.3.4 (Java 21 OpenJDK headless) on `127.0.0.1:8080` |
| **Database** | MySQL 8 with InnoDB tuned on `127.0.0.1:3306` |
| **Target Concurrency** | 20–50 concurrent employees |
| **Monthly Cost** | **$0.00 / month** (Within OCI Always Free limits: 4 OCPUs, 24 GB RAM, 200 GB storage free) |

---

## 1. OCI Instance Provisioning

1. Log in to the [Oracle Cloud Console](https://cloud.oracle.com/).
2. Navigate to **Compute** &rarr; **Instances** &rarr; Click **Create Instance**.
3. Configure the instance parameters:
   - **Name:** `nbh-erp-production`
   - **Compartment:** Select your root or designated compartment.
   - **Placement:** Any Availability Domain (AD) with Always Free capacity.
   - **Image:** Click **Change Image** &rarr; Select **Canonical Ubuntu** &rarr; Choose **24.04 LTS Minimal** or **24.04 LTS (aarch64 / ARM64)**.
   - **Shape:** Click **Change Shape** &rarr; Select **Ampere** &rarr; `VM.Standard.A1.Flex`:
     - **OCPUs:** `2`
     - **Memory (GB):** `12`
   - **Networking:**
     - Select **Create new virtual cloud network** (or choose existing VCN).
     - Subnet: Public Subnet.
     - **Assign a public IPv4 address:** Yes.
   - **Add SSH keys:** Generate or upload your public SSH key (`id_ed25519.pub`).
   - **Boot volume:** Leave default (50 GB) with transit encryption enabled.
4. Click **Create**. Note down the assigned **Public IP Address** once provisioning completes.

---

## 2. OCI Virtual Cloud Network (VCN) Security Ingress

In the OCI Console:
1. Navigate to **Networking** &rarr; **Virtual Cloud Networks** &rarr; Click your VCN &rarr; Click **Security Lists** &rarr; **Default Security List**.
2. Click **Add Ingress Rules**:
   - **Rule 1 (SSH):**
     - Source CIDR: `0.0.0.0/0` (or your static office/admin IP: `xxx.xxx.xxx.xxx/32`)
     - IP Protocol: `TCP`
     - Destination Port: `22`
     - Description: `SSH Administrative Access`
   - **Rule 2 (HTTP):**
     - Source CIDR: `0.0.0.0/0`
     - IP Protocol: `TCP`
     - Destination Port: `80`
     - Description: `HTTP Redirect and Let's Encrypt ACME`
   - **Rule 3 (HTTPS):**
     - Source CIDR: `0.0.0.0/0`
     - IP Protocol: `TCP`
     - Destination Port: `443`
     - Description: `HTTPS Production Web Traffic`
3. **DO NOT** add ingress rules for port `3306` (MySQL) or `8080` (Spring Boot).

---

## 3. DNS Configuration

Point your public domain (e.g. `erp.yourcompany.com`) to the OCI Public IP address via an **A Record** with TTL 300s.

```text
Type: A
Name: erp (or @)
Value: <YOUR_OCI_PUBLIC_IP>
TTL: 300
```

---

## 4. Initial Server Setup & Package Installation

Connect to your instance via SSH:
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@<YOUR_OCI_PUBLIC_IP>
```

Update system packages and install required dependencies:
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

---

## 5. Host Firewall Configuration (Ubuntu UFW)

Oracle Cloud Ubuntu images use standard `netfilter/iptables`. Enable UFW to ensure strict port controls:

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

## 6. MySQL 8 Database Configuration & Tuning (12 GB RAM)

Create a custom MySQL tuning configuration at `/etc/mysql/mysql.conf.d/99-nbh-erp.cnf`:

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

# Performance Settings
innodb_flush_log_at_trx_commit = 2
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

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON nbhdb.* TO 'nbh_erp'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

---

## 7. Directory Hierarchy & Dedicated Service User

Create an unprivileged system user and application directory structure:

```bash
sudo useradd -r -m -s /usr/sbin/nologin -d /opt/erp erp

# Create directory tree
sudo mkdir -p /opt/erp/{config,scripts}
sudo mkdir -p /var/log/nbh-erp
sudo mkdir -p /var/www/erp/dist
sudo mkdir -p /var/backups/nbh-erp

# Set ownership
sudo chown -R erp:erp /opt/erp
sudo chown -R erp:erp /var/log/nbh-erp
sudo chown -R www-data:www-data /var/www/erp
sudo chmod 750 /opt/erp
sudo chmod 750 /var/log/nbh-erp
```

---

## 8. Application Environment Configuration

Copy the template from `ORACLE_PRODUCTION_ENV.example` to `/opt/erp/config/erp.env`:

```bash
sudo tee /opt/erp/config/erp.env > /dev/null << 'EOF'
PORT=8080
SERVER_ADDRESS=127.0.0.1

DB_URL=jdbc:mysql://127.0.0.1:3306/nbhdb?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true&characterEncoding=UTF-8
DB_USERNAME=nbh_erp
DB_PASSWORD=YOUR_STRONG_PASSWORD_32_CHARS
DB_DDL_AUTO=validate
DB_BASELINE_ON_MIGRATE=true

HIKARI_MAX_POOL_SIZE=25
HIKARI_MIN_IDLE=10

# Generate with openssl rand -hex 32
JWT_SECRET=GENERATED_64_HEX_CHARACTERS_JWT_SECRET
JWT_ACCESS_TOKEN_EXPIRATION_MS=900000
JWT_REFRESH_TOKEN_EXPIRATION_MS=1800000

COOKIE_SECURE=true
COOKIE_SAME_SITE=Lax
REFRESH_SESSION_RETENTION_DAYS=1
REFRESH_SESSION_CLEANUP_CRON=0 0 3 * * ?

CORS_ALLOWED_ORIGINS=https://erp.yourcompany.com

INITIAL_ADMIN_ENABLED=false
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=
INITIAL_ADMIN_EMAIL=admin@yourcompany.com

APP_WAREHOUSE_PRINT_POLL_MS=5000

COMPANY_NAME="NBH Warehouse & Distribution"
COMPANY_ADDRESS="123 Commercial Avenue, Colombo, Sri Lanka"
COMPANY_PHONE="+94 11 234 5678"
EOF
```

Secure the environment file permissions:
```bash
sudo chown erp:erp /opt/erp/config/erp.env
sudo chmod 600 /opt/erp/config/erp.env
```

---

## 9. Building and Deploying Artifacts

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

3. **Transfer to OCI Server via SCP:**
   ```bash
   scp -i ~/.ssh/id_ed25519 target/erp-0.0.1-SNAPSHOT.jar ubuntu@<YOUR_OCI_PUBLIC_IP>:/tmp/nbh-erp.jar
   scp -i ~/.ssh/id_ed25519 -r frontend/dist/* ubuntu@<YOUR_OCI_PUBLIC_IP>:/tmp/dist/
   ```

### B. Install Artifacts on Server
On the OCI Server:
```bash
# Move backend jar
sudo mv /tmp/nbh-erp.jar /opt/erp/nbh-erp.jar
sudo chown erp:erp /opt/erp/nbh-erp.jar
sudo chmod 644 /opt/erp/nbh-erp.jar

# Move frontend static files
sudo rm -rf /var/www/erp/dist/*
sudo cp -r /tmp/dist/* /var/www/erp/dist/
sudo chown -R www-data:www-data /var/www/erp/dist
sudo chmod -R 755 /var/www/erp/dist
```

---

## 10. Systemd Service Deployment

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

## 11. SSL Certificate & NGINX Setup

1. **Obtain SSL Certificate with Certbot:**
   ```bash
   # Temporarily stop nginx if needed or use webroot
   sudo certbot certonly --nginx -d erp.yourcompany.com
   ```

2. **Install NGINX Site Configuration:**
   Copy `ORACLE_NGINX_CONFIG.conf` to `/etc/nginx/sites-available/nbh-erp.conf`:
   ```bash
   sudo cp ORACLE_NGINX_CONFIG.conf /etc/nginx/sites-available/nbh-erp.conf

   # Replace placeholder domain with your real domain
   sudo sed -i 's/erp.yourcompany.com/YOUR_ACTUAL_DOMAIN/g' /etc/nginx/sites-available/nbh-erp.conf

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

## 12. Automated Daily Database Backups

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

sudo chmod +x /opt/erp/scripts/backup-db.sh
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

## 13. Zero-Downtime Deployment & Update Procedure

When updating the application in the future, run this deployment script:

```bash
sudo tee /opt/erp/scripts/deploy-update.sh > /dev/null << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "==> Deploying NBH ERP update..."

# 1. Update frontend assets
if [ -d "/tmp/dist" ]; then
    echo "Updating frontend..."
    sudo cp -r /tmp/dist/* /var/www/erp/dist/
    sudo chown -R www-data:www-data /var/www/erp/dist
    rm -rf /tmp/dist
fi

# 2. Update backend JAR if present
if [ -f "/tmp/nbh-erp.jar" ]; then
    echo "Updating backend..."
    sudo cp /opt/erp/nbh-erp.jar /opt/erp/nbh-erp.jar.bak
    sudo mv /tmp/nbh-erp.jar /opt/erp/nbh-erp.jar
    sudo chown erp:erp /opt/erp/nbh-erp.jar
    sudo systemctl restart nbh-erp.service
    sudo systemctl status nbh-erp.service --no-pager
fi

# 3. Reload NGINX to ensure fresh cache headers
sudo systemctl reload nginx

echo "==> Update deployment completed successfully."
EOF

sudo chmod +x /opt/erp/scripts/deploy-update.sh
```

---

## 14. Verification and Health Checks

1. **Verify Backend Health:**
   ```bash
   curl -I http://127.0.0.1:8080/api/v1/auth/me
   ```

2. **Verify Public HTTPS:**
   ```bash
   curl -I https://erp.yourcompany.com
   # Should return HTTP/2 200 with security headers
   ```

3. **Verify SSE Connection:**
   Open browser Developer Tools &rarr; Network &rarr; filter `events` &rarr; observe open EventStream connection with real-time heartbeat and data events.
