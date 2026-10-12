import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, chmodSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEnvironment, readConfig } from '../lib/config.js';
loadEnvironment();
const config = readConfig(), source = join(config.dataDir, 'talenta.sqlite');
if (!existsSync(source)) throw new Error('Database belum tersedia. Jalankan aplikasi terlebih dahulu.');
const folder = resolve(config.dataDir, 'backups');
mkdirSync(folder, { recursive: true, mode: 0o700 });
const destination = join(folder, `serviam-${new Date().toISOString().replaceAll(':', '-')}.sqlite`);
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  chmodSync(destination, 0o600);
  const check = new DatabaseSync(destination);
  check.exec('PRAGMA journal_mode=DELETE');
  try { if (check.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Integritas backup gagal.'); } finally { check.close(); }
  console.log('Backup SQLite konsisten berhasil:', destination);
} finally { db.close(); }
