export const examsForType=(exams,type)=>exams.filter(e=>(e.examType||'serviam')===type);
export function scoringDescription(definition) {
  if(definition.custom)return 'Ujian buatan sendiri: skor mengikuti kunci dan bobot pada ujian ini. Kuesioner skala 1–5 ditinjau terpisah; tidak memakai profil kepribadian Serviam atau Indo Artha.';
  if(definition.id==='serviam')return 'Serviam: skor kemampuan dan situasional A–D. Kepribadian kerja berasal dari jawaban bagian E, bukan dari skor kognitif/TIU.';
  return 'Indo Artha: Model 1 mengukur kognitif/ketelitian (TIU), Model 2 mengukur gaya kerja, dan Model 3 menilai situasional. Profil gaya kerja hanya dihitung dari jawaban Model 2; skor TIU tidak menjadi skor kepribadian.';
}
