#!/usr/bin/env bash
# ==============================================================================
# Production Startup Script for Nutri Clinical Nutrition Backend
# Tối ưu hóa vận hành trên VPS 1 vCPU / 2GB RAM
# Tham chiếu: 02_HA_TANG_VPS_VA_TOI_UU_1CPU_2GB.md
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "=================================================================="
echo "🚀 [Nutri Backend] Starting Production Deployment & Process..."
echo "=================================================================="

# 1. Kích hoạt môi trường Node.js (nvm nếu có)
if [ -s "${HOME}/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1090
    source "${HOME}/.nvm/nvm.sh"
    nvm use 2>/dev/null || true
fi

echo "📦 Node.js Version: $(node -v)"
echo "📦 NPM Version:     $(npm -v)"

# 2. Đảm bảo cấu trúc thư mục upload phân tầng tồn tại
echo "📁 Ensuring upload directories exist..."
mkdir -p uploads/public uploads/protected
if [ -d "/var/www/uploads" ]; then
    mkdir -p /var/www/uploads/avatars /var/www/uploads/evidence /var/www/uploads/templates 2>/dev/null || true
fi

# 3. Kiểm tra artifact biên dịch dist/
if [ ! -f "dist/main.js" ] && [ ! -f "dist/src/main.js" ]; then
    echo "⚠️ dist/main.js not found! Running build..."
    npm run build
fi

# Đảm bảo proxy entry dist/main.js luôn tồn tại
if [ ! -f "dist/main.js" ] && [ -f "dist/src/main.js" ]; then
    echo "require('./src/main.js');" > dist/main.js
fi

# 4. Thực thi Database Migration tự động (Prisma Deploy)
echo "🗄️ Executing Prisma Database Migrations..."
npx prisma migrate deploy

# Tùy chọn Seed dữ liệu nếu biến RUN_SEED được bật
if [ "${RUN_SEED:-false}" = "true" ]; then
    echo "🌱 Seeding initial database..."
    npx prisma db seed || true
fi

# 5. Khởi chạy hoặc tải lại tiến trình qua PM2 (Fork mode, 256MB V8 heap)
echo "⚡ Starting/Reloading PM2 process via ecosystem.config.js..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
    pm2 save
    echo "📊 PM2 Current Status:"
    pm2 status nutri-backend || pm2 status
else
    echo "⚠️ PM2 not found globally! Starting directly with node limits..."
    export NODE_ENV=production
    export PORT=3000
    exec node --max-old-space-size=256 --enable-source-maps dist/main.js
fi

echo "=================================================================="
echo "✅ [Nutri Backend] Production process started successfully!"
echo "=================================================================="
