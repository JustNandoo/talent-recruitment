import { createInterface } from 'node:readline/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stdin, stdout } from 'node:process';
import { loadEnvironment, readConfig } from '../lib/config.js';

loadEnvironment();
const config = readConfig();
if (config.databaseUrl) { console.error('Database aktif Supabase: gunakan npm run setup:supabase, kemudian masuk di /penguji.'); process.exit(1); }

if (!stdin.isTTY) { console.error('Jalankan penyiapan akun dari terminal interaktif. Kata sandi tidak akan ditampilkan.'); process.exit(1); }
const readline = createInterface({ input: stdin, output: stdout });
const name = await readline.question('Nama penguji: ');
const email = await readline.question('Email penguji: ');
readline.close();
function hiddenPassword(label) {
  return new Promise(resolve => {
    stdout.write(label);
    stdin.setRawMode(true); stdin.resume();
    let value = '';
    const onData = chunk => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') { stdin.setRawMode(false); process.exit(130); }
        if (char === '\r' || char === '\n') {
          stdin.off('data', onData); stdin.setRawMode(false); stdin.pause(); stdout.write('\n'); return resolve(value);
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    stdin.on('data', onData);
  });
}
const password = await hiddenPassword('Kata sandi (minimal 12 karakter): ');
const confirm = await hiddenPassword('Ulangi kata sandi: ');
if (password !== confirm) { console.error('Kata sandi tidak sama.'); process.exit(1); }
try {
  const setupCode = readFileSync(join(config.dataDir, 'bootstrap-token'), 'utf8').trim();
  const response = await fetch(`http://127.0.0.1:${config.port}/api/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Talenta-Request': '1' }, body: JSON.stringify({ name, email, password, setupCode }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  console.log('Akun penguji berhasil dibuat. Masuk melalui aplikasi menggunakan email dan kata sandi Anda.');
} catch (error) { console.error('Penyiapan gagal:', error.message); process.exit(1); }
