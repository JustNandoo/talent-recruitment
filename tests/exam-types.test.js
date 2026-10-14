import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.js';
import {M1_ITEMS,M2_ITEMS,M3_ITEMS} from '../lib/indo-artha/bank.js';
import {examDefinition,questionsFor} from '../lib/exams.js';
import {createQuestionOrder,orderedPublicQuestions} from '../lib/order.js';

async function fixture(t) {
  const dir=mkdtempSync(join(tmpdir(),'talenta-exam-types-'));
  let now=Date.now(),app=createApp({dataDir:dir,clock:()=>now});
  let base;
  const listen=async()=>{await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;};
  await listen();
  const client=()=>{let cookie='';return {async call(path,method='GET',body){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Talenta-Request':'1',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=(response.headers.get('content-type')||'').includes('application/json')?await response.json():await response.text();return {status:response.status,data};}};};
  const admin=client();
  const result=await admin.call('/api/setup','POST',{name:'Penguji tes',email:'exam-test@example.test',password:'Test-isolated-password-2026',setupCode:readFileSync(app.store.bootstrapPath,'utf8')});assert.equal(result.status,201);
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.store.close();rmSync(dir,{recursive:true,force:true});});
  const invite=async(type='indo-artha',role='keu-staf')=>{const result=await admin.call('/api/admin/exams','POST',{name:'Peserta Indo Artha',role,examType:type});assert.equal(result.status,201);return {...result.data,token:result.data.invitationPath.split('/').at(-1)};};
  return {admin,client,invite,advance:ms=>{now+=ms;},get app(){return app;},async restart(){await new Promise(resolve=>app.server.close(resolve));app.store.close();app=createApp({dataDir:dir,clock:()=>now});await listen();}};
}
const answersFor = section => Object.fromEntries((section==='M1'?M1_ITEMS:section==='M2'?M2_ITEMS:M3_ITEMS).map(q=>[q.id,section==='M1'?q.key:section==='M2'?3:Object.keys(q.key).find(l=>q.key[l].points===3)]));

test('bank Indo Artha terpisah: 82 soal, paket ringkas, acak utuh, stimulus, dan tanpa kunci peserta',()=>{
  const d=examDefinition('indo-artha');assert.equal(d.count,82);assert.equal(d.minutes,90);assert.deepEqual(d.sections.map(s=>s.id),['M1','M3','JEDA','M2']);
  assert.equal(examDefinition('indo-artha-ringkas').count,57);assert.equal(examDefinition('indo-artha-ringkas').minutes,40);
  for(const type of ['serviam','indo-artha','indo-artha-ringkas']) {
    const order=createQuestionOrder(type);
    for(const s of examDefinition(type).sections) {
      const questions=orderedPublicQuestions(s.id,order,type);assert.equal(questions.length,s.count);
      for(const q of questions) for(const key of ['source','key','answer','analysis','weights','reversed','dim']) assert.equal(key in q,false,`${type} ${q.id} leaks ${key}`);
    }
  }
  assert.equal(questionsFor('indo-artha','M1',true).find(q=>q.id==='M1-29').stimulus.tables.length,2);
  assert.equal(questionsFor('indo-artha','M1',true).find(q=>q.id==='M1-3').options.length,5);
});

test('undangan memvalidasi posisi per ujian, metadata katalog, dokumen rahasia dilindungi',async t=>{
  const f=await fixture(t);
  const meta=await f.admin.call('/api/admin/meta');assert.equal(meta.data.exams.length,3);
  for(const body of [{examType:'unknown',role:'keu-staf'},{examType:'indo-artha',role:'administrasi'},{examType:'serviam',role:'keu-staf'},{examType:'indo-artha-ringkas',role:'keu-mgr'}]) assert.equal((await f.admin.call('/api/admin/exams','POST',{name:'Peserta uji',...body})).status,400);
  assert.equal((await f.client().call('/api/admin/source?examType=indo-artha&document=Kunci%20%26%20Analisa%20Model%201%20(rahasia).docx')).status,401);
  assert.equal((await f.admin.call('/api/admin/source?examType=indo-artha&document=Panduan%20Penguji.docx')).status,200);
  assert.equal((await f.admin.call('/api/admin/source?examType=indo-artha&document=../../.env')).status,404);
  for(const path of ['/lib/indo-artha/bank.js','/docs/indo-artha/Panduan%20Penguji.docx']) assert.equal((await f.client().call(path)).status,404);
});

test('ujian Indo Artha lengkap: 82 jawaban, jeda terkunci, resume, hasil tiga model, keputusan dan CSV',async t=>{
  const f=await fixture(t), invitation=await f.invite(),p=f.client();
  const intro=await p.call('/api/invitations/'+invitation.token);assert.equal(intro.data.invitation.company,'DIVISI HR · Indo Artha Group');assert.equal(intro.data.invitation.questionCount,82);
  let current=await p.call('/api/exam/start','POST',{token:invitation.token,consent:true});assert.equal(current.status,201);assert.equal(current.data.questions.length,30);
  assert.equal((await f.client().call('/api/exam/start','POST',{token:invitation.token,consent:true})).status,410);
  assert.equal((await p.call('/api/exam/answers','PATCH',{section:'M1',answers:{A1:'48'}})).status,400);
  assert.equal((await p.call('/api/exam/answers','PATCH',{section:'M1',answers:{'M1-24':'E'}})).status,400);
  const order=JSON.stringify(f.app.store.getExam(invitation.exam.id).question_order);
  await f.restart();assert.equal(JSON.stringify(f.app.store.getExam(invitation.exam.id).question_order),order);
  for(const section of ['M1','M3']) {assert.equal((await p.call('/api/exam/answers','PATCH',{section,answers:answersFor(section)})).status,200);current=await p.call('/api/exam/next','POST',{section});assert.equal(current.status,200);}
  assert.equal(current.data.sections[current.data.exam.sectionIndex].break,true);assert.deepEqual(current.data.questions,[]);
  assert.equal((await p.call('/api/exam/next','POST',{section:'JEDA'})).status,409);
  assert.equal((await p.call('/api/exam/answers','PATCH',{section:'JEDA',answers:{'M2-1':3}})).status,400);
  f.advance(10*60_000);current=await p.call('/api/exam');assert.equal(current.data.questions.length,40);
  assert.equal((await p.call('/api/exam/answers','PATCH',{section:'M2',answers:answersFor('M2')})).status,200);
  assert.equal((await p.call('/api/exam/next','POST',{section:'M2'})).data.exam.status,'completed');
  assert.equal((await p.call('/api/exam')).data.questions.length,0);
  assert.equal('result' in (await p.call('/api/exam')).data.exam,false);
  const detail=await f.admin.call('/api/admin/exams/'+invitation.exam.id);assert.equal(detail.data.exam.result.total,66);assert.equal(detail.data.exam.result.analysis.m1.total,30);assert.equal(detail.data.exam.result.analysis.m3.total,36);assert.equal(detail.data.exam.result.analysis.m2.validity.sv,15);assert.equal(detail.data.exam.answered,82);
  const saved=await f.admin.call('/api/admin/exams/'+invitation.exam.id,'PATCH',{note:'Konfirmasi bukti saat wawancara.',decision:'ditahan',interview:{}});assert.equal(saved.status,200);assert.equal(saved.data.exam.decision,'ditahan');
  assert.match((await f.admin.call('/api/admin/export')).data,/Indo Artha Group/);
});

test('deadline offline Indo Artha dan rotasi memakai paket yang sama; Serviam tetap 48 butir',async t=>{
 const f=await fixture(t);
 const invitation=await f.invite('indo-artha-ringkas','prod-operator');
 const rotated=await f.admin.call('/api/admin/exams/'+invitation.exam.id+'/rotate','POST',{});assert.equal(rotated.status,200);assert.equal(f.app.store.getExam(invitation.exam.id).exam_type,'indo-artha-ringkas');
 const p=f.client();await p.call('/api/exam/start','POST',{token:rotated.data.invitationPath.split('/').at(-1),consent:true});f.advance(40*60_000);
 assert.equal((await p.call('/api/exam')).data.exam.status,'completed');
 assert.equal((await f.admin.call('/api/admin/exams/'+invitation.exam.id)).data.exam.result.analysis.m1.max,15);
 const old=await f.invite('serviam','administrasi');assert.equal(old.exam.questionCount,48);assert.equal(old.exam.max,46);assert.equal(old.exam.examType,'serviam');
});
