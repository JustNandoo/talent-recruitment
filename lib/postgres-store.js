import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { token, hash, passwordHash } from './store.js';
import { definitionFor, scoreForExam, reviewForExam, examMetadata } from './exams.js';
import { interviewSummary } from './scoring.js';

const { Pool, types } = pg;
types.setTypeParser(20, value => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Nilai database melampaui batas angka yang didukung.');
  return number;
});
const SCHEMA_LOCK = 87341001, USERS_LOCK = 87341002;
const context = new AsyncLocalStorage();

export function postgresConnection(config) {
  let url;
  try { url = new URL(config.databaseUrl); } catch { throw new Error('DATABASE_URL PostgreSQL tidak valid.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Gunakan connection string PostgreSQL dari Supabase.');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (config.databaseTls === false && (!loopback || config.production)) throw new Error('Database cloud/produksi wajib memakai TLS terverifikasi.');
  for (const parameter of ['sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(parameter);
  return { connectionString: url.toString(), ssl: config.databaseTls === false ? false : { rejectUnauthorized: true, ...(config.databaseCa ? { ca: config.databaseCa.replaceAll('\\n','\n') } : {}) }, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000, allowExitOnIdle: true };
}

// Keep positional SQL and field names compatible with the existing local SQLite backend.
function sqlForPostgres(sql, lock = false) {
  let index = 0;
  const transformed = sql.replace(/'([^']|'')*'|"([^"]|"")*"|\?|\b(?:rowid|users|exams|sessions|audit|exam_templates)\b/g, value => {
    if (value === '?') return `$${++index}`;
    if (value.startsWith("'") || value.startsWith('"')) return value;
    return value === 'rowid' ? 'sort_id' : `serviam.${value}`;
  });
  let statement = transformed;
  if (lock && /^SELECT \* FROM serviam\.(users|exams) WHERE /i.test(statement)) statement += ' FOR UPDATE';
  return statement;
}

export async function openPostgresStore(config, clock = Date.now) {
  const connection = postgresConnection(config);
  const pool = new Pool(connection), ratePool = new Pool({ ...connection, max: 1 });
  for (const instance of [pool, ratePool]) instance.on('error', error => console.error('Database connection interrupted:', error.code || 'CONNECTION_ERROR'));
  const query = (sql, args = []) => (context.getStore()?.client || pool).query(sql, args);
  const db = {
    prepare(sql) {
      return {
        async get(...args) { return (await query(sqlForPostgres(sql, Boolean(context.getStore())), args)).rows[0]; },
        async all(...args) { return (await query(sqlForPostgres(sql), args)).rows; },
        async run(...args) { const result = await query(sqlForPostgres(sql), args); return { changes: result.rowCount }; },
      };
    },
  };
  async function transaction(work, options = {}) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout='15000'");
      if (options.usersLock) await client.query('SELECT pg_advisory_xact_lock($1)', [USERS_LOCK]);
      const value = await context.run({ client }, work);
      await client.query(value?.status >= 400 ? 'ROLLBACK' : 'COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }
  async function audit(actor, action, examId = null) {
    await db.prepare('INSERT INTO audit(actor,action,exam_id,at) VALUES(?,?,?,?)').run(actor, action, examId, clock());
  }
  try {
    await transaction(async () => {
      await query('SELECT pg_advisory_xact_lock($1)', [SCHEMA_LOCK]);
      await query('CREATE SCHEMA IF NOT EXISTS serviam');
      await query('CREATE TABLE IF NOT EXISTS serviam.schema_versions (version INTEGER PRIMARY KEY, applied_at BIGINT NOT NULL)');
      const version = await query('SELECT version FROM serviam.schema_versions WHERE version=1');
      if (!version.rows.length) {
        await query(readFileSync(new URL('../db/supabase.sql', import.meta.url), 'utf8'));
        await query('INSERT INTO serviam.schema_versions VALUES(1,$1)', [clock()]);
      }
      const examTypesVersion = await query('SELECT version FROM serviam.schema_versions WHERE version=2');
      if (!examTypesVersion.rows.length) {
        await query(readFileSync(new URL('../db/exam-types.sql', import.meta.url), 'utf8'));
        await query('INSERT INTO serviam.schema_versions VALUES(2,$1)', [clock()]);
      }
      const customVersion = await query('SELECT version FROM serviam.schema_versions WHERE version=3');
      if (!customVersion.rows.length) {
        await query(readFileSync(new URL('../db/custom-exams.sql', import.meta.url), 'utf8'));
        await query('INSERT INTO serviam.schema_versions VALUES(3,$1)', [clock()]);
      }
      if (!(await db.prepare('SELECT count(*) AS count FROM users').get()).count) {
        const emails = [config.superadminEmail, config.adminEmail].map(email => email.trim().toLowerCase());
        const passwords = [config.superadminPassword, config.adminPassword];
        if (emails[0] === emails[1] || emails.some(email => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Email admin dan superadmin harus valid dan berbeda.');
        if (passwords.some(password => typeof password !== 'string' || password.trim().length < 12 || password.length > 128) || passwords[0] === passwords[1]) {
          const error = new Error('Isi SUPERADMIN_PASSWORD dan ADMIN_PASSWORD berbeda, minimal 12 karakter, pada environment Vercel.');
          error.code = 'INITIAL_PASSWORDS_REQUIRED';
          throw error;
        }
        for (let i = 0; i < 2; i++) {
          await db.prepare('INSERT INTO users(id,email,name,password,created_at,role,must_change_password) VALUES(?,?,?,?,?,?,1)').run(token(), emails[i], i === 0 ? 'Superadmin HRD Serviam' : 'Admin Penguji HRD Serviam', passwordHash(passwords[i]), clock(), i === 0 ? 'superadmin' : 'admin');
        }
        await audit('operator', 'initial_accounts_created');
      }
    });
  } catch (error) { await Promise.all([pool.end(), ratePool.end()]); throw error; }

  async function getSession(raw, kind) {
    if (!raw) return null;
    return await db.prepare('SELECT * FROM sessions WHERE token_hash=? AND kind=? AND expires_at>?').get(hash(raw), kind, clock()) || null;
  }
  async function createSession(kind, userId, examId, lifetime) {
    const raw = token();
    await db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(clock());
    await db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(hash(raw), kind, userId, examId, clock() + lifetime);
    return raw;
  }
  async function getExam(id) { return db.prepare('SELECT * FROM exams WHERE id=?').get(id); }
  async function completeExam(exam, reason = 'submitted', finishedAt = clock()) {
    const changed = await db.prepare("UPDATE exams SET status='completed',finished_at=?,finish_reason=?,result=? WHERE id=? AND status='active'").run(finishedAt, reason, JSON.stringify(scoreForExam(exam)), exam.id);
    if (changed.changes) await audit(`peserta:${exam.id}`, `exam_${reason}`, exam.id);
    return getExam(exam.id);
  }
  async function refreshExam(exam) {
    if (!exam || exam.status !== 'active') return exam;
    const SECTIONS = definitionFor(exam).sections;
    let index = exam.section_index, deadline = exam.section_deadline;
    while (clock() >= deadline) {
      index++;
      if (index >= SECTIONS.length) return completeExam(exam, 'timeout', deadline);
      deadline += SECTIONS[index].minutes * 60_000;
    }
    if (index !== exam.section_index) {
      await db.prepare("UPDATE exams SET section_index=?,section_deadline=? WHERE id=? AND status='active'").run(index, deadline, exam.id);
      return getExam(exam.id);
    }
    return exam;
  }
  function publicExam(exam) {
    return { ...examMetadata(exam), id: exam.id, name: exam.name, role: exam.role, status: exam.status, serverTime: clock(), startedAt: exam.started_at, finishedAt: exam.finished_at, sectionIndex: exam.section_index, deadline: exam.section_deadline, ...(exam.status === 'active' ? { answers: JSON.parse(exam.answers) } : {}) };
  }
  function adminExam(exam, detail = false) {
    const result = exam.result ? JSON.parse(exam.result) : null, interview = JSON.parse(exam.interview);
    return { ...examMetadata(exam), id: exam.id, name: exam.name, email: exam.email, role: exam.role, status: exam.status === 'pending' && clock() >= exam.expires_at ? 'expired' : exam.status, createdAt: exam.created_at, expiresAt: exam.expires_at, startedAt: exam.started_at, finishedAt: exam.finished_at, sectionIndex: exam.section_index, finishReason: exam.finish_reason, answered: Object.values(JSON.parse(exam.answers)).filter(value => value !== '' && value !== null).length, total: result?.total ?? null, percent: result?.percent ?? null, review: reviewForExam(result, interview), interviewSummary: interviewSummary(interview), decision: exam.decision, reviewedAt: exam.reviewed_at, ...(detail ? { result, interview, note: exam.note, consentAt: exam.consent_at, questionOrder: JSON.parse(exam.question_order) } : {}) };
  }
  async function rateLimit(key, maximum) {
    const now = clock();
    // Separate autocommit connection: failed logins must still consume the shared limit.
    const result = await ratePool.query(`INSERT INTO serviam.rate_limits(key,count,reset_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN serviam.rate_limits.reset_at<=$3 THEN 1 ELSE serviam.rate_limits.count+1 END,reset_at=CASE WHEN serviam.rate_limits.reset_at<=$3 THEN $2 ELSE serviam.rate_limits.reset_at END RETURNING count`, [key, now + 15 * 60_000, now]);
    await ratePool.query('DELETE FROM serviam.rate_limits WHERE reset_at<=$1', [now]);
    return result.rows[0].count <= maximum;
  }
  async function setupUser() { return { error: 'Akun cloud sudah disiapkan dari konfigurasi deployment.', status: 409 }; }
  return { kind: 'postgres', db, clock, audit, setupUser, getSession, createSession, getExam, completeExam, refreshExam, publicExam, adminExam, rateLimit, runRequest: (req, work) => transaction(work, { usersLock: !['GET','HEAD'].includes(req.method) && /^\/api\/(admin\/users|setup)/.test(req.url) }), close: () => Promise.all([pool.end(), ratePool.end()]) };
}
