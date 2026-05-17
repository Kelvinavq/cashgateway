module.exports = {
  apps: [
    {
      name: 'hgcash-api',
      cwd: './server',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'hgcash-worker',
      cwd: './server',
      script: 'queues/webhookWorker.js',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
