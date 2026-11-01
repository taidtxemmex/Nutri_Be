/**
 * Cấu hình PM2 cho NestJS Backend trên VPS 1 vCPU / 2GB RAM
 * Tham chiếu kiến trúc: 02_HA_TANG_VPS_VA_TOI_UU_1CPU_2GB.md
 */
module.exports = {
  apps: [
    {
      name: 'nutri-nestjs-test',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork', // 1 vCPU: fork mode tối ưu nhất, tiết kiệm 50MB RAM so với cluster
      watch: false,

      // === CƠ CHẾ AUTO-RESTART BẢO MẬT & ỔN ĐỊNH ===
      autorestart: true, // Tự động hồi sinh khi app crash hoặc gặp lỗi
      max_memory_restart: '300M', // Tự động restart khi RAM vượt quá 300MB để chống rò rỉ bộ nhớ
      restart_delay: 2000, // Đợi 2 giây trước khi restart để tránh nghẽn CPU
      max_restarts: 15, // Số lần restart tối đa trong chu kỳ
      min_uptime: '10s', // Ứng dụng sống > 10s được tính là khởi động ổn định
      exp_backoff_restart_delay: 100, // Tự động tăng thời gian chờ nếu bị restart liên tục

      node_args: '--max-old-space-size=256 --enable-source-maps', // Giới hạn V8 heap 256MB cho VPS 2GB RAM
      kill_timeout: 5000, // Chờ 5s cho active HTTP requests hoàn tất trước khi kill
      wait_ready: false, // NestJS lắng nghe HTTP server tiêu chuẩn
      listen_timeout: 10000,

      env: {
        NODE_ENV: 'production',
        PORT: 8088,
      },
    },
  ],
};
