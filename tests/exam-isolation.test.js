import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreForExam,storedResultForExam,examDefinition,questionsFor} from '../lib/exams.js';
import {createCustomDefinition} from '../lib/custom-exams.js';
import {examsForType,scoringDescription} from '../public/exam-scope.js';
const record=(type,answers={})=>({exam_type:type,answers:JSON.stringify(answers),role:examDefinition(type).roles[0].id});
const ideal=type=>Object.fromEntries(examDefinition(type).sections.flatMap(s=>questionsFor(type,s.id).map(q=>[q.id,q.kind==='likert'?3:q.source?typeof q.source.key==='string'?q.source.key:Object.keys(q.source.key).find(k=>q.source.key[k].points===3):q.answer])));

test('Indo Artha: TIU/kognitif dan gaya kerja tidak saling mengubah, jawaban Serviam diabaikan',()=>{
 const answers=ideal('indo-artha');const base=scoreForExam(record('indo-artha',answers));
 const changed=Object.fromEntries(Object.entries(answers).map(([id,v])=>[id,id.startsWith('M1-')?'':v]));
 const low=scoreForExam(record('indo-artha',{...changed,E1:5,E13:5,E14:5,A1:'48','S1-Q1':'A'}));
 assert.equal(base.analysis.m1.total,30);assert.equal(low.analysis.m1.total,0);
 assert.deepEqual(low.personality,base.personality);assert.deepEqual(low.analysis.m2,base.analysis.m2);
 const changedStyle=scoreForExam(record('indo-artha',{...answers,'M2-4':5,'M2-8':5,'M2-12':5,'M2-30':5,'M2-36':5}));
 assert.equal(changedStyle.analysis.m1.total,base.analysis.m1.total);assert.equal(changedStyle.analysis.m3.total,base.analysis.m3.total);assert.equal(changedStyle.personality.valid,false);
 const onlyTIU=scoreForExam(record('indo-artha',Object.fromEntries(Object.entries(answers).filter(([id])=>id.startsWith('M1-')))));
 assert.equal(onlyTIU.personality.complete,false);assert.equal(onlyTIU.personality.valid,false);
 assert.ok(onlyTIU.personality.dimensions.every(d=>d.score===null));
});
test('rincian kasus situasional menjelaskan jawaban dan kode pada masing-masing soal',()=>{
 const result=scoreForExam(record('indo-artha',{'M3-1':'B','M3-2':'D'}));
 const cases=result.sections.find(s=>s.id==='M3').details;
 assert.match(cases[0].analysis,/Kasus 1 \(Integritas, keuangan\).*pilihan B bernilai 0\/3.*Pelanggaran etika.*red flag/);
 assert.match(cases[1].analysis,/Kasus 2 \(Integritas, keuangan\).*pilihan D bernilai 3\/3.*Ideal/);
 assert.notEqual(cases[0].analysis,cases[1].analysis);
 assert.match(cases[2].analysis,/Kasus 3.*belum dijawab/);
});
test('Serviam, Indo lengkap, ringkas dan custom hanya menghitung butir paket masing-masing',()=>{
 const answers={...ideal('indo-artha'),...ideal('serviam'),'S1-Q1':'B'};
 for(const type of ['serviam','indo-artha','indo-artha-ringkas']){
  const clean=scoreForExam(record(type,Object.fromEntries(Object.entries(answers).filter(([id])=>examDefinition(type).sections.some(s=>questionsFor(type,s.id).some(q=>q.id===id))))));
  assert.deepEqual(scoreForExam(record(type,answers)),clean);
  assert.equal(clean.answered,examDefinition(type).count);
 }
 const d=createCustomDefinition({name:'TIU dan Skala Mandiri',company:'Uji',roles:['Umum'],sections:[{name:'TIU',minutes:5,questions:[{kind:'choice',prompt:'Pilih jawaban dua.',options:['Satu','Dua'],key:'B'}]},{name:'Gaya kerja',minutes:5,questions:[{kind:'likert',prompt:'Saya memeriksa detail.'}]}]},'custom-separate').definition;
 const r=scoreForExam({exam_type:d.id,exam_definition:JSON.stringify(d),answers:JSON.stringify({...answers,'S1-Q1':'B','S2-Q1':4}),role:'role-1'});
 assert.equal(r.total,1);assert.equal(r.max,1);assert.equal(r.answered,2);assert.equal(r.personality,undefined);assert.equal(r.analysis,undefined);assert.equal(r.sections[1].details[0].scaleScore,4);
 assert.throws(()=>scoreForExam({exam_type:'indo-artha',exam_definition:JSON.stringify(d),answers:'{}'}),/Definisi ujian/);
});
test('hasil cache paket lain dihitung ulang dari jawaban sendiri; hasil lama yang valid dipertahankan',()=>{
 const indo=record('indo-artha',ideal('indo-artha')),serviam=record('serviam',ideal('serviam')),ringkas=record('indo-artha-ringkas',ideal('indo-artha-ringkas'));
 for(const [target,foreign] of [[indo,serviam],[serviam,indo],[ringkas,indo]]){
  const r=storedResultForExam({...target,result:JSON.stringify(scoreForExam(foreign))});
  assert.deepEqual(r,scoreForExam(target));assert.equal(r.examType,target.exam_type);
 }
 const historical=scoreForExam(serviam);delete historical.examType;
 assert.deepEqual(storedResultForExam({...serviam,result:JSON.stringify(historical)}),JSON.parse(JSON.stringify(historical)));
 const custom=createCustomDefinition({name:'Custom lama',company:'Uji',roles:['Umum'],sections:[{name:'Bagian 1',minutes:1,questions:[{kind:'choice',prompt:'Pilih satu.',options:['Satu','Dua'],key:'A'}]}]},'custom-test').definition;
 const r=storedResultForExam({exam_type:custom.id,exam_definition:JSON.stringify(custom),answers:'{"S1-Q1":"A"}',result:JSON.stringify(scoreForExam(indo)),role:'role-1'});
 assert.equal(r.custom,true);assert.equal(r.total,1);assert.equal(r.analysis,undefined);
});
test('filter tampilan memisahkan setiap paket dan profil kepribadian dijelaskan menurut sumber',()=>{
 const rows=[{name:'Legacy'},{name:'Lama',examType:'serviam'},{name:'Baru',examType:'indo-artha'},{name:'Ringkas',examType:'indo-artha-ringkas'},{name:'Impor A',examType:'custom-a'},{name:'Impor B',examType:'custom-b'}];
 assert.deepEqual(examsForType(rows,'serviam').map(r=>r.name),['Legacy','Lama']);
 for(const type of ['indo-artha','indo-artha-ringkas','custom-a','custom-b'])assert.equal(examsForType(rows,type).length,1);
 assert.match(scoringDescription(examDefinition('indo-artha')),/hanya dihitung dari jawaban Model 2/);
 assert.match(scoringDescription(examDefinition('serviam')),/bagian E/);
 assert.match(scoringDescription({custom:true}),/tidak memakai profil/);
});
