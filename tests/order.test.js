import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, SECTIONS } from '../lib/bank.js';
import { createQuestionOrder, originalQuestionOrder, orderedPublicQuestions } from '../lib/order.js';

test('pengacakan mempertahankan seluruh soal, bagian, opsi, dan bank sumber', () => {
  const original = originalQuestionOrder();
  const bankBefore = JSON.stringify(QUESTIONS);
  for (let attempt = 0; attempt < 30; attempt++) {
    const order = createQuestionOrder();
    for (const section of SECTIONS) {
      const ids = order[section.id];
      assert.equal(ids.length, section.count);
      assert.deepEqual([...ids].sort(), [...original[section.id]].sort());
      assert.notDeepEqual(ids, original[section.id]);
      const questions = orderedPublicQuestions(section.id, order);
      assert.deepEqual(questions.map(q => q.id), ids);
      for (const question of questions) {
        const source = QUESTIONS.find(q => q.id === question.id);
        assert.equal(question.prompt, source.prompt);
        assert.deepEqual(question.options, source.options);
        assert.equal('answer' in question, false);
        assert.equal('weights' in question, false);
        assert.equal('analysis' in question, false);
      }
    }
  }
  assert.equal(JSON.stringify(QUESTIONS), bankBefore);
});

test('urutan rusak tidak boleh menghilangkan, menggandakan, atau menukar bagian soal', () => {
  const duplicate = originalQuestionOrder();
  duplicate.A[1] = duplicate.A[0];
  assert.throws(() => orderedPublicQuestions('A', duplicate), /tidak valid/);
  const crossSection = originalQuestionOrder();
  crossSection.A[0] = 'B1';
  assert.throws(() => orderedPublicQuestions('A', crossSection), /tidak valid/);
  const missing = originalQuestionOrder();
  missing.A.pop();
  assert.throws(() => orderedPublicQuestions('A', missing), /tidak valid/);
});
