import { createConfiguredApp } from '../server.js';

// One reusable connection pool per warm function, with no listen() or local database writes.
export function createVercelHandler(options = {}) {
  let application;
  const handler = async (req, res) => {
    try {
      application ||= createConfiguredApp(options);
      const app = await application;
      await app.handler(req, res);
    } catch (error) {
      application = undefined;
      console.error('Application initialization failed:', error.code || 'DATABASE_CONFIGURATION_ERROR');
      const messages = {
        DATABASE_URL_REQUIRED: 'Isi DATABASE_URL Supabase pada Settings → Environment Variables Vercel, lalu redeploy. Panduan: SUPABASE-VERCEL.md.',
        INITIAL_PASSWORDS_REQUIRED: 'Isi SUPERADMIN_PASSWORD dan ADMIN_PASSWORD yang berbeda, masing-masing 12–128 karakter, pada Vercel lalu redeploy.',
      };
      const message = messages[error.code] || 'Aplikasi belum dapat terhubung ke database. Periksa DATABASE_URL dan Runtime Logs Vercel, lalu redeploy. Panduan: SUPABASE-VERCEL.md.';
      if (res.headersSent) return res.end();
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '10', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify({ error: message, ready: false }));
    }
  };
  handler.close = async () => { const app = await application; if (app) await app.store.close(); application = undefined; };
  return handler;
}
export default createVercelHandler();
