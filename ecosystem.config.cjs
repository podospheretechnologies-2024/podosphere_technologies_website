// pm2 process file for production. Start everything with:
//   pm2 start ecosystem.config.cjs && pm2 save
// Secrets are not set here: Next.js and the worker both read `.env` from this folder.

module.exports = {
  apps: [
    {
      // Next.js server: frontend pages + backend API routes (/api/*).
      name: 'podo-social-web',
      namespace: 'podo-social',
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3100',
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '700M',
      time: true,
      merge_logs: true,
      out_file: `${process.env.HOME}/.pm2/logs/podo-social-web.out.log`,
      error_file: `${process.env.HOME}/.pm2/logs/podo-social-web.error.log`,
    },
    {
      // Background jobs (BullMQ): publishing scheduled posts, token refresh, RSS autoposts.
      name: 'podo-social-worker',
      namespace: 'podo-social',
      cwd: __dirname,
      script: 'node_modules/tsx/dist/cli.mjs',
      args: '--conditions=react-server src/worker/index.ts',
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
      // Lets the worker finish its current job on restart (it closes queues on SIGINT).
      kill_timeout: 15000,
      time: true,
      merge_logs: true,
      out_file: `${process.env.HOME}/.pm2/logs/podo-social-worker.out.log`,
      error_file: `${process.env.HOME}/.pm2/logs/podo-social-worker.error.log`,
    },
  ],
};
