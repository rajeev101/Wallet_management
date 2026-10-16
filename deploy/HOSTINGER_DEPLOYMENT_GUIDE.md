# Hostinger VPS Deployment Guide for Campus Wallet

This guide will walk you step-by-step through deploying the full-stack Campus Wallet application (Node.js API, React Client, React Admin, and MongoDB) onto your **Hostinger VPS**.

---

## 1. Access Your Hostinger VPS

1. Log in to [Hostinger hPanel](https://hpanel.hostinger.com/).
2. Click on **VPS** in the top navigation and select your VPS server.
3. Note your VPS credentials:
   - **IP Address**: (e.g. `123.45.67.89`)
   - **SSH Port**: usually `22`
   - **Root Password**: (set in the hPanel VPS dashboard if you haven't yet)
4. Open your local terminal (PowerShell, Command Prompt, or Git Bash) and connect:
   ```bash
   ssh root@YOUR_VPS_IP
   ```

---

## 2. Option A: Automated 1-Command Deployment (Recommended)

Once logged in via SSH on your VPS, run:

```bash
# Clone the repository
git clone https://github.com/rajeev101/Wallet_management.git /var/www/wallet

# Navigate to deploy directory
cd /var/www/wallet/deploy

# Make script executable and run it
chmod +x setup-vps.sh
bash setup-vps.sh
```

The script will automatically:
- Install **Node.js 22 LTS**, **NPM**, **Git**, and **Nginx**.
- Install and configure **MongoDB Community Server** and start it as a system service.
- Install **PM2** process manager and start the Express API on port `5050` with auto-restart on system reboot.
- Build the **Client** and **Admin** production bundles (`dist/`).
- Configure **Nginx** reverse proxy and routing.
- Set up **UFW Firewall** (opening ports 22, 80, 443).

---

## 3. Option B: Manual Step-by-Step Setup

If you prefer running commands manually:

### Step 1: Install Node.js & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs nginx git
npm install -g pm2
```

### Step 2: Install MongoDB Community Server
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update -y
apt-get install -y mongodb-org
systemctl enable mongod
systemctl start mongod
```

### Step 3: Clone Code and Set Up Backend
```bash
git clone https://github.com/rajeev101/Wallet_management.git /var/www/wallet
cd /var/www/wallet/server
cp .env.example .env
nano .env   # Review and customize JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install --production
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Step 4: Build Client and Admin
```bash
# Client
cd /var/www/wallet/client
echo "VITE_API_BASE_URL=/api/v1" > .env
npm install
npm run build

# Admin
cd /var/www/wallet/admin
echo "VITE_API_BASE_URL=/api/v1" > .env
npm install
npm run build
```

### Step 5: Configure Nginx
```bash
cp /var/www/wallet/deploy/nginx-single-or-ip.conf /etc/nginx/sites-available/campus-wallet
ln -sf /etc/nginx/sites-available/campus-wallet /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

---

## 4. Connecting Your Custom Domain & Free SSL (Certbot)

If you have a domain (e.g. `yourdomain.com`):

1. **Point DNS in Hostinger DNS Manager**:
   - `A` Record: `@` &rarr; `YOUR_VPS_IP`
   - `A` Record: `www` &rarr; `YOUR_VPS_IP`
   - `A` Record: `admin` &rarr; `YOUR_VPS_IP` (optional if using `admin.yourdomain.com`)
   - `A` Record: `api` &rarr; `YOUR_VPS_IP` (optional if using `api.yourdomain.com`)

2. **Install Let's Encrypt SSL via Certbot**:
   ```bash
   apt-get install -y certbot python3-certbot-nginx
   certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```
   Certbot will automatically configure HTTPS redirection and auto-renewal.

---

## 5. Useful VPS Maintenance Commands

| Action | Command |
| :--- | :--- |
| **Check Backend Status** | `pm2 status` |
| **View Backend Logs** | `pm2 logs campus-wallet-api` |
| **Restart Backend** | `pm2 restart campus-wallet-api` |
| **Check MongoDB Status** | `systemctl status mongod` |
| **Restart Nginx** | `systemctl restart nginx` |
| **Update App with New Code** | `cd /var/www/wallet && git pull && cd client && npm run build && cd ../admin && npm run build && pm2 restart campus-wallet-api` |
