import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { openStore, hash, token, verifyPassword, passwordHash } from './lib/store.js';
import { SECTIONS, ROLES, SOURCE, INTERVIEWS, QUESTIONS } from './lib/bank.js';
import { createQuestionOrder, orderedPublicQuestions } from './lib/order.js';
import { validateAnswer } from './lib/scoring.js';
import { openBrowser } from './lib/browser.js';
import { loadEnvironment, readConfig } from './lib/config.js';
import { prepareAccounts } from './lib/accounts.js';
import { isIP } from 'node:net';

const root = dirname(fileURLToPath(import.meta.url));
const emailValid = email => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const textValid = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.length <= max;
const decisions = ['belum_diputuskan', 'lanjut', 'ditahan', 'tidak_lanjut'];
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const assert = (ok, status, message) => { if (!ok) throw new ApiError(status, message); };

function cookie(req, name) {
  const value = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return value?.slice(name.length + 1) || null;
}
async function readBody(req) {
  assert((req.headers['content-type'] || '').split(';')[0] === 'application/json', 415, 'Gunakan format JSON.');
  // Vercel's Node runtime may have already consumed and parsed the request stream.
  if (req.body !== undefined) {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString() : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    assert(Buffer.byteLength(raw) <= 65_536, 413, 'Data terlalu besar.');
    try { const data = JSON.parse(raw); assert(data && typeof data === 'object' && !Array.isArray(data), 400, 'Data tidak valid.'); return data; }
    catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, 'Format data tidak valid.'); }
  }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    assert(bytes <= 65_536, 413, 'Data terlalu besar.');
    chunks.push(chunk);
  }
  try { const data = JSON.parse(Buffer.concat(chunks).toString()); assert(data && typeof data === 'object' && !Array.isArray(data), 400, 'Data tidak valid.'); return data; }
  catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(400, 'Format data tidak valid.'); }
}
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createApp(options = {}) {
  const config = options.config || readConfig();
  const launchScript = readFileSync(join(root, 'public', 'index.html'), 'utf8').match(/<script id="launch-guard">([\s\S]*?)<\/script>/)?.[1];
  if (!launchScript) throw new Error('Skrip pembuka aplikasi tidak ditemukan.');
  const launchScriptHash = createHash('sha256').update(launchScript).digest('base64');
  const dataDir = options.dataDir || config.dataDir;
  const clock = options.clock || Date.now;
  const origin = options.origin || config.origin;
  const secure = options.secure ?? config.secure;
  const store = options.store || openStore(dataDir, clock);
  const { db } = store;
  const rateLimits = new Map();
  const dummyPassword = passwordHash(token());
  async function rateLimit(req, namespace, max) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').at(-1).trim();
    const remote = config.trustProxy && isIP(forwarded) ? forwarded : req.socket.remoteAddress;
    const key = `${namespace}:${remote}`;
    if (store.rateLimit) { assert(await store.rateLimit(key, max), 429, 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'); return; }
    const previous = rateLimits.get(key);
    const entry = previous && clock() < previous.until ? previous : { count: 0, until: clock() + 15 * 60_000 };
    entry.count++;
    rateLimits.set(key, entry);
    if (rateLimits.size > 1000) for (const [k, v] of rateLimits) if (v.until < clock()) rateLimits.delete(k);
    assert(entry.count <= max, 429, 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
  }
  function setCookie(res, name, value, maxAge) {
    res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
  }
  const userPayload = user => ({ id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: Boolean(user.must_change_password), active: Boolean(user.is_active) });
  async function admin(req, allowPasswordChange = false) {
    const session = (await store.getSession(cookie(req, 'talenta_admin'), 'admin'));
    assert(session, 401, 'Silakan masuk sebagai penguji.');
    const user = (await db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id));
    assert(user?.is_active, 401, 'Sesi tidak valid atau akun dinonaktifkan.');
    assert(allowPasswordChange || !user.must_change_password, 428, 'Ganti kata sandi awal sebelum mengakses dashboard.');
    return userPayload(user);
  }
  async function superadmin(req) {
    const user = await admin(req);
    assert(user.role === 'superadmin', 403, 'Fitur ini hanya tersedia untuk superadmin.');
    return user;
  }
  async function examSession(req) {
    const session = (await store.getSession(cookie(req, 'talenta_exam'), 'exam'));
    assert(session, 401, 'Sesi ujian tidak ditemukan. Gunakan tautan undangan Anda.');
    const exam = (await store.refreshExam((await store.getExam(session.exam_id))));
    assert(exam, 404, 'Ujian tidak ditemukan.');
    return exam;
  }
  function examPayload(exam) { return { exam: store.publicExam(exam), sections: SECTIONS, questions: exam.status === 'active' ? orderedPublicQuestions(SECTIONS[exam.section_index].id, JSON.parse(exam.question_order)) : [] }; }
  async function listExams() {
    const rows = await db.prepare('SELECT * FROM exams ORDER BY created_at DESC, rowid DESC').all();
    const exams = [];
    for (const row of rows) exams.push(store.adminExam(await store.refreshExam(await store.getExam(row.id))));
    return exams;
  }
  const handler = async (req, res) => {
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (config.production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' 'sha256-${launchScriptHash}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`);
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      const method = req.method;
      if (path.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(method)) {
          assert(req.headers['x-talenta-request'] === '1', 403, 'Permintaan tidak valid.');
          if (req.headers.origin) {
            const expected = origin || `${secure ? 'https' : 'http'}://${req.headers.host}`;
            assert(req.headers.origin === expected || config.allowedOrigins?.includes(req.headers.origin), 403, 'Origin tidak diizinkan.');
          }
        }
        if (path === '/api/health' && method === 'GET') return send(200, { ok: true, database: (await db.prepare('SELECT 1 as ok').get()).ok === 1 });
        if (path === '/api/ready' && method === 'GET') {
          const ready = Boolean((await db.prepare("SELECT id FROM users WHERE role='superadmin' AND is_active=1 AND must_change_password=0 LIMIT 1").get()));
          return send(ready ? 200 : 503, { ready, database: true, configured: Boolean((await db.prepare('SELECT id FROM users LIMIT 1').get())) });
        }
        if (path === '/api/status' && method === 'GET') return send(200, { configured: Boolean((await db.prepare('SELECT id FROM users LIMIT 1').get())), databaseEngine: store.kind || 'sqlite' });
        if (path === '/api/setup' && method === 'POST') {
          await rateLimit(req, 'setup', 10);
          const body = await readBody(req);
          assert(emailValid(body.email) && textValid(body.name, 2, 80) && textValid(body.password, 12, 128) && textValid(body.setupCode, 10, 100), 400, 'Lengkapi nama, email, kode penyiapan, dan kata sandi minimal 12 karakter.');
          const user = (await store.setupUser({ ...body, email: body.email.trim().toLowerCase(), name: body.name.trim() }));
          assert(!user.error, user.status || 400, user.error);
          setCookie(res, 'talenta_admin', (await store.createSession('admin', user.id, null, 12 * 3600_000)), 12 * 3600);
          return send(201, { user });
        }
        if (path === '/api/login' && method === 'POST') {
          await rateLimit(req, 'login', 10);
          const body = await readBody(req);
          assert(emailValid(body.email) && textValid(body.password, 1, 128), 400, 'Email atau kata sandi tidak valid.');
          const user = (await db.prepare('SELECT * FROM users WHERE email=?').get(body.email.trim().toLowerCase()));
          const matches = verifyPassword(body.password, user?.password || dummyPassword);
          assert(user?.is_active && matches, 401, 'Email atau kata sandi tidak sesuai.');
          setCookie(res, 'talenta_admin', (await store.createSession('admin', user.id, null, 12 * 3600_000)), 12 * 3600);
          (await store.audit(user.id, 'admin_login'));
          return send(200, { user: userPayload(user) });
        }
        if (path === '/api/logout' && method === 'POST') {
          const user = await admin(req, true);
          (await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(cookie(req, 'talenta_admin'))));
          setCookie(res, 'talenta_admin', '', 0);
          (await store.audit(user.id, 'admin_logout'));
          return send(200, { ok: true });
        }
        if (path === '/api/admin/me' && method === 'GET') return send(200, { user: await admin(req, true) });
        if (path === '/api/admin/password' && method === 'POST') {
          const user = await admin(req, true);
          await rateLimit(req, `password:${user.id}`, 10);
          const body = await readBody(req);
          assert(textValid(body.currentPassword, 1, 128) && textValid(body.password, 12, 128), 400, 'Kata sandi baru minimal 12 karakter.');
          const stored = (await db.prepare('SELECT password FROM users WHERE id=?').get(user.id));
          assert(verifyPassword(body.currentPassword, stored.password), 403, 'Kata sandi saat ini tidak sesuai.');
          assert(!verifyPassword(body.password, stored.password), 400, 'Gunakan kata sandi baru yang berbeda.');
          (await db.prepare('UPDATE users SET password=?,must_change_password=0 WHERE id=?').run(passwordHash(body.password), user.id));
          (await db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id));
          setCookie(res, 'talenta_admin', (await store.createSession('admin', user.id, null, 12 * 3600_000)), 12 * 3600);
          (await store.audit(user.id, 'password_changed'));
          return send(200, { ok: true });
        }
        if (path === '/api/admin/users' && method === 'GET') {
          await superadmin(req);
          return send(200, { users: (await db.prepare('SELECT * FROM users ORDER BY created_at,rowid').all()).map(userPayload) });
        }
        if (path === '/api/admin/users' && method === 'POST') {
          const actor = await superadmin(req), body = await readBody(req);
          assert(emailValid(body.email) && textValid(body.name, 2, 80) && textValid(body.password, 12, 128) && ['admin', 'superadmin'].includes(body.role), 400, 'Lengkapi nama, email, peran, dan kata sandi minimal 12 karakter.');
          const email = body.email.trim().toLowerCase();
          assert(!(await db.prepare('SELECT id FROM users WHERE email=?').get(email)), 409, 'Email sudah digunakan.');
          const id = token();
          (await db.prepare('INSERT INTO users(id,email,name,password,created_at,role,must_change_password) VALUES(?,?,?,?,?,?,1)').run(id, email, body.name.trim(), passwordHash(body.password), clock(), body.role));
          (await store.audit(actor.id, 'user_created'));
          return send(201, { user: userPayload((await db.prepare('SELECT * FROM users WHERE id=?').get(id))) });
        }
        const userMatch = path.match(/^\/api\/admin\/users\/([A-Za-z0-9_-]+)$/);
        if (userMatch && method === 'PATCH') {
          const actor = await superadmin(req), body = await readBody(req);
          const target = (await db.prepare('SELECT * FROM users WHERE id=?').get(userMatch[1]));
          assert(target, 404, 'Akun tidak ditemukan.');
          const role = body.role ?? target.role, active = body.active ?? Boolean(target.is_active);
          assert(['admin','superadmin'].includes(role) && typeof active === 'boolean', 400, 'Peran atau status tidak valid.');
          assert(!body.password || textValid(body.password, 12, 128), 400, 'Kata sandi minimal 12 karakter.');
          if (target.role === 'superadmin' && target.is_active && (role !== 'superadmin' || !active)) assert((await db.prepare("SELECT count(*) AS count FROM users WHERE role='superadmin' AND is_active=1").get()).count > 1, 409, 'Superadmin aktif terakhir tidak dapat dinonaktifkan atau diturunkan.');
          (await db.prepare('UPDATE users SET role=?,is_active=?,password=?,must_change_password=? WHERE id=?').run(role, Number(active), body.password ? passwordHash(body.password) : target.password, body.password ? 1 : target.must_change_password, target.id));
          (await db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id));
          (await store.audit(actor.id, body.password ? 'user_password_reset' : 'user_updated'));
          return send(200, { user: userPayload((await db.prepare('SELECT * FROM users WHERE id=?').get(target.id))) });
        }
        if (path === '/api/admin/audit' && method === 'GET') {
          await superadmin(req);
          return send(200, { audit: (await db.prepare('SELECT a.*,u.name AS actor_name FROM audit a LEFT JOIN users u ON u.id=a.actor ORDER BY a.id DESC LIMIT 200').all()) });
        }
        if (path === '/api/admin/system' && method === 'GET') {
          await superadmin(req);
          return send(200, { mode: config.production ? 'production' : 'development', publicOrigin: origin, secureCookies: secure, database: (await db.prepare('SELECT 1 AS ok').get()).ok === 1, databaseEngine: store.kind || 'sqlite', invitations: 'link', nodeVersion: process.versions.node });
        }
        if (path === '/api/admin/meta' && method === 'GET') { await admin(req); return send(200, { roles: ROLES, sections: SECTIONS, source: SOURCE, interviews: INTERVIEWS }); }
        if (path === '/api/admin/exams' && method === 'GET') { await admin(req); return send(200, { exams: await listExams() }); }
        if (path === '/api/admin/exams' && method === 'POST') {
          const user = await admin(req);
          const body = await readBody(req);
          assert(textValid(body.name, 2, 80) && (!body.email || emailValid(body.email)) && ROLES.some(r => r.id === body.role), 400, 'Nama, email, atau posisi tidak valid.');
          const rawToken = token();
          const id = token();
          const expiryDays = Number(body.expiryDays ?? 7);
          assert(Number.isInteger(expiryDays) && expiryDays >= 1 && expiryDays <= 30, 400, 'Masa berlaku harus 1–30 hari.');
          (await db.prepare('INSERT INTO exams(id,name,email,role,token_hash,created_at,expires_at,created_by,question_order) VALUES(?,?,?,?,?,?,?,?,?)').run(id, body.name.trim(), (body.email || '').trim().toLowerCase(), body.role, hash(rawToken), clock(), clock() + expiryDays * 86400_000, user.id, JSON.stringify(createQuestionOrder())));
          (await store.audit(user.id, 'invitation_created', id));
          return send(201, { exam: store.adminExam((await store.getExam(id))), invitationPath: `/ujian/${rawToken}`, ...(origin ? { publicOrigin: origin } : {}) });
        }
        if (path === '/api/admin/export' && method === 'GET') {
          await admin(req);
          const rows = [['Nama', 'Email', 'Posisi', 'Status', 'Skor A-D / 46', 'Persentase A-D', 'Tinjauan', 'Rata-rata wawancara', 'Keputusan penguji', 'Selesai pada']];
          (await listExams()).forEach(e => rows.push([e.name, e.email, ROLES.find(r => r.id === e.role)?.name, e.status, e.total, e.percent, e.review?.label, e.interviewSummary.average, e.decision, e.finishedAt ? new Date(e.finishedAt).toISOString() : '']));
          res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="hasil-rekrutmen.csv"' });
          return res.end('\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'));
        }
        if (path === '/api/admin/source' && method === 'GET') {
          await admin(req);
          const pdf = join(root, 'docs', 'bank-soal.pdf');
          assert(existsSync(pdf), 404, 'Dokumen sumber belum tersedia.');
          res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="Bank-Soal-Psikotes.pdf"' });
          return res.end(readFileSync(pdf));
        }
        const adminMatch = path.match(/^\/api\/admin\/exams\/([A-Za-z0-9_-]+)(\/rotate)?$/);
        if (adminMatch) {
          const user = await admin(req);
          const exam = (await store.refreshExam((await store.getExam(adminMatch[1]))));
          assert(exam, 404, 'Peserta tidak ditemukan.');
          if (method === 'GET' && !adminMatch[2]) return send(200, { exam: store.adminExam(exam, true) });
          if (method === 'POST' && adminMatch[2]) {
            assert(exam.status === 'pending', 409, 'Tautan peserta yang sudah mulai tidak dapat dibuat ulang.');
            const rawToken = token();
            (await db.prepare('UPDATE exams SET token_hash=?, expires_at=?, question_order=? WHERE id=?').run(hash(rawToken), clock() + 7 * 86400_000, JSON.stringify(createQuestionOrder()), exam.id));
            (await store.audit(user.id, 'invitation_rotated', exam.id));
            return send(200, { invitationPath: `/ujian/${rawToken}`, ...(origin ? { publicOrigin: origin } : {}) });
          }
          if (method === 'PATCH' && !adminMatch[2]) {
            assert(exam.status === 'completed', 409, 'Penilaian wawancara tersedia setelah ujian selesai.');
            const body = await readBody(req);
            const interview = body.interview ?? JSON.parse(exam.interview);
            assert(interview && typeof interview === 'object' && !Array.isArray(interview), 400, 'Wawancara tidak valid.');
            const clean = {};
            for (const [id, entry] of Object.entries(interview)) {
              assert(INTERVIEWS.some(q => q.id === id) && entry && typeof entry === 'object' && (entry.score === null || Number.isInteger(entry.score) && entry.score >= 1 && entry.score <= 5) && typeof entry.note === 'string' && entry.note.length <= 4000, 400, 'Nilai wawancara harus 1–5; catatan maksimal 4.000 karakter.');
              clean[id] = { score: entry.score, note: entry.note };
            }
            const note = body.note ?? exam.note;
            const decision = body.decision ?? exam.decision;
            assert(typeof note === 'string' && note.length <= 6000 && decisions.includes(decision), 400, 'Catatan atau keputusan tidak valid.');
            (await db.prepare('UPDATE exams SET interview=?,note=?,decision=?,reviewed_at=? WHERE id=?').run(JSON.stringify(clean), note, decision, clock(), exam.id));
            (await store.audit(user.id, 'assessment_saved', exam.id));
            return send(200, { exam: store.adminExam((await store.getExam(exam.id)), true) });
          }
          if (method === 'DELETE' && !adminMatch[2]) {
            assert(exam.status !== 'active', 409, 'Peserta sedang ujian. Tunggu hingga selesai sebelum menghapus.');
            (await db.prepare('DELETE FROM exams WHERE id=?').run(exam.id));
            (await store.audit(user.id, 'participant_deleted', exam.id));
            return send(200, { ok: true });
          }
        }
        const invitationMatch = path.match(/^\/api\/invitations\/([A-Za-z0-9_-]+)$/);
        if (invitationMatch && method === 'GET') {
          const exam = (await store.refreshExam((await db.prepare('SELECT * FROM exams WHERE token_hash=?').get(hash(invitationMatch[1])))));
          assert(exam, 404, 'Tautan ujian tidak ditemukan atau sudah diganti.');
          const ownSession = (await store.getSession(cookie(req, 'talenta_exam'), 'exam'));
          if (exam.status !== 'pending') {
            assert(ownSession?.exam_id === exam.id, 410, 'Tautan ini sudah digunakan. Setiap peserta hanya memiliki satu kesempatan ujian.');
            return send(200, { ...examPayload(exam), resume: true });
          }
          assert(clock() < exam.expires_at, 410, 'Masa berlaku tautan sudah habis. Hubungi penguji.');
          return send(200, { invitation: { name: exam.name, role: ROLES.find(r => r.id === exam.role)?.name, expiresAt: exam.expires_at }, sections: SECTIONS });
        }
        if (path === '/api/exam/start' && method === 'POST') {
          await rateLimit(req, 'start', 60);
          const body = await readBody(req);
          assert(textValid(body.token, 30, 100) && body.consent === true, 400, 'Setujui instruksi dan pengolahan hasil tes sebelum mulai.');
          const exam = (await db.prepare('SELECT * FROM exams WHERE token_hash=?').get(hash(body.token)));
          assert(exam, 404, 'Undangan tidak ditemukan.');
          assert(exam.status === 'pending', 410, 'Tautan sudah digunakan. Ujian tidak dapat diulang.');
          assert(clock() < exam.expires_at, 410, 'Masa berlaku tautan sudah habis.');
          const old = (await store.getSession(cookie(req, 'talenta_exam'), 'exam'));
          if (old) assert((await store.refreshExam((await store.getExam(old.exam_id))))?.status !== 'active', 409, 'Selesaikan ujian yang sedang aktif di browser ini terlebih dahulu.');
          const now = clock();
          const changed = (await db.prepare("UPDATE exams SET status='active',started_at=?,section_deadline=?,consent_at=? WHERE id=? AND status='pending'").run(now, now + SECTIONS[0].minutes * 60_000, now, exam.id));
          assert(changed.changes === 1, 410, 'Tautan sudah digunakan.');
          setCookie(res, 'talenta_exam', (await store.createSession('exam', null, exam.id, 3 * 3600_000)), 3 * 3600);
          (await store.audit(`peserta:${exam.id}`, 'exam_started', exam.id));
          return send(201, examPayload((await store.getExam(exam.id))));
        }
        if (path === '/api/exam' && method === 'GET') return send(200, examPayload(await examSession(req)));
        if (path === '/api/exam/answers' && method === 'PATCH') {
          const body = await readBody(req);
          const exam = await examSession(req);
          assert(exam.status === 'active', 410, 'Ujian sudah selesai; jawaban tidak dapat diubah.');
          assert(body.section === SECTIONS[exam.section_index].id, 409, 'Waktu bagian ini sudah berakhir. Jawaban terakhir yang tersimpan digunakan.');
          assert(body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) && Object.keys(body.answers).length <= 14, 400, 'Jawaban tidak valid.');
          const answers = JSON.parse(exam.answers);
          for (const [id, value] of Object.entries(body.answers)) {
            const question = QUESTIONS.find(q => q.id === id && q.section === body.section);
            assert(question && validateAnswer(question, value), 400, 'Pilihan jawaban tidak valid.');
            if (value === '' || value === null) delete answers[id]; else answers[id] = value;
          }
          (await db.prepare('UPDATE exams SET answers=? WHERE id=?').run(JSON.stringify(answers), exam.id));
          return send(200, { saved: true, serverTime: clock() });
        }
        if (path === '/api/exam/next' && method === 'POST') {
          const body = await readBody(req);
          const exam = await examSession(req);
          assert(exam.status === 'active', 410, 'Ujian sudah selesai.');
          assert(body.section === SECTIONS[exam.section_index].id, 409, 'Bagian ujian sudah berganti.');
          if (exam.section_index === SECTIONS.length - 1) return send(200, examPayload((await store.completeExam(exam))));
          const nextIndex = exam.section_index + 1;
          (await db.prepare('UPDATE exams SET section_index=?,section_deadline=? WHERE id=?').run(nextIndex, clock() + SECTIONS[nextIndex].minutes * 60_000, exam.id));
          return send(200, examPayload((await store.getExam(exam.id))));
        }
        throw new ApiError(404, 'Halaman API tidak ditemukan.');
      }
      assert(method === 'GET' || method === 'HEAD', 405, 'Metode tidak diizinkan.');
      if (path === '/index.html' || path === '/public/index.html') {
        res.writeHead(302, { Location: '/' });
        return res.end();
      }
      const assets = { '/app.js': 'app.js', '/style.css': 'style.css', '/favicon.svg': 'favicon.svg', '/serviam-logo.svg': 'serviam-logo.svg' };
      const asset = assets[path];
      const isPage = path === '/' || path === '/setup' || path === '/penguji' || /^\/penguji\/hasil\/[A-Za-z0-9_-]+$/.test(path) || /^\/ujian(?:\/[A-Za-z0-9_-]+)?$/.test(path);
      assert(asset || isPage, 404, 'Halaman tidak ditemukan.');
      const file = asset || 'index.html';
      const extension = file.slice(file.lastIndexOf('.'));
      res.writeHead(200, { 'Content-Type': mime[extension] });
      res.end(method === 'HEAD' ? '' : readFileSync(join(root, 'public', file)));
    } catch (error) {
      if (!res.headersSent) send(error.status || 500, { error: error.status ? error.message : 'Terjadi kesalahan server. Silakan coba lagi.' });
      else res.end();
      if (!error.status) console.error('Server error:', store.kind === 'postgres' ? error.code || 'SERVER_ERROR' : error.message);
    }
  };
  const requestHandler = !store.runRequest ? handler : async (req, res) => {
    if (!req.url.startsWith('/api/')) return handler(req, res);
    const reply = { status: 200, headers: new Map(), body: '', headersSent: false,
      setHeader(name, value) { this.headers.set(name, value); },
      writeHead(status, headers = {}) { this.status = status; for (const [name, value] of Object.entries(headers)) this.headers.set(name, value); },
      end(body = '') { this.body = body; this.headersSent = true; },
    };
    try {
      await store.runRequest(req, async () => { await handler(req, reply); return reply; });
      for (const [name, value] of reply.headers) res.setHeader(name, value);
      res.writeHead(reply.status); res.end(reply.body);
    } catch (error) {
      console.error('Database request failed:', error.code || 'DATABASE_REQUEST_ERROR');
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'Database sementara tidak tersedia. Coba lagi; jawaban yang telah tersimpan tetap aman.' }));
    }
  };
  const server = http.createServer(requestHandler);
  server.requestTimeout = 30_000;
  server.headersTimeout = 66_000;
  server.keepAliveTimeout = 65_000;
  server.maxHeadersCount = 100;
  return { server, store, config, handler: requestHandler };
}

export async function createConfiguredApp(options = {}) {
  const config = options.config || readConfig();
  if (!config.databaseUrl) return createApp({ ...options, config });
  const { openPostgresStore } = await import('./lib/postgres-store.js');
  const store = await openPostgresStore(config, options.clock);
  return createApp({ ...options, config, store });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  loadEnvironment();
  const config = readConfig(), port = config.port;
  const { server, store } = await createConfiguredApp({ config });
  if (config.bootstrap && !config.databaseUrl) {
    const accounts = prepareAccounts(store, config);
    if (accounts.created) console.log('Akun admin dan superadmin dibuat. Buka .data/initial-accounts.txt di laptop/server Anda; kata sandi awal wajib diganti saat masuk.');
  }
  server.on('error', async error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} sudah digunakan. Jika aplikasi ujian HRD sudah berjalan, gunakan alamat web yang tercetak pada terminal server tersebut. Tutup proses aplikasi sebelumnya untuk menjalankan versi yang baru, atau pilih PORT lain.`);
    } else console.error('Server gagal dijalankan:', error.message);
    await store.close();
    process.exit(1);
  });
  server.listen(port, config.host, () => {
    const actualPort = server.address().port;
    const localUrl = `http://localhost:${actualPort}/`;
    const browserUrl = config.production ? config.origin : localUrl;
    console.log(`Asesmen HRD Division PT Serviam Group Shipyard siap. Alamat web: ${browserUrl}`);
    console.log('Biarkan terminal tetap terbuka. Buka alamat web tersebut di browser; file HTML lokal kini diarahkan ke server pada port 3000.');
    if (store.bootstrapPath && existsSync(store.bootstrapPath)) console.log('Akun penguji belum dibuat. Jalankan npm run admin:setup atau gunakan kode lokal di .data/bootstrap-token pada halaman penyiapan.');
    const autoOpen = process.env.TALENTA_OPEN_BROWSER;
    if (autoOpen === 'true' || autoOpen !== 'false' && (process.platform === 'win32' || process.platform === 'darwin' || process.env.DISPLAY || process.env.WAYLAND_DISPLAY)) openBrowser(browserUrl);
  });
  function shutdown() { server.close(async () => { await store.close(); process.exit(0); }); }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
