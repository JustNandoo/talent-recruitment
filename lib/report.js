import PDFDocument from 'pdfkit';
import {INTERVIEWS} from './bank.js';
const decisions={belum_diputuskan:'Belum diputuskan',lanjut:'Lanjut proses',ditahan:'Ditahan / klarifikasi',tidak_lanjut:'Tidak lanjut'};
const date=value=>value?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(value))+' WIB':'Belum tersedia';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const plain=value=>String(value??'—').normalize('NFKC').replace(/[–—−]/g,'-').replace(/→/g,' -> ').replace(/≥/g,'>=').replace(/≤/g,'<=').replace(/×/g,'x').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff]/g,'');
const score=(value,max)=>max?`${value ?? 0}/${max}`:'Kuesioner';
export function buildReport(exam,generatedAt=Date.now()) {
  const r=exam.result;
  if(!r){const error=new Error('Laporan tersedia setelah ujian selesai.');error.status=409;throw error;}
  const sections=[];
  const add=(title,paragraphs=[],headers=[],rows=[])=>{paragraphs=paragraphs.filter(Boolean);if(paragraphs.length||rows.length)sections.push({title,paragraphs,headers,rows});};
  add('Ringkasan hasil',[`${r.answered}/${exam.questionCount} butir dijawab.`, `Tinjauan tes: ${exam.review?.label||'Perlu ditinjau penguji'}.`, `Keputusan penguji: ${decisions[exam.decision]||decisions.belum_diputuskan}.`],['Bagian','Jawaban','Skor'],r.sections.map(s=>[s.name,`${s.answered}/${s.count}`,score(s.score,s.max)]));
  if(exam.custom){
    add('Skoring ujian buatan penguji',['Skor mengikuti kunci dan bobot ujian ini. Skala 1-5 dilaporkan terpisah; tidak memakai profil kepribadian Serviam atau Indo Artha.']);
    const scales=r.sections.flatMap(s=>s.details.filter(d=>d.kind==='likert').map(d=>[s.name,d.prompt,d.response??'Belum dijawab',d.reversed?'Ya':'Tidak',d.scaleScore??'—']));
    if(scales.length)add('Respons skala 1-5',[],['Bagian','Pernyataan','Respons','Dibalik','Skor'],scales);
  }else if(exam.examType==='indo-artha'||exam.examType==='indo-artha-ringkas'){
    const a=r.analysis;
    add('Model 1 - Kognitif dan ketelitian (TIU)',[a.m1.narrative],['Subtes','Skor','Kategori'],a.m1.subtests.map(s=>[s.label,score(s.score,s.max),s.category]));
    add('Model 3 - Situasional',[a.m3.narrative],['Kompetensi','Skor','Kategori'],a.m3.competencies.map(s=>[s.label,score(s.score,s.max),s.category]));
    add('Model 2 - Gaya kerja dan validitas',[a.m2.narrative,`Validitas: ${a.m2.interpretable?'Dapat didiskusikan':'Tidak ditafsirkan'}. SV ${a.m2.validity.sv??'—'}/25; pasangan tidak konsisten ${a.m2.validity.inconsistent}.`, 'Profil gaya kerja hanya dihitung dari jawaban Model 2; tidak diturunkan dari skor TIU.'],['Dimensi','Skor / 25','Kategori','Target posisi'],a.m2.dimensions.map(d=>[d.label,d.score??'—',a.m2.interpretable?d.category||'Belum lengkap':'Tidak ditafsirkan',d.targetLabel||'—']));
    add('Rekomendasi awal dan klarifikasi',[a.recommendation.status,a.recommendation.action,...a.summary.confirm,...a.summary.interview.map(q=>`${q.source}: ${q.question}`)]);
  }else{
    add('Bagian E - Kepribadian kerja',[`Validitas: ${r.personality.valid?'Dapat didiskusikan':'Tidak ditafsirkan'}. Profil berasal dari jawaban bagian E, bukan skor kognitif/TIU.`],['Dimensi','Skor / 15','Kategori'],r.personality.dimensions.map(d=>[d.name,d.score??'—',d.label]));
    add('Hal yang perlu diklarifikasi',r.flags.map(f=>`${f.question}: ${f.text}`));
  }
  const interview=(exam.examType==='serviam'&&!exam.custom?INTERVIEWS:[]).filter(q=>exam.interview?.[q.id]?.score!=null||exam.interview?.[q.id]?.note).map(q=>[q.question||q.prompt||q.id,exam.interview[q.id].score??'—',exam.interview[q.id].note||'—']);
  add('Catatan dan keputusan penguji',[`Keputusan: ${decisions[exam.decision]||decisions.belum_diputuskan}.`,exam.note||'Belum ada catatan penguji.',exam.reviewedAt?`Terakhir disimpan: ${date(exam.reviewedAt)}.`:'Keputusan/catatan belum disimpan.'],interview.length?['Wawancara','Skor / 5','Catatan']:[],interview);
  return {name:exam.name,company:exam.company,label:exam.examLabel,total:score(r.total,r.max),generatedAt:date(generatedAt),identity:[['Nama peserta',exam.name],['Posisi',exam.roleName],['Email',exam.email||'Tidak dicantumkan'],['Jenis ujian',exam.examLabel],['Diundang',date(exam.createdAt)],['Selesai',date(exam.finishedAt)]],sections};
}
export function reportHtml(report,pdfUrl) {
  const table=(headers,rows)=>headers.length?`<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hasil - ${esc(report.name)}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#edf2ef;color:#23352e;font:14px/1.6 Arial,sans-serif}.toolbar{display:flex;flex-wrap:wrap;gap:12px;max-width:900px;margin:24px auto;padding:0 24px}.toolbar button,.toolbar a{font:inherit;padding:10px 18px;border:1px solid #235c49;border-radius:8px;background:#235c49;color:white;text-decoration:none;cursor:pointer}main{max-width:900px;margin:0 auto 32px;padding:48px;background:white}header{border-bottom:2px solid #235c49;padding-bottom:20px}h1{font-size:28px;line-height:1.3;margin:12px 0}h2{font-size:18px;margin:0 0 12px}p{white-space:pre-wrap;overflow-wrap:anywhere}section{margin-top:28px}table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}th,td{padding:9px 10px;text-align:left;border:1px solid #dce4de;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}th{background:#edf5ef}.meta td:first-child{width:28%;font-weight:bold}.caption{font-size:11px;color:#62766a}footer{margin-top:30px;font-size:11px;color:#62766a}@page{size:A4;margin:15mm}@media print{body{background:white;font-size:10pt}.toolbar{display:none}main{max-width:none;margin:0;padding:0}h2{break-after:avoid}thead{display:table-header-group}tr{break-inside:avoid}header{break-inside:avoid}section{margin-top:18px}table{font-size:9pt}th,td{padding:6px}a{color:inherit}}
  </style><script src="/report-print.js" defer></script></head><body><nav class="toolbar"><button type="button" data-print-report>Cetak / simpan sebagai PDF</button><a href="${esc(pdfUrl)}" download>Unduh PDF</a></nav><main><header><div>${esc(report.company)}</div><h1>Laporan hasil asesmen</h1><p>${esc(report.label)}</p><strong>Skor soal berkunci: ${esc(report.total)}</strong></header><section>${table(['Identitas peserta','Keterangan'],report.identity)}</section>${report.sections.map(s=>`<section><h2>${esc(s.title)}</h2>${s.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}${table(s.headers,s.rows)}</section>`).join('')}<footer>Dicetak/diekspor: ${esc(report.generatedAt)}. Hasil untuk peninjauan tim rekrutmen; keputusan akhir dicatat oleh penguji.</footer></main></body></html>`;
}
export function createPdfReport(report) {
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margins:{top:48,bottom:54,left:48,right:48},bufferPages:true,info:{Title:`Hasil asesmen - ${plain(report.name)}`,Author:plain(report.company)}}),chunks=[];
    doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
    const width=doc.page.width-96,bottom=()=>doc.page.height-54;
    const ensure=h=>{if(doc.y+h>bottom())doc.addPage();};
    const paragraph=(value,options={})=>{doc.font(options.bold?'Helvetica-Bold':'Helvetica').fontSize(options.size||10).fillColor(options.color||'#23352e');const h=doc.heightOfString(plain(value),{width,lineGap:3});if(h<doc.page.height-110)ensure(h+8);doc.text(plain(value),48,doc.y,{width,lineGap:3});doc.moveDown(.35);};
    function wrap(value,cellWidth){doc.font('Helvetica').fontSize(9);const lines=[];for(const para of plain(value).split('\n')){let line='';for(const word of para.split(/\s+/)){if(doc.widthOfString((line?line+' ':'')+word)<=cellWidth){line+=(line?' ':'')+word;continue;}if(line)lines.push(line);line='';for(const ch of word){if(doc.widthOfString(line+ch)>cellWidth){lines.push(line);line='';}line+=ch;}}lines.push(line);}return lines;}
    function table(headers,rows){
      if(!headers.length)return;
      const weights=headers.length===5?[.14,.42,.14,.14,.16]:headers.length===4?[.4,.15,.25,.2]:headers.length===3?[.54,.2,.26]:[.3,.7],widths=weights.map(w=>w*width);
      function row(lines,offset,count,header=false){const h=count*12+10,y=doc.y;let x=48;doc.save().fillColor(header?'#e7f0e9':'#ffffff').rect(48,y,width,h).fill();doc.restore();
        lines.forEach((cell,i)=>{doc.font(header?'Helvetica-Bold':'Helvetica').fontSize(9).fillColor('#23352e').text(cell.slice(offset,offset+count).join('\n'),x+7,y+5,{width:widths[i]-14,height:h-10,lineGap:2});x+=widths[i];});
        doc.strokeColor('#dce4de').lineWidth(.5).moveTo(48,y+h).lineTo(48+width,y+h).stroke();doc.x=48;doc.y=y+h;
      }
      const head=headers.map((h,i)=>wrap(h,widths[i]-14)),headLines=Math.max(...head.map(l=>l.length));
      const drawHead=()=>{ensure(headLines*13+44);row(head,0,headLines,true);};drawHead();
      for(const values of rows){const cells=values.map((v,i)=>wrap(v,widths[i]-14)),total=Math.max(...cells.map(c=>c.length));let offset=0;
        while(offset<total){let fits=Math.floor((bottom()-doc.y-14)/13);if(fits<1){doc.addPage();drawHead();fits=Math.floor((bottom()-doc.y-14)/13);}const count=Math.min(total-offset,fits);row(cells,offset,count);offset+=count;}
      }
      doc.y+=14;
    }
    try {
      paragraph(report.company,{bold:true,size:10,color:'#235c49'});paragraph('Laporan hasil asesmen',{bold:true,size:24});paragraph(report.label,{size:12});paragraph(`Skor soal berkunci: ${report.total}`,{bold:true,size:14});doc.moveDown();table(['Identitas peserta','Keterangan'],report.identity);
      for(const s of report.sections){ensure(70);paragraph(s.title,{bold:true,size:14,color:'#235c49'});s.paragraphs.forEach(p=>paragraph(p));table(s.headers,s.rows);}
      ensure(45);paragraph(`Dicetak/diekspor: ${report.generatedAt}`,{size:8,color:'#62766a'});
      const range=doc.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);const margin=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font('Helvetica').fontSize(8).fillColor('#62766a').text(plain(`Hasil asesmen | ${report.name} | ${i+1}/${range.count}`),48,doc.page.height-32,{width,height:16,lineBreak:false,continued:false});doc.page.margins.bottom=margin;}
      doc.end();
    }catch(error){doc.destroy();reject(error);}
  });
}
