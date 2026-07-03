module.exports = {
  apps: [
    {
      name:                'taskcraft-ai',
      script:              'server.js',
      instances:           2,
      exec_mode:           'cluster',
      autorestart:         true,
      watch:               false,
      max_memory_restart:  '512M',
      kill_timeout:        5000,
      listen_timeout:      5000,
    },
  ],
};
