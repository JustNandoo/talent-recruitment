import { loadEnvironment, readConfig } from '../lib/config.js';
import { openPostgresStore } from '../lib/postgres-store.js';
let store;
try {
  loadEnvironment();
  const config = readConfig();
  if (!config.databaseUrl) throw new Error('Isi DATABASE_URL pada .env pribadi. Ikuti SUPABASE-VERCEL.md.');
  store = await openPostgresStore(config);
  const users = await store.db.prepare('SELECT count(*) AS count FROM users').get();
  console.log(`Supabase terhubung. Migrasi selesai; ${users.count} akun tersedia. Akun yang sudah ada tidak ditimpa.`);
  console.log('Buka /penguji, masuk dengan kata sandi awal konfigurasi, lalu ganti kata sandi melalui aplikasi.');
} catch (error) { console.error('Penyiapan Supabase belum selesai:', error.code || 'CONFIGURATION_ERROR'); process.exitCode = 1; }
finally { if (store) await store.close(); }
