#!/usr/bin/env bash
# ==============================================================================
# Hostinger VPS Automated Deployment Script for Campus Wallet
# Target OS: Ubuntu 22.04 LTS / 24.04 LTS or Debian 12
# Run as root or with sudo: sudo bash deploy/setup-vps.sh
# ==============================================================================

set -e

echo "=========================================================="
echo " Starting Hostinger VPS Deployment for Campus Wallet"
echo "=========================================================="

# 1. Update system packages
echo "==> Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget gnupg git build-essential nginx ufw

# 2. Install Node.js 22 LTS
echo "==> Installing Node.js LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 3. Install MongoDB Community Edition
echo "==> Installing MongoDB Community Edition..."
if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
       gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg \
       --dearmor --yes

    # Detect Ubuntu version codename
    UBUNTU_CODENAME=$(lsb_release -cs 2>/dev/null || echo "jammy")
    # MongoDB 7.0 repo
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${UBUNTU_CODENAME}/mongodb-org/7.0 multiverse" | \
       tee /etc/apt/sources.list.d/mongodb-org-7.0.list

    apt-get update -y
    apt-get install -y mongodb-org || {
        echo "Fallback: installing mongodb via standard repositories"
        apt-get install -y mongodb
    }
fi

systemctl daemon-reload
systemctl enable mongod || systemctl enable mongodb
systemctl restart mongod || systemctl restart mongodb
echo "MongoDB status: Active"

# 4. Install PM2 globally
echo "==> Installing PM2 process manager..."
npm install -g pm2

# 5. Setup Project Directory (/var/www/wallet)
PROJECT_DIR="/var/www/wallet"
mkdir -p "$PROJECT_DIR"

echo "==> Copying project files to $PROJECT_DIR..."
# If running inside repo directory:
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [ "$REPO_ROOT" != "$PROJECT_DIR" ]; then
    rsync -av --exclude 'node_modules' --exclude '.git' "$REPO_ROOT/" "$PROJECT_DIR/"
fi

cd "$PROJECT_DIR"

# 6. Setup Server Environment
echo "==> Setting up Server..."
cd "$PROJECT_DIR/server"
if [ ! -f .env ]; then
    cp .env.example .env
    # Generate random JWT secret
    JWT_RANDOM=$(openssl rand -hex 32)
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_RANDOM}|" .env
    sed -i "s|MONGO_URI=.*|MONGO_URI=mongodb://127.0.0.1:27017/cpac|" .env
    sed -i "s|PORT=.*|PORT=5050|" .env
fi
npm install --production

# Start / Restart Server with PM2
echo "==> Starting API server with PM2..."
pm2 delete campus-wallet-api 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root || true

# 7. Build Client Frontend
echo "==> Building Client Frontend..."
cd "$PROJECT_DIR/client"
if [ ! -f .env ]; then
    echo "VITE_API_BASE_URL=/api/v1" > .env
fi
npm install
npm run build

# 8. Build Admin Frontend
echo "==> Building Admin Frontend..."
cd "$PROJECT_DIR/admin"
if [ ! -f .env ]; then
    echo "VITE_API_BASE_URL=/api/v1" > .env
fi
npm install
npm run build

# 9. Configure Nginx
echo "==> Configuring Nginx..."
cp "$PROJECT_DIR/deploy/nginx-single-or-ip.conf" /etc/nginx/sites-available/campus-wallet
ln -sf /etc/nginx/sites-available/campus-wallet /etc/nginx/sites-enabled/campus-wallet
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx

# 10. Firewall rules
echo "==> Configuring UFW firewall..."
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

echo "=========================================================="
echo " Deployment Complete!"
echo " Client:   http://<YOUR_VPS_IP>/"
echo " Admin:    http://<YOUR_VPS_IP>/admin"
echo " API:      http://<YOUR_VPS_IP>/api/v1"
echo "=========================================================="
