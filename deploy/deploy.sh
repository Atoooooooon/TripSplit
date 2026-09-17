#!/usr/bin/env bash
set -e

SERVER_IP="117.72.123.54"
SERVER_PASS="Lyh+010034"
TARGET_DIR="/opt/tripsplit"

echo "=== 1. Building local production assets ==="
npm run build

echo "=== 2. Creating target directories on remote server ==="
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no root@$SERVER_IP "mkdir -p $TARGET_DIR/dist $TARGET_DIR/data"

echo "=== 3. Uploading production files ==="
# Upload dist, package.json
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no -r dist package.json package-lock.json root@$SERVER_IP:$TARGET_DIR/

echo "=== 4. Installing production dependencies on remote server ==="
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no root@$SERVER_IP "cd $TARGET_DIR && npm install --omit=dev"

echo "=== 5. Setting up systemd service ==="
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no deploy/tripsplit.service root@$SERVER_IP:/etc/systemd/system/tripsplit.service
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no root@$SERVER_IP "systemctl daemon-reload && systemctl enable --now tripsplit.service && systemctl restart tripsplit.service"

echo "=== 6. Checking service status and port 81 ==="
sleep 2
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no root@$SERVER_IP "systemctl is-active tripsplit.service && ss -tulpn | grep ':81'"

echo "=== 7. Verifying HTTP access ==="
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no root@$SERVER_IP "curl -s http://127.0.0.1:81/api/health"

echo ""
echo "=== Deployment Successfully Completed! ==="
