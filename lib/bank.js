export const SOURCE = {
  title: 'Bank Soal Psikotes Karyawan Baru',
  author: 'Fajar',
  date: '8 Oktober 2026',
  version: '2026-10-08-v1',
  pages: 9,
};

export const SECTIONS = [
  { id: 'A', name: 'Penalaran logis', short: 'Logika', minutes: 15, count: 10, max: 10, minimum: 7, instruction: 'Lengkapi deret atau pilih kesimpulan yang paling tepat.' },
  { id: 'B', name: 'Kemampuan numerik', short: 'Numerik', minutes: 15, count: 8, max: 8, minimum: 5, instruction: 'Kerjakan tanpa kalkulator. Tuliskan jawaban akhir; satuan boleh disertakan.' },
  { id: 'C', name: 'Kemampuan verbal', short: 'Verbal', minutes: 10, count: 10, max: 10, minimum: 7, instruction: 'Pilih satu jawaban yang paling tepat.' },
  { id: 'D', name: 'Tes situasional', short: 'Situasional', minutes: 15, count: 6, max: 18, minimum: 13, instruction: 'Pilih tindakan yang paling mungkin Anda lakukan di situasi kerja tersebut.' },
  { id: 'E', name: 'Kepribadian kerja', short: 'Kepribadian', minutes: 10, count: 14, instruction: 'Beri nilai 1 (sangat tidak setuju) sampai 5 (sangat setuju). Tidak ada jawaban benar atau salah. Jawablah sejujurnya.' },
];

export const ROLES = [
  { id: 'administrasi', name: 'Staf administrasi', focus: 'Utamakan numerik, logika, dan ketelitian.' },
  { id: 'keuangan', name: 'Keuangan', focus: 'Utamakan numerik, logika, dan ketelitian; minimum numerik 6.' },
  { id: 'pengadaan', name: 'Pengadaan', focus: 'Minimum numerik 6; klarifikasi integritas pada penawaran vendor.' },
  { id: 'bd', name: 'Business development', focus: 'Utamakan verbal, situasional, serta komunikasi dan integritas saat wawancara; minimum verbal 8.' },
  { id: 'dokumen', name: 'Penyusun dokumen', focus: 'Minimum verbal 8; perhatikan ketelitian.' },
  { id: 'proyek', name: 'Koordinator proyek', focus: 'Utamakan logika, situasional, dan stabilitas emosi.' },
  { id: 'umum', name: 'Staf umum', focus: 'Tinjau seluruh bagian bersama bukti perilaku saat wawancara.' },
];

const choice = (section, number, prompt, options, answer, analysis, weights) => ({ id: `${section}${number}`, section, number, kind: 'choice', prompt, options, answer, analysis, ...(weights ? { weights } : {}) });
const text = (section, number, prompt, answer, analysis, kind = 'numeric') => ({ id: `${section}${number}`, section, number, kind, prompt, answer, analysis });

export const QUESTIONS = [
  text('A', 1, '3, 6, 12, 24, …', '48', 'Pola dikali 2. Soal pemanasan; kesalahan di sini perlu diperhatikan.'),
  text('A', 2, '2, 5, 10, 17, 26, …', '37', 'Pola n² + 1. Selisihnya 3, 5, 7, 9, lalu 11.'),
  text('A', 3, '1, 1, 2, 3, 5, 8, …', '13', 'Deret Fibonacci: tiap angka adalah jumlah dua angka sebelumnya.'),
  text('A', 4, '100, 95, 85, 70, 50, …', '25', 'Selisih bertambah 5, 10, 15, 20, lalu 25.'),
  text('A', 5, 'A, C, F, J, O, …', 'U', 'Lompatan huruf +2, +3, +4, +5, lalu +6. O = 15, U = 21.', 'text'),
  text('A', 6, '4, 9, 7, 12, 10, 15, …', '13', 'Dua pola bergantian: +5 lalu −2.'),
  choice('A', 7, 'Semua teknisi wajib ikut pelatihan K3. Budi adalah teknisi. Apa kesimpulan yang tepat?', ['Budi sudah ikut pelatihan K3', 'Budi wajib ikut pelatihan K3', 'Sebagian teknisi tidak ikut K3', 'Tidak dapat disimpulkan'], 'B', 'Silogisme langsung. “Wajib” belum tentu “sudah”; mengukur ketelitian membaca.'),
  choice('A', 8, 'Semua manajer menguasai Excel. Sebagian staf menguasai Excel. Apa kesimpulan yang tepat?', ['Sebagian staf adalah manajer', 'Semua yang menguasai Excel adalah manajer', 'Tidak ada kesimpulan pasti tentang hubungan staf dan manajer', 'Sebagian manajer adalah staf'], 'C', 'Menguasai Excel tidak menjadikan staf manajer. Pilihan A menyimpulkan terlalu cepat.'),
  choice('A', 9, 'Jika proyek selesai tepat waktu, tim mendapat bonus. Tim tidak mendapat bonus. Apa kesimpulan yang tepat?', ['Proyek selesai tepat waktu', 'Proyek tidak selesai tepat waktu', 'Bonus ditunda', 'Tidak dapat disimpulkan'], 'B', 'Modus tollens: jika P maka Q; tidak Q, maka tidak P.'),
  text('A', 10, 'Andi datang sebelum Budi. Citra datang setelah Dedi. Budi datang sebelum Dedi. Siapa yang datang paling akhir?', 'Citra', 'Urutannya Andi, Budi, Dedi, Citra. Mengukur penyusunan informasi yang tersebar.', 'text'),
  text('B', 1, 'Sebuah kapal menempuh 180 mil laut dalam 12 jam. Berapa kecepatan rata-ratanya dalam knot?', '15 knot', '180 ÷ 12 = 15. Knot = mil laut per jam.'),
  text('B', 2, 'Harga barang Rp 2.400.000 diberi diskon 15%, lalu dikenakan PPN 11% dari harga setelah diskon. Berapa harga akhirnya?', 'Rp 2.264.400', '2.400.000 × 0,85 = 2.040.000; × 1,11 = 2.264.400. Persen tidak dijumlahkan menjadi diskon bersih 4%.'),
  text('B', 3, 'Tiga orang menyelesaikan pekerjaan dalam 12 hari. Berapa hari jika dikerjakan 4 orang dengan kemampuan sama?', '9 hari', '3 × 12 = 36 orang-hari; dibagi 4 = 9. Ini perbandingan berbalik.'),
  text('B', 4, 'Penjualan naik dari 800 unit menjadi 1.000 unit. Berapa persen kenaikannya?', '25%', 'Kenaikan 200 dibagi nilai awal 800 = 25%. Jawaban 20% menggunakan nilai akhir sebagai pembagi.'),
  text('B', 5, 'Perbandingan staf pria dan wanita 3 : 2, totalnya 45 orang. Berapa staf wanita?', '18 orang', '2/5 × 45 = 18. Mengukur rasio dasar.'),
  text('B', 6, 'Berapa 25% dari 40% dari 500?', '50', '0,25 × 0,4 × 500 = 50. Mengukur persen bertingkat.'),
  text('B', 7, 'Anggaran Rp 120 juta. Sebanyak 35% untuk material, lalu 1/4 dari sisanya untuk transportasi. Berapa sisa anggaran?', 'Rp 58,5 juta', 'Material 42 juta; sisa 78 juta; transportasi 19,5 juta; sisa 58,5 juta. Transportasi dihitung dari sisa, bukan 120 juta.'),
  text('B', 8, 'Rata-rata nilai 4 karyawan adalah 75. Setelah karyawan kelima masuk, rata-rata menjadi 78. Berapa nilai karyawan kelima?', '90', '5 × 78 − 4 × 75 = 390 − 300 = 90.'),
  choice('C', 1, 'Pilih sinonim dari EFISIEN.', ['cepat', 'berdaya guna', 'mahal', 'rumit'], 'B', 'Efisien berarti hasil maksimal dengan sumber daya minimal; “cepat” hanya asosiasi.'),
  choice('C', 2, 'Pilih sinonim dari KREDIBEL.', ['dapat dipercaya', 'berutang', 'cerdas', 'terkenal'], 'A', 'Kosakata profesional: kredibel berarti dapat dipercaya.'),
  choice('C', 3, 'Pilih sinonim dari AMBIGU.', ['ambisius', 'jelas', 'bermakna ganda', 'ragu-ragu'], 'C', 'Ambigu berarti bermakna ganda. “Ambisius” hanya mirip bunyi.'),
  choice('C', 4, 'Pilih antonim dari OPTIMIS.', ['realistis', 'pesimis', 'yakin', 'ragu'], 'B', 'Lawan kata optimis adalah pesimis; kontrol dasar.'),
  choice('C', 5, 'Pilih antonim dari KONKRET.', ['nyata', 'padat', 'abstrak', 'pasti'], 'C', 'Konkret berarti nyata dan berwujud; lawannya abstrak.'),
  choice('C', 6, 'Pilih antonim dari SPORADIS.', ['tersebar', 'jarang', 'kontinu', 'acak'], 'C', 'Sporadis berarti sesekali dan tidak teratur; lawannya terus-menerus.'),
  choice('C', 7, 'DOKTER : RUMAH SAKIT = NAKHODA : …', ['laut', 'pelabuhan', 'kapal', 'awak'], 'C', 'Hubungan profesi dan tempat kerja utama. Nakhoda bekerja di kapal.'),
  choice('C', 8, 'PENA : MENULIS = GERGAJI : …', ['kayu', 'tukang', 'memotong', 'tajam'], 'C', 'Hubungan alat dan fungsinya; kayu adalah objek.'),
  choice('C', 9, 'AIR : HAUS = MAKANAN : …', ['lapar', 'kenyang', 'piring', 'dapur'], 'A', 'Pemenuhan kebutuhan: air menghilangkan haus, makanan menghilangkan lapar.'),
  choice('C', 10, 'PANAS : API = DINGIN : …', ['musim', 'es', 'kulit', 'air'], 'B', 'Hubungan sifat dan sumbernya. Air bisa panas atau dingin.'),
  choice('D', 1, 'Atasan memberi tugas mendesak, padahal Anda sedang mengerjakan tugas lain yang tenggatnya hari ini.', ['Kerjakan tugas baru dulu tanpa memberi tahu', 'Tolak karena sedang sibuk', 'Sampaikan ke atasan bahwa dua tugas bertabrakan dan minta prioritas', 'Kerjakan keduanya dengan lembur tanpa memberi tahu siapa pun'], 'C', 'Komunikasi dan manajemen prioritas. Lembur tanpa komunikasi berisiko membuat kedua tugas buruk.', [1, 0, 3, 1]),
  choice('D', 2, 'Anda menemukan kesalahan angka di laporan yang sudah dikirim rekan ke klien.', ['Diam saja, bukan tanggung jawab Anda', 'Beri tahu rekan secara langsung dan sarankan koreksi segera', 'Langsung lapor ke atasan bahwa rekan ceroboh', 'Perbaiki sendiri dan kirim ulang ke klien tanpa memberi tahu rekan'], 'B', 'Kepedulian pada mutu dan etika tim. Melapor dengan menyalahkan merusak kepercayaan; mengirim sendiri melangkahi pemilik pekerjaan.', [0, 3, 1, 1]),
  choice('D', 3, 'Vendor menawarkan hadiah pribadi agar penawarannya dipilih.', ['Terima, karena sudah biasa', 'Tolak dengan sopan dan laporkan sesuai kebijakan perusahaan', 'Tolak tetapi tidak melapor', 'Terima, tetapi tetap menilai secara objektif'], 'B', 'Integritas inti. Pilihan A atau D perlu klarifikasi serius, terutama untuk pengadaan dan BD.', [0, 3, 2, 0]),
  choice('D', 4, 'Anda baru dua minggu bekerja dan belum paham prosedur sistem internal.', ['Menebak sendiri agar tidak merepotkan', 'Langsung bertanya ke rekan atau atasan', 'Menunggu sampai ada yang menjelaskan', 'Mencari panduan tertulis dulu, lalu menanyakan bagian yang belum jelas'], 'D', 'Inisiatif belajar mandiri. B baik, D juga menghargai waktu orang lain.', [0, 2, 1, 3]),
  choice('D', 5, 'Anda berselisih dengan rekan satu tim soal pembagian tugas.', ['Menghindari rekan tersebut', 'Mengajak bicara langsung dan mencari pembagian yang adil', 'Mengeluhkan rekan itu ke rekan lain', 'Langsung meminta atasan memutuskan'], 'B', 'Penyelesaian konflik secara dewasa. Pilihan C perlu diklarifikasi karena dapat memecah tim.', [1, 3, 0, 2]),
  choice('D', 6, 'Klien marah lewat telepon karena keterlambatan pengiriman yang bukan kesalahan Anda.', ['Menjelaskan bahwa itu bukan kesalahan Anda', 'Mendengarkan, meminta maaf atas ketidaknyamanan, mengecek status, dan memberi jadwal kabar berikutnya', 'Segera mengalihkan telepon ke bagian lain', 'Menjanjikan barang tiba besok agar klien tenang'], 'B', 'Orientasi layanan. Janji tanpa dasar dapat memperparah keluhan berikutnya.', [1, 3, 1, 0]),
  ...[
    'Saya membuat daftar tugas sebelum mulai bekerja.',
    'Saya sering menunda pekerjaan sampai mendekati tenggat.',
    'Saya memeriksa ulang pekerjaan sebelum menyerahkannya.',
    'Membawa pulang sedikit barang kantor untuk keperluan pribadi itu wajar.',
    'Saya mengakui kesalahan saya sendiri meskipun tidak ada yang tahu.',
    'Aturan boleh dilanggar jika hasilnya baik untuk perusahaan.',
    'Saya senang membantu rekan yang kesulitan meskipun bukan tugas saya.',
    'Saya lebih suka bekerja sendiri karena orang lain sering memperlambat.',
    'Saya terbuka menerima kritik dari rekan kerja.',
    'Saya tetap tenang saat menghadapi tekanan tenggat.',
    'Saya mudah tersinggung bila pekerjaan saya dikoreksi.',
    'Setelah gagal, saya cepat bangkit dan mencari perbaikan.',
    'Saya tidak pernah sekalipun merasa kesal kepada siapa pun.',
    'Seumur hidup saya tidak pernah terlambat sekali pun.',
  ].map((prompt, i) => ({ id: `E${i + 1}`, section: 'E', number: i + 1, kind: 'likert', prompt })),
];

export const DIMENSIONS = [
  { id: 'ketelitian', name: 'Ketelitian', items: [1, 2, 3], reversed: [2], analysis: 'Terencana dan rapi; relevan untuk administrasi, keuangan, dan dokumen kontrak.' },
  { id: 'integritas', name: 'Integritas', items: [4, 5, 6], reversed: [4, 6], analysis: 'Jawaban setuju pada butir 4 atau 6 perlu digali saat wawancara, terlepas dari skor lainnya.' },
  { id: 'kerja_sama', name: 'Kerja sama', items: [7, 8, 9], reversed: [8], analysis: 'Bahan diskusi tentang kerja dalam tim lintas fungsi.' },
  { id: 'stabilitas', name: 'Stabilitas emosi', items: [10, 11, 12], reversed: [11], analysis: 'Bahan diskusi tentang tekanan tenggat dan penerimaan koreksi; bukan diagnosis psikologis.' },
];

export const INTERVIEWS = [
  { id: 'F1', prompt: 'Ceritakan saat Anda menyelesaikan pekerjaan dengan tenggat sangat ketat.', competency: 'Manajemen waktu', strong: 'Memecah tugas, memprioritaskan, dan memberi kabar ke pihak terkait.', concern: 'Hanya “lembur saja”, atau menyalahkan pihak lain atas tenggat.' },
  { id: 'F2', prompt: 'Apa kesalahan terbesar Anda di pekerjaan, dan apa yang Anda lakukan?', competency: 'Akuntabilitas', strong: 'Mengakui dengan jelas, menjelaskan perbaikan dan pelajaran yang diambil.', concern: 'Tidak bisa menyebut kesalahan, atau selalu menyalahkan orang lain.' },
  { id: 'F3', prompt: 'Kapan Anda tidak sependapat dengan atasan? Bagaimana menyelesaikannya?', competency: 'Komunikasi asertif', strong: 'Menyampaikan data atau alasan dengan sopan dan menjalankan keputusan akhir.', concern: 'Melawan terbuka, atau diam lalu mengeluh di belakang.' },
  { id: 'F4', prompt: 'Ceritakan saat Anda harus mempelajari hal baru dengan cepat.', competency: 'Kemampuan belajar', strong: 'Sumber belajar spesifik, waktu yang dibutuhkan, dan hasil terukur.', concern: 'Jawaban abstrak tanpa contoh nyata.' },
  { id: 'F5', prompt: 'Ceritakan saat Anda menghadapi klien atau pihak luar yang sulit.', competency: 'Orientasi layanan', strong: 'Mendengarkan, mencari solusi, dan menjaga hubungan.', concern: 'Merendahkan klien atau emosi terbawa saat bercerita.' },
  { id: 'F6', prompt: 'Pernahkah Anda diminta melakukan sesuatu yang menurut Anda tidak etis?', competency: 'Integritas', strong: 'Menolak atau mengeskalasi melalui jalur yang benar secara profesional.', concern: 'Ikut saja karena perintah atau menganggap hal itu wajar.' },
];

export function publicQuestions(section) {
  return QUESTIONS.filter(q => q.section === section).map(({ id, section, number, kind, prompt, options }) => ({ id, section, number, kind, prompt, ...(options ? { options } : {}) }));
}
