import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { loadEnvironment, readConfig } from '../lib/config.js';
try {
  loadEnvironment();
  const config = readConfig();
  if (!config.production) throw new Error('Atur NODE_ENV=production serta APP_ORIGIN HTTPS untuk pemeriksaan produksi.');
  if (new URL(config.origin).hostname.endsWith('.example')) throw new Error('Ganti domain contoh dengan domain produksi yang sebenarnya.');
  const db = new DatabaseSync(join(config.dataDir, 'talenta.sqlite'), { readOnly: true });
  try {
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Integritas database gagal.');
    if (!db.prepare("SELECT id FROM users WHERE role='superadmin' AND is_active=1 AND must_change_password=0 LIMIT 1").get()) throw new Error('Superadmin aktif harus menyelesaikan penggantian kata sandi awal.');
  } finally { db.close(); }
  if (process.argv.includes('--online')) {
    const response = await fetch(config.origin + '/api/ready', { signal: AbortSignal.timeout(15000) });
    if (!response.ok || !(await response.json()).ready) throw new Error('Endpoint HTTPS produksi belum siap.');
    if (!response.headers.get('strict-transport-security')) throw new Error('Header HSTS tidak tersedia.');
    console.log('Endpoint HTTPS, sertifikat TLS, dan readiness berhasil diperiksa.');
  }
  console.log('Konfigurasi dan database produksi lulus. Gunakan --online untuk verifikasi layanan HTTPS yang sudah dipasang.');
} catch (error) { console.error('Produksi belum siap:', error.message); process.exitCode = 1; }
