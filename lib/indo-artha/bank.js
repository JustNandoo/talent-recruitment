// Bank soal, kunci, dan tabel analisis untuk Paket Psikotes Rekrutmen 3 Model.
// Sumber: docs/indo-artha/*.docx. File ini hanya dipakai di server; kunci tidak pernah dikirim ke peserta.

export const LETTERS5 = ['A', 'B', 'C', 'D', 'E'];
export const LETTERS4 = ['A', 'B', 'C', 'D'];

// ---------------------------------------------------------------------------
// Model 1 — Tes Kemampuan Kognitif & Ketelitian (TKK)
// ---------------------------------------------------------------------------

export const M1_SUBTESTS = [
  { key: 'verbal', label: 'Verbal', max: 8, kuat: 7, memadai: 5 },
  { key: 'numerik', label: 'Numerik', max: 8, kuat: 7, memadai: 5 },
  { key: 'logika', label: 'Penalaran Logis', max: 7, kuat: 6, memadai: 4 },
  { key: 'ketelitian', label: 'Ketelitian & Kecermatan', max: 7, kuat: 6, memadai: 4 },
];

const STIMULI = {
  kebijakan: {
    title: 'Bacaan',
    text: 'Kebijakan pembelian perusahaan: setiap pembelian di atas Rp50 juta wajib melampirkan tiga penawaran pembanding dan disetujui Direktur Keuangan. Pembelian di bawah Rp50 juta cukup disetujui Manajer Departemen, kecuali barang yang termasuk aset tetap, yang selalu membutuhkan persetujuan Direktur Keuangan berapa pun nilainya.',
  },
  lantai: {
    title: 'Keterangan',
    text: 'Lima departemen — Keuangan, HRD, Produksi, Gudang, dan QC — menempati lantai 1 sampai 5, satu departemen per lantai.',
    list: [
      'Produksi berada di lantai 1.',
      'QC berada tepat di atas Produksi.',
      'Keuangan berada di lantai yang lebih tinggi daripada HRD.',
      'Gudang tidak berada di lantai 5.',
    ],
  },
  banding: {
    title: 'Petunjuk',
    text: 'Bandingkan data kiri dan kanan karakter demi karakter, lalu pilih: A. Sama persis · B. Berbeda 1 karakter · C. Berbeda 2 karakter · D. Berbeda 3 karakter atau lebih.',
  },
  po: {
    title: 'Data',
    text: 'Purchase Order (PO) dan Surat Jalan dari pemasok untuk pesanan yang sama.',
    tables: [
      {
        caption: 'Purchase Order',
        head: ['No', 'Kode barang', 'Nama barang', 'Qty', 'Harga satuan (Rp)'],
        rows: [
          ['1', 'BRG-1021', 'Baut M10', '500', '1.250'],
          ['2', 'BRG-1022', 'Mur M10', '500', '850'],
          ['3', 'BRG-2210', 'Plat besi 3 mm', '40', '285.000'],
          ['4', 'BRG-3105', 'Kawat las 2,6 mm', '25', '112.500'],
          ['5', 'BRG-4400', 'Sarung tangan kulit', '60', '37.500'],
        ],
      },
      {
        caption: 'Surat Jalan',
        head: ['No', 'Kode barang', 'Nama barang', 'Qty dikirim'],
        rows: [
          ['1', 'BRG-1021', 'Baut M10', '500'],
          ['2', 'BRG-1023', 'Mur M10', '500'],
          ['3', 'BRG-2210', 'Plat besi 3 mm', '40'],
          ['4', 'BRG-3105', 'Kawat las 2,6 mm', '52'],
          ['5', 'BRG-4400', 'Sarung tangan kulit', '60'],
        ],
      },
    ],
  },
};

const COMPARE_OPTIONS = ['Sama persis', 'Berbeda 1 karakter', 'Berbeda 2 karakter', 'Berbeda 3 karakter atau lebih'];

function m1(no, sub, text, options, key, why, extra = {}) {
  return { id: `M1-${no}`, model: 'M1', no, sub, text, options, key, why, ...extra };
}

export const M1_ITEMS = [
  m1(1, 'verbal', 'Sinonim: **EFISIEN** = ...', ['Cepat', 'Murah', 'Sederhana', 'Berdaya guna', 'Teratur'], 'D',
    'Efisien = berdaya guna (hasil maksimal dengan sumber daya minimal).'),
  m1(2, 'verbal', 'Sinonim: **AKUNTABEL** = ...', ['Dapat dipertanggungjawabkan', 'Dapat dihitung', 'Dapat dipercaya', 'Dapat diandalkan', 'Dapat diukur'], 'A',
    'Akuntabel = dapat dipertanggungjawabkan.'),
  m1(3, 'verbal', 'Lawan kata: **SURPLUS** >< ...', ['Laba', 'Inflasi', 'Neraca', 'Kredit', 'Defisit'], 'E',
    'Surplus (kelebihan) >< defisit (kekurangan).'),
  m1(4, 'verbal', 'Lawan kata: **FLUKTUATIF** >< ...', ['Dinamis', 'Naik', 'Stabil', 'Turun', 'Berubah'], 'C',
    'Fluktuatif (naik-turun) >< stabil.'),
  m1(5, 'verbal', 'AUDITOR : LAPORAN KEUANGAN = INSPEKTUR MUTU : ...', ['Pabrik', 'Mesin', 'Karyawan', 'Gudang', 'Produk'], 'E',
    'Auditor memeriksa laporan keuangan; inspektur mutu memeriksa produk.'),
  m1(6, 'verbal', 'BAHAN BAKU : PRODUKSI = ... : ...', ['Data : Analisis', 'Gaji : Karyawan', 'Gudang : Barang', 'Mesin : Operator', 'Laporan : Direktur'], 'A',
    'Bahan baku diolah dalam produksi; data diolah dalam analisis (input : proses).'),
  m1(7, 'verbal', 'Manajer Produksi ingin membeli mesin bor (aset tetap) senilai Rp30 juta. Siapa yang harus menyetujui?',
    ['Cukup Manajer Produksi', 'Manajer Produksi, dengan tiga penawaran pembanding', 'Direktur Keuangan, dengan tiga penawaran pembanding', 'Direktur Keuangan', 'Tidak memerlukan persetujuan'], 'D',
    'Aset tetap selalu disetujui Direktur Keuangan; tiga penawaran hanya untuk pembelian di atas Rp50 juta.', { stim: 'kebijakan' }),
  m1(8, 'verbal', 'Pernyataan yang PASTI benar menurut teks adalah ...',
    ['Semua pembelian aset tetap wajib melampirkan tiga penawaran pembanding.', 'Manajer Departemen tidak boleh menyetujui pembelian apa pun.', 'Pembelian alat tulis senilai Rp60 juta memerlukan persetujuan Direktur Keuangan.', 'Pembelian di bawah Rp50 juta tidak memerlukan persetujuan.', 'Direktur Keuangan hanya menyetujui pembelian aset tetap.'], 'C',
    'Rp60 juta di atas Rp50 juta, jadi wajib disetujui Direktur Keuangan.', { stim: 'kebijakan' }),
  m1(9, 'numerik', 'Angka berikutnya dari deret 3, 7, 15, 31, 63, ... adalah', ['95', '127', '129', '131', '135'], 'B',
    'Pola ×2 + 1: 63 × 2 + 1 = 127.'),
  m1(10, 'numerik', 'Angka berikutnya dari deret 2, 3, 5, 9, 17, ... adalah', ['25', '27', '31', '32', '33'], 'E',
    'Selisih 1, 2, 4, 8, lalu 16: 17 + 16 = 33.'),
  m1(11, 'numerik', 'Sebuah produk dibeli Rp80.000 dan dijual Rp100.000. Berapa persen keuntungan terhadap harga beli?', ['25%', '20%', '22,5%', '30%', '80%'], 'A',
    '(100.000 − 80.000) ÷ 80.000 = 25%.'),
  m1(12, 'numerik', 'Harga sebuah barang setelah diskon 20% adalah Rp240.000. Berapa harga sebelum diskon?', ['Rp260.000', 'Rp280.000', 'Rp288.000', 'Rp300.000', 'Rp320.000'], 'D',
    '240.000 ÷ 0,8 = 300.000.'),
  m1(13, 'numerik', 'Mesin A menghasilkan 120 unit/jam dan mesin B 80 unit/jam. Jika bekerja bersama, berapa lama untuk menghasilkan 1.000 unit?', ['4 jam', '5 jam', '6 jam', '8,3 jam', '12,5 jam'], 'B',
    '1.000 ÷ (120 + 80) = 5 jam.'),
  m1(14, 'numerik', 'Tingkat cacat produksi 2,5%. Dari 4.800 unit, berapa unit yang tidak cacat?', ['4.560', '4.600', '4.620', '4.650', '4.680'], 'E',
    '4.800 × 97,5% = 4.680.'),
  m1(15, 'numerik', 'Penjualan Q1 Rp400 juta. Q2 naik 15% dari Q1, lalu Q3 turun 10% dari Q2. Berapa penjualan Q3?', ['Rp400 juta', 'Rp410 juta', 'Rp414 juta', 'Rp420 juta', 'Rp460 juta'], 'C',
    '400 × 1,15 = 460; 460 × 0,9 = 414.'),
  m1(16, 'numerik', 'Enam operator menyelesaikan sebuah pekerjaan dalam 10 hari. Agar selesai dalam 4 hari, berapa operator TAMBAHAN yang dibutuhkan jika produktivitasnya sama?', ['9', '6', '12', '15', '24'], 'A',
    '6 × 10 = 60 orang-hari; 60 ÷ 4 = 15 operator; tambahan 15 − 6 = 9.'),
  m1(17, 'logika', 'Semua staf gudang memakai sepatu keselamatan. Budi tidak memakai sepatu keselamatan. Kesimpulan:',
    ['Budi staf gudang yang melanggar aturan', 'Budi sedang cuti', 'Sebagian staf gudang tidak memakai sepatu keselamatan', 'Budi bukan staf gudang', 'Tidak dapat disimpulkan'], 'D',
    'Semua staf gudang memakai sepatu keselamatan; Budi tidak, maka Budi bukan staf gudang.'),
  m1(18, 'logika', 'Sebagian karyawan produksi adalah lulusan SMK. Semua lulusan SMK telah mengikuti pelatihan K3. Kesimpulan:',
    ['Sebagian karyawan produksi telah mengikuti pelatihan K3', 'Semua karyawan produksi telah mengikuti pelatihan K3', 'Semua peserta pelatihan K3 adalah lulusan SMK', 'Sebagian karyawan produksi bukan lulusan SMK', 'Tidak ada karyawan produksi yang mengikuti pelatihan K3'], 'A',
    'Sebagian karyawan produksi lulusan SMK, dan semua lulusan SMK sudah ikut pelatihan K3.'),
  m1(19, 'logika', 'Jika mesin overheat, produksi dihentikan. Hari ini produksi tidak dihentikan. Kesimpulan:',
    ['Mesin overheat', 'Mesin rusak', 'Mesin tidak overheat', 'Produksi berjalan lambat', 'Tidak dapat disimpulkan'], 'C',
    'Produksi tidak dihentikan, maka mesin tidak overheat.'),
  m1(20, 'logika', 'Jika laporan selesai, rapat dilaksanakan. Hari ini rapat dilaksanakan. Kesimpulan:',
    ['Laporan selesai', 'Laporan belum selesai', 'Laporan selesai tepat waktu', 'Rapat ditunda', 'Belum dapat dipastikan apakah laporan selesai'], 'E',
    'Rapat bisa terlaksana karena alasan lain; implikasi tidak bisa dibalik.'),
  m1(21, 'logika', 'Departemen di lantai 5 adalah ...', ['Keuangan', 'HRD', 'Gudang', 'QC', 'Tidak dapat ditentukan'], 'A',
    'Lantai 1 Produksi, 2 QC; Gudang di 3 atau 4; karena Keuangan di atas HRD, Keuangan pasti di lantai 5.', { stim: 'lantai' }),
  m1(22, 'logika', 'Gudang berada di lantai ...', ['2', '3', '4', '5', 'Tidak dapat dipastikan (3 atau 4)'], 'E',
    'Ada dua susunan sah untuk lantai 3–4: Gudang–HRD atau HRD–Gudang.', { stim: 'lantai' }),
  m1(23, 'logika', 'Huruf berikutnya dari deret A, C, F, J, O, ... adalah', ['T', 'U', 'V', 'W', 'X'], 'B',
    'Selisih +2, +3, +4, +5, lalu +6: O (15) + 6 = U (21).'),
  m1(24, 'ketelitian', 'Bandingkan kedua data berikut.', COMPARE_OPTIONS, 'C',
    '"0814" vs "0841": 2 karakter tertukar.', { stim: 'banding', pair: ['INV/2026/0814/FIN-077', 'INV/2026/0841/FIN-077'] }),
  m1(25, 'ketelitian', 'Bandingkan kedua data berikut.', COMPARE_OPTIONS, 'A',
    'Identik.', { stim: 'banding', pair: ['Rp 12.457.300,00', 'Rp 12.457.300,00'] }),
  m1(26, 'ketelitian', 'Bandingkan kedua data berikut.', COMPARE_OPTIONS, 'B',
    '"7" vs "1".', { stim: 'banding', pair: ['PO-88213-JKT-BATCH7', 'PO-88213-JKT-BATCH1'] }),
  m1(27, 'ketelitian', 'Bandingkan kedua data berikut.', COMPARE_OPTIONS, 'D',
    'L/I, Q/O, dan B/8: 3 karakter berbeda.', { stim: 'banding', pair: ['SN: 4X9-KL2-77Q-0B5', 'SN: 4X9-KI2-77O-085'] }),
  m1(28, 'ketelitian', 'Berapa baris yang TIDAK cocok antara PO dan Surat Jalan (kode barang atau jumlah)?', ['Tidak ada', '1 baris', '2 baris', '3 baris', '4 baris'], 'C',
    'Baris 2 (kode BRG-1022 vs BRG-1023) dan baris 4 (qty 25 vs 52).', { stim: 'po' }),
  m1(29, 'ketelitian', 'Berapa total nilai seluruh PO (Qty × Harga satuan)?', ['Rp16.512.500', 'Rp17.152.500', 'Rp17.521.500', 'Rp18.512.500', 'Rp17.512.500'], 'E',
    '625.000 + 425.000 + 11.400.000 + 2.812.500 + 2.250.000 = 17.512.500.', { stim: 'po' }),
  m1(30, 'ketelitian', 'Jika faktur pemasok mengikuti Surat Jalan, berapa potensi kelebihan bayar untuk barang No. 4?', ['Rp2.812.500', 'Rp3.307.500', 'Rp3.375.000', 'Rp3.037.500', 'Rp5.850.000'], 'D',
    '(52 − 25) × 112.500 = 3.037.500.', { stim: 'po' }),
];

export const M1_TOTAL_CATEGORIES = [
  { min: 26, label: 'Sangat Tinggi', text: 'Cepat memahami sistem dan aturan baru; berkapasitas untuk peran analitis atau manajerial.' },
  { min: 21, label: 'Tinggi', text: 'Kemampuan analisis baik; mampu menangani tugas yang bervariasi dan penuh pengecualian.' },
  { min: 15, label: 'Sedang', text: 'Memadai untuk tugas terstruktur dengan SOP yang jelas.' },
  { min: 10, label: 'Rendah', text: 'Perlu pelatihan intensif; cocok untuk tugas rutin sederhana dengan supervisi.' },
  { min: 0, label: 'Sangat Rendah', text: 'Belum memenuhi; periksa dulu faktor non-kemampuan seperti salah paham instruksi, bahasa, atau kecemasan.' },
];

// Pengecoh diagnostik (bagian E kunci Model 1). Kunci: nomor soal + huruf jawaban salah.
export const M1_ERROR_PATTERNS = {
  '7A': ['Kurang membaca soal', 'Melewatkan pengecualian aset tetap.'],
  '7C': ['Penerapan aturan berlebihan', 'Memakai syarat tiga penawaran di bawah ambang Rp50 juta; kurang cermat pada batas nilai.'],
  '8A': ['Generalisasi', 'Menyimpulkan melebihi isi teks.'],
  '8E': ['Generalisasi', 'Menyimpulkan melebihi isi teks.'],
  '11B': ['Konsep', 'Menghitung terhadap harga jual, bukan harga beli; rancu margin vs markup (penting untuk keuangan).'],
  '12C': ['Konsep', 'Menambah 20% ke harga setelah diskon; salah konsep persentase.'],
  '13D': ['Kurang membaca soal', 'Hanya menghitung satu mesin.'],
  '13E': ['Kurang membaca soal', 'Hanya menghitung satu mesin.'],
  '15D': ['Konsep', 'Menjumlahkan persentase langsung (+15% − 10% = +5%).'],
  '16D': ['Kurang membaca soal', 'Menjawab total operator, bukan tambahan.'],
  '18B': ['Generalisasi', 'Menarik kesimpulan yang tidak didukung premis; rawan salah tafsir kebijakan.'],
  '18D': ['Generalisasi', 'Menarik kesimpulan yang tidak didukung premis; rawan salah tafsir kebijakan.'],
  '20A': ['Logika terbalik', 'Membalik implikasi; cenderung tergesa menyimpulkan sebab-akibat.'],
  '22B': ['Intoleran terhadap ambiguitas', 'Memaksakan jawaban pasti padahal datanya tidak cukup.'],
  '22C': ['Intoleran terhadap ambiguitas', 'Memaksakan jawaban pasti padahal datanya tidak cukup.'],
  '29B': ['Transposisi angka', 'Membalik urutan digit; risiko langsung pada pembayaran dan pencatatan.'],
  '29C': ['Transposisi angka', 'Membalik urutan digit; risiko langsung pada pembayaran dan pencatatan.'],
  '30B': ['Transposisi angka', 'Membalik urutan digit; risiko langsung pada pembayaran dan pencatatan.'],
  '30E': ['Kurang membaca soal', 'Menghitung nilai total kiriman, bukan selisihnya.'],
};
export const M1_CARELESS_KEYS = ['7A', '13D', '13E', '16D', '30E'];

// Bagian D kunci Model 1 — profil subtes.
export const M1_PROFILES = [
  {
    id: 'num-tel-kuat', subs: ['numerik', 'ketelitian'],
    test: (c) => c.numerik === 'Kuat' && c.ketelitian === 'Kuat',
    pola: 'Numerik Kuat + Ketelitian Kuat', asumsi: 'Andal mengolah angka dan data; risiko salah input rendah.',
    cocok: 'Akuntansi, AP/AR, payroll, cost control, inventory control',
    gali: 'Bagaimana Anda memastikan tidak ada salah input saat memproses data dalam jumlah besar?',
  },
  {
    id: 'log-verb-kuat', subs: ['logika', 'verbal'],
    test: (c) => c.logika === 'Kuat' && c.verbal === 'Kuat',
    pola: 'Logika Kuat + Verbal Kuat', asumsi: 'Cepat memahami aturan, SOP, dan laporan; mampu menangani pengecualian.',
    cocok: 'PPIC, operasional, calon supervisor atau manajer',
    gali: 'Ceritakan keputusan yang Anda ambil dengan informasi yang tidak lengkap.',
  },
  {
    id: 'tel-kuat-lain-memadai', subs: ['verbal', 'numerik', 'logika', 'ketelitian'],
    test: (c) => c.ketelitian === 'Kuat' && ['verbal', 'numerik', 'logika'].every((k) => c[k] === 'Memadai'),
    pola: 'Ketelitian Kuat, subtes lain Memadai', asumsi: 'Kuat di pekerjaan pengecekan dan dokumentasi berulang.',
    cocok: 'QC, admin produksi, gudang, data entry',
    gali: 'Bagaimana Anda tetap fokus pada pekerjaan yang berulang?',
  },
  {
    id: 'num-kuat-tel-lemah', subs: ['numerik', 'ketelitian'],
    test: (c) => c.numerik === 'Kuat' && c.ketelitian === 'Lemah',
    pola: 'Numerik Kuat, Ketelitian Lemah', asumsi: 'Paham konsep, tetapi ceroboh di detail.',
    cocok: 'Berisiko di keuangan; bisa di analisis bila ada pengecekan berlapis',
    gali: 'Kesalahan kecil apa yang pernah berdampak besar, dan apa yang Anda ubah setelahnya?',
  },
  {
    id: 'verb-lemah', subs: ['verbal', 'numerik', 'logika', 'ketelitian'],
    test: (c) => c.verbal === 'Lemah' && ['numerik', 'logika', 'ketelitian'].every((k) => c[k] !== 'Lemah'),
    pola: 'Verbal Lemah, subtes lain Memadai/Kuat', asumsi: 'Kemampuan kerja baik, tetapi mungkin sulit memahami instruksi tertulis; cek faktor bahasa.',
    cocok: 'Peran teknis dengan instruksi visual atau lisan, ditambah pelatihan SOP',
    gali: 'Minta kandidat menjelaskan ulang satu SOP singkat dengan kata-katanya sendiri.',
  },
  {
    id: 'log-lemah', subs: ['logika', 'verbal', 'numerik', 'ketelitian'],
    test: (c) => c.logika === 'Lemah' && !['verbal', 'numerik', 'ketelitian'].every((k) => c[k] === 'Lemah'),
    pola: 'Logika Lemah', asumsi: 'Sulit menyimpulkan dari aturan dan menangani pengecualian.',
    cocok: 'Tugas rutin dengan SOP jelas; belum cocok untuk supervisor',
    gali: 'Apa yang Anda lakukan jika situasinya tidak tercakup dalam SOP?',
  },
  {
    id: 'semua-lemah', subs: ['verbal', 'numerik', 'logika', 'ketelitian'],
    test: (c) => ['verbal', 'numerik', 'logika', 'ketelitian'].every((k) => c[k] === 'Lemah'),
    pola: 'Semua subtes Lemah', asumsi: 'Belum memenuhi kebutuhan kognitif peran.',
    cocok: 'Tes ulang hanya bila ada indikasi faktor non-kemampuan',
    gali: 'Tanyakan pengalaman saat tes: apakah instruksi dipahami dan waktunya cukup?',
  },
];

// ---------------------------------------------------------------------------
// Model 2 — Inventori Gaya Kerja (IGK)
// ---------------------------------------------------------------------------

export const LIKERT = [
  { value: 1, code: 'STS', label: 'Sangat Tidak Sesuai' },
  { value: 2, code: 'TS', label: 'Tidak Sesuai' },
  { value: 3, code: 'N', label: 'Netral' },
  { value: 4, code: 'S', label: 'Sesuai' },
  { value: 5, code: 'SS', label: 'Sangat Sesuai' },
];

const M2_STATEMENTS = [
  'Saya cukup puas jika pekerjaan selesai, walaupun hasilnya biasa saja.',
  'Saya cepat menyesuaikan diri ketika ada perubahan sistem atau prosedur kerja.',
  'Saya mampu meyakinkan orang lain untuk mendukung ide saya.',
  'Saya tidak pernah merasa kesal kepada siapa pun.',
  'Saya melaporkan kesalahan yang saya buat, meskipun berisiko ditegur.',
  'Dalam situasi darurat, saya bisa berpikir jernih untuk mengambil tindakan.',
  'Saya sering baru menyadari kesalahan saya setelah orang lain menunjukkannya.',
  'Saya tidak pernah melakukan kesalahan dalam pekerjaan.',
  'Rekan kerja sering meminta pendapat saya sebelum mengambil keputusan.',
  'Saya mudah tersinggung ketika pekerjaan tidak berjalan sesuai rencana.',
  'Saya merasa canggung jika harus menegur rekan kerja yang melakukan kesalahan.',
  'Saya tidak pernah mengatakan hal yang tidak sepenuhnya benar, sekecil apa pun.',
  'Saya bertindak tanpa menunggu perintah jika melihat masalah di area kerja saya.',
  'Saya senang membantu rekan kerja yang kesulitan menyelesaikan tugasnya.',
  'Saya mencari cara yang lebih efisien untuk menyelesaikan pekerjaan rutin.',
  'Saya merasa tidak nyaman jika diminta mencatat data yang tidak sesuai kenyataan.',
  'Saya terbuka mendengarkan pendapat yang berbeda dari pendapat saya.',
  'Saya tetap mengikuti prosedur kerja meskipun tidak ada atasan yang mengawasi.',
  'Kritik dari atasan bisa membuat suasana hati saya buruk selama berhari-hari.',
  'Saya membuat daftar atau rencana sebelum mulai mengerjakan tugas.',
  'Kalau target sangat mendesak, wajar jika sebagian prosedur keselamatan dilewati.',
  'Saya menetapkan target pribadi yang lebih tinggi daripada standar yang diminta.',
  'Saya tetap tenang saat menghadapi tenggat waktu yang ketat.',
  'Saya dapat bekerja dengan baik bersama orang dari latar belakang budaya yang berbeda.',
  'Saya membagikan informasi penting kepada tim tanpa harus diminta.',
  'Saya cenderung menunda pekerjaan yang sulit sampai mendekati tenggat waktu.',
  'Saya senang mempelajari teknologi atau alat kerja baru.',
  'Saya menghindari peran sebagai koordinator atau penanggung jawab kelompok.',
  'Perubahan rencana yang mendadak membuat saya sulit bekerja dengan baik.',
  'Saya selalu menyukai setiap orang yang saya temui.',
  'Saya memeriksa ulang pekerjaan saya sebelum menyerahkannya.',
  'Menerima hadiah dari pemasok adalah hal wajar selama tidak memengaruhi keputusan.',
  'Saya lebih nyaman dengan cara kerja lama yang sudah terbukti daripada mencoba cara baru.',
  'Saya lebih suka bekerja sendiri karena bekerja dengan orang lain sering memperlambat.',
  'Saya menyimpan dokumen dan peralatan kerja dalam keadaan rapi dan mudah ditemukan.',
  'Saya tidak pernah sekali pun datang terlambat seumur hidup saya.',
  'Saya bisa kembali fokus dengan cepat setelah mengalami kegagalan.',
  'Detail kecil tidak terlalu saya pedulikan selama hasil akhirnya kira-kira benar.',
  'Jika target tim gagal, biasanya itu karena kesalahan anggota lain.',
  'Saya nyaman mengambil keputusan dan bertanggung jawab atas hasilnya.',
];

export const M2_DIMENSIONS = [
  {
    key: 'KT', label: 'Ketelitian & Keteraturan', items: ['7R', '20', '31', '35', '38R'],
    meaning: {
      Tinggi: 'Teliti, terencana, dokumentasi rapi; minim kesalahan. Pada skor sangat tinggi bisa lambat atau perfeksionis.',
      Sedang: 'Cukup teliti untuk tugas umum; butuh checklist untuk pekerjaan kritis.',
      Rendah: 'Cenderung mengabaikan detail dan kurang terorganisir; risiko salah input dan dokumentasi.',
    },
  },
  {
    key: 'IN', label: 'Integritas & Kepatuhan (termasuk K3)', items: ['5', '16', '18', '21R', '32R'],
    meaning: {
      Tinggi: 'Patuh prosedur dan K3 tanpa diawasi, terbuka melaporkan kesalahan, menolak gratifikasi.',
      Sedang: 'Umumnya patuh, tetapi bisa menoleransi pelanggaran kecil saat tertekan.',
      Rendah: 'Permisif terhadap jalan pintas, gratifikasi, atau pelanggaran K3; red flag untuk semua posisi.',
    },
  },
  {
    key: 'SE', label: 'Stabilitas Emosi & Ketahanan Tekanan', items: ['6', '10R', '19R', '23', '37'],
    meaning: {
      Tinggi: 'Tenang di bawah tekanan, cepat pulih dari kegagalan, menerima kritik.',
      Sedang: 'Cukup stabil; bisa terganggu oleh tekanan berkepanjangan.',
      Rendah: 'Mudah tertekan atau tersinggung; risiko konflik, kesalahan saat tenggat, dan turnover.',
    },
  },
  {
    key: 'KS', label: 'Kerja Sama Tim', items: ['14', '17', '25', '34R', '39R'],
    meaning: {
      Tinggi: 'Suportif, terbuka terhadap pendapat lain, aktif berbagi informasi.',
      Sedang: 'Bekerja sama bila diperlukan; nyaman juga bekerja sendiri.',
      Rendah: 'Lebih suka bekerja sendiri dan cenderung menyalahkan; kurang cocok untuk kerja shift atau tim lini.',
    },
  },
  {
    key: 'OH', label: 'Orientasi Hasil & Inisiatif', items: ['1R', '13', '15', '22', '26R'],
    meaning: {
      Tinggi: 'Berinisiatif, menetapkan target tinggi, mencari perbaikan proses.',
      Sedang: 'Memenuhi standar; inisiatif muncul bila diarahkan.',
      Rendah: 'Puas dengan hasil minimal dan cenderung menunda; perlu supervisi ketat.',
    },
  },
  {
    key: 'KP', label: 'Kepemimpinan & Pengaruh', items: ['3', '9', '11R', '28R', '40'],
    meaning: {
      Tinggi: 'Berani mengambil keputusan, berpengaruh, mampu menegur.',
      Sedang: 'Dapat memimpin kelompok kecil atau tugas tertentu.',
      Rendah: 'Lebih nyaman sebagai pelaksana; belum siap memimpin.',
    },
  },
  {
    key: 'AD', label: 'Adaptabilitas', items: ['2', '24', '27', '29R', '33R'],
    meaning: {
      Tinggi: 'Cepat menyesuaikan diri dengan sistem, teknologi, dan budaya baru; penting di perusahaan internasional.',
      Sedang: 'Dapat beradaptasi dengan waktu dan pendampingan.',
      Rendah: 'Menyukai rutinitas dan menolak perubahan; berisiko saat implementasi sistem baru.',
    },
  },
];
export const M2_VALIDITY_ITEMS = [4, 8, 12, 30, 36];
export const M2_CONSISTENCY_PAIRS = [[2, 29], [18, 21], [23, 10], [40, 28]];

const M2_REVERSED = new Set(M2_DIMENSIONS.flatMap((d) => d.items.filter((i) => i.endsWith('R')).map((i) => Number.parseInt(i, 10))));
const M2_DIM_OF = new Map(M2_DIMENSIONS.flatMap((d) => d.items.map((i) => [Number.parseInt(i, 10), d.key])));

export const M2_ITEMS = M2_STATEMENTS.map((text, i) => {
  const no = i + 1;
  return {
    id: `M2-${no}`, model: 'M2', no, text,
    dim: M2_VALIDITY_ITEMS.includes(no) ? 'SV' : M2_DIM_OF.get(no),
    reversed: M2_REVERSED.has(no),
  };
});

// Profil ideal (bagian E kunci Model 2). Nilai = kategori minimum: 3 Tinggi, 2 Sedang, 0 tidak dipersyaratkan.
export const M2_PROFILES = {
  staf_keuangan: {
    label: 'Staf keuangan',
    target: { KT: 3, IN: 3, SE: 2, KS: 2, OH: 2, KP: 0, AD: 2 },
    targetLabel: { KT: 'Tinggi', IN: 'Tinggi', SE: 'Sedang–Tinggi', KS: 'Sedang', OH: 'Sedang', KP: 'Tidak dipersyaratkan', AD: 'Sedang' },
    mandatory: ['KT', 'IN'],
  },
  staf_operasional: {
    label: 'Staf operasional',
    target: { KT: 2, IN: 3, SE: 3, KS: 3, OH: 3, KP: 2, AD: 3 },
    targetLabel: { KT: 'Sedang–Tinggi', IN: 'Tinggi', SE: 'Tinggi', KS: 'Tinggi', OH: 'Tinggi', KP: 'Sedang', AD: 'Tinggi' },
    mandatory: ['IN'],
  },
  produksi: {
    label: 'Operator / staf produksi',
    target: { KT: 3, IN: 3, SE: 2, KS: 3, OH: 2, KP: 0, AD: 2 },
    targetLabel: { KT: 'Tinggi', IN: 'Tinggi', SE: 'Sedang–Tinggi', KS: 'Tinggi', OH: 'Sedang–Tinggi', KP: 'Tidak dipersyaratkan', AD: 'Sedang' },
    mandatory: ['IN'],
  },
  supervisor: {
    label: 'Supervisor',
    target: { KT: 2, IN: 3, SE: 2, KS: 3, OH: 3, KP: 2, AD: 2 },
    targetLabel: { KT: 'Sedang–Tinggi', IN: 'Tinggi', SE: 'Sedang–Tinggi', KS: 'Tinggi', OH: 'Tinggi', KP: 'Min. Sedang', AD: 'Sedang' },
    mandatory: ['IN', 'KP'],
  },
  manajer: {
    label: 'Manajer',
    target: { KT: 2, IN: 3, SE: 3, KS: 2, OH: 3, KP: 3, AD: 3 },
    targetLabel: { KT: 'Sedang–Tinggi', IN: 'Tinggi', SE: 'Tinggi', KS: 'Sedang–Tinggi', OH: 'Tinggi', KP: 'Tinggi', AD: 'Tinggi' },
    mandatory: ['IN', 'KP'],
  },
};

// Bagian F kunci Model 2 — pola kombinasi. `d` berisi kategori per dimensi.
export const M2_PATTERNS = [
  {
    test: (d) => d.OH === 'Tinggi' && d.IN === 'Rendah', pola: 'OH Tinggi + IN Rendah',
    asumsi: 'Mengejar target lewat jalan pintas.', pertimbangan: 'Red flag terutama untuk keuangan (manipulasi data) dan produksi (K3).',
    gali: 'Ceritakan saat target dan prosedur bertentangan. Apa yang Anda lakukan?',
  },
  {
    test: (d) => d.KT === 'Tinggi' && d.AD === 'Rendah', pola: 'KT Tinggi + AD Rendah',
    asumsi: 'Teliti tetapi kaku.', pertimbangan: 'Cocok untuk akuntansi dan QC; lambat saat sistem berubah.',
    gali: 'Bagaimana pengalaman Anda ketika sistem atau cara kerja diganti?',
  },
  {
    test: (d) => d.KP === 'Tinggi' && d.KS === 'Rendah', pola: 'KP Tinggi + KS Rendah',
    asumsi: 'Dominan dan berpotensi memicu konflik.', pertimbangan: 'Perhatikan khusus untuk posisi supervisor.',
    gali: 'Bagaimana Anda menangani anggota tim yang tidak setuju dengan keputusan Anda?',
  },
  {
    test: (d) => d.KS === 'Tinggi' && d.KP === 'Rendah', pola: 'KS Tinggi + KP Rendah',
    asumsi: 'Team player yang belum siap memimpin.', pertimbangan: 'Sangat baik untuk staf; siapkan program pengembangan sebelum promosi.',
    gali: 'Pernahkah Anda memimpin sesuatu? Apa yang paling sulit?',
  },
  {
    test: (d) => d.SE === 'Rendah', pola: 'SE Rendah di posisi bertekanan',
    asumsi: 'Rentan kelelahan dan kesalahan di bawah tekanan.', pertimbangan: 'Misalnya closing keuangan, operasional 24 jam, produksi target tinggi.',
    gali: 'Kapan terakhir Anda sangat tertekan di pekerjaan, dan apa yang Anda lakukan?',
  },
  {
    test: (d) => d.AD === 'Tinggi' && d.KT === 'Rendah', pola: 'AD Tinggi + KT Rendah',
    asumsi: 'Fleksibel dan cepat, tetapi kurang detail.', pertimbangan: 'Cocok untuk operasional lapangan bila ada checklist dan kontrol.',
    gali: 'Bagaimana Anda memastikan tidak ada yang terlewat saat bekerja cepat?',
  },
  {
    test: (d) => d.OH === 'Rendah' && d.KT === 'Rendah', pola: 'OH Rendah + KT Rendah',
    asumsi: 'Motivasi dan keteraturan rendah.', pertimbangan: 'Risiko kinerja; konfirmasi melalui referensi.',
    gali: 'Apa yang membuat Anda tetap menyelesaikan pekerjaan yang membosankan?',
  },
];
export const M2_FAKING_PATTERN = {
  pola: 'Semua dimensi ≥ 22 dan SV ≥ 16', asumsi: 'Kemungkinan besar menampilkan citra ideal (faking good).',
  pertimbangan: 'Jangan menarik kesimpulan dari profil ini.',
  gali: 'Gunakan pertanyaan perilaku yang menuntut contoh spesifik, termasuk kegagalan nyata.',
};

// ---------------------------------------------------------------------------
// Model 3 — Tes Penilaian Situasional (TPS)
// ---------------------------------------------------------------------------

export const M3_CODES = {
  I: { name: 'Ideal', text: 'Menyeimbangkan aturan, hasil, dan manusia; transparan dan proaktif.' },
  S: { name: 'Sebagian benar', text: 'Arah sudah benar, tetapi solusinya belum menyeluruh atau hanya mengatasi gejala.' },
  P: { name: 'Pasif', text: 'Menunggu, menghindar, atau menyerahkan keputusan sepenuhnya kepada atasan.' },
  K: { name: 'Kaku', text: 'Terlalu prosedural atau otoriter, sehingga operasional atau moral tim terganggu.' },
  R: { name: 'Reaktif', text: 'Menyalahkan, menegur di depan umum, atau menyimpulkan penyebab tanpa data.' },
  E: { name: 'Pelanggaran etika', text: 'Berbohong, memanipulasi data, menerima gratifikasi, atau menuruti instruksi yang melanggar.', flag: true },
  J: { name: 'Jalan pintas', text: 'Mengorbankan kontrol, mutu, atau keselamatan kerja demi kecepatan.', flag: true },
};

export const M3_COMPETENCIES = [
  { key: 'integritas', label: 'Integritas & Etika', cases: [1, 2, 4, 10], max: 12, kuat: 10, memadai: 7 },
  { key: 'masalah', label: 'Pemecahan Masalah', cases: [3, 7, 11], max: 9, kuat: 8, memadai: 6 },
  { key: 'k3', label: 'Keselamatan Kerja (K3)', cases: [9, 12], max: 6, kuat: 5, memadai: 4 },
  { key: 'kepemimpinan', label: 'Kepemimpinan & Hubungan Kerja', cases: [5, 6, 8], max: 9, kuat: 8, memadai: 6 },
];
export const M3_FUNCTIONS = [
  { key: 'keuangan', label: 'Keuangan', cases: [1, 2, 3, 4], max: 12, kuat: 10, memadai: 7, critical: [1, 2, 4] },
  { key: 'operasional', label: 'Operasional', cases: [5, 6, 7, 8], max: 12, kuat: 10, memadai: 7, critical: [5, 7] },
  { key: 'produksi', label: 'Produksi', cases: [9, 10, 11, 12], max: 12, kuat: 10, memadai: 7, critical: [9, 10, 12] },
];
export const M3_TOTAL_CATEGORIES = [
  { min: 31, label: 'Sangat Baik' }, { min: 25, label: 'Baik' }, { min: 19, label: 'Cukup' }, { min: 0, label: 'Kurang' },
];
export const M3_CODE_PATTERNS = [
  { code: 'I', test: (n) => n.I >= 9, pola: 'I ≥ 9', asumsi: 'Penilaian situasional matang; memahami keseimbangan prosedur, hasil, dan manusia.', implikasi: 'Siap untuk semua level, termasuk kandidat supervisor/manajer.' },
  { code: 'S', test: (n) => n.S >= 4, pola: 'S ≥ 4', asumsi: 'Arah benar tetapi solusinya belum menyeluruh; potensi berkembang dengan coaching.', implikasi: 'Wajar untuk staf; perlu perhatian untuk manajer.' },
  { code: 'P', test: (n) => n.P >= 3, pola: 'P ≥ 3', asumsi: 'Cenderung menunggu arahan dan menghindari keputusan.', implikasi: 'Dapat diterima untuk staf baru dengan supervisi; kekhawatiran serius untuk supervisor/manajer.' },
  { code: 'K', test: (n) => n.K >= 2, pola: 'K ≥ 2', asumsi: 'Kaku atau otoriter.', implikasi: 'Aman untuk fungsi kontrol (audit, akuntansi), tetapi bisa menghambat operasional dan moral tim.' },
  { code: 'R', test: (n) => n.R >= 2, pola: 'R = 2', asumsi: 'Reaktif; cenderung menyalahkan atau menyimpulkan tanpa data.', implikasi: 'Risiko konflik; perhatian khusus untuk calon pemimpin tim.' },
  { code: 'EJ', test: (n) => n.E + n.J >= 1, pola: 'E atau J ≥ 1', asumsi: 'Lihat aturan red flag.', implikasi: 'Berlaku untuk semua level.' },
];
export const M3_QUESTIONS = {
  E: 'Pernahkah Anda diminta melakukan sesuatu yang bertentangan dengan aturan? Apa yang terjadi?',
  J: 'Ceritakan saat target atau tenggat membuat Anda tergoda melewati prosedur. Apa yang Anda putuskan?',
  P: 'Beri contoh keputusan penting yang Anda ambil sendiri tanpa menunggu atasan.',
  K: 'Kapan Anda pernah membuat pengecualian terhadap aturan, dan mengapa?',
  R: 'Ceritakan konflik terakhir dengan rekan kerja. Bagaimana penyelesaiannya?',
  S: 'Dari masalah yang pernah Anda selesaikan, apa yang Anda lakukan agar masalah itu tidak terulang?',
};

function m3(no, fungsi, level, kompetensi, text, options, keyRow) {
  const key = {};
  keyRow.split(' ').forEach((cell, i) => {
    key[LETTERS4[i]] = { points: Number(cell[0]), code: cell[1] };
  });
  return { id: `M3-${no}`, model: 'M3', no, fungsi, level, kompetensi, text, options, key };
}

export const M3_ITEMS = [
  m3(1, 'keuangan', 'Staf', 'Integritas',
    'Saat rekonsiliasi bank akhir bulan, Anda menemukan selisih Rp1.750.000 antara saldo buku dan rekening koran. Tenggat laporan tinggal 2 jam dan atasan Anda sedang rapat.',
    ['Memberi tahu atasan lewat pesan singkat, terus menelusuri selisih, dan bila belum ketemu menyerahkan laporan tepat waktu dengan catatan selisih yang belum terjelaskan.',
      'Membukukan selisih ke akun "biaya lain-lain" agar laporan seimbang, lalu menelusurinya bulan depan.',
      'Menunggu atasan selesai rapat untuk melapor dan meminta arahan, walaupun laporan berisiko terlambat.',
      'Menahan laporan sampai selisih ditemukan, tanpa memberi tahu siapa pun.'],
    '3I 0E 2P 1K'),
  m3(2, 'keuangan', 'Staf/Supervisor', 'Integritas',
    'Vendor yang tagihannya sedang menunggu pembayaran mengirim parsel bernilai cukup besar ke rumah Anda menjelang hari raya, disertai pesan: "Mohon dibantu agar pembayaran kami diprioritaskan."',
    ['Menerima parsel dan memprioritaskan pembayaran vendor tersebut karena tagihannya memang sudah lama menunggu.',
      'Menerima parsel, tetapi tetap memproses pembayaran sesuai antrean normal.',
      'Mengembalikan parsel tanpa melapor, lalu memproses pembayaran sesuai jadwal normal.',
      'Mengembalikan parsel dengan sopan, melaporkannya ke atasan atau unit kepatuhan sesuai kebijakan, dan memproses pembayaran sesuai jadwal normal.'],
    '0E 1E 2S 3I'),
  m3(3, 'keuangan', 'Supervisor', 'Pemecahan Masalah',
    'Manajer Produksi meminta pencairan dana darurat Rp75 juta hari ini untuk membeli suku cadang mesin yang rusak. Penawaran harga dan persetujuan direktur belum lengkap, dan lini produksi berhenti sampai suku cadang tersedia.',
    ['Menolak permintaan sampai semua dokumen lengkap, karena prosedur tidak boleh ditawar.',
      'Menghubungi direktur berwenang untuk persetujuan cepat (misalnya lewat email), mengecek prosedur pembelian darurat, dan mencairkan dana setelah persetujuan minimal terpenuhi.',
      'Mencairkan dana saat itu juga karena darurat, dan meminta dokumen dilengkapi minggu depan.',
      'Meneruskan masalah ke atasan Anda dan menunggu keputusannya.'],
    '1K 3I 0J 2P'),
  m3(4, 'keuangan', 'Manajer', 'Integritas',
    'Menjelang tutup buku tahunan, seorang direktur meminta Anda "menggeser" sebagian pendapatan Januari tahun depan ke Desember agar target tahunan tercapai.',
    ['Menuruti permintaan karena itu instruksi atasan dan selisih waktunya hanya beberapa minggu.',
      'Menolak dengan sopan dan mencatat pendapatan di periode yang benar, tanpa membahasnya lebih lanjut.',
      'Menjelaskan secara pribadi bahwa hal itu melanggar standar akuntansi, menawarkan alternatif yang sah (misalnya analisis proyeksi atau pipeline), dan mengeskalasi ke komite audit bila tetap dipaksa.',
      'Menyampaikan keberatan, tetapi menyerahkan keputusan akhir kepada direktur karena kewenangan ada padanya.'],
    '0E 2S 3I 1P'),
  m3(5, 'operasional', 'Staf', 'Kepemimpinan & Hubungan Kerja',
    'Pengiriman untuk pelanggan utama di luar negeri dipastikan terlambat 3 hari karena jadwal kapal mundur. Pelanggan belum mengetahuinya.',
    ['Menunggu sampai pelanggan bertanya, karena keterlambatan disebabkan pihak ketiga.',
      'Mengatakan kepada pelanggan bahwa barang sudah dikirim tepat waktu, lalu mengurus keterlambatan di belakang layar.',
      'Melapor ke atasan dan menyerahkan seluruh komunikasi dengan pelanggan kepadanya.',
      'Setelah berkoordinasi dengan atasan, segera memberi tahu pelanggan secara proaktif: penyebab, estimasi waktu baru, dan opsi alternatif seperti pengiriman parsial lewat udara.'],
    '1P 0E 2P 3I'),
  m3(6, 'operasional', 'Supervisor', 'Kepemimpinan & Hubungan Kerja',
    'Dua anggota tim Anda berselisih tajam soal pembagian shift dan mulai saling menyindir di grup kerja. Produktivitas tim mulai turun.',
    ['Bertemu masing-masing secara pribadi untuk memahami masalah, lalu memfasilitasi pertemuan bersama untuk menyepakati aturan pembagian shift yang adil dan transparan.',
      'Membiarkan mereka menyelesaikannya sendiri karena keduanya sudah dewasa.',
      'Menegur keduanya secara terbuka di grup kerja agar tidak terulang.',
      'Langsung menetapkan jadwal shift baru tanpa diskusi untuk mengakhiri perselisihan.'],
    '3I 0P 1R 2S'),
  m3(7, 'operasional', 'Supervisor', 'Pemecahan Masalah',
    'Sistem ERP gudang mati sejak pagi dan baru pulih sore hari menurut tim IT. Hari ini ada 15 truk yang harus dimuat.',
    ['Menghentikan seluruh pengeluaran barang sampai sistem normal agar data tidak kacau.',
      'Memuat semua truk tanpa pencatatan, karena data bisa dicocokkan dari surat jalan nanti.',
      'Menjalankan prosedur manual cadangan (formulir bernomor urut), memprioritaskan muatan sesuai urgensi pelanggan, dan menugaskan satu orang menginput ulang data setelah sistem pulih.',
      'Hanya memuat truk dengan prioritas tertinggi memakai catatan seadanya, sisanya ditunda sampai sistem pulih.'],
    '1K 0J 3I 2S'),
  m3(8, 'operasional', 'Manajer', 'Kepemimpinan & Hubungan Kerja',
    'Perusahaan menerapkan sistem kerja baru yang memangkas satu tahapan proses. Beberapa staf senior menolak dengan alasan "cara lama sudah terbukti".',
    ['Menerapkan sistem baru secara tegas; yang tidak mengikuti akan diberi sanksi.',
      'Menjelaskan alasan dan manfaat perubahan, melibatkan staf senior sebagai penguji coba dan pemberi masukan, menyediakan pelatihan, serta menetapkan target waktu penerapan yang jelas.',
      'Menunda penerapan sampai seluruh staf setuju.',
      'Menguji coba sistem di satu tim dulu, lalu menyampaikan hasilnya kepada seluruh staf sebelum diterapkan penuh.'],
    '1K 3I 0P 2S'),
  m3(9, 'produksi', 'Operator/Staf', 'K3',
    'Anda melihat rekan kerja mengoperasikan mesin press dengan pelindung (safety guard) yang dilepas agar lebih cepat. Target produksi hari ini memang tinggi.',
    ['Membiarkannya karena itu tanggung jawab rekan tersebut dan target memang harus tercapai.',
      'Melaporkannya ke supervisor setelah jam kerja selesai.',
      'Menegurnya, tetapi tidak melapor agar ia tidak mendapat masalah.',
      'Menegurnya dengan baik, memintanya menghentikan mesin dan memasang kembali pelindung, lalu melaporkan kejadian ke supervisor.'],
    '0J 1P 2S 3I'),
  m3(10, 'produksi', 'Staf', 'Integritas',
    'Di akhir shift, Anda menemukan 30 unit produk dengan cacat kecil yang sulit terlihat orang awam. Produk dijadwalkan dikirim ke pelanggan besok pagi.',
    ['Memisahkan dan menandai unit tersebut (karantina), melaporkannya ke supervisor/QC sesuai prosedur produk tidak sesuai, dan mencatat temuan.',
      'Meloloskan produk karena cacatnya tidak akan disadari pelanggan.',
      'Memperbaiki sendiri cacatnya tanpa mencatat agar pengiriman tidak terganggu.',
      'Melapor ke supervisor dan menyerahkan keputusan sepenuhnya kepadanya.'],
    '3I 0E 1J 2P'),
  m3(11, 'produksi', 'Supervisor', 'Pemecahan Masalah',
    'Dalam seminggu, tingkat cacat di lini Anda naik dari 1,5% menjadi 4%. Operator saling menyalahkan antara bahan baku dan setelan mesin.',
    ['Mengganti operator yang paling sering bertugas saat cacat terjadi.',
      'Langsung mengajukan klaim ke pemasok bahan baku karena itu penyebab paling mungkin.',
      'Mengumpulkan data per shift, per batch bahan, dan per mesin, menganalisis akar masalah bersama tim (misalnya 5 Why atau diagram tulang ikan), lalu menetapkan dan memantau tindakan perbaikan.',
      'Meminta teknisi memeriksa dan menyetel ulang semua mesin.'],
    '0R 1R 3I 2S'),
  m3(12, 'produksi', 'Manajer', 'K3',
    'Pelanggan besar meminta pesanannya dipercepat 2 minggu. Untuk itu tim produksi harus lembur 3 minggu berturut-turut dan jadwal perawatan preventif mesin ditunda.',
    ['Menerima permintaan tanpa syarat karena pelanggan besar harus dipertahankan.',
      'Menghitung kapasitas riil dan risikonya, menawarkan opsi realistis kepada pelanggan (misalnya pengiriman bertahap), mengatur lembur dalam batas aturan dengan rotasi, dan tidak menunda perawatan kritis.',
      'Menolak permintaan karena kapasitas tidak memadai.',
      'Menerima permintaan penuh, menambah tenaga kontrak sementara agar lembur tidak berlebihan, dan tetap menjalankan perawatan sesuai jadwal.'],
    '0J 3I 1K 2S'),
];

// ---------------------------------------------------------------------------
// Posisi, paket, dan bagian ujian
// ---------------------------------------------------------------------------

const SUPERVISOR_M1 = { min: 20, conditions: [{ noLemah: true }] };
export const POSITIONS = [
  { key: 'keu-staf', label: 'Staf Keuangan / Akuntansi', fungsi: 'keuangan', level: 'staf', m1: { min: 19, conditions: [{ sub: 'numerik', min: 6 }, { sub: 'ketelitian', min: 6 }] }, m2: 'staf_keuangan' },
  { key: 'ops-staf', label: 'Staf Operasional (logistik, gudang, PPIC, purchasing)', fungsi: 'operasional', level: 'staf', m1: { min: 17, conditions: [{ sub: 'logika', min: 4 }, { sub: 'ketelitian', min: 4 }] }, m2: 'staf_operasional' },
  { key: 'prod-operator', label: 'Operator Produksi', fungsi: 'produksi', level: 'operator', m1: { min: 14, conditions: [{ sub: 'numerik', min: 4 }, { sub: 'ketelitian', min: 4 }] }, m2: 'produksi', ringkas: true },
  { key: 'prod-staf', label: 'Staf Produksi / QC', fungsi: 'produksi', level: 'staf', m1: { min: 16, conditions: [{ sub: 'ketelitian', min: 5 }] }, m2: 'produksi', ringkas: true },
  { key: 'keu-spv', label: 'Supervisor Keuangan', fungsi: 'keuangan', level: 'supervisor', m1: SUPERVISOR_M1, m2: 'supervisor', extraMandatory: ['KT'] },
  { key: 'ops-spv', label: 'Supervisor Operasional', fungsi: 'operasional', level: 'supervisor', m1: SUPERVISOR_M1, m2: 'supervisor' },
  { key: 'prod-spv', label: 'Supervisor Produksi', fungsi: 'produksi', level: 'supervisor', m1: SUPERVISOR_M1, m2: 'supervisor' },
  { key: 'keu-mgr', label: 'Manajer Keuangan', fungsi: 'keuangan', level: 'manajer', m1: { min: 24, conditions: [{ sub: 'numerik', min: 7 }, { sub: 'ketelitian', min: 6 }, { noLemah: true }] }, m2: 'manajer', extraMandatory: ['KT'] },
  { key: 'ops-mgr', label: 'Manajer Operasional', fungsi: 'operasional', level: 'manajer', m1: { min: 23, conditions: [{ sub: 'logika', min: 5 }, { sub: 'verbal', min: 6 }, { noLemah: true }] }, m2: 'manajer' },
  { key: 'prod-mgr', label: 'Manajer Produksi', fungsi: 'produksi', level: 'manajer', m1: { min: 23, conditions: [{ sub: 'logika', min: 5 }, { sub: 'verbal', min: 6 }, { noLemah: true }] }, m2: 'manajer' },
];
export const RINGKAS_M1 = { min: 9, conditions: [{ sub: 'ketelitian', min: 4 }] };
// Kasus utama tambahan (Panduan Penguji) untuk supervisor dan manajer.
export const LEVEL_KEY_CASES = { supervisor: [3, 6, 7, 11], manajer: [4, 8, 12] };

export function getPosition(key) {
  return POSITIONS.find((p) => p.key === key) || null;
}

export const MODEL_INFO = {
  M1: {
    title: 'Model 1 — Tes Kemampuan Kognitif & Ketelitian (TKK)', short: 'Model 1 · Kognitif',
    instructions: (n, minutes) => [
      `Ada ${n} soal dengan waktu ${minutes} menit. Pilih satu jawaban paling tepat.`,
      'Kerjakan yang Anda yakini lebih dulu. Soal yang tidak sempat dikerjakan biarkan kosong, jangan menebak asal.',
      'Kalkulator dan ponsel tidak diperbolehkan. Siapkan pensil dan kertas buram.',
      'Anda dapat berpindah soal dan memeriksa kembali jawaban sebelum menekan Selesai.',
    ],
  },
  M2: {
    title: 'Model 2 — Inventori Gaya Kerja (IGK)', short: 'Model 2 · Gaya Kerja',
    instructions: (n, minutes) => [
      `Ada ${n} pernyataan tentang cara Anda bekerja, dengan waktu ${minutes} menit. Tidak ada jawaban benar atau salah.`,
      'Pilih satu kolom yang paling menggambarkan diri Anda yang sebenarnya, bukan yang ideal.',
      'STS = Sangat Tidak Sesuai · TS = Tidak Sesuai · N = Netral · S = Sesuai · SS = Sangat Sesuai.',
      'Jawablah semua pernyataan tanpa terlalu lama berpikir. Periksa kembali agar setiap pernyataan terjawab.',
    ],
  },
  M3: {
    title: 'Model 3 — Tes Penilaian Situasional (TPS)', short: 'Model 3 · Situasional',
    instructions: (n, minutes) => [
      `Ada ${n} situasi kerja dengan waktu ${minutes} menit.`,
      'Bayangkan Anda berada dalam situasi tersebut, walaupun posisinya berbeda dari yang Anda lamar.',
      'Pilih satu tindakan yang paling tepat menurut Anda.',
      'Anda dapat memeriksa kembali jawaban sebelum menekan Selesai.',
    ],
  },
};

// Urutan pelaksanaan mengikuti Panduan Penguji: Model 1 → Model 3 → jeda → Model 2.
export const PACKAGES = {
  lengkap: {
    label: 'Lengkap (3 model, ±90 menit)',
    sections: [
      { key: 'M1', minutes: 40, items: M1_ITEMS.map((q) => q.id) },
      { key: 'M3', minutes: 25, items: M3_ITEMS.map((q) => q.id) },
      { key: 'JEDA', minutes: 10, break: true },
      { key: 'M2', minutes: 15, items: M2_ITEMS.map((q) => q.id) },
    ],
  },
  ringkas: {
    label: 'Ringkas operator massal (±40 menit)',
    sections: [
      { key: 'M1', minutes: 20, items: M1_ITEMS.filter((q) => q.sub === 'numerik' || q.sub === 'ketelitian').map((q) => q.id) },
      { key: 'M3', minutes: 5, items: ['M3-9', 'M3-10'] },
      { key: 'M2', minutes: 15, items: M2_ITEMS.map((q) => q.id) },
    ],
  },
};

export const ITEMS = new Map([...M1_ITEMS, ...M2_ITEMS, ...M3_ITEMS].map((q) => [q.id, q]));
export { STIMULI };

// Versi soal untuk peserta: tanpa kunci, pembahasan, kode, atau dimensi.
export function publicItem(id) {
  const q = ITEMS.get(id);
  if (!q) return null;
  if (q.model === 'M2') return { id: q.id, model: 'M2', text: q.text, scale: LIKERT.map(({ value, code, label }) => ({ value, code, label })) };
  const letters = q.options.length === 5 ? LETTERS5 : LETTERS4;
  const out = {
    id: q.id, model: q.model, text: q.text,
    options: q.options.map((text, i) => ({ letter: letters[i], text })),
  };
  if (q.stim) out.stimulus = STIMULI[q.stim];
  if (q.pair) out.pair = q.pair;
  return out;
}
