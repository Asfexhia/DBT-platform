import fs from 'fs';
import path from 'path';

const logDir = path.resolve(process.cwd(), 'backend', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const appendJsonLog = (filename, obj) => {
  try {
    const filePath = path.join(logDir, filename);
    const line = JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n';
    fs.appendFileSync(filePath, line);
  } catch (e) {
    // best-effort logging
    console.error('Failed to write log:', e.message);
  }
};

export default {
  authFailure: (details) => appendJsonLog('auth.log', details),
  general: (details) => appendJsonLog('general.log', details)
};
