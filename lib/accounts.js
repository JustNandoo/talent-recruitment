import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { passwordHash, token } from './store.js';

export function prepareAccounts(store, config) {
  if (store.db.prepare('SELECT COUNT(*) AS count FROM users').get().count > 0) return { created: false };
  const emails = [config.superadminEmail, config.adminEmail].map(value => value.trim().toLowerCase());
  if (emails[0] === emails[1] || emails.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw new Error('Email admin dan superadmin harus valid dan berbeda.');
  const path = join(config.dataDir, 'initial-accounts.txt');
  if (existsSync(path)) throw new Error('File akun awal sudah ada. Periksa file tersebut sebelum membuat ulang akun.');
  const accounts = ['superadmin', 'admin'].map((role, index) => ({ role, email: emails[index], name: role === 'superadmin' ? 'Superadmin HRD Serviam' : 'Admin Penguji HRD Serviam', password: randomBytes(24).toString('base64url') }));
  store.db.exec('BEGIN IMMEDIATE');
  try {
    for (const account of accounts) {
      store.db.prepare('INSERT INTO users(id,email,name,password,created_at,role,must_change_password) VALUES(?,?,?,?,?,?,1)').run(token(), account.email, account.name, passwordHash(account.password), store.clock(), account.role);
    }
    writeFileSync(path, 'AKUN AWAL HRD DIVISION PT SERVIAM GROUP SHIPYARD\nSimpan file ini secara pribadi. Kata sandi wajib diganti saat masuk.\n\n' + accounts.map(account => `Peran: ${account.role}\nEmail: ${account.email}\nKata sandi awal: ${account.password}\n`).join('\n'), { mode: 0o600, flag: 'wx' });
    store.db.exec('COMMIT');
    store.audit('operator', 'initial_accounts_created');
  } catch (error) {
    store.db.exec('ROLLBACK');
    throw error;
  }
  if (existsSync(store.bootstrapPath)) unlinkSync(store.bootstrapPath);
  return { created: true, credentialsPath: path };
}
