const fail = message => { const error=new Error(message);error.status=400;throw error; };
const text = (value,min,max,label) => {
  if(typeof value !== 'string' || value.trim().length<min || value.length>max) fail(`${label} harus ${min}–${max} karakter.`);
  return value.trim();
};
const integer = (value,min,max,label) => {if(!Number.isInteger(value)||value<min||value>max)fail(`${label} harus angka bulat ${min}–${max}.`);return value;};
export const SOURCE_LIMIT=1024*1024, TOTAL_SOURCE_LIMIT=2*SOURCE_LIMIT;
const mediaTypes={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain; charset=utf-8',md:'text/plain; charset=utf-8',csv:'text/csv; charset=utf-8',json:'application/json; charset=utf-8',zip:'application/zip'};
export function createCustomDefinition(input,id) {
  if(!input || typeof input!=='object' || Array.isArray(input))fail('Data ujian tidak valid.');
  const name=text(input.name,3,120,'Nama ujian'),company=text(input.company,2,120,'Penyelenggara');
  if(!Array.isArray(input.roles)||input.roles.length<1||input.roles.length>30)fail('Isi 1–30 posisi peserta.');
  const roleNames=input.roles.map(r=>text(r,2,100,'Posisi'));
  if(new Set(roleNames.map(r=>r.toLocaleLowerCase('id-ID'))).size!==roleNames.length)fail('Nama posisi harus berbeda.');
  if(!Array.isArray(input.sections)||input.sections.length<1||input.sections.length>10)fail('Ujian memerlukan 1–10 bagian.');
  const questions=[];
  const sections=input.sections.map((s,si)=>{
    if(!s||typeof s!=='object')fail('Bagian ujian tidak valid.');
    const section=`S${si+1}`,name=text(s.name,2,100,'Nama bagian'),minutes=integer(s.minutes,1,180,'Waktu bagian');
    if(!Array.isArray(s.questions)||!s.questions.length||s.questions.length>100)fail('Setiap bagian memerlukan 1–100 soal.');
    const items=s.questions.map((q,qi)=>{
      if(!q||typeof q!=='object')fail('Soal tidak valid.');
      const kind=q.kind;
      if(!['choice','weighted','text','likert'].includes(kind))fail('Jenis soal tidak didukung.');
      const question={id:`${section}-Q${qi+1}`,section,number:qi+1,kind:kind==='weighted'?'choice':kind,prompt:text(q.prompt,3,4000,'Teks soal'),context:text(q.context||'',0,6000,'Bacaan/data pendukung'),sourceName:text(q.sourceName||'',0,200,'Referensi sumber'),analysis:text(q.explanation||'',0,4000,'Pembahasan')};
      if(kind==='choice'||kind==='weighted') {
        if(!Array.isArray(q.options)||q.options.length<2||q.options.length>5)fail('Pilihan ganda memerlukan 2–5 pilihan.');
        question.options=q.options.map(o=>text(o,1,1500,'Pilihan jawaban'));
        if(kind==='weighted') {
          if(!Array.isArray(q.weights)||q.weights.length!==q.options.length)fail('Isi bobot setiap pilihan jawaban.');
          question.weights=q.weights.map(w=>integer(w,0,100,'Bobot pilihan'));
          question.max=Math.max(...question.weights);
          if(!question.max)fail('Minimal satu pilihan harus mempunyai bobot di atas nol.');
          question.answer='ABCDE'[question.weights.indexOf(question.max)];
        } else {
          if(typeof q.key!=='string'||q.key.length!==1||!'ABCDE'.slice(0,q.options.length).includes(q.key))fail('Pilih kunci jawaban yang tersedia.');
          question.answer=q.key;question.max=integer(q.points??1,1,100,'Poin soal');
        }
      } else if(kind==='text') {
        if(!Array.isArray(q.acceptedAnswers)||!q.acceptedAnswers.length||q.acceptedAnswers.length>10)fail('Jawaban singkat memerlukan 1–10 kunci alternatif.');
        question.acceptedAnswers=q.acceptedAnswers.map(a=>text(a,1,120,'Kunci jawaban singkat'));
        question.answer=question.acceptedAnswers[0];question.max=integer(q.points??1,1,100,'Poin soal');
      } else {
        if(q.reversed!==undefined&&typeof q.reversed!=='boolean')fail('Pembalikan skala tidak valid.');
        question.reversed=Boolean(q.reversed);question.max=0;
        question.scale=['Sangat tidak sesuai','Tidak sesuai','Netral','Sesuai','Sangat sesuai'].map((label,i)=>({value:i+1,label}));
      }
      questions.push(question);return question.id;
    });
    return {id:section,name,short:name,minutes,count:items.length,items,break:false,instruction:text(s.instruction||'',0,2000,'Instruksi bagian')};
  });
  const minutes=sections.reduce((n,s)=>n+s.minutes,0);
  if(minutes>180)fail('Jumlah waktu ujian maksimal 180 menit.');
  if(questions.length>300)fail('Satu ujian maksimal 300 soal.');
  const sources=validateSources(input.sources);
  return {definition:{id,custom:true,name,label:name,company,description:text(input.description||'',0,2000,'Deskripsi ujian'),roles:roleNames.map((name,i)=>({id:`role-${i+1}`,name})),sections,questions,count:questions.length,minutes,max:questions.reduce((n,q)=>n+q.max,0),scoreLabel:'Skor soal berkunci',documents:[],sources:sources.map(({data,...s})=>s)},sources};
}
export function customPublicQuestions(definition,section) {
  return definition.questions.filter(q=>q.section===section).map(({id,section,number,kind,prompt,options,scale,context})=>({id,section,number,kind,prompt,...(options?{options}:{}),...(scale?{scale}:{}),...(context?{stimulus:{title:'Bacaan / data pendukung',text:context}}:{})}));
}
const normalize=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('id-ID');
export function scoreCustomExam(definition,answers) {
  const sections=definition.sections.map(s=>{
    const details=definition.questions.filter(q=>q.section===s.id).map(q=>{
      const response=answers[q.id]??null,answered=response!==null&&response!=='';
      const points=q.kind==='likert'?0:q.weights?(answered?q.weights['ABCDE'.indexOf(response)]??0:0):q.kind==='text'?(q.acceptedAnswers.some(a=>normalize(a)===normalize(response))?q.max:0):(response===q.answer?q.max:0);
      return {id:q.id,number:q.number,prompt:q.prompt,options:q.options,weights:q.weights,acceptedAnswers:q.acceptedAnswers,response,key:q.answer??null,points,max:q.max,analysis:q.analysis,sourceName:q.sourceName,answered,kind:q.kind,...(q.kind==='likert'?{reversed:q.reversed,scaleScore:answered?(q.reversed?6-response:response):null}:{})};
    });
    return {id:s.id,name:s.name,short:s.short,count:s.count,answered:details.filter(d=>d.answered).length,score:details.reduce((n,q)=>n+q.points,0),max:details.reduce((n,q)=>n+q.max,0),details};
  });
  const total=sections.reduce((n,s)=>n+s.score,0);
  return {custom:true,examType:definition.id,total,max:definition.max,percent:definition.max?Math.round(total/definition.max*100):null,answered:sections.reduce((n,s)=>n+s.answered,0),sections};
}
export function customDefinitionSummary({questions,sections,...definition}) {
  return {...definition,sections:sections.map(({items,...section})=>section)};
}

export function validateSources(inputSources) {
  const sources=[];
  if(inputSources!==undefined&&(!Array.isArray(inputSources)||inputSources.length>10))fail('Maksimal 10 dokumen sumber.');
  let bytes=0;
  for(const [index,source] of (inputSources||[]).entries()) {
    const name=text(source?.name,1,180,'Nama dokumen').replace(/[\r\n\/\\]/g,'_');
    const extension=name.split('.').at(-1).toLowerCase(),type=mediaTypes[extension];
    if(!type)fail('Sumber harus PDF, DOCX, ZIP, TXT, MD, CSV, atau JSON.');
    if(typeof source.data!=='string'||source.data.length>Math.ceil(SOURCE_LIMIT/3)*4+4||!source.data.length||source.data.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(source.data))fail('Isi dokumen sumber tidak valid atau melebihi 1 MB.');
    const buffer=Buffer.from(source.data,'base64');
    if(buffer.length>SOURCE_LIMIT||buffer.toString('base64')!==source.data)fail('Isi dokumen sumber tidak valid atau melebihi 1 MB.');
    if(extension==='pdf'&&!buffer.subarray(0,5).equals(Buffer.from('%PDF-')))fail('Berkas PDF tidak valid.');
    if(['docx','zip'].includes(extension)&&!(buffer[0]===0x50&&buffer[1]===0x4b))fail('Berkas DOCX/ZIP tidak valid.');
    bytes+=buffer.length;if(bytes>TOTAL_SOURCE_LIMIT)fail('Total dokumen sumber maksimal 2 MB.');
    sources.push({id:`source-${index+1}`,name,type,size:buffer.length,data:source.data});
  }
  return sources;
}
