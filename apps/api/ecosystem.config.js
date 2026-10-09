// pm2 process config for the tuli API.
// Secrets come from apps/api/.env (loaded by @nestjs/config).
module.exports = {
  apps: [
    {
      name: 'nubian-invoices-api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      // headless Chrome renders previews/PDFs inside this process tree
      max_memory_restart: '900M',
      env: {
        NODE_ENV: 'production',
        TZ: process.env.APP_TZ || 'Africa/Nairobi',
        PORT: 4400, // imports 4300, kaizen 4100, nubian-updates 4200
      },
    },
  ],
};
