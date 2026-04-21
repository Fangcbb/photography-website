module.exports = {
  apps: [
    {
      name: "photo",
      script: ".next/standalone/server.js",
      cwd: "/var/www/photo-site/current",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
