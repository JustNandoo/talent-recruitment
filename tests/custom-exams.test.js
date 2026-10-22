import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.js';
import {createCustomDefinition,customPublicQuestions,scoreCustomExam} from '../lib/custom-exams.js';
import {parseQuestionImport,csvRows} from '../public/exam-builder.js';
const definition = () => ({name:'Tes Administrasi Mandiri',company:'Perusahaan Uji',roles:['Staf Administrasi','Supervisor'],sections:[{name:'Kompetensi',minutes:15,instruction:'Ikuti instruksi soal.',questions:[
 {kind:'choice',prompt:'Pilihan kelima adalah jawaban benar.',options:['Satu','Dua','Tiga','Empat','Lima'],key:'E',points:2,explanation:'Kunci pribadi penguji.'},
 {kind:'weighted',prompt:'Pilih langkah kerja terbaik.',options:['Tanpa pemeriksaan','Periksa sebagian','Periksa seluruhnya'],weights:[0,1,3]},
 {kind:'text',prompt:'Tuliskan nama ibu kota.',acceptedAnswers:['Jakarta','DKI Jakarta'],points:2},
 {kind:'likert',prompt:'Saya mengabaikan detail.',reversed:true},
]}],sources:[{name:'referensi.txt',data:Buffer.from('Dokumen sumber khusus penguji.').toString('base64')}]});
async function fixture(t) {
 const dir=mkdtempSync(join(tmpdir(),'custom-exams-'));let app=createApp({dataDir:dir}),base;
 const listen=async()=>{await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;};await listen();
 const client=()=>{let cookie='';return {async call(path,method='GET',body,headers={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Talenta-Request':'1',Cookie:cookie,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,data:(r.headers.get('content-type')||'').includes('application/json')?await r.json():await r.text()};}};};
 const admin=client();assert.equal((await admin.call('/api/setup','POST',{name:'Penguji custom',email:'custom@example.test',password:'Isolated-custom-test-2026',setupCode:readFileSync(app.store.bootstrapPath,'utf8')})).status,201);
 t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.store.close();rmSync(dir,{recursive:true,force:true});});
 return {admin,client,get app(){return app;},async restart(){await new Promise(resolve=>app.server.close(resolve));app.store.close();app=createApp({dataDir:dir});await listen();}};
}
test('empat jenis soal custom memakai kunci/bobot dan memisahkan skor kuesioner',()=>{
 const {definition:d,sources}=createCustomDefinition(definition(),'custom-test');
 assert.equal(d.max,7);assert.equal(d.count,4);assert.equal(d.sources[0].size,30);assert.equal('data' in d.sources[0],false);assert.equal(sources.length,1);
 const questions=customPublicQuestions(d,'S1');assert.equal(questions.length,4);
 for(const q of questions)for(const key of ['answer','acceptedAnswers','weights','max','analysis','reversed','sourceName'])assert.equal(key in q,false,`leak ${key}`);
 const r=scoreCustomExam(d,{'S1-Q1':'E','S1-Q2':'C','S1-Q3':'  dKi    JaKaRtA  ','S1-Q4':2});
 assert.equal(r.total,7);assert.equal(r.percent,100);assert.equal(r.sections[0].details[3].scaleScore,4);
 const input=definition();input.sections[0].questions=[{kind:'likert',prompt:'Saya memeriksa detail.'}];
 const survey=createCustomDefinition(input,'custom-survey').definition;
 assert.equal(scoreCustomExam(survey,{'S1-Q1':5}).percent,null);assert.equal(survey.max,0);
});
test('validasi custom menolak soal, kunci, waktu, jenis berkas dan ukuran sumber yang salah',()=>{
 const bad=change=>{const input=definition();change(input);assert.throws(()=>createCustomDefinition(input,'custom-bad'),e=>e.status===400);};
 bad(d=>d.sections[0].questions[0].key='F');bad(d=>d.sections[0].questions[0].options=['Hanya satu']);bad(d=>d.sections[0].questions[1].weights=[0,1]);bad(d=>d.sections[0].questions[2].acceptedAnswers=[]);bad(d=>d.sections[0].minutes=181);bad(d=>d.roles=['Staf','staf']);bad(d=>d.sources[0].name='script.html');bad(d=>d.sources[0].data='invalid');bad(d=>d.sources[0].name='fake.pdf');bad(d=>d.sources[0].data=Buffer.alloc(1024*1024+1).toString('base64'));
});
test('import JSON, CSV, TXT menangani kutip/newline dan mewajibkan kunci tanpa menebak',()=>{
 const json=parseQuestionImport(JSON.stringify([{prompt:'Hasil dua tambah dua?',options:['3','4'],key:'B'}]),'soal.json');assert.equal(json[0].key,'B');
 const csv=parseQuestionImport('soal,A,B,kunci,pembahasan\r\n"Mana kota, Jakarta?","Jakarta","Bandung",A,"Teks dengan ""kutip""\nbaris berikutnya"','soal.csv');assert.equal(csv[0].options[0],'Jakarta');assert.match(csv[0].explanation,/"kutip"\n/);
 assert.deepEqual(csvRows('a,b\n"x,y",z'),[['a','b'],['x,y','z']]);
 const txt=parseQuestionImport('1. Hasil 2 + 2?\nA. 3\nB. 4\nKunci: B','soal.txt');assert.equal(txt[0].key,'B');
 assert.throws(()=>parseQuestionImport('[{"prompt":"Tanpa kunci","options":["A","B"]}]','soal.json'),/kunci/);
 assert.throws(()=>parseQuestionImport('1. Tanpa kunci\nA. Ya\nB. Tidak','soal.txt'),/kunci/);
 assert.throws(()=>csvRows('a,b\n"belum ditutup'),/kutip/);
});
test('custom tersimpan setelah restart; undangan memakai snapshot dan sumber dilindungi',async t=>{
 const f=await fixture(t),input=definition();input.sources[0].data=Buffer.from('Referensi'.repeat(10000)).toString('base64');
 assert.equal((await f.client().call('/api/admin/templates','POST',input)).status,401);
 assert.equal((await f.admin.call('/api/admin/templates','POST',input,{Origin:'https://asing.example'})).status,403);
 const created=await f.admin.call('/api/admin/templates','POST',input);assert.equal(created.status,201);const type=created.data.exam.id;assert.ok(type.startsWith('custom-'));
 const meta=await f.admin.call('/api/admin/meta');const d=meta.data.exams.find(d=>d.id===type);assert.equal(d.count,4);assert.equal('questions' in d,false);assert.equal('data' in d.sources[0],false);
 const invitation=await f.admin.call('/api/admin/exams','POST',{name:'Peserta Custom',examType:type,role:'role-1'});assert.equal(invitation.status,201);const id=invitation.data.exam.id,token=invitation.data.invitationPath.split('/').at(-1);
 const saved=f.app.store.getExam(id);assert.ok(saved.exam_definition);assert.equal(JSON.parse(saved.exam_definition).sources[0].data,undefined);
 const changed=JSON.parse(f.app.store.db.prepare('SELECT definition FROM exam_templates WHERE id=?').get(type).definition);changed.questions[0].answer='A';changed.sections[0].minutes=30;f.app.store.db.prepare('UPDATE exam_templates SET definition=? WHERE id=?').run(JSON.stringify(changed),type);
 await f.restart();
 const p=f.client();const started=await p.call('/api/exam/start','POST',{token,consent:true});assert.equal(started.status,201);assert.equal(started.data.sections[0].minutes,15);assert.equal(started.data.questions.length,4);
 assert.equal(JSON.stringify(started.data).includes('Kunci pribadi'),false);
 assert.equal((await p.call('/api/exam/answers','PATCH',{section:'S1',answers:{'S1-Q1':'E','S1-Q2':'C','S1-Q3':'DKI Jakarta','S1-Q4':2}})).status,200);
 assert.equal((await p.call('/api/exam/next','POST',{section:'S1'})).data.exam.status,'completed');
 const result=await f.admin.call('/api/admin/exams/'+id);assert.equal(result.status,200);assert.equal(result.data.exam.custom,true);assert.equal(result.data.exam.result.total,7);assert.equal(result.data.exam.review.label,'Perlu ditinjau penguji');
 assert.equal((await f.admin.call('/api/admin/exams/'+id,'PATCH',{interview:{},note:'Tinjauan manual.',decision:'belum_diputuskan'})).status,200);
 assert.equal((await f.client().call(`/api/admin/templates/${type}/sources/source-1`)).status,401);
 const source=await f.admin.call(`/api/admin/templates/${type}/sources/source-1`);assert.equal(source.status,200);assert.equal(source.data.length,90000);
 assert.equal((await f.admin.call(`/api/admin/templates/${type}/sources/source-99`)).status,404);
 assert.match((await f.admin.call('/api/admin/export')).data,/Tes Administrasi Mandiri/);
});

test('API import Word hanya untuk penguji, CSRF terlindungi, hasil dapat langsung disimpan sebagai ujian',async t=>{
 const f=await fixture(t),name='Soal Model 1 - Kognitif.docx',keyName='Kunci & Analisa Model 1 (rahasia).docx';
 const sources=[name,keyName].map(name=>({name,data:readFileSync(new URL('../docs/indo-artha/'+name,import.meta.url)).toString('base64')}));
 assert.equal((await f.client().call('/api/admin/import-documents','POST',{sources})).status,401);
 assert.equal((await f.admin.call('/api/admin/import-documents','POST',{sources},{Origin:'https://asing.example'})).status,403);
 const imported=await f.admin.call('/api/admin/import-documents','POST',{sources});assert.equal(imported.status,200);assert.equal(imported.data.count,30);assert.deepEqual(imported.data.warnings,[]);
 const created=await f.admin.call('/api/admin/templates','POST',{name:'Impor Word otomatis',company:'Uji Word',roles:['Umum'],sections:imported.data.sections,sources});assert.equal(created.status,201);assert.equal(created.data.exam.count,30);
 assert.equal((await f.admin.call('/api/admin/import-documents','POST',{sources:[]})).status,400);
 assert.equal((await f.admin.call('/api/admin/import-documents','POST',{sources:[{name:'fake.docx',data:Buffer.from('PK invalid').toString('base64')}]})).status,400);
 assert.equal((await f.client().call('/lib/document-import.js')).status,404);
});

test('katalog hanya dua paket aktif; migrasi mengarsipkan template lama tanpa menghapus hasil',async t=>{
 const f=await fixture(t);
 const meta=(await f.admin.call('/api/admin/meta')).data;
 assert.deepEqual(meta.exams.filter(e=>!e.archived).map(e=>e.id),['serviam','indo-artha']);
 assert.equal(meta.exams.find(e=>e.id==='indo-artha').label,'DIVISI HR · Indo Artha Group · Psikotes');
 const created=await f.admin.call('/api/admin/templates','POST',definition());assert.equal(created.status,201);
 const id=created.data.exam.id;
 const invitation=await f.admin.call('/api/admin/exams','POST',{name:'Peserta historis',examType:id,role:'role-1'});assert.equal(invitation.status,201);
 // Reproduce the pre-migration table; reopen applies the one-time archive flag.
 f.app.store.db.exec('ALTER TABLE exam_templates DROP COLUMN archived');
 await f.restart();
 const after=(await f.admin.call('/api/admin/meta')).data;
 assert.equal(after.exams.filter(e=>!e.archived).length,2);assert.equal(after.exams.find(e=>e.id===id).archived,true);
 assert.equal((await f.admin.call('/api/admin/exams/'+invitation.data.exam.id)).status,200);
 assert.equal((await f.admin.call(`/api/admin/templates/${id}/sources/source-1`)).status,200);
 const newer=await f.admin.call('/api/admin/templates','POST',definition());assert.equal(newer.status,201);
 assert.equal((await f.admin.call('/api/admin/meta')).data.exams.find(e=>e.id===newer.data.exam.id).archived,false);
});
