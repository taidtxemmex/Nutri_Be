/**
 * Cấu hình PM2 cho NestJS Backend trên VPS 1 vCPU / 2GB RAM
 * Tham chiếu kiến trúc: 02_HA_TANG_VPS_VA_TOI_UU_1CPU_2GB.md
 */
module.exports = {
  apps: [
    {
      name: 'nutri-backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork', // 1 vCPU: fork mode tối ưu nhất, tiết kiệm 50MB RAM so với cluster
      watch: false,
      max_memory_restart: '300M', // Tự động restart khi RAM vượt quá 300MB để chống rò rỉ bộ nhớ
      node_args: '--max-old-space-size=256 --enable-source-maps', // Giới hạn V8 heap 256MB cho VPS 2GB RAM
      kill_timeout: 5000, // Chờ 5s cho active HTTP requests hoàn tất trước khi kill
      wait_ready: true, // Chờ tín hiệu process.send('ready') hoặc timeout
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'development',
        PORT: 8080,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
