import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createApp } from '../server.js';
import { originalQuestionOrder } from '../lib/order.js';

const answers={
  A:{A1:'48',A2:'37',A3:'13',A4:'25',A5:'u',A6:'13',A7:'B',A8:'C',A9:'B',A10:'citra'},
  B:{B1:'15',B2:'2.264.400',B3:'9',B4:'25%',B5:'18',B6:'50',B7:'58,5 juta',B8:'90'},
  C:{C1:'B',C2:'A',C3:'C',C4:'B',C5:'C',C6:'C',C7:'C',C8:'C',C9:'A',C10:'B'},
  D:{D1:'C',D2:'B',D3:'B',D4:'D',D5:'B',D6:'B'},
  E:{E1:5,E2:1,E3:5,E4:1,E5:5,E6:1,E7:5,E8:1,E9:5,E10:5,E11:1,E12:5,E13:2,E14:2},
};
async function fixture(t) {
  const dir=mkdtempSync(join(tmpdir(),'talenta-test-'));
  let time=Date.UTC(2026,9,8,7,0,0);
  let instance=createApp({dataDir:dir,clock:()=>time});
  await new Promise(resolve=>instance.server.listen(0,'127.0.0.1',resolve));
  let base=`http://127.0.0.1:${instance.server.address().port}`;
  const client=(initialCookie='')=>{
    let cookies=initialCookie;
    return {
      async call(path,method='GET',body,headers={}) {
        const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Talenta-Request':'1',...(cookies?{Cookie:cookies}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
        if(response.headers.get('set-cookie')) cookies=response.headers.get('set-cookie').split(';')[0];
        const contentType=response.headers.get('content-type') || '';
        const data=contentType.includes('application/json')?await response.json():await response.text();
        return {status:response.status,data,headers:response.headers};
      },
      get cookies(){return cookies;},
    };
  };
  const admin=client();
  const password=randomBytes(24).toString('base64url');
  assert.equal((await admin.call('/api/setup','POST',{name:'Penguji tes',email:'admin@example.test',password,setupCode:readFileSync(instance.store.bootstrapPath,'utf8')})).status,201);
  t.after(async()=>{await new Promise(resolve=>instance.server.close(resolve));instance.store.close();rmSync(dir,{recursive:true,force:true});});
  async function invite(overrides={}) {
    const response=await admin.call('/api/admin/exams','POST',{name:'Peserta Uji',email:'peserta@example.test',role:'administrasi',...overrides});
    assert.equal(response.status,201);
    return {...response.data,token:response.data.invitationPath.split('/').at(-1)};
  }
  return {admin,client,invite,dir,password,get instance(){return instance;},advance:ms=>{time+=ms;},async restart(){await new Promise(resolve=>instance.server.close(resolve));instance.store.close();instance=createApp({dataDir:dir,clock:()=>time});await new Promise(resolve=>instance.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${instance.server.address().port}`;}};
}

test('setup terkunci, password di-hash, login salah ditolak dan route penguji dilindungi',async t=>{
  const f=await fixture(t);
  assert.equal(existsSync(f.instance.store.bootstrapPath),false);
  assert.equal((await f.client().call('/api/setup','POST',{name:'Orang lain',email:'other@example.test',password:f.password,setupCode:'kode-tidak-berlaku'})).status,409);
  for(const path of ['/api/admin/me','/api/admin/meta','/api/admin/exams','/api/admin/export','/api/admin/source']) assert.equal((await f.client().call(path)).status,401);
  assert.equal((await f.client().call('/api/login','POST',{email:'admin@example.test',password:'salah'})).status,401);
  const user=f.instance.store.db.prepare('SELECT * FROM users').get();
  assert.notEqual(user.password,f.password);
  assert.equal((await f.client().call('/api/login','POST',{email:'admin@example.test',password:f.password})).status,200);
  assert.equal((await f.client().call('/lib/bank.js')).status,404);
  assert.equal((await f.client().call('/.data/talenta.sqlite')).status,404);
});
test('aliran ujian lengkap: skoring langsung, wawancara manual, CSV, dan larangan mengulang',async t=>{
  const f=await fixture(t);const invite=await f.invite();const participant=f.client();
  const invitation=await participant.call(`/api/invitations/${invite.token}`);assert.equal(invitation.status,200);
  assert.equal((await participant.call('/api/exam/start','POST',{token:invite.token,consent:false})).status,400);
  const start=await participant.call('/api/exam/start','POST',{token:invite.token,consent:true});assert.equal(start.status,201);
  assert.match(start.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  assert.equal(JSON.stringify(start.data).includes('analysis'),false);
  for(const section of ['A','B','C','D','E']) {
    const current=await participant.call('/api/exam');assert.equal(current.data.questions[0].section,section);
    assert.equal((await participant.call('/api/exam/answers','PATCH',{section,answers:answers[section]})).status,200);
    assert.equal((await participant.call('/api/exam/next','POST',{section})).status,200);
  }
  const result=await f.admin.call(`/api/admin/exams/${invite.exam.id}`);
  assert.equal(result.data.exam.result.total,46);
  assert.equal(result.data.exam.review.label,'Siap diwawancarai');
  assert.equal(result.data.exam.decision,'belum_diputuskan');
  const interview=Object.fromEntries([1,2,3,4,5,6].map(n=>[`F${n}`,{score:4,note:'Contoh situasi, aksi dan hasil.'}]));
  const assessment=await f.admin.call(`/api/admin/exams/${invite.exam.id}`,'PATCH',{interview,note:'Keputusan oleh penguji.',decision:'lanjut'});
  assert.equal(assessment.data.exam.interviewSummary.average,4);
  assert.equal(assessment.data.exam.decision,'lanjut');
  const completed=await participant.call('/api/exam');assert.equal(completed.data.exam.status,'completed');
  assert.equal('result' in completed.data.exam,false);assert.deepEqual(completed.data.questions,[]);
  assert.equal((await participant.call('/api/exam/answers','PATCH',{section:'E',answers:{E1:1}})).status,410);
  assert.equal((await participant.call('/api/exam/start','POST',{token:invite.token,consent:true})).status,410);
  assert.equal((await f.admin.call(`/api/admin/exams/${invite.exam.id}/rotate`,'POST',{})).status,409);
  const csv=await f.admin.call('/api/admin/export');assert.equal(csv.status,200);assert.match(csv.data,/Peserta Uji/);assert.match(csv.data,/"46"/);
});
test('tautan sekali pakai tetap atomik pada dua permintaan start bersamaan',async t=>{
  const f=await fixture(t);const invite=await f.invite();const a=f.client(),b=f.client();
  const responses=await Promise.all([a.call('/api/exam/start','POST',{token:invite.token,consent:true}),b.call('/api/exam/start','POST',{token:invite.token,consent:true})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,410]);
  const winner=responses[0].status===201?a:b;const loser=responses[0].status===201?b:a;
  assert.equal((await winner.call(`/api/invitations/${invite.token}`)).data.resume,true);
  assert.equal((await loser.call(`/api/invitations/${invite.token}`)).status,410);
  assert.equal((await loser.call('/api/exam')).status,401);
  const stored=f.instance.store.getExam(invite.exam.id);assert.notEqual(stored.token_hash,invite.token);
});
test('timer server menutup bagian dan seluruh ujian saat peserta offline',async t=>{
  const f=await fixture(t);const invite=await f.invite();const p=f.client();
  await p.call('/api/exam/start','POST',{token:invite.token,consent:true});
  await p.call('/api/exam/answers','PATCH',{section:'A',answers:{A1:'48'}});
  f.advance(15*60_000);
  assert.equal((await p.call('/api/exam/answers','PATCH',{section:'A',answers:{A2:'37'}})).status,409);
  assert.equal((await p.call('/api/exam')).data.questions[0].section,'B');
  f.advance(50*60_000);
  // Penguji juga memicu penyelesaian, tanpa peserta membuka halaman lagi.
  const result=await f.admin.call(`/api/admin/exams/${invite.exam.id}`);
  assert.equal(result.data.exam.status,'completed');assert.equal(result.data.exam.result.total,1);
  assert.equal(result.data.exam.finishReason,'timeout');
  assert.equal(result.data.exam.result.personality.dimensions[0].score,null);
  assert.equal((await p.call('/api/exam/next','POST',{section:'E'})).status,410);
});
test('validasi input, jawaban bagian lain, CSRF dan rotasi undangan',async t=>{
  const f=await fixture(t);const invite=await f.invite();const p=f.client();
  assert.equal((await f.admin.call('/api/admin/exams','POST',{name:'Nama',role:'invalid'})).status,400);
  assert.equal((await f.admin.call('/api/admin/exams','POST',{name:'Nama',role:'umum'}, {Origin:'https://other.example'})).status,403);
  assert.equal((await f.admin.call('/api/admin/exams','POST',{name:'Nama',role:'umum'}, {'X-Talenta-Request':''})).status,403);
  const rotated=await f.admin.call(`/api/admin/exams/${invite.exam.id}/rotate`,'POST',{});
  assert.equal((await p.call(`/api/invitations/${invite.token}`)).status,404);
  const raw=rotated.data.invitationPath.split('/').at(-1);
  await p.call('/api/exam/start','POST',{token:raw,consent:true});
  assert.equal((await p.call('/api/exam/answers','PATCH',{section:'A',answers:{B1:'15'}})).status,400);
  assert.equal((await p.call('/api/exam/answers','PATCH',{section:'A',answers:{A7:'E'}})).status,400);
  assert.equal((await p.call('/api/exam/answers','PATCH',{section:'A',answers:{A1:'x'.repeat(121)}})).status,400);
  assert.equal((await f.admin.call(`/api/admin/exams/${invite.exam.id}`,'DELETE')).status,409);
  assert.equal((await f.admin.call(`/api/admin/exams/${invite.exam.id}`,'PATCH',{note:'Tidak diizinkan saat aktif'})).status,409);
  assert.equal((await p.call('/api/exam/next','POST',{section:'B'})).status,409);
});
test('expiry, logout, rate limiting dan penghapusan data peserta',async t=>{
  const f=await fixture(t);const invite=await f.invite({expiryDays:1,name:'=HYPERLINK("x")'});
  const csv=await f.admin.call('/api/admin/export');assert.ok(csv.data.includes("'=HYPERLINK"));
  f.advance(86400_000);
  assert.equal((await f.client().call(`/api/invitations/${invite.token}`)).status,410);
  assert.equal((await f.client().call('/api/exam/start','POST',{token:invite.token,consent:true})).status,410);
  const relog=f.client();await relog.call('/api/login','POST',{email:'admin@example.test',password:f.password});
  assert.equal((await relog.call(`/api/admin/exams/${invite.exam.id}`,'DELETE')).status,200);
  assert.equal((await relog.call(`/api/admin/exams/${invite.exam.id}`)).status,404);
  assert.equal((await relog.call('/api/logout','POST',{})).status,200);
  assert.equal((await relog.call('/api/admin/me')).status,401);
  let response;
  for(let i=0;i<11;i++) response=await f.client().call('/api/login','POST',{email:'admin@example.test',password:'salah'});
  assert.equal(response.status,429);
});
test('jawaban, sesi, status sekali pakai dan hasil tetap tersimpan setelah restart',async t=>{
  const f=await fixture(t);const invite=await f.invite();const p=f.client();
  await p.call('/api/exam/start','POST',{token:invite.token,consent:true});
  await p.call('/api/exam/answers','PATCH',{section:'A',answers:{A1:'48'}});
  await f.restart();
  assert.equal((await p.call('/api/exam')).data.exam.answers.A1,'48');
  assert.equal((await f.client().call('/api/exam/start','POST',{token:invite.token,consent:true})).status,410);
  assert.equal((await f.admin.call(`/api/admin/exams/${invite.exam.id}`)).data.exam.answered,1);
});

test('urutan dibuat per tautan dan tetap sama saat reload, melanjutkan, serta restart server',async t=>{
  const f=await fixture(t);
  const first=await f.invite({name:'Nama Sama'}), second=await f.invite({name:'Nama Sama'});
  const orderA=JSON.parse(f.instance.store.getExam(first.exam.id).question_order);
  const orderB=JSON.parse(f.instance.store.getExam(second.exam.id).question_order);
  assert.notEqual(first.token,second.token);
  assert.notDeepEqual(orderA,orderB);
  const a=f.client(), b=f.client();
  const startA=await a.call('/api/exam/start','POST',{token:first.token,consent:true});
  const startB=await b.call('/api/exam/start','POST',{token:second.token,consent:true});
  assert.deepEqual(startA.data.questions.map(q=>q.id),orderA.A);
  assert.deepEqual(startB.data.questions.map(q=>q.id),orderB.A);
  const firstId=orderA.A[0];
  await a.call('/api/exam/answers','PATCH',{section:'A',answers:{[firstId]:answers.A[firstId]}});
  const resumed=await a.call(`/api/invitations/${first.token}`);
  assert.equal(resumed.data.resume,true);
  assert.deepEqual(resumed.data.questions.map(q=>q.id),orderA.A);
  assert.equal(resumed.data.exam.answers[firstId],answers.A[firstId]);
  await f.restart();
  assert.deepEqual((await a.call('/api/exam')).data.questions.map(q=>q.id),orderA.A);
  assert.deepEqual((await b.call('/api/exam')).data.questions.map(q=>q.id),orderB.A);
  for(const section of ['A','B','C','D','E']) {
    const current=await a.call('/api/exam');
    assert.deepEqual(current.data.questions.map(q=>q.id),orderA[section]);
    await a.call('/api/exam/answers','PATCH',{section,answers:answers[section]});
    await a.call('/api/exam/next','POST',{section});
  }
  const result=await f.admin.call(`/api/admin/exams/${first.exam.id}`);
  assert.equal(result.data.exam.result.total,46);
  assert.deepEqual(result.data.exam.questionOrder,orderA);
  assert.equal((await f.client().call('/api/exam/start','POST',{token:first.token,consent:true})).status,410);
});

test('membuat ulang tautan pending mengganti urutan dan membatalkan tautan lama',async t=>{
  const f=await fixture(t), invite=await f.invite();
  const before=JSON.parse(f.instance.store.getExam(invite.exam.id).question_order);
  const rotated=await f.admin.call(`/api/admin/exams/${invite.exam.id}/rotate`,'POST',{});
  const after=JSON.parse(f.instance.store.getExam(invite.exam.id).question_order);
  assert.notDeepEqual(after,before);
  assert.equal((await f.client().call(`/api/invitations/${invite.token}`)).status,404);
  const p=f.client();
  const start=await p.call('/api/exam/start','POST',{token:rotated.data.invitationPath.split('/').at(-1),consent:true});
  assert.equal(start.status,201);
  assert.deepEqual(start.data.questions.map(q=>q.id),after.A);
  assert.equal((await f.admin.call(`/api/admin/exams/${invite.exam.id}/rotate`,'POST',{})).status,409);
});

test('upgrade database lama menjaga akun, jawaban, hasil, dan urutan ujian yang sudah dimulai',async t=>{
  const f=await fixture(t);
  const pending=await f.invite(), active=await f.invite(), completed=await f.invite();
  const a=f.client(), c=f.client();
  const original=originalQuestionOrder();
  f.instance.store.db.prepare('UPDATE exams SET question_order=?').run(JSON.stringify(original));
  await a.call('/api/exam/start','POST',{token:active.token,consent:true});
  await a.call('/api/exam/answers','PATCH',{section:'A',answers:{A1:'48'}});
  await c.call('/api/exam/start','POST',{token:completed.token,consent:true});
  for(const section of ['A','B','C','D','E']) await c.call('/api/exam/next','POST',{section});
  const resultBefore=(await f.admin.call(`/api/admin/exams/${completed.exam.id}`)).data.exam.result;
  f.instance.store.db.exec('ALTER TABLE exams DROP COLUMN question_order');
  await f.restart();
  assert.equal((await f.admin.call('/api/admin/me')).status,200);
  const ongoing=await a.call('/api/exam');
  assert.equal(ongoing.data.exam.status,'active');
  assert.deepEqual(ongoing.data.questions.map(q=>q.id),original.A);
  assert.equal(ongoing.data.exam.answers.A1,'48');
  const completedAfter=(await f.admin.call(`/api/admin/exams/${completed.exam.id}`)).data.exam;
  assert.equal(completedAfter.status,'completed');
  assert.deepEqual(completedAfter.result,resultBefore);
  assert.deepEqual(completedAfter.questionOrder,original);
  assert.equal((await f.client().call('/api/exam/start','POST',{token:active.token,consent:true})).status,410);
  const pendingOrder=JSON.parse(f.instance.store.getExam(pending.exam.id).question_order);
  for(const section of ['A','B','C','D','E']) assert.notDeepEqual(pendingOrder[section],original[section]);
  await f.restart();
  assert.deepEqual(JSON.parse(f.instance.store.getExam(pending.exam.id).question_order),pendingOrder);
  assert.deepEqual((await a.call('/api/exam')).data.questions.map(q=>q.id),original.A);
});
