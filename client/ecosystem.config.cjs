module.exports = {
  apps: [{
    name: 'opencode-wrapper-client',
    script: 'node_modules/.bin/vite',
    args: 'preview --host 0.0.0.0 --port 3011',
    cwd: '/root/opencode-wrapper-main/client',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};