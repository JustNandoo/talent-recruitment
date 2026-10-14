import { unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
const fail = message => { const error=new Error(message);error.status=400;throw error; };
const MAX_TEXT=400000, MAX_EXPANDED=16*1024*1024;
const xml = buffer => {
  const raw=Buffer.from(buffer).toString('utf8');
  if(/<!DOCTYPE|<!ENTITY/i.test(raw))fail('Dokumen XML tidak didukung.');
  return new XMLParser({preserveOrder:true,ignoreAttributes:false,trimValues:false,parseTagValue:false,parseAttributeValue:false}).parse(raw);
};
const children=(node,name)=>node?.[name]||[];
function find(nodes,name) { for(const node of nodes||[]) {if(name in node)return node;for(const [key,value]of Object.entries(node))if(Array.isArray(value)){const result=find(value,name);if(result)return result;}} }
function all(nodes,name) {const out=[];for(const node of nodes||[])for(const [key,value]of Object.entries(node)){if(key===name)out.push(node);if(Array.isArray(value))out.push(...all(value,name));}return out;}
const attr=node=>node?.[':@']?.['@_w:val'];
function nodeText(nodes) {return (nodes||[]).map(node=>Object.entries(node).map(([key,value])=>key==='#text'?String(value):key==='w:tab'?'\t':key==='w:br'||key==='w:cr'?'\n':key==='w:drawing'?' [GAMBAR SUMBER] ':key===':@'?'':Array.isArray(value)?nodeText(value):'').join('')).join('');}
function boundedZip(buffer,filter=()=>true) {
  let total=0,count=0;
  return unzipSync(buffer,{filter:entry=>{
    if(++count>200 || entry.originalSize>8*1024*1024 || (total+=entry.originalSize)>MAX_EXPANDED)fail('Arsip terlalu besar setelah diekstrak. Maksimal 16 MB / 200 entri.');
    return filter(entry.name);
  }});
}
export function readDocx(buffer) {
  const zip=boundedZip(buffer,name=>name==='word/document.xml'||name==='word/numbering.xml');
  if(!zip['word/document.xml'])fail('Word tidak valid. Gunakan format .docx.');
  const numbering=zip['word/numbering.xml']?xml(zip['word/numbering.xml']):[],abstracts=new Map(),nums=new Map(),counters=new Map();
  for(const node of all(numbering,'w:abstractNum')) {
    const levels=new Map();for(const level of children(node,'w:abstractNum').filter(n=>n['w:lvl']))levels.set(level[':@']?.['@_w:ilvl'],{format:attr(find(level['w:lvl'],'w:numFmt')),start:Number(attr(find(level['w:lvl'],'w:start'))||1)});
    abstracts.set(node[':@']?.['@_w:abstractNumId'],levels);
  }
  for(const node of all(numbering,'w:num'))nums.set(node[':@']?.['@_w:numId'],attr(find(node['w:num'],'w:abstractNumId')));
  const lines=[],body=find(xml(zip['word/document.xml']),'w:body');
  function paragraph(node){let value=nodeText(node['w:p']).trim();const num=find(node['w:p'],'w:numPr');
    if(num&&value){const numId=attr(find(num['w:numPr'],'w:numId')),level=attr(find(num['w:numPr'],'w:ilvl'))||'0',format=abstracts.get(nums.get(numId))?.get(level);
      if(format&&format.format!=='bullet'){const id=`${numId}:${level}`,n=counters.get(id)??format.start;counters.set(id,n+1);const label=/letter/i.test(format.format)?String.fromCharCode((format.format==='lowerLetter'?97:65)+n-1):String(n);value=`${label}. ${value}`;}
    }return value;}
  for(const node of children(body,'w:body')) {
    if(node['w:p'])lines.push(paragraph(node));
    if(node['w:tbl'])for(const row of node['w:tbl'].filter(n=>n['w:tr']))lines.push(row['w:tr'].filter(n=>n['w:tc']).map(cell=>all(cell['w:tc'],'w:p').map(paragraph).join('\n')).join(' | '));
  }
  return lines.join('\n');
}
export async function readPdf(buffer){
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,verbosity:0});
  try {const doc=await task.promise;if(doc.numPages>80)fail('PDF maksimal 80 halaman.');const lines=[];let length=0;
    for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),content=await page.getTextContent();let lastY,line='';
      for(const item of content.items){if(!('str'in item))continue;const y=item.transform[5];if(lastY!==undefined&&Math.abs(y-lastY)>3&&line){lines.push(line);line='';}line+=(line?' ':'')+item.str;lastY=y;if(item.hasEOL){lines.push(line);line='';lastY=undefined;}length+=item.str.length;if(length>MAX_TEXT)fail('Teks PDF terlalu panjang.');}
      if(line)lines.push(line);page.cleanup();}
    if(lines.join('').trim().length<20)fail('PDF ini tidak memiliki teks yang bisa dibaca (kemungkinan scan). Gunakan Word atau PDF dengan teks yang dapat dipilih.');
    return lines.join('\n');
  }finally{await task.destroy();}
}
const groupName=name=>(name.match(/model\s*\d+/i)?.[0]||name.replace(/\.[^.]+$/,'').replace(/\b(?:soal|kunci|jawaban|pembahasan|analisa|rahasia)\b/gi,'').replace(/[^\p{L}\p{N}]+/gu,' ')).trim().toLowerCase();
export function parseDocumentText(raw,name='dokumen.txt') {
  if(raw.length>MAX_TEXT)fail('Teks dokumen terlalu panjang.');
  const lines=raw.replace(/\u00a0/g,' ').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),questions=[],keys=new Map(),warnings=[];
  const isKey=/^(?:kunci|jawaban|answer|pembahasan)/i.test(name),likert=/sangat tidak sesuai|skala\s*1\s*[–-]\s*5/i.test(raw);
  let current=null,keyHeader=null,context='',contextRange=null,capturingContext=false,sharedOptions=null;
  const splitOptions=line=>[...line.replace(/[·|;]\s*(?=[A-Ea-e][.)])/g,' ').matchAll(/(?:^|\s+)([A-Ea-e])[.)]\s+(.+?)(?=\s+[A-Ea-e][.)]\s+|$)/g)];
  const put=(no,data)=>{const prior=keys.get(no);if(prior&&JSON.stringify(prior)!==JSON.stringify(data)){warnings.push(`Kunci nomor ${no} lebih dari satu; periksa dokumen ${name}.`);keys.set(no,{conflict:true});}else keys.set(no,data);};
  for(const line of lines) {
    if(!isKey&&/^lembar jawaban/i.test(line))break;
    const shared=line.match(/^Soal\s+(\d+)\s*[–-]\s*(\d+)\./i);
    if(shared){sharedOptions={start:Number(shared[1]),end:Number(shared[2]),options:splitOptions(line.slice(line.indexOf('A.'))).map(o=>o[2].replace(/\.$/,''))};current=null;continue;}
    const cells=line.split(/\s*\|\s*/);
    if(cells.length>2 && /^(?:no\.?|nomor|kasus)$/i.test(cells[0])) {
      keyHeader=null;
      if(cells.some(c=>/^(?:kunci|jawaban)$/i.test(c)))keyHeader=cells.map(c=>c.toLowerCase());
      else if(isKey&&cells.includes('A')&&cells.includes('B'))keyHeader=cells;
      else if(cells.some(c=>/pernyataan|pertanyaan|soal/i.test(c)))keyHeader=cells.map(c=>c.toLowerCase());
      if(capturingContext)context+='\n'+line;continue;
    }
    if(sharedOptions&&cells.length===3&&/^\d+$/.test(cells[0])&&Number(cells[0])>=sharedOptions.start&&Number(cells[0])<=sharedOptions.end){questions.push({number:Number(cells[0]),prompt:`Bandingkan data kiri dan kanan.\nData kiri: ${cells[1]}\nData kanan: ${cells[2]}`,kind:'choice',options:sharedOptions.options,key:'',points:1,sourceName:name});continue;}
    if(capturingContext&&cells.length>1){context+='\n'+line;continue;}
    if(cells.length>2&&/^\d+$/.test(cells[0])&&keyHeader){const no=Number(cells[0]),ki=keyHeader.findIndex(c=>/^(kunci|jawaban)$/.test(c)),pi=keyHeader.findIndex(c=>/pernyataan|pertanyaan|soal/.test(c));
      if(ki>=0&&/^[A-E]$/i.test(cells[ki]))put(no,{key:cells[ki].toUpperCase(),explanation:cells[keyHeader.findIndex(c=>/pembahasan/.test(c))]||''});
      else if(keyHeader.includes('A')){const weights='ABCDE'.split('').filter(c=>keyHeader.includes(c)).map(c=>Number(cells[keyHeader.indexOf(c)]?.match(/^\d+/)?.[0]));if(weights.length>=2&&weights.every(Number.isInteger))put(no,{weights});}
      else if(pi>=0&&likert&&!isKey)questions.push({number:no,prompt:cells[pi],kind:'likert',reversed:false,sourceName:name});
      continue;
    }
    if(/^(?:bacaan|teks|tabel|data|keterangan)\s+(?:untuk|berikut)/i.test(line)) {const range=line.match(/(?:soal\s*)?(\d+)\s*[–-]\s*(\d+)/);contextRange=range?[Number(range[1]),Number(range[2])]:null;context=line;capturingContext=true;current=null;continue;}
    // A separate answer sheet can contain compact pairs such as 1. B, 2C, or 3: D.
    if(isKey||/^(?:kunci|ringkasan kunci)/i.test(line)) {
      const pairs=[...line.matchAll(/\b(\d+)\s*[.:)=-]?\s*([A-E])\b/gi)];
      for(const pair of pairs){const no=Number(pair[1]);if(!keys.has(no))put(no,{key:pair[2].toUpperCase()});}
      if(isKey){for(const match of line.matchAll(/\b(\d+)R\b/g))put(Number(match[1]),{reversed:true});continue;}
    }
    const key=line.match(/^(?:kunci(?:\s+jawaban)?|jawaban(?:\s+benar)?|answer)\s*[:=]\s*([A-E])\b(?:\s*[.·—–-]?\s*(.*))?$/i);
    if(key&&current){current.key=key[1].toUpperCase();if(key[2])current.explanation=key[2];continue;}
    const explanation=line.match(/^(?:pembahasan|penjelasan)\s*[:=]\s*(.+)$/i);if(explanation&&current){current.explanation=explanation[1];continue;}
    const title=line.match(/^(?:(?:soal|kasus|pertanyaan)\s+)?(\d+)(?:\s*[.):\-]\s*|\s+)(.+)$/i);
    if(title&&!isKey){const number=Number(title[1]);current={number,prompt:title[2],kind:likert?'likert':'choice',options:[],key:'',points:1,sourceName:name,context:context&&(!contextRange||(number>=contextRange[0]&&number<=contextRange[1]))?context:''};questions.push(current);capturingContext=false;continue;}
    if(capturingContext){context+='\n'+line;continue;}
    if(current){const options=splitOptions(line);
      if(options.length){for(const option of options)current.options[option[1].toUpperCase().charCodeAt(0)-65]=option[2].trim();current.kind='choice';}
      else if(!/^(?:subtes|model|petunjuk|periksa kembali|nama:)/i.test(line)){if(current.options.length)current.options[current.options.length-1]+='\n'+line;else current.prompt+='\n'+line;}
    }
  }
  const usable=questions.filter(q=>q.kind==='likert'||q.options.length>=2);
  if(questions.length!==usable.length)warnings.push(`${questions.length-usable.length} butir tidak mempunyai pilihan yang terbaca dan tidak diimpor (${name}).`);
  if(raw.includes('[GAMBAR SUMBER]'))warnings.push(`Ada gambar di ${name}; isi gambar belum dikonversi. Periksa sumber sebelum menerbitkan.`);
  return {name,group:groupName(name),questions:usable,keys,warnings,minutes:Number(raw.match(/(?:waktu|selama)\s*(\d+)\s*menit/i)?.[1]||20)};
}
export async function importDocuments(sources) {
  const docs=[];let expanded=0;
  async function read(name,buffer){const ext=name.split('.').at(-1).toLowerCase();expanded+=buffer.length;if(expanded>MAX_EXPANDED)fail('Total dokumen hasil ekstraksi terlalu besar.');
    if(ext==='zip'){const zip=boundedZip(buffer,n=>/\.(docx|pdf|txt|md)$/i.test(n)&&!n.startsWith('__MACOSX/'));for(const [path,data]of Object.entries(zip)){if(docs.length>=20)fail('Maksimal 20 dokumen per impor.');await read(path.split('/').at(-1),data);}return;}
    if(!['docx','pdf','txt','md'].includes(ext))fail('Impor otomatis mendukung Word (.docx), PDF teks, TXT, MD, atau ZIP berisi dokumen tersebut.');
    let text;try{text=ext==='docx'?readDocx(buffer):ext==='pdf'?await readPdf(buffer):buffer.toString('utf8');}catch(error){if(error.status)throw error;fail(`${name} tidak dapat dibaca. Periksa format dan proteksi dokumen.`);}
    if(/^(?:panduan|lembar rekap)/i.test(name)){docs.push({name,questions:[],keys:new Map(),warnings:[`${name} disimpan sebagai referensi; bukan file soal.`]});return;}
    docs.push(parseDocumentText(text,name));
  }
  for(const source of sources)await read(source.name,Buffer.from(source.data,'base64'));
  const questionDocs=docs.filter(d=>d.questions.length),keyDocs=docs.filter(d=>d.keys.size),warnings=docs.flatMap(d=>d.warnings),sections=[];
  if(!questionDocs.length)fail('Tidak ditemukan soal. Gunakan soal bernomor dan pilihan A., B., dst. Sertakan file soal bersama file kunci.');
  for(const doc of questionDocs){const matches=keyDocs.filter(k=>k===doc||k.group===doc.group||(questionDocs.length===1&&keyDocs.length===1));let missing=0;
    const questions=doc.questions.map(q=>{const found=matches.map(k=>k.keys.get(q.number)).filter(Boolean);const unique=new Set(found.map(({key,weights,reversed,conflict})=>JSON.stringify({key,weights,reversed,conflict})));
      if(unique.size>1||found.some(k=>k.conflict)){warnings.push(`Kunci nomor ${q.number} ambigu (${doc.name}); isi setelah memeriksa sumber.`);q.key='';}
      else if(found[0]){const key=found[0];if(q.kind==='likert'){q.reversed=Boolean(key.reversed);}else if(key.weights){q.kind='weighted';q.weights=key.weights;q.key='';}else q.key=key.key;if(key.explanation)q.explanation=key.explanation;}
      if(q.kind==='choice'&&(!q.key||!q.options[q.key.charCodeAt(0)-65])){q.key='';missing++;}
      if(q.kind==='weighted'&&q.weights.length!==q.options.length){q.kind='choice';q.key='';missing++;warnings.push(`Bobot nomor ${q.number} tidak cocok dengan jumlah pilihan.`);}
      const {number,...question}=q;return question;
    });
    if(missing)warnings.push(`${missing} soal di ${doc.name} belum memiliki kunci yang terbaca. Pilih kunci sebelum menyimpan.`);
    if(questions.length>100)fail('Maksimal 100 soal per dokumen/bagian. Pecah dokumen menjadi beberapa bagian.');
    sections.push({name:doc.name.replace(/\.[^.]+$/,'').slice(0,100),minutes:doc.minutes,instruction:'Kerjakan sesuai petunjuk pada setiap soal.',questions});
  }
  if(sections.length>10||sections.reduce((n,s)=>n+s.questions.length,0)>300)fail('Maksimal 10 bagian dan 300 soal per ujian.');
  return {sections,warnings,count:sections.reduce((n,s)=>n+s.questions.length,0)};
}
