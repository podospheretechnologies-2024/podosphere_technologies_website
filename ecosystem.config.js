module.exports = {
  apps: [
    {
      name: 'podo-web',
      script: 'pnpm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'podo-worker',
      script: 'pnpm',
      args: 'run worker',
      env: {
        NODE_ENV: 'production',
      },
    }
  ]
};
