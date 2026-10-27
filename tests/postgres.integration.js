import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import pg from 'pg';
import { readConfig } from '../lib/config.js';
import { postgresConnection, openPostgresStore } from '../lib/postgres-store.js';
import { createConfiguredApp } from '../server.js';
import { createVercelHandler } from '../api/handler.js';
import { verifyPassword } from '../lib/store.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL wajib menunjuk database PostgreSQL lokal khusus tes bernama serviam_test.');
const target = new URL(databaseUrl);
if (!['localhost','127.0.0.1','[::1]'].includes(target.hostname) || !/^\/serviam_test(?:_[a-z0-9]+)?$/.test(target.pathname)) throw new Error('Pengujian hanya boleh memakai database lokal serviam_test; jangan gunakan database peserta.');
const password = () => randomBytes(24).toString('base64url');
const answers = {
  A: { A1:'48', A2:'37', A3:'13', A4:'25', A5:'u', A6:'13', A7:'B', A8:'C', A9:'B', A10:'citra' },
  B: { B1:'15', B2:'2.264.400', B3:'9', B4:'25%', B5:'18', B6:'50', B7:'58,5 juta', B8:'90' },
  C: { C1:'B', C2:'A', C3:'C', C4:'B', C5:'C', C6:'C', C7:'C', C8:'C', C9:'A', C10:'B' },
  D: { D1:'C', D2:'B', D3:'B', D4:'D', D5:'B', D6:'B' },
  E: { E1:5, E2:1, E3:5, E4:1, E5:5, E6:1, E7:5, E8:1, E9:5, E10:5, E11:1, E12:5, E13:2, E14:2 },
};

test('PostgreSQL dan handler Vercel: migrasi, banyak instance, ujian, akses, serta pemulihan', async t => {
  const config = readConfig({ DATABASE_URL: databaseUrl, DATABASE_TLS:'false', TRUST_PROXY:'true', DATA_DIR:'/tmp/serviam-test-must-not-create', SUPERADMIN_PASSWORD:password(), ADMIN_PASSWORD:password() });
  const pool = new pg.Pool(postgresConnection(config));
  let now = Date.now();
  const clock = () => now;
  const applications = [], servers = [], urls = [];
  let vercel;
  t.after(async () => {
    await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
    await Promise.all(applications.map(app => app.store.close()));
    if (vercel) await vercel.close();
    await pool.query('DROP SCHEMA IF EXISTS serviam CASCADE');
    await pool.end();
  });
  await pool.query('DROP SCHEMA IF EXISTS serviam CASCADE');
  await pool.query("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$");
  await t.test('inisialisasi tanpa sandi dibatalkan sepenuhnya; dua cold start membuat tepat dua akun', async () => {
    await assert.rejects(openPostgresStore({ ...config, superadminPassword:undefined }), error => error.code === 'INITIAL_PASSWORDS_REQUIRED');
    assert.equal((await pool.query("SELECT count(*) FROM pg_namespace WHERE nspname='serviam'")).rows[0].count, 0);
    applications.push(...await Promise.all([createConfiguredApp({ config, clock, secure:true }), createConfiguredApp({ config, clock, secure:true })]));
    for (const app of applications) { await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve)); servers.push(app.server); urls.push(`http://127.0.0.1:${app.server.address().port}`); }
    assert.equal((await pool.query('SELECT count(*) FROM serviam.users')).rows[0].count, 2);
    const users = (await pool.query('SELECT * FROM serviam.users ORDER BY sort_id')).rows;
    assert.deepEqual(users.map(user => user.role), ['superadmin','admin']);
    assert.equal(users[0].must_change_password, 1); assert.notEqual(users[0].password, config.superadminPassword);
    assert.equal(verifyPassword(config.superadminPassword, users[0].password), true);
    assert.equal(existsSync(config.dataDir), false);
  });
  let ipIndex = 1;
  function client(worker = 0, initialCookie = '', ip = `198.51.100.${ipIndex++}`) {
    let cookie = initialCookie;
    return { get cookie() { return cookie; }, async call(path, method='GET', body, headers={}) {
      const response = await fetch(urls[worker] + path, { method, headers:{ 'Content-Type':'application/json', 'X-Talenta-Request':'1', 'X-Forwarded-For':ip, ...(cookie ? {Cookie:cookie} : {}), ...headers }, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      const data = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : await response.text();
      return { status:response.status, data, headers:response.headers };
    }};
  }
  const superuser = client(0), admin = client(1);
  const changedSuperPassword = password(), changedAdminPassword = password();
  await t.test('akun awal wajib mengganti sandi; sesi, cookie Secure, serta akses admin dibatasi', async () => {
    assert.equal((await superuser.call('/api/login','POST',{ email:config.superadminEmail, password:config.superadminPassword })).status, 200);
    assert.equal((await superuser.call('/api/admin/exams')).status, 428);
    assert.equal((await client().call('/api/ready')).status, 503);
    const change = await superuser.call('/api/admin/password','POST',{ currentPassword:config.superadminPassword, password:changedSuperPassword });
    assert.equal(change.status, 200); assert.match(change.headers.get('set-cookie'), /HttpOnly; SameSite=Strict;.*Secure/);
    assert.equal((await client(1,superuser.cookie).call('/api/ready')).status, 200);
    assert.equal((await admin.call('/api/login','POST',{ email:config.adminEmail, password:config.adminPassword })).status, 200);
    assert.equal((await admin.call('/api/admin/password','POST',{ currentPassword:config.adminPassword, password:changedAdminPassword })).status, 200);
    for (const route of ['/api/admin/users','/api/admin/system','/api/admin/audit']) assert.equal((await admin.call(route)).status, 403);
    assert.equal((await client().call('/api/admin/source')).status, 401);
  });
  async function invite(name='Peserta Supabase') {
    const response = await admin.call('/api/admin/exams','POST',{ name, email:'postgres@example.test', role:'administrasi' }); assert.equal(response.status, 201);
    return { ...response.data, token:response.data.invitationPath.split('/').at(-1) };
  }
  let invitation, participant, order;
  await t.test('dua instance memulai link bersamaan: satu menang; jawaban paralel tidak hilang', async () => {
    invitation = await invite();
    const a=client(0), b=client(1);
    const started = await Promise.all([a.call('/api/exam/start','POST',{token:invitation.token,consent:true}),b.call('/api/exam/start','POST',{token:invitation.token,consent:true})]);
    assert.deepEqual(started.map(response => response.status).sort(), [201,410]);
    participant = started[0].status === 201 ? a : b;
    const parallel = client(1,participant.cookie);
    const saves = await Promise.all([participant.call('/api/exam/answers','PATCH',{section:'A',answers:{A1:'48'}}),parallel.call('/api/exam/answers','PATCH',{section:'A',answers:{A2:'37'}})]);
    assert.deepEqual(saves.map(response => response.status), [200,200]);
    const exam = await parallel.call('/api/exam');
    assert.equal(exam.data.exam.answers.A1,'48'); assert.equal(exam.data.exam.answers.A2,'37');
    order = JSON.parse((await applications[0].store.getExam(invitation.exam.id)).question_order);
    assert.deepEqual(exam.data.questions.map(question=>question.id), order.A);
    const other = await invite(); assert.notDeepEqual(JSON.parse((await applications[1].store.getExam(other.exam.id)).question_order), order);
  });
  await t.test('ujian 48 soal menghasilkan skor 46; analisis, wawancara, ekspor, dan larangan ulang berfungsi', async () => {
    for (const section of ['A','B','C','D','E']) {
      const current = await participant.call('/api/exam'); assert.deepEqual(current.data.questions.map(q=>q.id), order[section]);
      assert.equal('analysis' in current.data.questions[0], false);
      assert.equal((await participant.call('/api/exam/answers','PATCH',{section,answers:answers[section]})).status, 200);
      assert.equal((await participant.call('/api/exam/next','POST',{section})).status, 200);
    }
    const result = await admin.call(`/api/admin/exams/${invitation.exam.id}`);
    assert.equal(result.data.exam.result.total, 46); assert.equal(result.data.exam.review.label,'Siap diwawancarai');
    const interview = Object.fromEntries([1,2,3,4,5,6].map(index=>[`F${index}`,{score:4,note:'Situasi, tugas, aksi, hasil.'}]));
    const assessment = await admin.call(`/api/admin/exams/${invitation.exam.id}`,'PATCH',{interview,decision:'lanjut',note:'Hasil penguji'});
    assert.equal(assessment.data.exam.interviewSummary.average,4);
    const completed = await participant.call('/api/exam'); assert.equal(completed.data.exam.status,'completed'); assert.equal('result' in completed.data.exam,false);
    assert.equal((await client(1).call('/api/exam/start','POST',{token:invitation.token,consent:true})).status,410);
    assert.equal((await participant.call('/api/exam/answers','PATCH',{section:'E',answers:{E1:1}})).status,410);
    const csv = await admin.call('/api/admin/export'); assert.equal(csv.status,200); assert.match(csv.data,/"46"/);
    assert.equal((await admin.call('/api/admin/source')).status,200);
  });
  await t.test('handler Vercel memakai body yang sudah diparse; cold start tidak mereset akun atau hasil', async () => {
    vercel = createVercelHandler({config:{...config,superadminPassword:undefined,adminPassword:undefined},clock,secure:true});
    const server = http.createServer(async(req,res)=>{
      if (req.method !== 'GET') { const chunks=[]; for await(const chunk of req) chunks.push(chunk); req.body=JSON.parse(Buffer.concat(chunks)); }
      await vercel(req,res);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); servers.push(server); urls.push(`http://127.0.0.1:${server.address().port}`);
    const cold=client(2);
    assert.equal((await cold.call('/api/login','POST',{email:config.superadminEmail,password:config.superadminPassword})).status,401);
    assert.equal((await cold.call('/api/login','POST',{email:config.superadminEmail,password:changedSuperPassword})).status,200);
    assert.equal((await cold.call(`/api/admin/exams/${invitation.exam.id}`)).data.exam.result.total,46);
    assert.equal((await cold.call('/')).status,200); assert.equal((await cold.call('/style.css')).status,200); assert.equal((await cold.call('/serviam-logo.svg')).status,200);
    assert.equal((await cold.call('/docs/bank-soal.pdf')).status,404); assert.equal((await cold.call('/.env')).status,404);
    assert.equal((await cold.call('/api/admin/system')).data.databaseEngine,'postgres');
    assert.equal(existsSync(config.dataDir),false);
  });
  await t.test('rate limit dibagi antar instance, termasuk transaksi login yang dibatalkan', async () => {
    const a=client(0,'','203.0.113.88'), b=client(1,'','203.0.113.88');
    for(let index=0;index<10;index++) assert.equal((await (index%2?a:b).call('/api/login','POST',{email:config.adminEmail,password:'salah'})).status,401);
    assert.equal((await a.call('/api/login','POST',{email:config.adminEmail,password:changedAdminPassword})).status,429);
    now+=15*60_000;
    assert.equal((await b.call('/api/login','POST',{email:config.adminEmail,password:changedAdminPassword})).status,200);
  });
  await t.test('timer offline, rotasi link, CSRF, rollback jawaban salah, dan penghapusan data', async () => {
    const pending=await invite('Tautan baru');
    assert.equal((await admin.call('/api/admin/exams','POST',{name:'CSRF',role:'umum'},{Origin:'https://asing.example'})).status,403);
    const rotated=await admin.call(`/api/admin/exams/${pending.exam.id}/rotate`,'POST',{}); assert.equal(rotated.status,200);
    assert.equal((await client(1).call('/api/invitations/'+pending.token)).status,404);
    const p=client(1); assert.equal((await p.call('/api/exam/start','POST',{token:rotated.data.invitationPath.split('/').at(-1),consent:true})).status,201);
    assert.equal((await p.call('/api/exam/answers','PATCH',{section:'A',answers:{A1:'48',B1:'15'}})).status,400);
    assert.deepEqual((await p.call('/api/exam')).data.exam.answers,{});
    await p.call('/api/exam/answers','PATCH',{section:'A',answers:{A1:'48'}});
    now+=65*60_000;
    const timedOut=await admin.call(`/api/admin/exams/${pending.exam.id}`); assert.equal(timedOut.data.exam.finishReason,'timeout'); assert.equal(timedOut.data.exam.result.total,1);
    assert.equal((await p.call('/api/exam/next','POST',{section:'E'})).status,410);
    assert.equal((await admin.call(`/api/admin/exams/${pending.exam.id}`,'DELETE')).status,200);
    assert.equal((await p.call('/api/exam')).status,401);
  });
  await t.test('pengelolaan akun dan dua penurunan superadmin paralel menyisakan satu superadmin aktif', async () => {
    const newPassword=password(), email='second@example.test';
    const created=await superuser.call('/api/admin/users','POST',{name:'Superadmin Dua',email,role:'superadmin',password:newPassword}); assert.equal(created.status,201);
    const second=client(1); await second.call('/api/login','POST',{email,password:newPassword}); await second.call('/api/admin/password','POST',{currentPassword:newPassword,password:password()});
    const users=(await superuser.call('/api/admin/users')).data.users;
    const firstId=users.find(user=>user.email===config.superadminEmail).id, secondId=created.data.user.id;
    const changed=await Promise.all([superuser.call(`/api/admin/users/${firstId}`,'PATCH',{role:'admin'}),second.call(`/api/admin/users/${secondId}`,'PATCH',{role:'admin'})]);
    assert.deepEqual(changed.map(response=>response.status).sort(),[200,409]);
    assert.equal((await pool.query("SELECT count(*) FROM serviam.users WHERE role='superadmin' AND is_active=1")).rows[0].count,1);
  });
  await t.test('upgrade database versi 1 menambah jenis Serviam tanpa mengubah hasil dan akun', async () => {
    const original=(await pool.query('SELECT * FROM serviam.exams WHERE id=$1',[invitation.exam.id])).rows[0];
    const usersBefore=(await pool.query('SELECT id,password FROM serviam.users ORDER BY sort_id')).rows;
    await pool.query('ALTER TABLE serviam.exams DROP COLUMN exam_type');
    await pool.query('DELETE FROM serviam.schema_versions WHERE version=2');
    const upgraded=await createConfiguredApp({config:{...config,superadminPassword:undefined,adminPassword:undefined},clock});applications.push(upgraded);
    const restored=await upgraded.store.getExam(invitation.exam.id);
    assert.equal(restored.exam_type,'serviam');
    for(const key of ['answers','result','question_order','status','started_at','finished_at']) assert.equal(restored[key],original[key]);
    assert.deepEqual((await pool.query('SELECT id,password FROM serviam.users ORDER BY sort_id')).rows,usersBefore);
    assert.equal(upgraded.store.adminExam(restored).total,46);
  });
  await t.test('migrasi jenis ujian menjaga Serviam; Indo Artha dua instance, 82 jawaban dan jeda', async () => {
    assert.equal((await pool.query('SELECT exam_type FROM serviam.exams WHERE id=$1',[invitation.exam.id])).rows[0].exam_type,'serviam');
    assert.equal((await pool.query('SELECT version FROM serviam.schema_versions WHERE version=2')).rows.length,1);
    const {M1_ITEMS,M2_ITEMS,M3_ITEMS} = await import('../lib/indo-artha/bank.js');
    const invited=await admin.call('/api/admin/exams','POST',{name:'Peserta Indo Artha Postgres',email:'indo-postgres@example.test',examType:'indo-artha',role:'keu-staf'});assert.equal(invited.status,201);
    const p=client(0), started=await p.call('/api/exam/start','POST',{token:invited.data.invitationPath.split('/').at(-1),consent:true});assert.equal(started.status,201);assert.equal(started.data.questions.length,30);
    const parallel=client(1,p.cookie);
    const saves=await Promise.all([p.call('/api/exam/answers','PATCH',{section:'M1',answers:{'M1-1':'D'}}),parallel.call('/api/exam/answers','PATCH',{section:'M1',answers:{'M1-2':'A'}})]);assert.deepEqual(saves.map(x=>x.status),[200,200]);
    assert.equal((await p.call('/api/exam')).data.exam.answers['M1-2'],'A');
    for(const [section,items] of [['M1',M1_ITEMS],['M3',M3_ITEMS]]) {
      const answers=Object.fromEntries(items.map(q=>[q.id,section==='M1'?q.key:Object.keys(q.key).find(k=>q.key[k].points===3)]));
      assert.equal((await parallel.call('/api/exam/answers','PATCH',{section,answers})).status,200);
      assert.equal((await p.call('/api/exam/next','POST',{section})).status,200);
    }
    assert.equal((await p.call('/api/exam/next','POST',{section:'JEDA'})).status,409);
    now+=10*60_000;
    assert.equal((await parallel.call('/api/exam')).data.questions.length,40);
    const gaya=Object.fromEntries(M2_ITEMS.map(q=>[q.id,3]));
    assert.equal((await p.call('/api/exam/answers','PATCH',{section:'M2',answers:gaya})).status,200);
    assert.equal((await parallel.call('/api/exam/next','POST',{section:'M2'})).data.exam.status,'completed');
    const result=await admin.call(`/api/admin/exams/${invited.data.exam.id}`);assert.equal(result.status,200);assert.equal(result.data.exam.result.total,66);assert.equal(result.data.exam.answered,82);assert.equal(result.data.exam.result.analysis.m2.validity.sv,15);
    assert.equal((await admin.call(`/api/admin/exams/${invited.data.exam.id}`,'PATCH',{note:'Bukti wawancara',decision:'ditahan',interview:{}})).status,200);
  });
  await t.test('jabatan buatan sendiri tersimpan dengan acuan penilaian pada PostgreSQL', async () => {
    assert.equal((await pool.query('SELECT version FROM serviam.schema_versions WHERE version=5')).rows.length,1);
    const body={name:'Peserta Analis',email:'analis@example.test',examType:'indo-artha',role:'keu-staf',positionName:'Analis Piutang'};
    const invited=await admin.call('/api/admin/exams','POST',body);
    assert.equal(invited.status,201);
    assert.equal(invited.data.exam.roleName,'Analis Piutang');
    assert.equal(invited.data.exam.scoringRoleName,'Staf Keuangan / Akuntansi');
    const saved=(await pool.query('SELECT role,position_name FROM serviam.exams WHERE id=$1',[invited.data.exam.id])).rows[0];
    assert.deepEqual(saved,{role:'keu-staf',position_name:'Analis Piutang'});
    const exam=await client().call('/api/invitations/'+invited.data.invitationPath.split('/').at(-1));
    assert.equal(exam.data.invitation.role,'Analis Piutang');
  });
  await t.test('ujian custom dan sumber tersimpan lintas instance dengan snapshot kunci', async () => {
    const body={name:'Ujian Custom Postgres',company:'Perusahaan Tes',roles:['Staf'],sections:[{name:'Pengetahuan',minutes:5,questions:[{kind:'choice',prompt:'Jawaban yang benar?',options:['Salah','Benar'],key:'B',points:2}]}],sources:[{name:'sumber.txt',data:Buffer.from('Referensi private test.').toString('base64')}]};
    const made=await admin.call('/api/admin/templates','POST',body);assert.equal(made.status,201);const type=made.data.exam.id;
    assert.equal((await pool.query('SELECT version FROM serviam.schema_versions WHERE version=3')).rows.length,1);
    assert.equal((await client(1,admin.cookie).call('/api/admin/meta')).data.exams.some(e=>e.id===type),true);
    const invited=await admin.call('/api/admin/exams','POST',{name:'Peserta custom',email:'custom-postgres@example.test',examType:type,role:'role-1'});assert.equal(invited.status,201);
    const stored=(await pool.query('SELECT definition FROM serviam.exam_templates WHERE id=$1',[type])).rows[0];
    const edited=JSON.parse(stored.definition);edited.questions[0].answer='A';await pool.query('UPDATE serviam.exam_templates SET definition=$1 WHERE id=$2',[JSON.stringify(edited),type]);
    const p=client(1);const started=await p.call('/api/exam/start','POST',{token:invited.data.invitationPath.split('/').at(-1),consent:true});assert.equal(started.status,201);assert.equal(started.data.exam.custom,true);
    assert.equal('answer' in started.data.questions[0],false);
    assert.equal((await p.call('/api/exam/answers','PATCH',{section:'S1',answers:{'S1-Q1':'B'}})).status,200);
    await p.call('/api/exam/next','POST',{section:'S1'});
    const result=await admin.call(`/api/admin/exams/${invited.data.exam.id}`);assert.equal(result.data.exam.result.total,2);
    assert.equal((await client().call(`/api/admin/templates/${type}/sources/source-1`)).status,401);
    assert.equal((await admin.call(`/api/admin/templates/${type}/sources/source-1`)).data,'Referensi private test.');
    for(const role of ['anon','authenticated'])assert.equal((await pool.query("SELECT has_table_privilege($1,'serviam.exam_templates','SELECT') AS allowed",[role])).rows[0].allowed,false);
  });
  await t.test('migrasi katalog menyisakan dua paket, arsip menjaga hasil dan sumber lama',async()=>{
    const before=(await pool.query('SELECT count(*) AS n FROM serviam.exams')).rows[0].n;
    const template=(await pool.query('SELECT id FROM serviam.exam_templates ORDER BY created_at DESC LIMIT 1')).rows[0];
    await pool.query('ALTER TABLE serviam.exam_templates DROP COLUMN archived');
    await pool.query('DELETE FROM serviam.schema_versions WHERE version=4');
    applications.push(await createConfiguredApp({config,clock,secure:true}));
    const meta=(await admin.call('/api/admin/meta')).data;
    assert.deepEqual(meta.exams.filter(e=>!e.archived).map(e=>e.id),['serviam','indo-artha']);
    assert.equal(meta.exams.find(e=>e.id===template.id).archived,true);
    assert.equal((await pool.query('SELECT count(*) AS n FROM serviam.exams')).rows[0].n,before);
    assert.equal((await admin.call(`/api/admin/templates/${template.id}/sources/source-1`)).status,200);
    assert.equal((await pool.query('SELECT version FROM serviam.schema_versions WHERE version=4')).rows.length,1);
  });
  await t.test('schema privat dan RLS menolak akses anon/authenticated; audit tidak mengandung sandi', async () => {
    for (const role of ['anon','authenticated']) assert.equal((await pool.query("SELECT has_schema_privilege($1,'serviam','USAGE') AS allowed",[role])).rows[0].allowed,false);
    const tables=(await pool.query("SELECT relname,relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace WHERE nspname='serviam' AND relname IN('users','exams','sessions','audit','rate_limits')")).rows;
    assert.equal(tables.length,5); assert.equal(tables.every(table=>table.relrowsecurity),true);
    const audit=JSON.stringify((await pool.query('SELECT * FROM serviam.audit')).rows);
    assert.equal(audit.includes(config.superadminPassword),false); assert.equal(audit.includes(config.adminPassword),false);
  });
});
