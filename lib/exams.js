import { SECTIONS, ROLES, QUESTIONS, publicQuestions } from './bank.js';
import { scoreExam, reviewStatus } from './scoring.js';
import { PACKAGES, MODEL_INFO, POSITIONS, ITEMS, publicItem } from './indo-artha/bank.js';
import { analyzeParticipant } from './indo-artha/analysis.js';

const documents = ['Panduan Penguji.docx', 'Soal Model 1 - Kognitif.docx', 'Soal Model 2 - Gaya Kerja.docx', 'Soal Model 3 - Situasional.docx', 'Kunci & Analisa Model 1 (rahasia).docx', 'Kunci & Analisa Model 2 (rahasia).docx', 'Kunci & Analisa Model 3 (rahasia).docx', 'Lembar Rekap & Keputusan.docx'];
const indo = (id, pkg) => {
  const sections = PACKAGES[pkg].sections.map(s => ({ id: s.key, name: s.break ? 'Jeda istirahat' : MODEL_INFO[s.key].title, short: s.break ? 'Jeda' : MODEL_INFO[s.key].short, minutes: s.minutes, count: s.items?.length || 0, break: Boolean(s.break), instruction: s.break ? 'Istirahat selama 10 menit. Bagian berikutnya terbuka setelah jeda selesai.' : MODEL_INFO[s.key].instructions(s.items.length, s.minutes).join(' '), items: s.items || [] }));
  return { id, pkg, name: 'Indo Artha Group Psikotes', company: 'DIVISI HR · Indo Artha Group', label: `${'Indo Artha Group'} · ${pkg === 'lengkap' ? 'Paket lengkap' : 'Ringkas operator'}`, sections, roles: POSITIONS.filter(p => pkg === 'lengkap' || p.ringkas).map(p => ({id:p.key, name:p.label})), count: sections.reduce((n,s) => n+s.count,0), minutes: sections.reduce((n,s) => n+s.minutes,0), max: pkg === 'lengkap' ? 66 : 21, scoreLabel: 'Skor M1 + M3', documents };
};
export const EXAMS = [
  { id: 'serviam', name: 'Serviam Group Shipyard', label: 'Serviam · Asesmen rekrutmen', company: 'HRD Division PT Serviam Group Shipyard', sections: SECTIONS, roles: ROLES, count:48, minutes:65, max:46, scoreLabel:'Skor A–D', documents:[] },
  indo('indo-artha', 'lengkap'), indo('indo-artha-ringkas', 'ringkas'),
];
export const examDefinition = (type = 'serviam') => EXAMS.find(e => e.id === type);
export const definitionFor = exam => {
  const definition = examDefinition(exam.exam_type || exam.examType || 'serviam');
  if (!definition) throw new Error('Jenis ujian tersimpan tidak dikenal.');
  return definition;
};
export function publicDefinitions() {
  return EXAMS.map(({pkg, sections, ...exam}) => ({...exam, sections:sections.map(({items,...section})=>section)}));
}
export function questionsFor(type, section, publicOnly = false) {
  const definition = examDefinition(type);
  if (!definition) throw new Error('Jenis ujian tidak dikenal.');
  if (type === 'serviam') return publicOnly ? publicQuestions(section) : QUESTIONS.filter(q => q.section === section);
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
export function scoreForExam(exam) {
  const definition = definitionFor(exam), answers = JSON.parse(exam.answers);
  if (definition.id === 'serviam') return scoreExam(answers, exam.role);
  const analysis = analyzeParticipant({answers, pkg:definition.pkg, positionKey:exam.role});
  const total = analysis.m1.total + analysis.m3.total;
  const sections = ['M1','M3'].map(id => {
    const model = analysis[id.toLowerCase()];
    return {id, name:MODEL_INFO[id].title, short:MODEL_INFO[id].short, score:model.total, max:model.max, answered:model.answered, count:definition.sections.find(s=>s.id===id).count,
      details:questionsFor(definition.id,id).map(q => {
        const item=q.source, response=answers[q.id]??null, key=id==='M1'?item.key:Object.keys(item.key).find(letter=>item.key[letter].points===3);
        return {id:q.id, number:q.number, prompt:q.prompt, options:q.options, response, key, points:id==='M1'?Number(response===key):item.key[response]?.points||0, max:id==='M1'?1:3, analysis:id==='M1'?item.why:MODEL_INFO.M3.title, answered:response!==null, ...(id==='M3'?{code:item.key[response]?.code??null}: {})};
      })};
  });
  return {examType:definition.id, version:'indo-artha-2026-10-13', total, max:definition.max, percent:Math.round(total/definition.max*100), answered:Object.values(answers).filter(v=>v!==null && v!=='').length, analysis, sections, minimumsMet:analysis.m1.threshold?.status==='memenuhi', flags:analysis.m3.redFlags.map(f=>({type:'integritas',question:`M3-${f.no}`,text:`${f.name}; klarifikasi saat wawancara.`})), personality:{valid:analysis.m2.interpretable,complete:analysis.m2.complete,dimensions:analysis.m2.dimensions} };
}
export function reviewForExam(result, interview) {
  if (!result?.examType) return reviewStatus(result,interview);
  const label = result.analysis.recommendation.status;
  return {label, tone:label==='Direkomendasikan'?'green':label==='Tidak direkomendasikan'?'red':'amber'};
}
export function examMetadata(exam) {
  const d=definitionFor(exam);
  return {examType:d.id, examLabel:d.label, company:d.company, questionCount:d.count, minutes:d.minutes, max:d.max, scoreLabel:d.scoreLabel, roleName:d.roles.find(r=>r.id===exam.role)?.name || exam.role, sections:d.sections.map(({items,...s})=>s)};
}
