import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readConfig } from '../lib/config.js';
import { postgresConnection } from '../lib/postgres-store.js';
import { createVercelHandler } from '../api/handler.js';

test('Vercel memilih origin produksi/preview, HTTPS, dan menolak fallback SQLite', () => {
  const env = { VERCEL: '1', VERCEL_URL: 'preview-example.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'example.vercel.app', DATABASE_URL: 'postgres://localhost/unused' };
  const production = readConfig({ ...env, VERCEL_ENV: 'production' });
  assert.equal(production.origin, 'https://example.vercel.app');
  assert.equal(production.secure, true);
  assert.equal(production.bootstrap, false);
  assert.ok(production.allowedOrigins.includes('https://preview-example.vercel.app'));
  assert.equal(readConfig({ ...env, VERCEL_ENV: 'preview' }).origin, 'https://preview-example.vercel.app');
  assert.equal(readConfig({ ...env, APP_ORIGIN: 'https://hrd.example.test' }).origin, 'https://hrd.example.test');
  assert.throws(() => readConfig({ ...env, DATABASE_URL: '' }), error => error.code === 'DATABASE_URL_REQUIRED');
});
test('koneksi PostgreSQL cloud tetap memverifikasi TLS meskipun URL meminta sslmode lemah', () => {
  const config = { databaseUrl: 'postgres://user:unused@pooler.example.test:6543/database?sslmode=disable', production: true };
  const connection = postgresConnection(config);
  assert.equal(connection.ssl.rejectUnauthorized, true);
  assert.equal(new URL(connection.connectionString).searchParams.has('sslmode'), false);
  assert.throws(() => postgresConnection({ ...config, databaseTls: false }), /TLS/);
  assert.throws(() => postgresConnection({ ...config, databaseUrl: 'postgres://localhost/database', databaseTls: false }), /TLS/);
  assert.equal(postgresConnection({ databaseUrl: 'postgres://localhost/database', databaseTls: false }).ssl, false);
});
test('konfigurasi Vercel yang belum lengkap memberi 503 terarah dan tidak membocorkan kredensial', async t => {
  const env = { VERCEL: '1', VERCEL_URL: 'example.vercel.app' };
  // Config resolution occurs inside the request, just as in a Vercel cold start.
  const keys = Object.keys(env), previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const missing = ['DATABASE_URL','POSTGRES_URL','SUPABASE_DB_URL','APP_ORIGIN'];
  for (const key of missing) previous[key] = process.env[key];
  Object.assign(process.env, env); for (const key of missing) delete process.env[key];
  const handler = createVercelHandler(), server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); for (const [key,value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(response.status, 503);
  const result = await response.json(); assert.match(result.error, /DATABASE_URL/); assert.equal(result.ready, false);
});
