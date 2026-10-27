import { customPublicQuestions, scoreCustomExam } from './custom-exams.js';
import { SECTIONS, ROLES, QUESTIONS, publicQuestions } from './bank.js';
import { scoreExam, reviewStatus } from './scoring.js';
import { PACKAGES, MODEL_INFO, POSITIONS, ITEMS, M3_CODES, publicItem } from './indo-artha/bank.js';
import { analyzeParticipant } from './indo-artha/analysis.js';

const documents = ['Panduan Penguji.docx', 'Soal Model 1 - Kognitif.docx', 'Soal Model 2 - Gaya Kerja.docx', 'Soal Model 3 - Situasional.docx', 'Kunci & Analisa Model 1 (rahasia).docx', 'Kunci & Analisa Model 2 (rahasia).docx', 'Kunci & Analisa Model 3 (rahasia).docx', 'Lembar Rekap & Keputusan.docx'];
// Catalog dates come from the first bank commits, not process/deployment time.
const indo = (id, pkg) => {
  const sections = PACKAGES[pkg].sections.map(s => ({ id: s.key, name: s.break ? 'Jeda istirahat' : MODEL_INFO[s.key].title, short: s.break ? 'Jeda' : MODEL_INFO[s.key].short, minutes: s.minutes, count: s.items?.length || 0, break: Boolean(s.break), instruction: s.break ? 'Istirahat selama 10 menit. Bagian berikutnya terbuka setelah jeda selesai.' : MODEL_INFO[s.key].instructions(s.items.length, s.minutes).join(' '), items: s.items || [] }));
  return { id, pkg, createdAt:Date.parse('2026-10-14T15:49:18+07:00'), updatedAt:Date.parse(pkg==='lengkap'?'2026-10-22T18:29:28+07:00':'2026-10-14T15:49:18+07:00'), name: 'Indo Artha Group Psikotes', company: 'DIVISI HR · Indo Artha Group', label: pkg==='lengkap'?'DIVISI HR · Indo Artha Group · Psikotes':'Indo Artha Group · Ringkas operator (arsip)', archived:pkg!=='lengkap', sections, roles: POSITIONS.filter(p => pkg === 'lengkap' || p.ringkas).map(p => ({id:p.key, name:p.label})), count: sections.reduce((n,s) => n+s.count,0), minutes: sections.reduce((n,s) => n+s.minutes,0), max: pkg === 'lengkap' ? 66 : 21, scoreLabel: 'Skor M1 + M3', documents };
};
export const EXAMS = [
  { id: 'serviam', createdAt:Date.parse('2026-10-12T22:09:00+07:00'), updatedAt:Date.parse('2026-10-12T22:09:00+07:00'), name: 'Serviam Group Shipyard', label: 'Serviam · Asesmen rekrutmen', company: 'HRD Division PT Serviam Group Shipyard', sections: SECTIONS, roles: ROLES, count:48, minutes:65, max:46, scoreLabel:'Skor A–D', documents:[] },
  indo('indo-artha', 'lengkap'), indo('indo-artha-ringkas', 'ringkas'),
];
export const examDefinition = (type = 'serviam') => typeof type === 'object' && type !== null ? type : EXAMS.find(e => e.id === type);
export const definitionFor = exam => {
  const definition = exam.exam_definition ? JSON.parse(exam.exam_definition) : examDefinition(exam.exam_type || exam.examType || 'serviam');
  if (exam.exam_definition && definition.id !== (exam.exam_type || exam.examType)) throw new Error('Definisi ujian tidak sesuai jenis undangan.');
  if (!definition) throw new Error('Jenis ujian tersimpan tidak dikenal.');
  return definition;
};
export function publicDefinitions() {
  return EXAMS.map(({pkg, sections, ...exam}) => ({...exam, sections:sections.map(({items,...section})=>section)}));
}
export function questionsFor(type, section, publicOnly = false) {
  const definition = examDefinition(type);
  if (!definition) throw new Error('Jenis ujian tidak dikenal.');
  if (definition.custom) return publicOnly ? customPublicQuestions(definition, section) : definition.questions.filter(q=>q.section===section);
  if (definition.id === 'serviam') return publicOnly ? publicQuestions(section) : QUESTIONS.filter(q => q.section === section);
  const ids = definition.sections.find(s => s.id === section)?.items || [];
  return ids.map(id => {
    const item = ITEMS.get(id), question = publicOnly ? publicItem(id) : item;
    return { id, section, number:item.no, kind:section === 'M2' ? 'likert' : 'choice', prompt:(publicOnly ? question.text : item.text).replaceAll('**',''), ...(section === 'M2' ? { scale:publicItem(id).scale } : { options: publicOnly ? question.options.map(o=>o.text) : item.options }), ...(publicOnly ? { ...(question.stimulus ? {stimulus:question.stimulus} : {}), ...(question.pair ? {pair:question.pair} : {}) } : {source:item}) };
  });
}
export function validateExamAnswer(question, value) {
  if (value === '' || value === null) return true;
  if (question.kind === 'choice') return typeof value === 'string' && 'ABCDE'.slice(0,question.options.length).includes(value) && value.length === 1;
  if (question.kind === 'likert') return Number.isInteger(value) && value >= 1 && value <= 5;
  return typeof value === 'string' && value.length <= 120;
}
function situationalAnalysis(item, response) {
  const choice = item.key[response];
  if (!choice) return `Kasus ${item.no} (${item.kompetensi}) belum dijawab; pola respons belum dapat ditafsirkan.`;
  const code = M3_CODES[choice.code];
  return `Kasus ${item.no} (${item.kompetensi}, ${item.fungsi}): pilihan ${response} bernilai ${choice.points}/3, kode ${choice.code} (${code.name}). ${code.text}${code.flag ? ' Respons ini merupakan red flag dan perlu diklarifikasi saat wawancara.' : ''}`;
}
export function scoreForExam(exam) {
  const definition = definitionFor(exam), answers = scopedAnswers(exam, definition);
  if (definition.custom) return scoreCustomExam(definition, answers);
  if (definition.id === 'serviam') return {...scoreExam(answers, exam.role),examType:'serviam'};
  const analysis = analyzeParticipant({answers, pkg:definition.pkg, positionKey:exam.role});
  const total = analysis.m1.total + analysis.m3.total;
  const sections = ['M1','M3'].map(id => {
    const model = analysis[id.toLowerCase()];
    return {id, name:MODEL_INFO[id].title, short:MODEL_INFO[id].short, score:model.total, max:model.max, answered:model.answered, count:definition.sections.find(s=>s.id===id).count,
      details:questionsFor(definition.id,id).map(q => {
        const item=q.source, response=answers[q.id]??null, key=id==='M1'?item.key:Object.keys(item.key).find(letter=>item.key[letter].points===3);
        return {id:q.id, number:q.number, prompt:q.prompt, options:q.options, response, key, points:id==='M1'?Number(response===key):item.key[response]?.points||0, max:id==='M1'?1:3, analysis:id==='M1'?item.why:situationalAnalysis(item,response), answered:response!==null, ...(id==='M3'?{code:item.key[response]?.code??null}: {})};
      })};
  });
  return {examType:definition.id, version:'indo-artha-2026-10-13', total, max:definition.max, percent:Math.round(total/definition.max*100), answered:Object.values(answers).filter(v=>v!==null && v!=='').length, analysis, sections, minimumsMet:analysis.m1.threshold?.status==='memenuhi', flags:analysis.m3.redFlags.map(f=>({type:'integritas',question:`M3-${f.no}`,text:`${f.name}; klarifikasi saat wawancara.`})), personality:{valid:analysis.m2.interpretable,complete:analysis.m2.complete,dimensions:analysis.m2.dimensions} };
}
export function reviewForExam(result, interview) {
  if (result?.custom) return {label:'Perlu ditinjau penguji',tone:'gray'};
  if (!result?.examType || result.examType==='serviam') return reviewStatus(result,interview);
  const label = result.analysis.recommendation.status;
  return {label, tone:label==='Direkomendasikan'?'green':label==='Tidak direkomendasikan'?'red':'amber'};
}
export function examMetadata(exam) {
  const d=definitionFor(exam);
  const scoringRoleName=d.roles.find(r=>r.id===exam.role)?.name || exam.role;
  return {custom:Boolean(d.custom), examType:d.id, examLabel:d.label, company:d.company, questionCount:d.count, minutes:d.minutes, max:d.max, scoreLabel:d.scoreLabel, roleName:exam.position_name || scoringRoleName, ...(exam.position_name?{scoringRoleName}:{}), sections:d.sections.map(({items,...s})=>s)};
}

// Only answers belonging to this invitation's package may contribute to a result.
export function scopedAnswers(exam, definition=definitionFor(exam)) {
  const answers=JSON.parse(exam.answers);
  const ids=new Set(definition.sections.flatMap(s=>questionsFor(definition,s.id).map(q=>q.id)));
  return Object.fromEntries(Object.entries(answers).filter(([id])=>ids.has(id)));
}
export function storedResultForExam(exam) {
  if(!exam.result)return null;
  const definition=definitionFor(exam),result=JSON.parse(exam.result);
  const expected=definition.custom?'custom':definition.id==='serviam'?'serviam':'indo-artha';
  const actual=result.custom?'custom':!result.examType||result.examType==='serviam'?'serviam':'indo-artha';
  const matches=expected===actual&&(result.examType||'serviam')===definition.id &&
    (expected!=='indo-artha'||result.analysis?.pkg===definition.pkg) &&
    (expected!=='serviam'||result.sections?.map(s=>s.id).join(',')==='A,B,C,D');
  // Keep valid historical scores. A mismatched cached result is rebuilt from this
  // invitation's own answers; never interpret another package's personality scale.
  if (!matches) return scoreForExam(exam);
  // Older completed invitations keep their original scores, while the answer
  // detail receives the current per-case explanation when opened by an examiner.
  if (expected === 'indo-artha' && Array.isArray(result.sections)) {
    const section = result.sections.find(s => s.id === 'M3');
    if (section?.details) for (const detail of section.details) {
      const item = ITEMS.get(detail.id);
      if (item) detail.analysis = situationalAnalysis(item, detail.response);
    }
  }
  return result;
}
