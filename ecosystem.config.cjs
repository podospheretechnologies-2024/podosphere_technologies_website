// pm2 process file for production. Start everything with:
//   pm2 start ecosystem.config.cjs && pm2 save
// Secrets live in repo-root `.env` (cwd below).
//
// Web uses `next start` against the server's local `.next` OR a Linux-built
// standalone (see scripts/build-standalone-linux.sh). Do NOT run a Windows-packed
// standalone on Ubuntu — native deps (sharp) will crash and nginx returns 502.

module.exports = {
  apps: [
    {
      name: 'podo-social-web',
      namespace: 'podo-social',
      cwd: __dirname,
      // Emergency-stable entry used historically on the 2GB host.
      // Warning about standalone is harmless; site stays up on :3100.
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
      name: 'podo-social-worker',
      namespace: 'podo-social',
      cwd: __dirname,
      script: 'node_modules/tsx/dist/cli.mjs',
      args: '--conditions=react-server src/worker/index.ts',
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
      kill_timeout: 15000,
      time: true,
      merge_logs: true,
      out_file: `${process.env.HOME}/.pm2/logs/podo-social-worker.out.log`,
      error_file: `${process.env.HOME}/.pm2/logs/podo-social-worker.error.log`,
    },
  ],
};
