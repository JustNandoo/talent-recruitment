import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export function loadEnvironment() {
  const path = join(projectRoot, '.env');
  if (existsSync(path)) process.loadEnvFile(path);
}
export function readConfig(env = process.env) {
  const vercel = env.VERCEL === '1';
  const production = env.NODE_ENV === 'production' || vercel;
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT harus berupa angka 0–65535.');
  const automaticHost = env.VERCEL_ENV === 'preview' ? env.VERCEL_URL : env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  let origin = env.APP_ORIGIN || (vercel && automaticHost ? `https://${automaticHost}` : '');
  if (origin) {
    let url;
    try { url = new URL(origin); } catch { throw new Error('APP_ORIGIN harus berupa alamat web yang valid.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('APP_ORIGIN harus berupa origin web tanpa path atau kredensial.');
    origin = url.origin;
  }
  const secure = env.COOKIE_SECURE === 'true' || origin.startsWith('https://');
  const bootstrap = env.BOOTSTRAP_ACCOUNTS === 'true' || !production && env.BOOTSTRAP_ACCOUNTS !== 'false';
  if (production && (!origin.startsWith('https://') || !secure || env.COOKIE_SECURE === 'false')) throw new Error('Mode produksi memerlukan APP_ORIGIN HTTPS dan cookie Secure.');
  if (production && new URL(origin).hostname.endsWith('.example')) throw new Error('Ganti domain contoh dengan domain HTTPS produksi yang sebenarnya.');
  if (production && bootstrap) throw new Error('Jalankan setup:accounts secara terpisah; BOOTSTRAP_ACCOUNTS harus false pada produksi.');
  const databaseUrl = env.DATABASE_URL || env.POSTGRES_URL || env.SUPABASE_DB_URL || '';
  if (vercel && !databaseUrl) { const error = new Error('Isi DATABASE_URL Supabase pada Environment Variables Vercel.'); error.code = 'DATABASE_URL_REQUIRED'; throw error; }
  const allowedOrigins = [origin];
  if (vercel && env.VERCEL_URL) allowedOrigins.push(new URL(`https://${env.VERCEL_URL}`).origin);
  return { production, vercel, port, origin, allowedOrigins, secure, bootstrap, host: env.HOST || '0.0.0.0', trustProxy: env.TRUST_PROXY === 'true' || vercel, dataDir: resolve(projectRoot, env.DATA_DIR || '.data'), databaseUrl, databaseTls: env.DATABASE_TLS !== 'false', databaseCa: env.DATABASE_CA_CERT || '', superadminPassword: env.SUPERADMIN_PASSWORD, adminPassword: env.ADMIN_PASSWORD, superadminEmail: env.SUPERADMIN_EMAIL || 'superadmin@serviam.local', adminEmail: env.ADMIN_EMAIL || 'admin@serviam.local' };
}
