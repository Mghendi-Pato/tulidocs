// pm2 process config for the tuli API (tulidocs.com).
// Port and secrets come from apps/api/.env (loaded by @nestjs/config) — see deploy/setup-server.sh.
module.exports = {
  apps: [
    {
      name: 'tulidocs-api',
      cwd: __dirname,
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      // headless Chrome renders previews/PDFs inside this process tree
      max_memory_restart: '900M',
      env: {
        NODE_ENV: 'production',
        TZ: process.env.APP_TZ || 'Africa/Nairobi',
      },
    },
  ],
};
