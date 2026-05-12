import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const pluginDir = 'C:\\Users\\rammo\\Local Sites\\aexis\\app\\public\\wp-content\\plugins\\aexis-marketplace-cms';
const backupDir = path.join(rootDir, 'backups', `backup-${Date.now()}`);

console.log('Starting backup to', backupDir);

fs.mkdirSync(backupDir, { recursive: true });

// Copy Plugin
if (fs.existsSync(pluginDir)) {
  console.log('Backing up plugin...');
  fs.cpSync(pluginDir, path.join(backupDir, 'aexis-marketplace-cms'), { recursive: true });
} else {
  console.warn('Plugin directory not found:', pluginDir);
}

// Copy ENV files and configs
console.log('Backing up config files...');
const filesToBackup = fs.readdirSync(rootDir).filter(f => f.startsWith('.env') || f === 'package.json' || f === 'vite.config.ts');
filesToBackup.forEach(f => {
  fs.copyFileSync(path.join(rootDir, f), path.join(backupDir, f));
});

console.log('Creating zip...');
try {
  execSync(`powershell -Command "Compress-Archive -Path '${backupDir}\\*' -DestinationPath '${backupDir}.zip' -Force"`);
  console.log('Backup zip created successfully at', `${backupDir}.zip`);
  fs.rmSync(backupDir, { recursive: true, force: true });
} catch (e) {
  console.error('Failed to create zip. You might need to zip the folder manually.', e.message);
}
console.log('Backup complete.');
