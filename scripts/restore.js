import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const pluginDir = 'C:\\Users\\rammo\\Local Sites\\aexis\\app\\public\\wp-content\\plugins\\aexis-marketplace-cms';
const backupsDir = path.join(rootDir, 'backups');

if (!fs.existsSync(backupsDir)) {
  console.error('No backups directory found.');
  process.exit(1);
}

const zips = fs.readdirSync(backupsDir).filter(f => f.endsWith('.zip'));
if (zips.length === 0) {
  console.error('No backup zips found.');
  process.exit(1);
}

zips.sort();
const latestZip = path.join(backupsDir, zips[zips.length - 1]);
console.log(`Restoring from latest backup: ${latestZip}`);

const extractDir = path.join(backupsDir, 'temp-restore');
try {
  fs.mkdirSync(extractDir, { recursive: true });
  execSync(`powershell -Command "Expand-Archive -Path '${latestZip}' -DestinationPath '${extractDir}' -Force"`);
  
  const pluginBackup = path.join(extractDir, 'aexis-marketplace-cms');
  if (fs.existsSync(pluginBackup)) {
    fs.mkdirSync(path.dirname(pluginDir), { recursive: true });
    fs.cpSync(pluginBackup, pluginDir, { recursive: true });
    console.log('Plugin restored to Local Sites folder.');
  }

  const files = fs.readdirSync(extractDir);
  files.forEach(f => {
    if (f.startsWith('.env')) {
      fs.copyFileSync(path.join(extractDir, f), path.join(rootDir, f));
      console.log(`Restored ${f}`);
    }
  });

  fs.rmSync(extractDir, { recursive: true, force: true });
  console.log('Restore complete.');

} catch(e) {
  console.error('Restore failed', e.message);
  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
}
