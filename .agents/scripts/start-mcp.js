// scripts/start-mcp.js
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Resolve the external config file (outside the repo)
const configPath = path.resolve(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');

// Load the JSON config (will throw if invalid)
const config = require(configPath);

function runServer(name, command, args, env = {}) {
  console.log(`▶️ Starting ${name}…`);
  const fullCmd = process.platform === 'win32' ? `${command}.cmd` : command;
  const proc = spawn(fullCmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
    cwd: process.cwd(),
    shell: true,
  });
  proc.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ ${name} exited with code ${code}`);
    } else {
      console.log(`✅ ${name} finished`);
    }
  });
}

Object.entries(config.mcpServers).forEach(([name, srv]) => {
  runServer(name, srv.command, srv.args, srv.env);
});
