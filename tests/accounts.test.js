import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server.js';
import { prepareAccounts } from '../lib/accounts.js';
import { readConfig } from '../lib/config.js';

async function fixture(t, production = false) {
  const dir = mkdtempSync(join(tmpdir(), 'serviam-accounts-'));
  const config = readConfig({ DATA_DIR: dir, ...(production ? { NODE_ENV: 'production', APP_ORIGIN: 'https://ujian.serviam.test', BOOTSTRAP_ACCOUNTS: 'false' } : {}) });
  let app = createApp({ config });
  const initialized = prepareAccounts(app.store, config);
  const credentials = [...readFileSync(initialized.credentialsPath, 'utf8').matchAll(/Email: (.+)\nKata sandi awal: (.+)/g)].map(match => ({ email: match[1], password: match[2] }));
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  let base = `http://127.0.0.1:${app.server.address().port}`;
  function client() {
    let cookie = '';
    return {
      async call(path, method = 'GET', body, headers = {}) {
        const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Talenta-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
        return { status: response.status, data: await response.json(), headers: response.headers };
      },
    };
  }
  async function login(index, change = true) {
    const c = client(), credential = credentials[index];
    assert.equal((await c.call('/api/login', 'POST', credential)).status, 200);
    if (change) {
      const password = randomBytes(24).toString('base64url');
      assert.equal((await c.call('/api/admin/password', 'POST', { currentPassword: credential.password, password })).status, 200);
      credential.password = password;
    }
    return c;
  }
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); app.store.close(); rmSync(dir, { recursive: true, force: true }); });
  return { dir, config, credentials, client, login, get app() { return app; }, async restart() { await new Promise(resolve => app.server.close(resolve)); app.store.close(); app = createApp({ config }); await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${app.server.address().port}`; } };
}

test('akun awal dibuat acak, di-hash, tersimpan pribadi dan setup ulang tidak menimpa akun', async t => {
  const f = await fixture(t);
  const users = f.app.store.db.prepare('SELECT * FROM users ORDER BY created_at,rowid').all();
  assert.deepEqual(users.map(user => user.role), ['superadmin', 'admin']);
  assert.notEqual(f.credentials[0].password, f.credentials[1].password);
  for (let i = 0; i < 2; i++) { assert.notEqual(users[i].password, f.credentials[i].password); assert.equal(users[i].must_change_password, 1); }
  if (process.platform !== 'win32') assert.equal(statSync(join(f.dir, 'initial-accounts.txt')).mode & 0o777, 0o600);
  assert.equal(prepareAccounts(f.app.store, f.config).created, false);
  await f.restart();
  assert.equal(prepareAccounts(f.app.store, f.config).created, false);
  assert.equal((await f.client().call('/api/setup', 'POST', { name: 'Akun tambahan', email: 'other@example.test', password: randomBytes(24).toString('base64url'), setupCode: 'kode-tidak-berlaku' })).status, 409);
});

test('kata sandi awal wajib diganti; perubahan merotasi sesi dan membatasi akses admin', async t => {
  const f = await fixture(t), superuser = await f.login(0, false), oldSession = await f.login(0, false);
  assert.equal((await superuser.call('/api/admin/me')).data.user.mustChangePassword, true);
  assert.equal((await superuser.call('/api/admin/exams')).status, 428);
  assert.equal((await superuser.call('/api/ready')).status, 503);
  assert.equal((await superuser.call('/api/admin/password', 'POST', { currentPassword: 'salah', password: randomBytes(24).toString('base64url') })).status, 403);
  const password = randomBytes(24).toString('base64url');
  assert.equal((await superuser.call('/api/admin/password', 'POST', { currentPassword: f.credentials[0].password, password })).status, 200);
  assert.equal((await oldSession.call('/api/admin/me')).status, 401);
  assert.equal((await superuser.call('/api/ready')).status, 200);
  const admin = await f.login(1);
  assert.equal((await admin.call('/api/admin/exams')).status, 200);
  for (const path of ['/api/admin/users', '/api/admin/audit', '/api/admin/system']) assert.equal((await admin.call(path)).status, 403);
  assert.equal((await admin.call('/api/admin/users', 'POST', { name: 'Tidak sah', email: 'other@example.test', role: 'superadmin', password })).status, 403);
  const invitation = await admin.call('/api/admin/exams', 'POST', { name: 'Peserta Link', email: 'participant@example.test', role: 'umum' });
  assert.equal(invitation.status, 201);
  assert.match(invitation.data.invitationPath, /^\/ujian\//);
  const token = invitation.data.invitationPath.split('/').at(-1);
  assert.notEqual(f.app.store.getExam(invitation.data.exam.id).token_hash, token);
  assert.equal((await f.client().call('/api/invitations/' + token)).status, 200);
});

test('superadmin mengelola akses, reset sandi dan menjaga superadmin aktif terakhir', async t => {
  const f = await fixture(t), superuser = await f.login(0), admin = await f.login(1);
  const users = (await superuser.call('/api/admin/users')).data.users;
  const adminId = users.find(user => user.role === 'admin').id, superId = users.find(user => user.role === 'superadmin').id;
  assert.equal(JSON.stringify(users).includes('password'), false);
  assert.equal((await superuser.call('/api/admin/users/' + superId, 'PATCH', { active: false })).status, 409);
  assert.equal((await superuser.call('/api/admin/users/' + superId, 'PATCH', { role: 'admin' })).status, 409);
  assert.equal((await admin.call('/api/admin/users/' + superId, 'PATCH', { role: 'admin' })).status, 403);
  assert.equal((await superuser.call('/api/admin/users/' + adminId, 'PATCH', { active: false })).status, 200);
  assert.equal((await admin.call('/api/admin/me')).status, 401);
  assert.equal((await f.client().call('/api/login', 'POST', f.credentials[1])).status, 401);
  const replacement = randomBytes(24).toString('base64url');
  assert.equal((await superuser.call('/api/admin/users/' + adminId, 'PATCH', { active: true, password: replacement })).status, 200);
  const resetClient = f.client();
  assert.equal((await resetClient.call('/api/login', 'POST', { email: f.credentials[1].email, password: replacement })).status, 200);
  assert.equal((await resetClient.call('/api/admin/exams')).status, 428);
  const newUser = { name: 'Penguji Baru', email: 'new@example.test', role: 'admin', password: randomBytes(24).toString('base64url') };
  assert.equal((await superuser.call('/api/admin/users', 'POST', newUser)).status, 201);
  assert.equal((await superuser.call('/api/admin/users', 'POST', newUser)).status, 409);
  assert.ok((await superuser.call('/api/admin/audit')).data.audit.some(entry => entry.action === 'user_password_reset'));
});

test('konfigurasi produksi menolak HTTP; cookie, origin publik dan CSRF mengikuti HTTPS', async t => {
  assert.throws(() => readConfig({ NODE_ENV: 'production' }), /HTTPS/);
  assert.throws(() => readConfig({ NODE_ENV: 'production', APP_ORIGIN: 'http://example.test' }), /HTTPS/);
  assert.throws(() => readConfig({ APP_ORIGIN: 'https://example.test/path' }), /origin/);
  assert.throws(() => readConfig({ NODE_ENV: 'production', APP_ORIGIN: 'https://example.test', BOOTSTRAP_ACCOUNTS: 'true' }), /BOOTSTRAP/);
  const f = await fixture(t, true), c = f.client();
  const response = await c.call('/api/login', 'POST', f.credentials[0]);
  assert.match(response.headers.get('set-cookie'), /Secure/);
  assert.match(response.headers.get('strict-transport-security'), /31536000/);
  await c.call('/api/admin/password', 'POST', { currentPassword: f.credentials[0].password, password: randomBytes(24).toString('base64url') });
  assert.equal((await c.call('/api/admin/exams', 'POST', { name: 'Peserta', role: 'umum' }, { Origin: 'http://other.test' })).status, 403);
  const invite = await c.call('/api/admin/exams', 'POST', { name: 'Peserta', email: 'peserta@example.test', role: 'umum' }, { Origin: f.config.origin });
  assert.equal(invite.status, 201);
  assert.equal(invite.data.publicOrigin, f.config.origin);
});

test('backup SQLite saat server aktif membawa jawaban WAL dan dapat dibuka kembali', async t => {
  const f = await fixture(t), c = await f.login(0);
  const invite = await c.call('/api/admin/exams', 'POST', { name: 'Peserta backup', email: 'backup@example.test', role: 'umum' });
  const participant = f.client();
  await participant.call('/api/exam/start', 'POST', { token: invite.data.invitationPath.split('/').at(-1), consent: true });
  await participant.call('/api/exam/answers', 'PATCH', { section: 'A', answers: { A1: '48' } });
  execFileSync(process.execPath, ['scripts/backup.js'], { cwd: new URL('..', import.meta.url), env: { ...process.env, DATA_DIR: f.dir, NODE_ENV: 'development', APP_ORIGIN: '', BOOTSTRAP_ACCOUNTS: 'false' }, stdio: 'pipe' });
  const files = readdirSync(join(f.dir, 'backups'));
  assert.equal(files.length, 1);
  const backup = new DatabaseSync(join(f.dir, 'backups', files[0]), { readOnly: true });
  try {
    assert.equal(backup.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    assert.equal(JSON.parse(backup.prepare('SELECT answers FROM exams WHERE id=?').get(invite.data.exam.id).answers).A1, '48');
    assert.equal(backup.prepare('SELECT count(*) AS count FROM users').get().count, 2);
  } finally { backup.close(); }
});

test('migrasi akun lama mempertahankan password dan sesi, serta menetapkan superadmin pertama', async t => {
  const f = await fixture(t), c = await f.login(0, false);
  const before = f.app.store.db.prepare('SELECT id,email,password FROM users ORDER BY created_at,rowid').all();
  for (const column of ['role','is_active','must_change_password']) f.app.store.db.exec(`ALTER TABLE users DROP COLUMN ${column}`);
  await f.restart();
  const after = f.app.store.db.prepare('SELECT * FROM users ORDER BY created_at,rowid').all();
  assert.deepEqual(after.map(user => ({id:user.id,email:user.email,password:user.password})), before.map(user => ({id:user.id,email:user.email,password:user.password})));
  assert.deepEqual(after.map(user => user.role), ['superadmin','admin']);
  assert.equal((await c.call('/api/admin/me')).data.user.role, 'superadmin');
  assert.equal((await c.call('/api/admin/exams')).status, 200);
});
