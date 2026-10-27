module.exports = {
  apps: [{
    name: "photo",
    script: ".next/standalone/server.js",
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: { NODE_ENV: "production", PORT: 3000 },
    // 避免快速循环重启
    min_uptime: "10s",
    max_restarts: 10,
    restart_delay: 3000
  }]
};
