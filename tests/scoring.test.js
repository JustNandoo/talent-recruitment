import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, SECTIONS, publicQuestions } from '../lib/bank.js';
import { parseNumber, scoreExam, interviewSummary, reviewStatus } from '../lib/scoring.js';

export const perfectAnswers = {
  A1:'48',A2:'37',A3:'13',A4:'25',A5:'U',A6:'13',A7:'B',A8:'C',A9:'B',A10:'Citra',
  B1:'15 knot',B2:'Rp 2.264.400',B3:'9 hari',B4:'25%',B5:'18 orang',B6:'50',B7:'Rp 58,5 juta',B8:'90',
  C1:'B',C2:'A',C3:'C',C4:'B',C5:'C',C6:'C',C7:'C',C8:'C',C9:'A',C10:'B',
  D1:'C',D2:'B',D3:'B',D4:'D',D5:'B',D6:'B',
  E1:5,E2:1,E3:5,E4:1,E5:5,E6:1,E7:5,E8:1,E9:5,E10:5,E11:1,E12:5,E13:2,E14:2,
};

test('dokumen: 48 butir, 65 menit, skor A–D 46, tanpa kunci di data peserta', () => {
  assert.equal(QUESTIONS.length,48);
  assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,48);
  assert.deepEqual(SECTIONS.map(s=>QUESTIONS.filter(q=>q.section===s.id).length),[10,8,10,6,14]);
  assert.equal(SECTIONS.reduce((sum,s)=>sum+s.minutes,0),65);
  for(const s of SECTIONS) for(const q of publicQuestions(s.id)) {
    assert.equal('answer' in q,false); assert.equal('analysis' in q,false); assert.equal('weights' in q,false);
  }
});
test('kunci PDF: jawaban ideal menghasilkan 10/8/10/18 dan dimensi E 15', () => {
  const result=scoreExam(perfectAnswers);
  assert.equal(result.total,46); assert.equal(result.percent,100);
  assert.deepEqual(result.sections.map(s=>s.score),[10,8,10,18]);
  assert.deepEqual(result.personality.dimensions.map(d=>d.score),[15,15,15,15]);
  assert.equal(result.minimumsMet,true); assert.equal(result.answered,48);
  assert.deepEqual(result.flags,[]); assert.equal(result.personality.valid,true);
});
test('angka: rupiah, pemisah ribuan, desimal Indonesia, juta dan satuan', () => {
  for(const [raw,expected] of [['Rp 2.264.400',2264400],['2264400',2264400],['2,264,400',2264400],['Rp 58,5 juta',58500000],['58.5 juta',58500000],['58.500.000',58500000],['15 knot',15],['25%',25],['9 hari',9],['18 orang',18]]) assert.equal(parseNumber(raw),expected,raw);
  for(const raw of ['', 'lima belas', '15 atau 16', '2.40.000', '0x30', 'Infinity', 'NaN', '15abc']) assert.equal(parseNumber(raw),null,raw);
  assert.equal(scoreExam({...perfectAnswers,B2:'Rp 2.304.000'}).sections[1].score,7);
  assert.equal(scoreExam({...perfectAnswers,B7:'58,5'}).sections[1].score,7);
});
test('bobot SJT tepat untuk seluruh 24 pilihan', () => {
  const weights=[[1,0,3,1],[0,3,1,1],[0,3,2,0],[0,2,1,3],[1,3,0,2],[1,3,1,0]];
  for(let i=0;i<6;i++) for(let j=0;j<4;j++) {
    const result=scoreExam({[`D${i+1}`]:'ABCD'[j]});
    assert.equal(result.sections[3].details[i].points,weights[i][j]);
  }
});
test('batas minimum mengikuti posisi dan terpenuhi hanya jika setiap bagian lolos', () => {
  const answers={...perfectAnswers,B1:'0',B2:'0',B3:'0',C1:'A',C2:'B',C3:'A'};
  assert.equal(scoreExam(answers,'administrasi').minimumsMet,true);
  assert.equal(scoreExam(answers,'keuangan').minimumsMet,false);
  assert.equal(scoreExam(answers,'pengadaan').sections[1].minimum,6);
  assert.equal(scoreExam(answers,'bd').minimumsMet,false);
  assert.equal(scoreExam(answers,'dokumen').sections[2].minimum,8);
});
test('integritas diklarifikasi meskipun total dimensi lainnya tinggi', () => {
  for(const overrides of [{D3:'A'},{D3:'D'},{E4:4},{E6:5}]) {
    const result=scoreExam({...perfectAnswers,...overrides});
    assert.ok(result.flags.some(f=>f.type==='integritas'));
    assert.equal(reviewStatus(result,{}).label,'Klarifikasi integritas');
  }
  assert.equal(scoreExam({...perfectAnswers,D3:'C',E4:3,E6:3}).flags.some(f=>f.type==='integritas'),false);
});
test('validitas kedua butir 4–5 mengabaikan interpretasi E; jawaban kurang tidak diberi label rendah', () => {
  const invalid=scoreExam({...perfectAnswers,E13:4,E14:5});
  assert.equal(invalid.personality.valid,false);
  assert.ok(invalid.personality.dimensions.every(d=>d.label==='Tidak ditafsirkan'));
  assert.equal(scoreExam({...perfectAnswers,E13:5,E14:3}).personality.valid,true);
  const missing={...perfectAnswers}; delete missing.E2;
  const result=scoreExam(missing);
  assert.equal(result.personality.dimensions[0].score,null);
  assert.equal(result.personality.dimensions[0].label,'Belum lengkap');
  assert.equal(result.personality.complete,false);
});
test('wawancara harus 6 butir; minimum rata-rata 3, rekomendasi tidak menjadi keputusan final', () => {
  const result=scoreExam(perfectAnswers);
  assert.equal(reviewStatus(result,{}).label,'Siap diwawancarai');
  assert.equal(interviewSummary({F1:{score:5}}).average,null);
  const interview=Object.fromEntries([1,2,3,4,5,6].map(n=>[`F${n}`,{score:3,note:'Bukti perilaku'}]));
  assert.equal(interviewSummary(interview).average,3);
  assert.equal(reviewStatus(result,interview).label,'Layak dipertimbangkan');
  interview.F1.score=2;
  assert.equal(reviewStatus(result,interview).label,'Tinjau wawancara');
});
