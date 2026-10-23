import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReport,reportHtml,createPdfReport} from '../lib/report.js';
import {examDefinition,examMetadata,questionsFor,scoreForExam} from '../lib/exams.js';
import {createCustomDefinition} from '../lib/custom-exams.js';
import {readPdf} from '../lib/document-import.js';
export function sampleReportExam(type='indo-artha'){
 const d=examDefinition(type),answers=Object.fromEntries(d.sections.flatMap(s=>questionsFor(type,s.id).map(q=>[q.id,q.kind==='likert'?3:q.source?typeof q.source.key==='string'?q.source.key:Object.keys(q.source.key).find(k=>q.source.key[k].points===3):q.answer]))),row={exam_type:type,role:d.roles[0].id,answers:JSON.stringify(answers)};
 return {...examMetadata(row),name:'Peserta Uji Laporan',email:'uji@example.test',createdAt:1792000000000,finishedAt:1792005000000,result:scoreForExam(row),review:{label:'Perlu ditinjau'},decision:'belum_diputuskan',note:'Catatan penguji untuk uji laporan.',interview:{}};
}
test('PDF dan halaman cetak memisahkan profil setiap paket serta memuat catatan penguji',async()=>{
 for(const type of ['serviam','indo-artha','indo-artha-ringkas']){
  const exam=sampleReportExam(type),report=buildReport(exam),pdf=await createPdfReport(report),text=await readPdf(pdf);
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(pdf),isEvalSupported:false,verbosity:0});const document=await task.promise;for(let n=1;n<=document.numPages;n++){const content=await(await document.getPage(n)).getTextContent();assert.ok(content.items.some(item=>item.str?.trim()&&!item.str.startsWith('Hasil asesmen |')),'PDF must not contain a page with only a footer');}await task.destroy();
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.match(text,/Peserta Uji Laporan/);assert.match(text,/Catatan penguji untuk uji laporan/);
  if(type==='serviam'){assert.match(text,/Bagian E - Kepribadian kerja/);assert.doesNotMatch(text,/Model 2 - Gaya kerja dan validitas/);}
  else{assert.match(text,/Model 2 - Gaya kerja dan validitas/);assert.doesNotMatch(text,/Bagian E - Kepribadian kerja/);assert.match(text,/Skor \/ 25/);}
 }
 const exam=sampleReportExam();exam.name='<script>alert(1)</script>';exam.note='<img src=x onerror=alert(1)>';
 const html=reportHtml(buildReport(exam),'/api/admin/exams/test/report.pdf');assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;img/);assert.match(html,/data-print-report/);assert.match(html,/@media print/);assert.match(html,/report-print.js/);
});
test('rapport custom, kuesioner saja dan teks panjang tetap bisa diekspor PDF',async()=>{
 const d=createCustomDefinition({name:'Kuesioner Mandiri',company:'Perusahaan Uji',roles:['Umum'],sections:[{name:'Gaya kerja',minutes:5,questions:[{kind:'likert',prompt:'Saya memeriksa pekerjaan dengan teliti.',reversed:true}]}]},'custom-report').definition;
 const row={exam_type:d.id,exam_definition:JSON.stringify(d),role:'role-1',answers:'{"S1-Q1":2}'};
 const exam={...sampleReportExam(),...examMetadata(row),result:scoreForExam(row),note:'Catatan panjang. '.repeat(350)};
 const report=buildReport(exam),pdf=await createPdfReport(report),text=await readPdf(pdf);
 assert.match(text,/Kuesioner/);assert.match(text,/Respons skala 1-5/);assert.match(text,/Saya memeriksa pekerjaan/);assert.doesNotMatch(text,/Model 2 - Gaya kerja dan validitas/);
 assert.equal((text.match(/Catatan panjang\./g)||[]).length,350);
 assert.throws(()=>buildReport({...exam,result:null}),e=>e.status===409);
});
