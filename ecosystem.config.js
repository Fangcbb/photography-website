module.exports = {
  apps: [
    {
      name: "photo",
      script: ".next/standalone/server.js",
      cwd: "/photography-website-main",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
