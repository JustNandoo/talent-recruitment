// Skoring dan analisis kompetensi/perilaku sesuai Kunci & Analisa Model 1–3 serta Lembar Rekap & Keputusan.
// Semua fungsi murni: menerima jawaban mentah, mengembalikan hasil yang dapat ditampilkan di dashboard dan PDF.

import {
  ITEMS, M1_ITEMS, M1_SUBTESTS, M1_TOTAL_CATEGORIES, M1_ERROR_PATTERNS, M1_CARELESS_KEYS, M1_PROFILES,
  M2_ITEMS, M2_DIMENSIONS, M2_VALIDITY_ITEMS, M2_CONSISTENCY_PAIRS, M2_PROFILES, M2_PATTERNS, M2_FAKING_PATTERN, LIKERT,
  M3_ITEMS, M3_CODES, M3_COMPETENCIES, M3_FUNCTIONS, M3_TOTAL_CATEGORIES, M3_CODE_PATTERNS, M3_QUESTIONS,
  PACKAGES, RINGKAS_M1, LEVEL_KEY_CASES, getPosition,
} from './bank.js';

const LEVEL_RANK = { Rendah: 1, Sedang: 2, Tinggi: 3 };

function subCategory(score, def) {
  if (score >= def.kuat) return 'Kuat';
  if (score >= def.memadai) return 'Memadai';
  return 'Lemah';
}

function listText(items, empty = '-') {
  if (!items.length) return empty;
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} dan ${items.at(-1)}`;
}

function sectionItems(pkg, model) {
  return PACKAGES[pkg].sections.find((s) => s.key === model)?.items || [];
}

// ---------------------------------------------------------------------------
// Model 1
// ---------------------------------------------------------------------------

export function analyzeM1(answers, { pkg = 'lengkap', position } = {}) {
  const ids = sectionItems(pkg, 'M1');
  const items = M1_ITEMS.filter((q) => ids.includes(q.id));
  const ringkas = pkg === 'ringkas';
  const subDefs = M1_SUBTESTS.filter((s) => items.some((q) => q.sub === s.key));
  const scores = Object.fromEntries(subDefs.map((s) => [s.key, 0]));
  const detail = [];
  const errors = [];
  let answered = 0;
  let correct = 0;
  let wrongVisual = 0;

  for (const q of items) {
    const a = answers[q.id] || null;
    const ok = a === q.key;
    if (a) answered += 1;
    if (ok) { correct += 1; scores[q.sub] += 1; }
    if (a && !ok) {
      const pat = M1_ERROR_PATTERNS[`${q.no}${a}`];
      if (pat) errors.push({ no: q.no, answer: a, code: `${q.no}${a}`, type: pat[0], indication: pat[1] });
      if (q.no >= 24 && q.no <= 27) wrongVisual += 1;
    }
    detail.push({ id: q.id, no: q.no, sub: q.sub, answer: a, key: q.key, correct: ok, why: q.why });
  }

  const subtests = subDefs.map((s) => ({ key: s.key, label: s.label, score: scores[s.key], max: s.max, category: subCategory(scores[s.key], s) }));
  const cats = Object.fromEntries(subtests.map((s) => [s.key, s.category]));
  const max = items.length;
  const total = correct;
  const totalCat = ringkas ? null : M1_TOTAL_CATEGORIES.find((c) => total >= c.min);
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  if (wrongVisual >= 2) {
    errors.push({ no: '24–27', answer: `${wrongVisual} salah`, code: '24-27', type: 'Ketelitian visual', indication: 'Berisiko di pekerjaan input dan verifikasi dokumen.' });
  }
  const carelessCount = errors.filter((e) => M1_CARELESS_KEYS.includes(e.code)).length;
  const impulsive = carelessCount >= 3;

  // Kecepatan vs akurasi (bagian F). Ambang 27/22 dari 30 diskalakan untuk versi ringkas.
  const hi = Math.ceil(max * 0.9);
  const lo = Math.ceil(max * (22 / 30));
  let speed = null;
  if (answered >= hi && accuracy >= 80) speed = { style: 'cepat dan cermat', text: 'Cepat dan cermat; mampu bekerja di bawah tekanan waktu.' };
  else if (answered >= hi && accuracy < 60) speed = { style: 'terburu-buru', text: 'Terburu-buru atau menebak; risiko kesalahan saat tenggat ketat.' };
  else if (answered < lo && accuracy >= 80) speed = { style: 'hati-hati tetapi lambat', text: 'Hati-hati dan cenderung lambat; cocok untuk peran yang menuntut ketelitian, tetapi gali kecepatan kerjanya.' };
  else if (answered < lo && accuracy < 60) speed = { style: 'kapasitas belum memadai atau ada hambatan', text: 'Kapasitas belum memadai atau ada hambatan seperti kecemasan, bahasa, atau motivasi.' };

  const available = new Set(subDefs.map((s) => s.key));
  const profiles = M1_PROFILES.filter((p) => p.subs.every((k) => available.has(k)) && p.test(cats))
    .map(({ pola, asumsi, cocok, gali }) => ({ pola, asumsi, cocok, gali }));

  // Ambang posisi (bagian C) atau aturan versi ringkas.
  const rule = ringkas ? RINGKAS_M1 : position?.m1;
  let threshold = null;
  if (rule) {
    const conditions = rule.conditions.map((c) => {
      if (c.noLemah) {
        const lemah = subtests.filter((s) => s.category === 'Lemah').map((s) => s.label);
        return { text: 'Tidak ada subtes kategori Lemah', met: lemah.length === 0, detail: lemah.length ? `Lemah: ${lemah.join(', ')}` : '' };
      }
      const s = subtests.find((x) => x.key === c.sub);
      return { text: `${s.label} ≥ ${c.min}`, met: s.score >= c.min, detail: `${s.score}/${s.max}` };
    });
    const shortfall = Math.max(0, rule.min - total);
    const failed = conditions.filter((c) => !c.met);
    let status = 'memenuhi';
    if (shortfall > 2) status = 'tidak';
    else if (shortfall > 0 || failed.length) status = 'hampir';
    threshold = {
      label: ringkas ? 'Versi ringkas operator' : position.label,
      min: rule.min, max, conditions, shortfall, failed: failed.map((c) => c.text), status,
    };
  }

  // Templat kalimat asumsi awal (bagian G).
  const ranked = [...subtests].sort((a, b) => b.score / b.max - a.score / a.max);
  const best = ranked.filter((s) => s.score / s.max === ranked[0].score / ranked[0].max);
  const worst = ranked.filter((s) => s.score / s.max === ranked.at(-1).score / ranked.at(-1).max);
  const flat = best.length === subtests.length;
  const style = impulsive ? 'terburu-buru (impulsif)' : speed?.style || (accuracy >= 80 ? 'cermat' : 'cukup cermat');
  const errTypes = [...new Set(errors.map((e) => e.type))];
  const meetText = threshold ? (threshold.status === 'memenuhi' ? 'memenuhi' : 'belum memenuhi') : 'belum dibandingkan dengan';
  const parts = [];
  parts.push(ringkas
    ? `Kandidat memperoleh skor ${total}/${max} pada versi ringkas (Numerik dan Ketelitian)`
    : `Kandidat berada pada kategori ${totalCat.label} (skor ${total}/${max})`);
  parts[0] += flat
    ? ', dengan profil subtes yang merata.'
    : `, dengan kekuatan pada ${listText(best.map((s) => s.label))} dan kelemahan relatif pada ${listText(worst.map((s) => s.label))}.`;
  parts.push(`Pola jawabannya ${style} (dijawab ${answered}/${max}, akurasi ${accuracy}%), dengan ${errTypes.length ? `kesalahan khas ${listText(errTypes.map((t) => t.toLowerCase()))}` : 'tanpa kesalahan khas'}.`);
  parts.push(`Kandidat ${meetText} ambang posisi ${threshold ? threshold.label : '-'}${threshold?.failed.length ? ` (tidak terpenuhi: ${threshold.failed.join('; ')})` : ''}${threshold?.shortfall ? `, kurang ${threshold.shortfall} poin dari minimum ${threshold.min}` : ''}.`);

  return {
    taken: true, ringkas, max, total, answered, accuracy,
    category: totalCat ? { label: totalCat.label, text: totalCat.text } : null,
    subtests, errors, impulsive, carelessCount, speed, profiles, threshold,
    narrative: parts.join(' '), detail,
  };
}

// ---------------------------------------------------------------------------
// Model 2
// ---------------------------------------------------------------------------

function m2Category(score) {
  if (score >= 19) return 'Tinggi';
  if (score >= 12) return 'Sedang';
  return 'Rendah';
}

export function analyzeM2(answers, { position } = {}) {
  const raw = {};
  for (const q of M2_ITEMS) {
    const v = Number(answers[q.id]);
    raw[q.no] = Number.isInteger(v) && v >= 1 && v <= 5 ? v : null;
  }
  const scored = (no) => {
    const v = raw[no];
    if (v == null) return null;
    return ITEMS.get(`M2-${no}`).reversed ? 6 - v : v;
  };
  const answeredCount = Object.values(raw).filter((v) => v != null).length;

  const svValues = M2_VALIDITY_ITEMS.map((no) => raw[no]);
  const sv = svValues.every((v) => v != null) ? svValues.reduce((a, b) => a + b, 0) : null;
  let svStatus = null;
  let svText = 'Item skala validitas belum lengkap; validitas tidak dapat dinilai.';
  if (sv != null) {
    if (sv <= 15) { svStatus = 'wajar'; svText = 'Wajar.'; }
    else if (sv <= 20) { svStatus = 'waspada'; svText = 'Waspada: kandidat cenderung menampilkan citra ideal; tafsirkan dimensi Tinggi dengan hati-hati.'; }
    else { svStatus = 'tidak_valid'; svText = 'Tidak valid: profil IGK tidak dipakai; ganti dengan wawancara perilaku mendalam.'; }
  }

  const pairs = M2_CONSISTENCY_PAIRS.map(([a, b]) => {
    const va = scored(a);
    const vb = scored(b);
    const diff = va != null && vb != null ? Math.abs(va - vb) : null;
    return { pair: `${a}–${b}`, a: va, b: vb, diff, inconsistent: diff != null && diff >= 3 };
  });
  const inconsistent = pairs.filter((p) => p.inconsistent).length;
  const consistencyStatus = inconsistent >= 2 ? 'kurang_konsisten' : 'wajar';

  const values = Object.values(raw).filter((v) => v != null);
  const neutralCount = values.filter((v) => v === 3).length;
  const extremeCount = values.filter((v) => v === 1 || v === 5).length;
  const styleNotes = [];
  if (neutralCount >= 20) styleNotes.push('Netral atau defensif, enggan membuka diri (jawaban N ≥ 20).');
  if (extremeCount >= 30) styleNotes.push('Gaya ekstrem: profil tampak lebih tajam daripada kenyataan (STS + SS ≥ 30).');

  const profileKey = position?.m2;
  const profile = profileKey ? M2_PROFILES[profileKey] : null;
  const mandatory = profile ? [...new Set([...profile.mandatory, ...(position.extraMandatory || [])])] : [];

  const dimensions = M2_DIMENSIONS.map((d) => {
    const nums = d.items.map((i) => Number.parseInt(i, 10));
    const vals = nums.map(scored);
    const complete = vals.every((v) => v != null);
    const score = complete ? vals.reduce((a, b) => a + b, 0) : null;
    const category = complete ? m2Category(score) : null;
    const target = profile ? profile.target[d.key] : null;
    return {
      key: d.key, label: d.label, score, category, complete,
      meaning: category ? d.meaning[category] : 'Belum lengkap; tidak diberi skor.',
      target, targetLabel: profile ? profile.targetLabel[d.key] : null,
      meets: complete && target != null ? LEVEL_RANK[category] >= target : null,
      mandatory: mandatory.includes(d.key),
    };
  });

  const complete = answeredCount === M2_ITEMS.length;
  const cats = Object.fromEntries(dimensions.map((d) => [d.key, d.category]));
  const fakingGood = sv != null && sv >= 16 && dimensions.every((d) => d.score != null && d.score >= 22);
  let overall = 'valid';
  if (svStatus == null) overall = 'tidak_lengkap';
  else if (svStatus === 'tidak_valid') overall = 'tidak_valid';
  else if (svStatus === 'waspada') overall = 'waspada';
  const interpretable = overall === 'valid' || overall === 'waspada';

  let fit = null;
  if (profile && interpretable) {
    const count = dimensions.filter((d) => d.meets).length;
    const level = count >= 6 ? 'sangat sesuai' : count >= 4 ? 'cukup sesuai' : 'kurang sesuai';
    fit = { count, of: dimensions.length, level, profile: profile.label };
  }
  const mandatoryLow = interpretable ? dimensions.filter((d) => d.mandatory && d.category === 'Rendah').map((d) => d.key) : [];
  const mandatoryBelow = interpretable ? dimensions.filter((d) => d.mandatory && d.meets === false).map((d) => d.key) : [];
  const mandatoryIncomplete = dimensions.filter((d) => d.mandatory && !d.complete).map((d) => d.key);

  const patterns = interpretable ? M2_PATTERNS.filter((p) => p.test(cats)).map(({ pola, asumsi, pertimbangan, gali }) => ({ pola, asumsi, pertimbangan, gali })) : [];
  if (fakingGood) patterns.push({ ...M2_FAKING_PATTERN });

  const statusWord = { valid: 'valid', waspada: 'perlu kehati-hatian', tidak_valid: 'tidak valid', tidak_lengkap: 'belum lengkap' }[overall];
  let narrative = `Profil IGK ${statusWord} (SV ${sv ?? '-'}, ${inconsistent} pasang tidak konsisten${complete ? '' : `, ${answeredCount}/40 pernyataan terjawab`}).`;
  if (interpretable) {
    const high = dimensions.filter((d) => d.category === 'Tinggi').map((d) => d.key);
    const low = dimensions.filter((d) => d.category === 'Rendah').map((d) => d.key);
    narrative += ` Dimensi menonjol: ${listText(high, 'tidak ada')}; area perhatian: ${listText(low, 'tidak ada')}.`;
    if (fit) {
      narrative += ` Kecocokan dengan profil ${fit.profile}: ${fit.level} (${fit.count}/${fit.of} dimensi sesuai target), dimensi wajib ${mandatoryLow.length ? `tidak terpenuhi: ${mandatoryLow.join(', ')} Rendah` : mandatoryBelow.length ? `minimal Sedang, tetapi ${mandatoryBelow.join(', ')} di bawah target` : 'terpenuhi'}.`;
    }
    if (patterns.length) narrative += ` Pola ${listText(patterns.map((p) => p.pola))} mengindikasikan ${listText(patterns.map((p) => p.asumsi.replace(/\.$/, '').toLowerCase()))}; perlu dikonfirmasi saat wawancara.`;
  } else if (overall === 'tidak_valid') {
    narrative += ' Profil tidak ditafsirkan; gunakan wawancara perilaku mendalam.';
  }

  const detail = M2_ITEMS.map((q) => ({
    no: q.no, dim: q.dim, reversed: q.reversed, answer: raw[q.no],
    code: raw[q.no] ? LIKERT[raw[q.no] - 1].code : null, scored: q.dim === 'SV' ? raw[q.no] : scored(q.no),
  }));

  return {
    taken: true, complete, answeredCount,
    validity: { sv, svStatus, svText, pairs, inconsistent, consistencyStatus, neutralCount, extremeCount, styleNotes },
    overall, interpretable, dimensions, fit,
    mandatory: { keys: mandatory, low: mandatoryLow, below: mandatoryBelow, incomplete: mandatoryIncomplete },
    patterns, fakingGood, narrative, detail,
  };
}

// ---------------------------------------------------------------------------
// Model 3
// ---------------------------------------------------------------------------

export function analyzeM3(answers, { pkg = 'lengkap', position } = {}) {
  const ids = sectionItems(pkg, 'M3');
  const items = M3_ITEMS.filter((q) => ids.includes(q.id));
  const ringkas = pkg === 'ringkas';
  const counts = { I: 0, S: 0, P: 0, K: 0, R: 0, E: 0, J: 0 };
  const byCase = {};
  const detail = [];
  let total = 0;
  for (const q of items) {
    const a = answers[q.id] || null;
    const k = a ? q.key[a] : null;
    if (k) { total += k.points; counts[k.code] += 1; }
    byCase[q.no] = k ? k.points : 0;
    detail.push({ no: q.no, fungsi: q.fungsi, level: q.level, kompetensi: q.kompetensi, answer: a, points: k ? k.points : 0, code: k ? k.code : null, best: Object.keys(q.key).find((l) => q.key[l].code === 'I') });
  }
  const max = items.length * 3;
  const answered = detail.filter((d) => d.answer).length;
  const fungsi = position?.fungsi || null;
  const fnDef = M3_FUNCTIONS.find((f) => f.key === fungsi);

  const redFlags = detail.filter((d) => d.code && M3_CODES[d.code].flag).map((d) => ({
    no: d.no, answer: d.answer, code: d.code, name: M3_CODES[d.code].name,
    inFunction: Boolean(fnDef && (ringkas ? true : fnDef.critical.includes(d.no))),
  }));

  let competencies = [];
  let functionScores = [];
  let category = null;
  if (!ringkas) {
    category = M3_TOTAL_CATEGORIES.find((c) => total >= c.min).label;
    competencies = M3_COMPETENCIES.map((c) => {
      const score = c.cases.reduce((s, n) => s + byCase[n], 0);
      return { key: c.key, label: c.label, cases: c.cases, score, max: c.max, category: subCategory(score, c) };
    });
    functionScores = M3_FUNCTIONS.map((f) => {
      const score = f.cases.reduce((s, n) => s + byCase[n], 0);
      return { key: f.key, label: f.label, cases: f.cases, score, max: f.max, category: subCategory(score, f), applied: f.key === fungsi };
    });
  }

  const patterns = ringkas ? [] : M3_CODE_PATTERNS.filter((p) => p.test(counts)).map(({ code, pola, asumsi, implikasi }) => ({ code, pola, asumsi, implikasi }));
  const topCount = Math.max(...Object.values(counts));
  const dominant = topCount > 0 ? Object.keys(counts).filter((c) => counts[c] === topCount) : [];

  // Kasus utama level (supervisor/manajer). Untuk manajer, kasus 4, 8, 12 idealnya I; P atau K wajib digali.
  const levelCases = (!ringkas && position && LEVEL_KEY_CASES[position.level]) || [];
  const keyCases = levelCases.map((n) => detail.find((d) => d.no === n));
  const managerProbe = position?.level === 'manajer'
    ? keyCases.filter((d) => d.code === 'P' || d.code === 'K').map((d) => ({ no: d.no, code: d.code }))
    : [];

  const qCodes = new Set();
  for (const c of dominant) if (c !== 'I') qCodes.add(c);
  for (const p of patterns) if (p.code !== 'I' && p.code !== 'EJ') qCodes.add(p.code);
  if (counts.E) qCodes.add('E');
  if (counts.J) qCodes.add('J');
  const interviewQuestions = [...qCodes].map((c) => ({ code: c, question: M3_QUESTIONS[c] }));

  // Lolos versi ringkas: Model 3 ≥ 4/6 tanpa red flag.
  const ringkasPass = ringkas ? total >= 4 && redFlags.length === 0 : null;

  let narrative;
  if (ringkas) {
    narrative = `Kandidat memperoleh ${total}/${max} pada kasus produksi 9–10. ${redFlags.length ? `Red flag: ${redFlags.map((r) => `kasus ${r.no} (${r.code})`).join(', ')}.` : 'Red flag: tidak ada.'} ${ringkasPass ? 'Memenuhi' : 'Belum memenuhi'} syarat versi ringkas (≥ 4/6 tanpa red flag).`;
  } else {
    const fs = functionScores.find((f) => f.applied);
    const sorted = [...competencies].sort((a, b) => b.score / b.max - a.score / a.max);
    const domText = dominant.length ? dominant.map((c) => `${c} (${M3_CODES[c].name})`).join(', ') : '-';
    const domAsumsi = dominant.map((c) => M3_CODES[c].text.replace(/\.$/, '').toLowerCase());
    narrative = `Kandidat memperoleh ${total}/${max} (${category})${fs ? `, skor fungsi ${fs.label} ${fs.score}/12 (${fs.category})` : ''}, dengan kompetensi terkuat ${sorted[0].label} dan terlemah ${sorted.at(-1).label}. Gaya respons dominan ${domText}, mengindikasikan ${listText(domAsumsi)}. Red flag: ${redFlags.length ? redFlags.map((r) => `kasus ${r.no}, kode ${r.code}`).join('; ') : 'tidak ada'}.`;
  }

  return {
    taken: true, ringkas, total, max, answered, category, competencies, functionScores,
    counts, dominant, patterns, redFlags, keyCases, managerProbe, interviewQuestions, ringkasPass, narrative, detail,
  };
}

// ---------------------------------------------------------------------------
// Rekap dan rekomendasi awal (Lembar Rekap & Keputusan)
// ---------------------------------------------------------------------------

export function recommend({ m1, m2, m3, pkg = 'lengkap', position }) {
  const tidak = [];
  const pertimbangkan = [];
  const positif = [];
  const notes = [];
  const missing = [];
  const ringkas = pkg === 'ringkas';

  if (!m1?.taken) missing.push('Model 1');
  else if (m1.threshold) {
    const t = m1.threshold;
    if (t.status === 'tidak') tidak.push(`Model 1 kurang ${t.shortfall} poin dari ambang ${t.label} (min. ${t.min}).`);
    else if (t.status === 'hampir') {
      if (t.shortfall) pertimbangkan.push(`Model 1 kurang ${t.shortfall} poin dari ambang (min. ${t.min}).`);
      if (t.failed.length) pertimbangkan.push(`Syarat subtes Model 1 tidak terpenuhi: ${t.failed.join('; ')}.`);
      if (t.failed.length >= 2) notes.push('Lebih dari satu syarat subtes Model 1 tidak terpenuhi; perhatikan secara khusus.');
    } else positif.push(`Model 1 memenuhi ambang ${t.label} (${m1.total}/${m1.max}).`);
  }

  if (!m2?.taken) missing.push('Model 2');
  else if (m2.overall === 'tidak_valid') notes.push('Model 2 tidak valid (SV ≥ 21): keputusan diambil dari Model 1, Model 3, dan hasil wawancara saja.');
  else if (m2.overall === 'tidak_lengkap') notes.push('Model 2 belum lengkap (item validitas kosong): profil tidak ditafsirkan.');
  else {
    if (m2.mandatory.low.length) tidak.push(`Dimensi wajib Model 2 berkategori Rendah: ${m2.mandatory.low.join(', ')}.`);
    if (m2.overall === 'waspada') pertimbangkan.push(`Model 2 berstatus waspada (SV ${m2.validity.sv}).`);
    if (m2.fit && m2.fit.count <= 3) pertimbangkan.push(`Model 2 hanya ${m2.fit.count} dimensi sesuai target profil ${m2.fit.profile}.`);
    if (m2.mandatory.incomplete.length) pertimbangkan.push(`Dimensi wajib Model 2 belum lengkap: ${m2.mandatory.incomplete.join(', ')}.`);
    if (m2.validity.consistencyStatus === 'kurang_konsisten') notes.push(`Jawaban Model 2 kurang konsisten (${m2.validity.inconsistent} pasang); tafsirkan dengan sangat hati-hati.`);
    if (m2.fakingGood) notes.push('Pola faking good pada Model 2: jangan menarik kesimpulan dari profil ini.');
    if (!m2.mandatory.low.length && m2.overall === 'valid' && (!m2.fit || m2.fit.count > 3)) positif.push(`Model 2 valid dan dimensi wajib minimal Sedang${m2.fit ? ` (${m2.fit.level})` : ''}.`);
  }

  if (!m3?.taken) missing.push('Model 3');
  else {
    const inFn = m3.redFlags.filter((r) => r.inFunction);
    if (m3.redFlags.length >= 2) tidak.push(`Dua red flag atau lebih pada Model 3 (${m3.redFlags.map((r) => `kasus ${r.no} ${r.code}`).join(', ')}).`);
    else if (inFn.length) tidak.push(`Red flag di fungsi yang dilamar: kasus ${inFn[0].no} (kode ${inFn[0].code}).`);
    else if (m3.redFlags.length === 1) pertimbangkan.push(`Satu red flag di luar fungsi yang dilamar: kasus ${m3.redFlags[0].no} (kode ${m3.redFlags[0].code}); wajib digali saat wawancara.`);
    if (ringkas) {
      if (m3.total < 4) tidak.push(`Model 3 versi ringkas ${m3.total}/6 (syarat ≥ 4).`);
      else if (!m3.redFlags.length) positif.push(`Model 3 versi ringkas ${m3.total}/6 tanpa red flag.`);
    } else if (m3.total <= 18) tidak.push(`Model 3 skor ${m3.total}/36 (≤ 18).`);
    else if (m3.total <= 24) pertimbangkan.push(`Model 3 skor ${m3.total}/36 (19–24).`);
    else if (!m3.redFlags.length) positif.push(`Model 3 skor ${m3.total}/36 tanpa red flag.`);
  }

  let status;
  if (tidak.length) status = 'Tidak direkomendasikan';
  else if (missing.length) status = 'Belum lengkap';
  else if (pertimbangkan.length) status = 'Dipertimbangkan';
  else status = 'Direkomendasikan';
  const action = {
    Direkomendasikan: 'Lanjut wawancara user.',
    Dipertimbangkan: 'Wawancara mendalam untuk menguji asumsi awal.',
    'Tidak direkomendasikan': 'Tidak dilanjutkan, kecuali wawancara dan referensi memberi bukti kuat sebaliknya.',
    'Belum lengkap': `Belum semua model dikerjakan (${missing.join(', ')}).`,
  }[status];
  return { status, action, tidak, pertimbangkan, positif, notes, missing, position: position?.label || null };
}

function summarize({ m1, m2, m3, position, rec }) {
  const strengths = [];
  const risks = [];
  const confirm = [];
  const interview = [];
  const addQ = (q, source) => { if (q && !interview.some((x) => x.question === q)) interview.push({ question: q, source }); };

  if (m1?.taken) {
    for (const s of m1.subtests) {
      if (s.category === 'Kuat') strengths.push(`${s.label} kuat (${s.score}/${s.max})`);
      if (s.category === 'Lemah') risks.push(`${s.label} lemah (${s.score}/${s.max})`);
    }
    const types = [...new Set(m1.errors.map((e) => e.type))];
    if (types.length) risks.push(`Kesalahan khas Model 1: ${types.join(', ').toLowerCase()}`);
    if (m1.impulsive) risks.push('Indikasi impulsif/terburu-buru (≥ 3 kesalahan kurang membaca soal)');
    for (const p of m1.profiles) addQ(p.gali, `Model 1 · ${p.pola}`);
  }
  if (m2?.taken && m2.interpretable) {
    for (const d of m2.dimensions) {
      if (d.category === 'Tinggi') strengths.push(`${d.label} tinggi (${d.score})`);
      if (d.category === 'Rendah') risks.push(`${d.label} rendah (${d.score})`);
    }
    for (const p of m2.patterns) { risks.push(`Pola gaya kerja: ${p.pola} — ${p.asumsi}`); addQ(p.gali, `Model 2 · ${p.pola}`); }
  }
  if (m3?.taken) {
    for (const c of m3.competencies) {
      if (c.category === 'Kuat') strengths.push(`${c.label} (situasional) kuat (${c.score}/${c.max})`);
      if (c.category === 'Lemah') risks.push(`${c.label} (situasional) lemah (${c.score}/${c.max})`);
    }
    if (!m3.redFlags.length) strengths.push('Tidak ada red flag situasional');
    for (const r of m3.redFlags) risks.push(`Red flag kasus ${r.no}: ${r.name}`);
    for (const p of m3.patterns) if (['P', 'K', 'R'].includes(p.code)) risks.push(`Gaya respons ${p.pola}: ${p.asumsi}`);
    for (const q of m3.interviewQuestions) addQ(q.question, `Model 3 · kode ${q.code}`);
  }

  // Maksimal tiga hal untuk dikonfirmasi, diprioritaskan dari risiko terbesar.
  if (m3?.taken) for (const r of m3.redFlags) confirm.push(`Red flag Model 3 kasus ${r.no} (kode ${r.code}): ${M3_QUESTIONS[r.code]}`);
  if (m2?.taken && m2.interpretable) {
    for (const k of m2.mandatory.low) confirm.push(`Dimensi wajib ${k} Rendah: gali bukti perilaku nyata.`);
    for (const k of m2.mandatory.below.filter((x) => !m2.mandatory.low.includes(x))) confirm.push(`Dimensi wajib ${k} di bawah target profil: gali bukti perilaku nyata.`);
  }
  if (m1?.taken && m1.threshold && m1.threshold.status !== 'memenuhi') {
    const t = m1.threshold;
    confirm.push(`Ambang Model 1 belum terpenuhi (${[t.shortfall ? `kurang ${t.shortfall} poin` : '', ...t.failed].filter(Boolean).join('; ')}): pertimbangkan uji praktik terkait.`);
  }
  if (m1?.taken) {
    if (m1.errors.some((e) => e.type === 'Transposisi angka')) confirm.push('Transposisi angka pada Model 1: tanyakan metode pengecekan ulang angka yang biasa dipakai.');
    if (m1.impulsive) confirm.push('Indikasi impulsif pada Model 1: gali cara kandidat memastikan instruksi dipahami sebelum bekerja.');
  }
  if (m2?.taken && m2.interpretable) for (const p of m2.patterns) confirm.push(`Model 2 ${p.pola}: ${p.gali}`);
  if (m3?.taken) {
    for (const d of m3.managerProbe) confirm.push(`Kasus level manajer ${d.no} dijawab ${d.code}: ${M3_QUESTIONS[d.code]}`);
    for (const p of m3.patterns) if (['P', 'K', 'R'].includes(p.code)) confirm.push(`Model 3 ${p.pola}: ${M3_QUESTIONS[p.code]}`);
  }

  const fitParts = [];
  if (m1?.threshold) fitParts.push(`Model 1 ${m1.threshold.status === 'memenuhi' ? 'memenuhi' : 'belum memenuhi'} ambang ${m1.threshold.label}`);
  if (m2?.fit) fitParts.push(`Model 2 ${m2.fit.level} dengan profil ${m2.fit.profile}`);
  if (m3?.taken) {
    const fs = m3.functionScores.find((f) => f.applied);
    if (fs) fitParts.push(`Model 3 skor fungsi ${fs.label} ${fs.score}/12 (${fs.category})`);
    else if (m3.ringkas) fitParts.push(`Model 3 versi ringkas ${m3.total}/6`);
  }

  return {
    strengths, risks,
    fit: fitParts.length ? `${fitParts.join('; ')}.` : 'Belum dapat dinilai.',
    confirm: [...new Set(confirm)].slice(0, 3),
    interview,
    recommendation: rec.status,
  };
}

// Analisis lengkap untuk satu peserta. `progress` menentukan model mana yang sudah dikerjakan.
export function analyzeParticipant({ answers = {}, pkg = 'lengkap', positionKey, progress = null }) {
  const position = getPosition(positionKey);
  const taken = (key) => {
    if (!progress) return true;
    return Boolean(progress.sections?.find((s) => s.key === key)?.startedAt);
  };
  const m1 = taken('M1') ? analyzeM1(answers, { pkg, position }) : { taken: false };
  const m2 = taken('M2') ? analyzeM2(answers, { position }) : { taken: false };
  const m3 = taken('M3') ? analyzeM3(answers, { pkg, position }) : { taken: false };
  const rec = recommend({ m1, m2, m3, pkg, position });
  const summary = summarize({ m1, m2, m3, position, rec });
  return { position, pkg, m1, m2, m3, recommendation: rec, summary };
}
