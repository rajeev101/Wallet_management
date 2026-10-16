#!/usr/bin/env bash
# ==============================================================================
# Hostinger VPS Quick Redeployment Script
# Pulls latest master branch, rebuilds frontends, and restarts PM2/Nginx
# Run on VPS: bash /var/www/wallet/deploy/redeploy-vps.sh
# ==============================================================================

set -e

PROJECT_DIR="/var/www/wallet"

echo "=========================================================="
echo " Redeploying Campus Wallet on VPS"
echo "=========================================================="

# 1. Locate project directory
if [ ! -d "$PROJECT_DIR" ]; then
    echo "Directory $PROJECT_DIR not found. Searching for project..."
    if [ -d "/root/Wallet_management" ]; then
        PROJECT_DIR="/root/Wallet_management"
    elif [ -d "$HOME/Wallet_management" ]; then
        PROJECT_DIR="$HOME/Wallet_management"
    else
        echo "Cloning repository to $PROJECT_DIR..."
        git clone https://github.com/rajeev101/Wallet_management.git "$PROJECT_DIR"
    fi
fi

echo "==> Using project directory: $PROJECT_DIR"
cd "$PROJECT_DIR"

# 2. Fetch latest changes from GitHub master branch
echo "==> Pulling latest changes from origin/master..."
git fetch origin
git reset --hard origin/master

# 3. Update server dependencies & restart PM2
echo "==> Updating backend server..."
cd "$PROJECT_DIR/server"
npm install --production

if pm2 list | grep -q "campus-wallet-api"; then
    echo "==> Restarting existing PM2 process..."
    pm2 reload campus-wallet-api || pm2 restart campus-wallet-api
elif [ -f ecosystem.config.js ]; then
    echo "==> Starting PM2 process..."
    pm2 start ecosystem.config.js
    pm2 save
else
    pm2 start src/server.js --name campus-wallet-api
    pm2 save
fi

# 4. Rebuild Client Frontend
echo "==> Rebuilding Client frontend..."
cd "$PROJECT_DIR/client"
if [ ! -f .env ]; then
    echo "VITE_API_BASE_URL=/api/v1" > .env
fi
npm install
npm run build

# 5. Rebuild Admin Frontend
echo "==> Rebuilding Admin frontend..."
cd "$PROJECT_DIR/admin"
if [ ! -f .env ]; then
    echo "VITE_API_BASE_URL=/api/v1" > .env
fi
npm install
npm run build

# 6. Ensure Nginx configuration is updated and reloaded
echo "==> Reloading Nginx..."
if [ -f "$PROJECT_DIR/deploy/nginx-single-or-ip.conf" ]; then
    cp "$PROJECT_DIR/deploy/nginx-single-or-ip.conf" /etc/nginx/sites-available/campus-wallet
    ln -sf /etc/nginx/sites-available/campus-wallet /etc/nginx/sites-enabled/campus-wallet
    rm -f /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl reload nginx || systemctl restart nginx

SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

echo "=========================================================="
echo " Redeployment Succeeded!"
echo " Client:   http://${SERVER_IP}/"
echo " Admin:    http://${SERVER_IP}/admin"
echo " API:      http://${SERVER_IP}/api/v1"
echo "=========================================================="
