// pm2 process file for production. Start everything with:
//   pm2 start ecosystem.config.cjs && pm2 save
// Secrets: web loads repo-root `.env` via scripts/run-standalone-web.cjs;
// the worker inherits cwd + dotenv from the app (same folder).

module.exports = {
  apps: [
    {
      // Packed Next standalone server (avoids `next start` + output:standalone warning).
      name: 'podo-social-web',
      namespace: 'podo-social',
      cwd: __dirname,
      script: 'scripts/run-standalone-web.cjs',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: '3100',
        HOSTNAME: '0.0.0.0',
      },
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
