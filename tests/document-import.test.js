import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zipSync,strToU8} from 'fflate';
import {importDocuments,parseDocumentText,readDocx} from '../lib/document-import.js';
import {createCustomDefinition,validateSources} from '../lib/custom-exams.js';
const source=(name,data)=>({name,data:Buffer.from(data).toString('base64')});
const docx=body=>Buffer.from(zipSync({'word/document.xml':strToU8(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`)}));
const paragraph=text=>`<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
test('Word nyata: 82 soal, konteks tabel, seluruh kunci/bobot/reverse cocok dengan sumber',async()=>{
 const names=['Soal Model 1 - Kognitif.docx','Kunci & Analisa Model 1 (rahasia).docx','Soal Model 2 - Gaya Kerja.docx','Kunci & Analisa Model 2 (rahasia).docx','Soal Model 3 - Situasional.docx','Kunci & Analisa Model 3 (rahasia).docx'];
 const sources=names.map(name=>source(name,readFileSync(new URL('../docs/indo-artha/'+name,import.meta.url))));
 const result=await importDocuments(sources);
 assert.equal(result.count,82);assert.deepEqual(result.warnings,[]);assert.deepEqual(result.sections.map(s=>s.questions.length),[30,40,12]);
 const {ITEMS}=await import('../lib/indo-artha/bank.js');
 for(let n=1;n<=30;n++)assert.equal(result.sections[0].questions[n-1].key,ITEMS.get(`M1-${n}`).key);
 for(let n=1;n<=12;n++)assert.deepEqual(result.sections[2].questions[n-1].weights,Object.values(ITEMS.get(`M3-${n}`).key).map(o=>o.points));
 assert.match(result.sections[0].questions[27].context,/285\.000/);assert.match(result.sections[0].questions[6].context,/Rp50 juta/);
 assert.equal(result.sections[1].questions[0].reversed,true);assert.equal(result.sections[1].questions[1].reversed,false);
 const saved=createCustomDefinition({name:'Ujian Word',company:'Perusahaan Uji',roles:['Umum'],sections:result.sections,sources},'custom-test');assert.equal(saved.definition.count,82);
 const guides=['Panduan Penguji.docx','Lembar Rekap & Keputusan.docx'].map(name=>source(name,readFileSync(new URL('../docs/indo-artha/'+name,import.meta.url))));
 const zipped=source('Soal_Baru.zip',zipSync(Object.fromEntries([...sources,...guides].map(s=>[s.name,Buffer.from(s.data,'base64')]))));
 assert.equal((await importDocuments([zipped])).count,82);
});
test('Word combined, missing keys, distinct numbered keys and ambiguous pairings',async()=>{
 const combined=await importDocuments([source('soal-dan-kunci.docx',docx(['1. Berapa 2 + 2?','A. 3 · B. 4','Kunci: B','Pembahasan: Penjumlahan.'].map(paragraph).join('')))]);
 assert.equal(combined.sections[0].questions[0].key,'B');assert.equal(combined.sections[0].questions[0].explanation,'Penjumlahan.');
 const raw='1. Apa yang dipilih?\nA. Satu\nB. Dua';
 const missing=await importDocuments([source('soal.txt',raw)]);assert.equal(missing.sections[0].questions[0].key,'');assert.match(missing.warnings.join(),/belum memiliki kunci/);
 assert.throws(()=>createCustomDefinition({name:'Tes missing',company:'Uji',roles:['Umum'],sections:missing.sections},'custom-missing'),/kunci/);
 const paired=await importDocuments([source('soal.txt',raw),source('kunci.txt','1. B')]);assert.equal(paired.sections[0].questions[0].key,'B');
 const ambiguous=await importDocuments([source('soal Model 1.txt',raw),source('kunci Model 1.txt','1. B'),source('jawaban Model 1.txt','1. A')]);assert.equal(ambiguous.sections[0].questions[0].key,'');assert.match(ambiguous.warnings.join(),/ambigu/);
 const partial=parseDocumentText('1. Soal tidak lengkap\n2. Soal lengkap\nA. Aaa\nB. Bbb','soal.txt');assert.equal(partial.questions.length,1);assert.match(partial.warnings[0],/tidak diimpor/);
});
test('Word automatic numbering and XML preserve digits; invalid/oversized archives rejected',async()=>{
 const numbering='<w:numbering><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';
 const p='<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Pilih angka 1.250</w:t></w:r></w:p>';
 const bytes=zipSync({'word/document.xml':strToU8(`<w:document><w:body>${p}${paragraph('A. 1.250')}${paragraph('B. 2.500')}${paragraph('Kunci: A')}</w:body></w:document>`),'word/numbering.xml':strToU8(numbering)});
 assert.match(readDocx(bytes),/^1\. Pilih angka 1\.250/);
 const r=await importDocuments([source('soal.docx',bytes)]);assert.equal(r.sections[0].questions[0].options[0],'1.250');
 await assert.rejects(importDocuments([source('bad.docx','not a zip')]),/tidak dapat dibaca/);
 await assert.rejects(importDocuments([source('bomb.docx',zipSync({'word/document.xml':new Uint8Array(9*1024*1024)}))]),/terlalu besar/);
 await assert.rejects(importDocuments([source('xml.docx',docx('<!DOCTYPE x><w:p/>'))]),/XML/);
 assert.throws(()=>validateSources([source('file.doc','old word')]),/Sumber harus/);
});
test('PDF text reads numbered questions and inline keys without OCR',async()=>{
 const text='BT /F1 12 Tf 50 740 Td (1. What is 2 + 2?) Tj 0 -20 Td (A. Three) Tj 0 -20 Td (B. Four) Tj 0 -20 Td (Kunci: B) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${text.length} >>\nstream\n${text}\nendstream`];
 let pdf='%PDF-1.4\n',offsets=[0];for(const [i,body]of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${body}\nendobj\n`;}const start=pdf.length;pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 const r=await importDocuments([source('soal.pdf',pdf)]);assert.equal(r.count,1);assert.equal(r.sections[0].questions[0].key,'B');assert.deepEqual(r.warnings,[]);
});

test('ZIP aplikasi Indo Artha dikenali tanpa duplikat; semua kunci, bobot, dan skala terisi',async()=>{
 const names=['Soal Model 1 - Kognitif.docx','Kunci & Analisa Model 1 (rahasia).docx','Soal Model 2 - Gaya Kerja.docx','Kunci & Analisa Model 2 (rahasia).docx','Soal Model 3 - Situasional.docx','Kunci & Analisa Model 3 (rahasia).docx'];
 const files=Object.fromEntries(names.map(name=>['psikotes-2/docs/sumber/'+name,readFileSync(new URL('../docs/indo-artha/'+name,import.meta.url))]));
 files['psikotes-2/README.md']=strToU8('1. Langkah setup\nA. Jalankan kode\nB. Ubah konfigurasi\nKunci: A');
 files['psikotes-2/server.js']=strToU8('throw new Error("Never run uploaded code")');
 const r=await importDocuments([source('DIVISI-HR-Indo-Artha-Group-Psikotes (1).zip',zipSync(files))]);
 assert.equal(r.count,82);assert.equal(r.builtinType,'indo-artha');assert.equal(r.suggestedName,'DIVISI HR · Indo Artha Group · Psikotes');
 assert.deepEqual(r.keySummary,{choice:30,weighted:12,scale:40,missing:0});
 assert.equal(r.sections.length,3);
 // Different source content must never silently reuse the built-in scoring.
 files['psikotes-2/docs/sumber/Soal Model 1 - Kognitif.docx']=docx([paragraph('1. Soal berbeda'),paragraph('A. Satu'),paragraph('B. Dua'),paragraph('Kunci: A')].join(''));
 const custom=await importDocuments([source('custom.zip',zipSync(files))]);assert.equal(custom.builtinType,undefined);
});
test('kunci Word dalam tabel dua kolom dan nama bernomor dikenali otomatis',async()=>{
 const cells=rows=>'<w:tbl>'+rows.map(row=>'<w:tr>'+row.map(c=>'<w:tc>'+paragraph(c)+'</w:tc>').join('')+'</w:tr>').join('')+'</w:tbl>';
 const question=source('soal Model 1.docx',docx([paragraph('Model 1'),paragraph('1. Pilih yang benar'),paragraph('A. Satu'),paragraph('B. Dua')].join('')));
 const answer=source('02-jawaban-final.docx',docx(paragraph('Kunci Model 1')+cells([['No','Kunci'],['1','B']])));
 const r=await importDocuments([question,answer]);assert.equal(r.sections[0].questions[0].key,'B');assert.equal(r.keySummary.missing,0);
});
