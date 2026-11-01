# ==============================================================================
# Multi-Stage Build Dockerfile for Nutri Clinical Nutrition Backend (NestJS 10)
# Tối ưu hóa kích thước image < 150MB & kiểm soát bộ nhớ RAM < 256MB trên VPS 1 vCPU / 2GB RAM
# ==============================================================================

# ------------------------------------------------------------------------------
# STAGE 1: Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Cài đặt OpenSSL và dependencies build hệ thống
RUN apk add --no-cache openssl libc6-compat

# Copy package manifests & prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Cài đặt toàn bộ dependencies (bao gồm devDependencies để compile TypeScript)
RUN npm ci

# Copy toàn bộ mã nguồn cấu hình dự án
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/

# Biên dịch mã nguồn và khởi tạo Prisma Client
RUN npx prisma generate
RUN npm run build

# Dọn dẹp devDependencies để thu gọn image runtime
RUN npm prune --production

# ------------------------------------------------------------------------------
# STAGE 2: Production Runner Tinh Gọn (< 150MB)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Cài đặt runtime dependencies tối thiểu: OpenSSL (Prisma) và dumb-init (PID 1 signals)
RUN apk add --no-cache openssl dumb-init tzdata && \
    cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime && \
    echo "Asia/Ho_Chi_Minh" > /etc/timezone

# Tạo user/group không đặc quyền (Non-root Least Privilege Security)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Biến môi trường chuẩn production & tối ưu bộ nhớ heap Node.js
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=256 --enable-source-maps"

# Copy các artifacts cần thiết từ builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# Khởi tạo cây thư mục lưu trữ file phân tầng (Public / Protected) với quyền ghi
RUN mkdir -p uploads/public uploads/protected && \
    chown -R nestjs:nodejs uploads

# Chuyển quyền thực thi sang user không phải root
USER nestjs

# Expose cổng HTTP backend
EXPOSE 3000

# Quản lý tiến trình qua dumb-init chống Zombie process
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Khởi chạy ứng dụng NestJS production
CMD ["node", "dist/main.js"]
