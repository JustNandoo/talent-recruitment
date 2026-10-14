import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeM1, analyzeM2, analyzeM3, analyzeParticipant } from '../lib/indo-artha/analysis.js';
import { M1_ITEMS, M2_ITEMS, M2_DIMENSIONS, M3_ITEMS, PACKAGES, ITEMS, getPosition, publicItem } from '../lib/indo-artha/bank.js';

// Jawaban Model 2 yang menghasilkan skor dimensi tertentu (nilai sesudah pembalikan dibagi rata).
export function m2Answers(targets, sv = [3, 3, 3, 2, 2]) {
  const answers = {};
  for (const d of M2_DIMENSIONS) {
    const base = Math.floor(targets[d.key] / 5);
    let rest = targets[d.key] % 5;
    for (const item of d.items) {
      const no = Number.parseInt(item, 10);
      const scored = base + (rest-- > 0 ? 1 : 0);
      answers[`M2-${no}`] = item.endsWith('R') ? 6 - scored : scored;
    }
  }
  [4, 8, 12, 30, 36].forEach((no, i) => { answers[`M2-${no}`] = sv[i]; });
  return answers;
}

const allCorrect = () => Object.fromEntries(M1_ITEMS.map((q) => [q.id, q.key]));
const m3Best = () => Object.fromEntries(M3_ITEMS.map((q) => [q.id, Object.keys(q.key).find((l) => q.key[l].code === 'I')]));

test('bank soal sesuai dokumen: 30 + 40 + 12 butir, kunci Model 3 terbaik sesuai ringkasan', () => {
  assert.equal(M1_ITEMS.length, 30);
  assert.equal(M2_ITEMS.length, 40);
  assert.equal(M3_ITEMS.length, 12);
  assert.equal(M1_ITEMS.map((q) => q.key).join(''), 'DAECEADCBEADBECADACEAEBCABDCED');
  const best = M3_ITEMS.map((q) => `${q.no}${Object.keys(q.key).find((l) => q.key[l].code === 'I')}`).join(' ');
  assert.equal(best, '1A 2D 3B 4C 5D 6A 7C 8B 9D 10A 11C 12B');
  for (const q of M3_ITEMS) {
    assert.deepEqual(Object.values(q.key).map((k) => k.points).sort(), [0, 1, 2, 3]);
  }
  const dimItems = M2_DIMENSIONS.flatMap((d) => d.items.map((i) => Number.parseInt(i, 10)));
  assert.equal(new Set([...dimItems, 4, 8, 12, 30, 36]).size, 40);
  assert.equal(PACKAGES.ringkas.sections[0].items.length, 15);
});

test('soal untuk peserta tidak memuat kunci, pembahasan, kode, atau dimensi', () => {
  for (const id of ITEMS.keys()) {
    const json = JSON.stringify(publicItem(id));
    for (const leak of ['"key"', '"why"', '"code":"I"', '"dim"', '"reversed"', '"points"', '"kompetensi"']) {
      assert.ok(!json.includes(leak), `${id} membocorkan ${leak}`);
    }
  }
});

test('Model 1: skor sempurna, kategori, ambang, dan kecepatan', () => {
  const r = analyzeM1(allCorrect(), { position: getPosition('keu-mgr') });
  assert.equal(r.total, 30);
  assert.equal(r.category.label, 'Sangat Tinggi');
  assert.equal(r.accuracy, 100);
  assert.equal(r.threshold.status, 'memenuhi');
  assert.equal(r.speed.style, 'cepat dan cermat');
  assert.deepEqual(r.subtests.map((s) => s.category), ['Kuat', 'Kuat', 'Kuat', 'Kuat']);
  assert.ok(r.profiles.some((p) => p.pola === 'Numerik Kuat + Ketelitian Kuat'));
});

test('Model 1: pengecoh diagnostik, impulsif, dan ketelitian visual', () => {
  const a = allCorrect();
  Object.assign(a, { 'M1-7': 'A', 'M1-13': 'D', 'M1-16': 'D', 'M1-30': 'E', 'M1-24': 'A', 'M1-25': 'B', 'M1-29': 'B' });
  const r = analyzeM1(a, { position: getPosition('ops-staf') });
  assert.equal(r.carelessCount, 4);
  assert.equal(r.impulsive, true);
  assert.ok(r.errors.some((e) => e.type === 'Ketelitian visual'));
  assert.ok(r.errors.some((e) => e.code === '29B' && e.type === 'Transposisi angka'));
  assert.match(r.narrative, /terburu-buru \(impulsif\)/);
});

test('Model 2: pembalikan item, validitas, konsistensi, dan gaya menjawab', () => {
  const all5 = Object.fromEntries(M2_ITEMS.map((q) => [q.id, 5]));
  const r = analyzeM2(all5, { position: getPosition('ops-staf') });
  assert.equal(r.validity.sv, 25);
  assert.equal(r.overall, 'tidak_valid');
  assert.equal(r.interpretable, false);
  assert.equal(r.validity.extremeCount, 40);
  // Semua 5: item R menjadi 1, sehingga pasangan 2–29 (5 vs 1) tidak konsisten.
  assert.ok(r.validity.inconsistent >= 2);
  const kt = r.dimensions.find((d) => d.key === 'KT');
  assert.equal(kt.score, 5 + 5 + 5 + 1 + 1);

  const neutral = Object.fromEntries(M2_ITEMS.map((q) => [q.id, 3]));
  const n = analyzeM2(neutral, { position: getPosition('ops-staf') });
  assert.equal(n.validity.sv, 15);
  assert.equal(n.overall, 'valid');
  assert.ok(n.validity.styleNotes[0].startsWith('Netral'));
});

test('Model 2: dimensi yang belum lengkap tidak diberi skor', () => {
  const a = m2Answers({ KT: 20, IN: 20, SE: 20, KS: 20, OH: 20, KP: 20, AD: 20 });
  delete a['M2-5'];
  const r = analyzeM2(a, { position: getPosition('prod-operator') });
  const inDim = r.dimensions.find((d) => d.key === 'IN');
  assert.equal(inDim.score, null);
  assert.deepEqual(r.mandatory.incomplete, ['IN']);
  assert.equal(r.complete, false);
});

test('Model 2: pola kombinasi dan faking good', () => {
  const r = analyzeM2(m2Answers({ KT: 15, IN: 10, SE: 10, KS: 15, OH: 22, KP: 15, AD: 15 }), { position: getPosition('keu-staf') });
  assert.ok(r.patterns.some((p) => p.pola === 'OH Tinggi + IN Rendah'));
  assert.ok(r.patterns.some((p) => p.pola === 'SE Rendah di posisi bertekanan'));
  assert.deepEqual(r.mandatory.low, ['IN']);
  const fake = analyzeM2(m2Answers({ KT: 23, IN: 23, SE: 23, KS: 23, OH: 23, KP: 23, AD: 23 }, [4, 4, 3, 3, 3]), { position: getPosition('keu-staf') });
  assert.equal(fake.overall, 'waspada');
  assert.equal(fake.fakingGood, true);
});

test('Model 3: red flag tetap dihitung walau bernilai 1, aturan fungsi', () => {
  const a = m3Best();
  a['M3-2'] = 'B'; // 1 · E
  const keu = analyzeM3(a, { position: getPosition('keu-staf') });
  assert.equal(keu.total, 34);
  assert.equal(keu.redFlags.length, 1);
  assert.equal(keu.redFlags[0].inFunction, true);
  const ops = analyzeM3(a, { position: getPosition('ops-staf') });
  assert.equal(ops.redFlags[0].inFunction, false);
});

test('contoh Lembar Rekap: Staf Keuangan (AP) menghasilkan Dipertimbangkan', () => {
  const answers = allCorrect();
  // Verbal 6, Numerik 7, Logika 5, Ketelitian 4 — salah di 27, 29B, 30B.
  Object.assign(answers, { 'M1-1': 'A', 'M1-2': 'B', 'M1-9': 'A', 'M1-17': 'A', 'M1-19': 'A', 'M1-27': 'C', 'M1-29': 'B', 'M1-30': 'B' });
  Object.assign(answers, m2Answers({ KT: 15, IN: 22, SE: 17, KS: 18, OH: 20, KP: 12, AD: 16 }));
  'A D D C C D D D D D D D'.split(' ').forEach((l, i) => { answers[`M3-${i + 1}`] = l; });

  const r = analyzeParticipant({ answers, pkg: 'lengkap', positionKey: 'keu-staf' });
  assert.equal(r.m1.total, 22);
  assert.equal(r.m1.category.label, 'Tinggi');
  assert.deepEqual(r.m1.subtests.map((s) => s.score), [6, 7, 5, 4]);
  assert.equal(r.m1.accuracy, 73);
  assert.equal(r.m1.threshold.status, 'hampir');
  assert.deepEqual(r.m1.threshold.failed, ['Ketelitian & Kecermatan ≥ 6']);
  assert.ok(r.m1.errors.filter((e) => e.type === 'Transposisi angka').length === 2);

  assert.equal(r.m2.validity.sv, 13);
  assert.equal(r.m2.validity.inconsistent, 0);
  assert.equal(r.m2.overall, 'valid');
  assert.deepEqual(r.m2.dimensions.map((d) => d.score), [15, 22, 17, 18, 20, 12, 16]);
  assert.equal(r.m2.fit.count, 6);
  assert.equal(r.m2.fit.level, 'sangat sesuai');
  assert.deepEqual(r.m2.mandatory.low, []);

  assert.equal(r.m3.total, 28);
  assert.equal(r.m3.category, 'Baik');
  assert.equal(r.m3.functionScores.find((f) => f.applied).score, 11);
  assert.deepEqual(r.m3.competencies.map((c) => c.score), [11, 6, 5, 6]);
  assert.deepEqual([r.m3.counts.I, r.m3.counts.S, r.m3.counts.P], [4, 5, 3]);
  assert.equal(r.m3.redFlags.length, 0);

  assert.equal(r.recommendation.status, 'Dipertimbangkan');
  assert.ok(r.summary.confirm.length <= 3 && r.summary.confirm.length > 0);
  assert.ok(r.summary.confirm.some((c) => c.includes('Transposisi')));
});

test('rekomendasi: Direkomendasikan, Tidak direkomendasikan, dan SV tidak valid', () => {
  const good = { ...allCorrect(), ...m2Answers({ KT: 21, IN: 22, SE: 20, KS: 21, OH: 21, KP: 20, AD: 20 }), ...m3Best() };
  const r = analyzeParticipant({ answers: good, pkg: 'lengkap', positionKey: 'prod-mgr' });
  assert.equal(r.recommendation.status, 'Direkomendasikan');

  const twoFlags = { ...good, 'M3-1': 'B', 'M3-7': 'B' };
  assert.equal(analyzeParticipant({ answers: twoFlags, pkg: 'lengkap', positionKey: 'prod-mgr' }).recommendation.status, 'Tidak direkomendasikan');

  const invalid = { ...good, 'M2-4': 5, 'M2-8': 5, 'M2-12': 5, 'M2-30': 5, 'M2-36': 5 };
  const inv = analyzeParticipant({ answers: invalid, pkg: 'lengkap', positionKey: 'prod-mgr' });
  assert.equal(inv.m2.overall, 'tidak_valid');
  assert.equal(inv.recommendation.status, 'Direkomendasikan');
  assert.ok(inv.recommendation.notes.some((n) => n.includes('tidak valid')));

  const low = { ...allCorrect() };
  for (const q of M1_ITEMS.slice(0, 10)) low[q.id] = null;
  const lowR = analyzeParticipant({ answers: { ...good, ...low }, pkg: 'lengkap', positionKey: 'prod-mgr' });
  assert.equal(lowR.recommendation.status, 'Tidak direkomendasikan');
});

test('versi ringkas operator: 15 soal Model 1 dan kasus 9–10', () => {
  const answers = { ...allCorrect(), ...m2Answers({ KT: 20, IN: 20, SE: 15, KS: 20, OH: 15, KP: 12, AD: 15 }), 'M3-9': 'D', 'M3-10': 'D' };
  const r = analyzeParticipant({ answers, pkg: 'ringkas', positionKey: 'prod-operator' });
  assert.equal(r.m1.max, 15);
  assert.equal(r.m1.total, 15);
  assert.equal(r.m1.category, null);
  assert.equal(r.m3.max, 6);
  assert.equal(r.m3.total, 5);
  assert.equal(r.m3.ringkasPass, true);
  assert.equal(r.recommendation.status, 'Direkomendasikan');
  const flagged = analyzeParticipant({ answers: { ...answers, 'M3-10': 'C' }, pkg: 'ringkas', positionKey: 'prod-operator' });
  assert.equal(flagged.recommendation.status, 'Tidak direkomendasikan');
});

test('model yang belum dikerjakan menghasilkan status Belum lengkap', () => {
  const progress = { sections: [{ key: 'M1', startedAt: 1 }, { key: 'M3' }, { key: 'M2' }] };
  const r = analyzeParticipant({ answers: allCorrect(), pkg: 'lengkap', positionKey: 'ops-staf', progress });
  assert.equal(r.m2.taken, false);
  assert.equal(r.recommendation.status, 'Belum lengkap');
});
