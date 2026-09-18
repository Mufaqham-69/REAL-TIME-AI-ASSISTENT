const { spawn } = require('child_process');
const path = require('path');

console.log('[Runner] Starting Real-Time AI Assistant (Backend + Frontend)...');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// 1. Start Server
const serverProc = spawn(npmCmd, ['--prefix', 'server', 'start'], {
    stdio: 'inherit',
    shell: true
});

// 2. Start Client
const clientProc = spawn(npmCmd, ['--prefix', 'server/client', 'run', 'dev'], {
    stdio: 'inherit',
    shell: true
});

const cleanup = () => {
    console.log('\n[Runner] Shutting down services...');
    if (serverProc && !serverProc.killed) {
        if (isWindows) {
            spawn('taskkill', ['/pid', serverProc.pid, '/f', '/t']);
        } else {
            serverProc.kill();
        }
    }
    if (clientProc && !clientProc.killed) {
        if (isWindows) {
            spawn('taskkill', ['/pid', clientProc.pid, '/f', '/t']);
        } else {
            clientProc.kill();
        }
    }
    process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
