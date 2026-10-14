const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const emptyQuestion = ()=>({prompt:'',kind:'choice',options:['','','',''],key:'A',points:1,weights:[0,0,0,0],acceptedAnswers:[],explanation:'',context:'',sourceName:'',reversed:false});
const emptySection = ()=>({name:'Bagian 1',minutes:20,instruction:'Pilih jawaban yang paling tepat.',questions:[emptyQuestion()]});
let draft={name:'',company:'',description:'',roles:['Umum'],sections:[emptySection()],sources:[]};
let controller;
let dirty=false;
let importMessage="";
let importWarnings=[];
export const builderHasUnsaved = ()=>dirty;
export const unmountBuilder = ()=>controller?.abort();
export function parseQuestionImport(raw, filename) {
  const ext=filename.split('.').at(-1).toLowerCase();
  let questions;
  if(ext==='json') {
    const data=JSON.parse(raw);questions=Array.isArray(data)?data:data.questions;
    if(!Array.isArray(questions))throw new Error('JSON harus berupa daftar soal atau objek dengan properti questions.');
  } else if(ext==='csv') {
    const rows=csvRows(raw.replace(/^\uFEFF/,''));
    const headers=rows.shift()?.map(x=>x.trim().toLowerCase());
    if(!headers?.includes('soal'))throw new Error('CSV memerlukan kolom soal,A,B,kunci. Kolom C,D,E dan pembahasan opsional.');
    questions=rows.filter(r=>r.some(Boolean)).map(row=>{
      const cell=name=>row[headers.indexOf(name)]||'';
      const options=['a','b','c','d','e'].map(cell);while(options.length>2&&!options.at(-1))options.pop();
      return {prompt:cell('soal'),kind:'choice',options,key:cell('kunci').trim().toUpperCase(),points:1,explanation:cell('pembahasan')};
    });
  } else if(ext==='txt') {
    questions=[];let question;
    for(const line of raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)) {
      const title=line.match(/^\d+[.)]\s+(.+)$/),option=line.match(/^([A-E])[.)]\s+(.+)$/),key=line.match(/^(?:kunci|jawaban)\s*:\s*([A-E])$/i);
      if(title){question={prompt:title[1],kind:'choice',options:[],key:'',points:1};questions.push(question);}
      else if(question&&option)question.options['ABCDE'.indexOf(option[1])]=option[2];
      else if(question&&key)question.key=key[1].toUpperCase();
      else if(question)question.prompt+='\n'+line;
    }
  } else throw new Error('Import soal mendukung JSON, CSV, atau TXT. PDF/DOCX dapat ditambahkan sebagai dokumen sumber.');
  if(!questions?.length || questions.length>100)throw new Error('Import harus berisi 1–100 soal untuk satu bagian.');
  return questions.map(q=>{
    if(!q || typeof q!=='object' || typeof q.prompt!=='string')throw new Error('Setiap soal harus mempunyai prompt berupa teks.');
    const out={...emptyQuestion(),...q};
    if(out.kind==='choice' && (typeof q.key!=='string' || q.key.length!==1 || !'ABCDE'.slice(0,out.options?.length||0).includes(q.key)))throw new Error('Setiap soal pilihan ganda import harus mempunyai kunci A–E yang sesuai pilihan.');
    if(!['choice','weighted','text','likert'].includes(out.kind))throw new Error('Jenis soal import tidak dikenal.');
    if(!Array.isArray(out.options)||out.options.length>5||!Array.isArray(out.acceptedAnswers))throw new Error('Pilihan/kunci alternatif import tidak valid.');
    if(out.kind==='weighted'&&(!Array.isArray(out.weights)||out.weights.length!==out.options.length))throw new Error('Isi bobot setiap pilihan pada import.');
    return out;
  });
}
export function csvRows(text) {
  const rows=[],row=[];let cell='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const char=text[i];
    if(char==='"') {if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(char===','&&!quoted){row.push(cell);cell='';}
    else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row.splice(0));cell='';}
    else cell+=char;
  }
  if(quoted)throw new Error('Tanda kutip CSV belum ditutup.');
  if(cell||row.length){row.push(cell);rows.push(row);}
  return rows;
}
const field = (label,path,value,extra='')=>`<label>${esc(label)}<input data-builder-field="${path}" value="${esc(value)}" ${extra}/></label>`;
const area = (label,path,value,extra='')=>`<label>${esc(label)}<textarea data-builder-field="${path}" rows="3" ${extra}>${esc(value)}</textarea></label>`;
export function builderMarkup() {
  return `<form id="exam-builder-form" class="exam-builder" data-dirty="${dirty}"><div class="page-heading"><div><span class="eyebrow">UJIAN BUATAN SENDIRI</span><h1>Buat ujian sendiri</h1><p>Susun soal dan aturan waktu, lampirkan sumber, lalu gunakan ujian untuk undangan peserta.</p></div><button type="button" class="button secondary" data-builder-action="cancel">Kembali ke ujian</button></div><section class="panel builder-panel"><h2>Identitas ujian</h2><div class="form-two-col">${field('Nama ujian','name',draft.name,'required minlength="3" maxlength="120" placeholder="Contoh: Tes Administrasi 2026"')}${field('Perusahaan / penyelenggara','company',draft.company,'required minlength="2" maxlength="120" placeholder="Nama perusahaan"')}</div>${area('Deskripsi untuk penguji','description',draft.description,'maxlength="2000"')}${area('Posisi peserta (satu posisi per baris)','roles',draft.roles.join('\n'),'required')}<p class="muted">Setiap undangan menyimpan versi soal yang digunakan saat dibuat. Untuk revisi soal setelah disimpan, buat ujian baru.</p></section><section class="panel builder-panel builder-import"><h2>Import otomatis dari dokumen</h2><p>Pilih file soal dan kunci sekaligus, atau ZIP berisi keduanya. Soal, pilihan, kunci, pembahasan dan bobot yang terbaca langsung masuk ke editor.</p><label>Import Word / PDF / ZIP (soal + kunci)<input id="builder-document-import" type="file" multiple accept=".docx,.pdf,.zip,.txt,.md" /></label><small>Word .docx, PDF dengan teks, TXT, MD, ZIP · 1 MB per file, total 2 MB. Kunci dapat berada di file terpisah dengan nomor soal yang sama.</small><p id="document-import-status" role="status">${esc(importMessage)}</p>${importWarnings.length?`<ul class="import-warnings">${importWarnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}</section><section class="panel builder-panel"><h2>Dokumen sumber soal</h2><p>Lampirkan panduan, bank soal, atau kunci referensi untuk penguji. Soal yang akan dikerjakan peserta diisi atau diimport di editor bagian di bawah.</p><label>Tambahkan dokumen sumber<input id="builder-sources" type="file" multiple accept=".pdf,.docx,.zip,.txt,.md,.csv,.json" /></label><small>PDF, DOCX, ZIP, TXT, MD, CSV, JSON · maksimal 1 MB per berkas, total 2 MB.</small><div class="builder-source-list">${draft.sources.map((s,i)=>`<div><span>${esc(s.name)} · ${Math.ceil(atob(s.data).length/1024)} KB</span><button type="button" class="text-button" data-builder-action="source-remove" data-index="${i}">Hapus lampiran</button></div>`).join('')}</div></section>${draft.sections.map(sectionMarkup).join('')}<div class="builder-actions"><button type="button" class="button secondary" data-builder-action="section-add">+ Tambah bagian</button><span class="muted">${draft.sections.reduce((n,s)=>n+s.questions.length,0)} soal · ${draft.sections.reduce((n,s)=>n+Number(s.minutes||0),0)} menit</span></div><div class="builder-error form-error" id="builder-error" role="alert"></div><div class="builder-actions"><button class="button primary" type="submit">Simpan & gunakan ujian</button><span class="muted">Soal berkunci dinilai otomatis. Skala 1–5 menjadi bahan tinjauan penguji.</span></div></form>`;
}
function sectionMarkup(s,si) {
  return `<section class="panel builder-panel" data-builder-section="${si}"><div class="builder-heading"><h2>Bagian ${si+1}</h2>${draft.sections.length>1?`<button type="button" class="text-button" data-builder-action="section-remove" data-section="${si}">Hapus bagian</button>`:''}</div><div class="form-two-col">${field('Nama bagian',`sections.${si}.name`,s.name,'required maxlength="100"')}${field('Waktu (menit)',`sections.${si}.minutes`,s.minutes,'type="number" required min="1" max="180"')}</div>${area('Instruksi peserta',`sections.${si}.instruction`,s.instruction,'maxlength="2000"')}<div class="builder-import"><label>Import soal ke bagian ini<input type="file" data-builder-import="${si}" accept=".json,.csv,.txt" /></label><details><summary>Format import dan contoh</summary><p>CSV: kolom <code>soal,A,B,C,D,E,kunci,pembahasan</code>. Kolom C–E dan pembahasan boleh kosong. TXT: nomor soal, pilihan per baris, lalu <code>Kunci: A</code>. Periksa kunci setelah import.</p><pre>${esc(JSON.stringify([{prompt:'Berapa hasil 2 + 2?',kind:'choice',options:['3','4','5'],key:'B',points:1}],null,2))}</pre></details></div>${s.questions.map((q,qi)=>questionMarkup(q,si,qi)).join('')}<button type="button" class="button secondary" data-builder-action="question-add" data-section="${si}">+ Tambah soal</button></section>`;
}
function questionMarkup(q,si,qi) {
  const path=`sections.${si}.questions.${qi}`;
  return `<article class="builder-question"><div class="builder-heading"><h3>Soal ${qi+1}</h3>${draft.sections[si].questions.length>1?`<button type="button" class="text-button" data-builder-action="question-remove" data-section="${si}" data-question="${qi}">Hapus soal</button>`:''}</div><label>Jenis soal<select data-builder-field="${path}.kind">${[['choice','Pilihan ganda · satu kunci'],['weighted','Situasional · bobot tiap pilihan'],['text','Jawaban singkat'],['likert','Skala 1–5 · kuesioner']].map(([id,name])=>`<option value="${id}" ${q.kind===id?'selected':''}>${name}</option>`).join('')}</select></label>${area('Pertanyaan / pernyataan',`${path}.prompt`,q.prompt,'required minlength="3" maxlength="4000"')}${q.kind==='choice'||q.kind==='weighted'?`<div class="builder-options">${q.options.map((option,i)=>`<div class="builder-option">${field(`Pilihan ${'ABCDE'[i]}`,`${path}.options.${i}`,option,'required maxlength="1500"')}${q.kind==='weighted'?field(`Bobot ${'ABCDE'[i]}`,`${path}.weights.${i}`,q.weights[i]??0,'type="number" required min="0" max="100"'):''}</div>`).join('')}</div><div class="builder-actions">${q.options.length<5?`<button type="button" class="text-button" data-builder-action="option-add" data-section="${si}" data-question="${qi}">+ Pilihan</button>`:''}${q.options.length>2?`<button type="button" class="text-button" data-builder-action="option-remove" data-section="${si}" data-question="${qi}">Kurangi pilihan</button>`:''}</div>${q.kind==='choice'?`<div class="form-two-col"><label>Kunci jawaban<select data-builder-field="${path}.key" required><option value="" ${!q.key?'selected':''}>Pilih kunci jawaban</option>${q.options.map((_,i)=>`<option value="${'ABCDE'[i]}" ${q.key==='ABCDE'[i]?'selected':''}>${'ABCDE'[i]}</option>`).join('')}</select></label>${field('Poin jika benar',`${path}.points`,q.points,'type="number" required min="1" max="100"')}</div>`:''}`:q.kind==='text'?`${area('Kunci jawaban (satu alternatif per baris)',`${path}.acceptedAnswers`,q.acceptedAnswers.join('\n'),'required')}<p class="muted">Huruf besar/kecil dan spasi berlebih diabaikan. Tuliskan alternatif jawaban yang diterima.</p>${field('Poin jika benar',`${path}.points`,q.points,'type="number" min="1" max="100" required')}`:`<p>Skala: 1 Sangat tidak sesuai → 5 Sangat sesuai. Tidak ada jawaban benar/salah.</p><label class="consent-label"><input type="checkbox" data-builder-field="${path}.reversed" ${q.reversed?'checked':''}/>Balik skor untuk butir negatif (6 − jawaban)</label>`}<details class="builder-context"><summary>Bacaan pendukung, pembahasan, dan referensi</summary>${area('Bacaan / data yang tampil untuk peserta',`${path}.context`,q.context,'maxlength="6000"')}${area('Pembahasan khusus penguji',`${path}.explanation`,q.explanation,'maxlength="4000"')}${field('Referensi sumber (nama dokumen / halaman)',`${path}.sourceName`,q.sourceName,'maxlength="200"')}</details></article>`;
}
function capture(root) {
  for(const field of root.querySelectorAll('[data-builder-field]')) {
    const path=field.dataset.builderField.split('.'),key=path.pop();let obj=draft;
    for(const part of path)obj=obj[part];
    obj[key]=field.type==='checkbox'?field.checked:field.type==='number'?Number(field.value):['roles','acceptedAnswers'].includes(key)?field.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean):field.value;
  }
}
async function fileSource(file) {
  if(file.size>1024*1024)throw new Error(`${file.name}: maksimal 1 MB.`);
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Berkas tidak dapat dibaca.'));reader.readAsDataURL(file);});
  return {name:file.name,data};
}
function addSources(sources) {
  const all=[...draft.sources,...sources];
  if(all.length>10||all.reduce((n,s)=>n+atob(s.data).length,0)>2*1024*1024)throw new Error('Maksimal 10 lampiran dengan total ukuran 2 MB.');
  draft.sources=all;
}
export function mountBuilder(root,{save,cancel,importDocuments}) {
  controller?.abort();controller=new AbortController();const signal=controller.signal;
  const error=message=>{const target=root.querySelector('#builder-error');if(target){target.textContent=message;target.scrollIntoView({block:'center'});}};
  const refresh=()=>{root.innerHTML=builderMarkup();};
  root.addEventListener('input',()=>{const form=root.querySelector('#exam-builder-form');if(form){dirty=true;form.dataset.dirty='true';}},{signal});
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-builder-action]');if(!button)return;
    capture(root);const action=button.dataset.builderAction,si=Number(button.dataset.section),qi=Number(button.dataset.question);
    if(action==='cancel'){cancel();return;}
    dirty=true;
    if(action==='section-add'){if(draft.sections.length>=10){error('Maksimal 10 bagian.');return;}const section=emptySection();section.name=`Bagian ${draft.sections.length+1}`;draft.sections.push(section);}
    if(action==='section-remove')draft.sections.splice(si,1);
    if(action==='question-add'){if(draft.sections[si].questions.length>=100){error('Maksimal 100 soal per bagian.');return;}draft.sections[si].questions.push(emptyQuestion());}
    if(action==='question-remove')draft.sections[si].questions.splice(qi,1);
    if(action==='option-add'){draft.sections[si].questions[qi].options.push('');draft.sections[si].questions[qi].weights.push(0);}
    if(action==='option-remove'){const q=draft.sections[si].questions[qi];q.options.pop();q.weights.pop();if(!'ABCDE'.slice(0,q.options.length).includes(q.key))q.key='A';}
    if(action==='source-remove')draft.sources.splice(Number(button.dataset.index),1);
    refresh();
  },{signal});
  root.addEventListener('change',async event=>{
    const field=event.target;
    capture(root);dirty=true;
    try {
      if(field.dataset.builderField?.endsWith('.kind')){const parts=field.dataset.builderField.split('.');const q=draft.sections[Number(parts[1])].questions[Number(parts[3])];q.weights=q.options.map((_,i)=>q.weights[i]??0);refresh();return;}
      if(field.id==='builder-document-import'&&field.files.length){
        field.disabled=true;importMessage='Membaca dokumen soal dan kunci…';root.querySelector('#document-import-status').textContent=importMessage;
        const sources=await Promise.all([...field.files].map(fileSource));
        const all=[...draft.sources,...sources];if(all.length>10||all.reduce((n,s)=>n+atob(s.data).length,0)>2*1024*1024)throw new Error('Total sumber maksimal 2 MB / 10 file.');
        const result=await importDocuments(sources);if(signal.aborted)return;
        capture(root);
        const nonempty=draft.sections.filter(s=>s.questions.some(q=>q.prompt.trim()));
        if(nonempty.length+result.sections.length>10||[...nonempty,...result.sections].reduce((n,s)=>n+s.questions.length,0)>300)throw new Error('Hasil import melebihi 10 bagian / 300 soal.');
        draft.sections=[...nonempty,...result.sections.map(s=>({...s,questions:s.questions.map(q=>({...emptyQuestion(),...q}))}))];
        addSources(sources);importWarnings=result.warnings;importMessage=`${result.count} soal berhasil diimport dari ${sources.length} file. Periksa hasil lalu simpan ujian.`;dirty=true;refresh();return;
      }
      if(field.id==='builder-sources'){const sources=await Promise.all([...field.files].map(fileSource));if(signal.aborted)return;addSources(sources);refresh();}
      if(field.dataset.builderImport!==undefined && field.files[0]) {
        const file=field.files[0];if(file.size>1024*1024)throw new Error('Berkas import maksimal 1 MB.');
        const questions=parseQuestionImport(await file.text(),file.name),section=draft.sections[Number(field.dataset.builderImport)];
        const existing=section.questions.filter(q=>q.prompt.trim());if(existing.length+questions.length>100)throw new Error('Maksimal 100 soal per bagian setelah import.');
        const source=await fileSource(file);if(signal.aborted)return;addSources([source]);section.questions=[...existing,...questions];refresh();
      }
    }catch(e){if(signal.aborted)return;field.disabled=false;importMessage='';error(e.message);}
  },{signal});
  root.addEventListener('submit',async event=>{
    if(event.target.id!=='exam-builder-form')return;
    event.preventDefault();event.stopPropagation();capture(root);
    const button=event.target.querySelector('button[type="submit"]');button.disabled=true;
    try{await save(structuredClone(draft));dirty=false;importMessage='';importWarnings=[];draft={name:'',company:'',description:'',roles:['Umum'],sections:[emptySection()],sources:[]};}
    catch(e){error(e.message);button.disabled=false;}
  },{signal});
}
