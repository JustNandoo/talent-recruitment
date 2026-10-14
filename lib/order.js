import { randomInt } from 'node:crypto';
import { examDefinition, questionsFor } from './exams.js';

export function originalQuestionOrder(type = 'serviam') {
  return Object.fromEntries(examDefinition(type).sections.map(section => [section.id, questionsFor(type, section.id).map(q => q.id)]));
}

export function createQuestionOrder(type = 'serviam') {
  const original = originalQuestionOrder(type);
  const order = originalQuestionOrder(type);
  for (const [section, ids] of Object.entries(order)) {
    if (ids.length < 2) continue;
    do {
      for (let i = ids.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
    } while (ids.every((id, index) => id === original[section][index]));
  }
  return order;
}

export function orderedPublicQuestions(section, order, type = 'serviam') {
  const questions = questionsFor(type, section, true);
  const byId = new Map(questions.map(q => [q.id, q]));
  const ids = order[section];
  if (!Array.isArray(ids) || ids.length !== questions.length || new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) {
    throw new Error('Urutan soal tersimpan tidak valid.');
  }
  return ids.map(id => byId.get(id));
}
