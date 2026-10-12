import { QUESTIONS, SECTIONS, DIMENSIONS, INTERVIEWS, ROLES, SOURCE } from './bank.js';

const numericAnswers = { A1: 48, A2: 37, A3: 13, A4: 25, A6: 13, B1: 15, B2: 2264400, B3: 9, B4: 25, B5: 18, B6: 50, B7: 58500000, B8: 90 };

// Indonesian number notation, rupiah, units, and explicit juta/ribu suffixes.
// Ambiguous or additional text is not silently interpreted as a correct answer.
export function parseNumber(input) {
  let value = String(input ?? '').normalize('NFKC').trim().toLowerCase();
  value = value.replace(/^rp\.?\s*/, '').replace(/\s*(knot|hari|orang|unit|persen|%)$/, '').trim();
  let multiplier = 1;
  if (/\s*juta$/.test(value)) { multiplier = 1e6; value = value.replace(/\s*juta$/, ''); }
  else if (/\s*ribu$/.test(value)) { multiplier = 1e3; value = value.replace(/\s*ribu$/, ''); }
  if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) value = value.replaceAll('.', '').replace(',', '.');
  else if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(value)) value = value.replaceAll(',', '');
  else if (/^[+-]?\d+(,\d+)?$/.test(value)) value = value.replace(',', '.');
  else if (!/^[+-]?\d+(\.\d+)?$/.test(value)) return null;
  const number = Number(value) * multiplier;
  return Number.isFinite(number) ? number : null;
}

export function isCorrect(q, answer) {
  if (q.kind === 'numeric') { const n = parseNumber(answer); return n !== null && Math.abs(n - numericAnswers[q.id]) < 0.000001; }
  return String(answer ?? '').trim().toLocaleLowerCase('id-ID') === String(q.answer).toLocaleLowerCase('id-ID');
}

export function validateAnswer(q, value) {
  if (value === '' || value === null) return true;
  if (q.kind === 'choice') return typeof value === 'string' && ['A', 'B', 'C', 'D'].includes(value);
  if (q.kind === 'likert') return Number.isInteger(value) && value >= 1 && value <= 5;
  return typeof value === 'string' && value.length <= 120;
}

export function scoreExam(answers, role = 'umum') {
  const flags = [];
  const sections = SECTIONS.filter(s => s.id !== 'E').map(section => {
    const minimum = section.id === 'B' && ['keuangan', 'pengadaan'].includes(role) ? 6 : section.id === 'C' && ['bd', 'dokumen'].includes(role) ? 8 : section.minimum;
    const details = QUESTIONS.filter(q => q.section === section.id).map(q => {
      const response = answers[q.id] ?? null;
      const answered = response !== null && response !== '';
      const points = q.weights ? (answered ? q.weights[['A', 'B', 'C', 'D'].indexOf(response)] ?? 0 : 0) : Number(isCorrect(q, response));
      return { id: q.id, number: q.number, prompt: q.prompt, options: q.options, response, key: q.answer, points, max: q.weights ? 3 : 1, analysis: q.analysis, answered };
    });
    const score = details.reduce((sum, q) => sum + q.points, 0);
    return { id: section.id, name: section.name, short: section.short, score, max: section.max, minimum, meetsMinimum: score >= minimum, answered: details.filter(q => q.answered).length, count: section.count, details };
  });
  if (['A', 'D'].includes(answers.D3)) flags.push({ type: 'integritas', question: 'D3', text: 'Pilihan menerima hadiah vendor. Klarifikasi integritas melalui wawancara, khususnya untuk pengadaan dan BD.' });
  if (answers.D5 === 'C') flags.push({ type: 'diskusi', question: 'D5', text: 'Pilihan mengeluhkan rekan kepada orang lain. Gali cara menyelesaikan konflik.' });
  if (answers.E4 >= 4 || answers.E6 >= 4) flags.push({ type: 'integritas', question: [answers.E4 >= 4 ? 'E4' : '', answers.E6 >= 4 ? 'E6' : ''].filter(Boolean).join(', '), text: 'Setuju membawa barang kantor untuk kepentingan pribadi atau melanggar aturan demi hasil. Perlu klarifikasi, terlepas dari skor dimensi.' });
  const personalityComplete = QUESTIONS.filter(q => q.section === 'E').every(q => Number.isInteger(answers[q.id]));
  const valid = personalityComplete && !(answers.E13 >= 4 && answers.E14 >= 4);
  if (answers.E13 >= 4 && answers.E14 >= 4) flags.push({ type: 'validitas', question: 'E13, E14', text: 'Kedua butir validitas bernilai 4–5. Abaikan interpretasi bagian E dan gunakan bukti perilaku saat wawancara.' });
  if (!personalityComplete) flags.push({ type: 'kelengkapan', question: 'E', text: 'Bagian E belum lengkap. Dimensi yang tidak lengkap tidak ditafsirkan; validitas bagian E belum dapat dipastikan.' });
  const dimensions = DIMENSIONS.map(d => {
    const complete = d.items.every(n => Number.isInteger(answers[`E${n}`]));
    const score = complete ? d.items.reduce((sum, n) => sum + (d.reversed.includes(n) ? 6 - answers[`E${n}`] : answers[`E${n}`]), 0) : null;
    return { ...d, score, max: 15, minimum: 9, complete, label: !complete ? 'Belum lengkap' : !valid ? 'Tidak ditafsirkan' : score >= 12 ? 'Kuat' : score >= 9 ? 'Cukup' : 'Perlu digali', details: d.items.map(n => ({ id: `E${n}`, response: answers[`E${n}`] ?? null, reversed: d.reversed.includes(n) })) };
  });
  return {
    version: SOURCE.version, sections,
    total: sections.reduce((sum, s) => sum + s.score, 0), max: 46,
    percent: Math.round(sections.reduce((sum, s) => sum + s.score, 0) / 46 * 100),
    minimumsMet: sections.every(s => s.meetsMinimum),
    personality: { valid, complete: personalityComplete, dimensions, validityAnswers: [answers.E13 ?? null, answers.E14 ?? null] },
    flags, answered: QUESTIONS.filter(q => answers[q.id] !== undefined && answers[q.id] !== '').length,
    roleFocus: ROLES.find(r => r.id === role)?.focus || ROLES.at(-1).focus,
  };
}

export function interviewSummary(interview = {}) {
  const ratings = INTERVIEWS.map(q => interview[q.id]?.score).filter(n => Number.isInteger(n) && n >= 1 && n <= 5);
  const complete = ratings.length === 6;
  const average = complete ? Math.round(ratings.reduce((a, b) => a + b, 0) / 6 * 100) / 100 : null;
  return { complete, count: ratings.length, average, meetsMinimum: complete && average >= 3 };
}

export function reviewStatus(result, interview) {
  if (!result) return null;
  if (result.flags.some(f => f.type === 'integritas')) return { label: 'Klarifikasi integritas', tone: 'amber' };
  if (!result.minimumsMet) return { label: 'Perlu ditinjau', tone: 'amber' };
  const summary = interviewSummary(interview);
  if (!summary.complete) return { label: 'Siap diwawancarai', tone: 'green' };
  if (!summary.meetsMinimum) return { label: 'Tinjau wawancara', tone: 'amber' };
  return { label: 'Layak dipertimbangkan', tone: 'green' };
}
