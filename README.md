# HRD Division PT Serviam Group Shipyard — Asesmen Rekrutmen

Aplikasi ujian sekali pakai yang diselenggarakan oleh **HRD Division PT Serviam Group Shipyard**, dengan logo Serviam dan dashboard penilaian untuk penguji. Soal, kunci, analisis, waktu, dan panduan wawancara mengacu pada **Bank Soal Psikotes Karyawan Baru** dari Fajar (8 Oktober 2026), yang tersimpan di `docs/bank-soal.pdf`.

## Menjalankan aplikasi

Memerlukan **Node.js 24 atau lebih baru**. Backend memakai HTTP bawaan Node dan SQLite bawaan `node:sqlite`; tidak memerlukan database, API key, atau layanan eksternal. Frontend tidak memerlukan proses build.

Untuk paket ZIP, ekstrak seluruh isi lalu baca `MULAI-DI-SINI.txt`. Di Windows jalankan `start.bat`; di Linux/macOS jalankan `sh start.sh` dari folder proyek. Skrip memeriksa runtime dan menjalankan aplikasi tanpa instalasi paket tambahan.

Paket juga memuat **`Talenta.sln`** untuk Visual Studio 2022 dengan workload **Node.js development** dan **`Talenta.code-workspace`** untuk VS Code. Keduanya menjalankan `server.js`; petunjuk F5 dan pembuatan akun tersedia di `BUKA-DI-VISUAL-STUDIO.md`.

```bash
# Jalankan dari folder proyek yang berisi package.json.
npm ci --ignore-scripts
npm test
npm start
```

Server memakai port 3000 secara default. `npm run dev` menjalankan mode pengembangan dengan restart otomatis. Pada tugas cloud gunakan checkout yang sudah tersedia; setiap tugas sudah terisolasi, sehingga tidak perlu membuat Git worktree.

Setelah `npm start`, gunakan **alamat web yang tercetak di terminal**. Pada port default, alamatnya `http://localhost:3000/`. Browser lokal di Windows/macOS atau Linux dengan desktop dibuka otomatis setelah server siap. File `index.html` di folder proyek dan `public/index.html` kini mengarahkan ke server pada port 3000 jika dibuka sebagai file. Untuk port lain, gunakan alamat dari terminal.

Jika ingin mematikan pembukaan browser otomatis, atur `TALENTA_OPEN_BROWSER=false` pada environment proses. Halaman juga menampilkan petunjuk jika JavaScript gagal termuat dan permintaan server dibatasi 12 detik agar tidak menunggu tanpa batas.

## Akun admin dan superadmin

Pada instalasi lokal baru, `npm start` otomatis membuat **dua akun** dengan kata sandi acak berbeda:

- `superadmin@serviam.local`: mengelola seluruh fitur, akun penguji, status sistem, dan audit.
- `admin@serviam.local`: mengundang peserta, memeriksa jawaban/analisis, menilai wawancara, dan mengekspor hasil.

Alamat ini adalah identitas login lokal; tidak mengirim email. Ubah `SUPERADMIN_EMAIL` dan `ADMIN_EMAIL` pada `.env` **sebelum instalasi pertama** jika ingin identitas lain. Kata sandi awal tersimpan secara pribadi pada `.data/initial-accounts.txt` (izin 0600 pada Linux). Buka file itu di komputer/server sendiri. Kata sandi tidak dicetak ke log dan tidak disertakan dalam Git atau ZIP. Dashboard terkunci sampai pemilik akun mengganti kata sandi awal. Setelah kedua akun menggantinya, hapus file kata sandi awal melalui pengelola file Anda.

Aplikasi memakai akun yang sudah ada tanpa menimpanya. Pada migrasi versi lama, akun penguji pertama menjadi superadmin; penguji lainnya menjadi admin. Akun admin tambahan dapat dibuat melalui **Akun penguji → Tambah akun**. Superadmin dapat menonaktifkan akun, mengganti peran, dan mereset kata sandi awal; sesi akun yang diubah dihentikan. Superadmin aktif terakhir dilindungi dari penonaktifan/penurunan peran. Menu **Ganti kata sandi** juga tersedia untuk setiap akun.

Untuk menyiapkan akun sebelum menjalankan server atau pada produksi:

```bash
npm run setup:accounts
```

Perintah ini hanya bekerja pada database tanpa akun. Konfigurasi produksi memakai `BOOTSTRAP_ACCOUNTS=false`. Untuk penyiapan manual akun pertama melalui web, kode lokal `.data/bootstrap-token` tetap didukung saat tidak ada akun; `npm run admin:setup` membuat superadmin pertama melalui server yang sedang berjalan.

## Alur penguji dan peserta

1. Penguji masuk, memilih **Add invitation**, dan mengisi nama serta posisi peserta. Email opsional. Masa berlaku undangan dapat dipilih 1, 7, 14, atau 30 hari.
2. Tekan **Copy link**, lalu bagikan tautan sendiri melalui WhatsApp, pesan, atau saluran yang Anda pilih. Aplikasi tidak mengirim email secara otomatis dan hanya menyimpan hash token. Tautan asli hanya tampil saat dibuat. **Buat ulang tautan** membatalkan tautan lama, hanya jika peserta belum mulai.
3. Peserta membaca instruksi, menyetujui pengolahan hasil untuk rekrutmen, lalu mulai. **Satu kali berarti satu kesempatan ujian**, bukan satu kali membuka halaman instruksi. Token dikonsumsi atomik saat mulai dan tidak dapat digunakan dari browser kedua.
4. Sesi dapat dilanjutkan di browser yang sama, dengan cookie yang sama, selama batas waktu belum habis. Jawaban disimpan otomatis di server. Kegagalan penyimpanan ditampilkan dan perpindahan bagian menunggu penyimpanan berhasil.
5. Bagian yang sudah ditutup tidak dapat dibuka kembali. Deadline berasal dari server, tetap berjalan saat peserta offline, dan tidak dapat diperpanjang dengan mengubah jam perangkat. Waktu habis menggunakan jawaban terakhir yang tersimpan. Setelah bagian E atau seluruh waktu habis, hasil dihitung otomatis.
6. Penguji melihat skor dan analisis, menilai enam pertanyaan wawancara STAR (1–5), lalu mencatat keputusan secara manual. Penguji dapat mengekspor ringkasan CSV atau menghapus data peserta yang sudah tidak diperlukan. Penghapusan diblokir saat ujian masih berlangsung.

Token undangan bukan verifikasi identitas. Peserta yang kehilangan cookie setelah memulai tidak mendapat sesi baru; jangan menghapus cookie atau berganti browser saat ujian.

## Urutan soal per peserta

Urutan 48 soal diacak **di dalam masing-masing bagian A–E** ketika tautan undangan dibuat, lalu disimpan di SQLite untuk peserta tersebut. Urutan bagian dan batas waktunya mengikuti PDF. Setiap bagian selalu memuat seluruh butir satu kali; pilihan jawaban tetap mengikuti sumber. Urutan tidak berubah ketika halaman dimuat ulang, peserta melanjutkan sesi, atau server dijalankan ulang. Penguji melihat rincian A–D menurut nomor yang tampil pada peserta dan dapat memeriksa kode soal sumber. Nilai, bobot situasional, butir balik, dan analisis menggunakan kode sumber, bukan posisi tampilan.

Membuat ulang undangan yang belum digunakan membatalkan tautan lama dan membuat urutan baru. Saat memperbarui aplikasi lama, undangan yang belum dimulai mendapat urutan acak; ujian yang sedang berjalan dan hasil yang sudah selesai mempertahankan urutan sumber sebelumnya. Migrasi otomatis menambahkan kolom `question_order` tanpa menghapus akun, jawaban, sesi, atau hasil. **Pertahankan folder `.data`** ketika memperbarui aplikasi di laptop.

Identitas penyelenggara tampil di halaman masuk, dashboard, undangan, formulir persetujuan peserta, dan halaman ujian. Aset `public/serviam-logo.svg` adalah gambar vektor berdasarkan logo yang dilampirkan dan juga dipakai sebagai favicon. Nama file workspace/solution tetap tersedia seperti pada paket sebelumnya.

## Aturan penilaian

| Bagian | Butir | Waktu | Maksimum | Minimum |
| --- | ---: | ---: | ---: | ---: |
| A — Logika | 10 | 15 menit | 10 | 7 |
| B — Numerik | 8 | 15 menit | 8 | 5; keuangan/pengadaan 6 |
| C — Verbal | 10 | 10 menit | 10 | 7; BD/penyusun dokumen 8 |
| D — Situasional | 6 | 15 menit | 18 | 13 |
| E — Kepribadian kerja | 14 | 10 menit | 15 per dimensi | 9 per dimensi sebagai bahan diskusi |
| F — Wawancara STAR | 6 | panduan 30 menit | 5 per pertanyaan | rata-rata 3 |

- A–C mendapat satu poin per jawaban benar. Jawaban angka menerima format rupiah, pemisah ribuan, desimal Indonesia, serta satuan dan `juta` yang eksplisit. Jawaban kosong mendapat nol.
- D memakai seluruh bobot 0–3 dari dokumen. Total A–D maksimum 46. Persentase hanya deskripsi dari `total / 46`, bukan bobot baru atau keputusan final.
- E2, E4, E6, E8, E11 dibalik dengan rumus `6 − jawaban`. Dimensi: ketelitian (E1–3), integritas (E4–6), kerja sama (E7–9), stabilitas emosi (E10–12). Skor 12–15 kuat, 9–11 cukup, ≤8 perlu digali. Dimensi yang belum lengkap tidak diberi skor atau label rendah.
- E13 dan E14 bukan skor kepribadian. Jika keduanya bernilai 4–5, interpretasi E diabaikan. Bagian E yang belum lengkap juga tidak ditafsirkan.
- D3 pilihan A/D atau E4/E6 jawaban 4–5 memunculkan klarifikasi integritas. D5 pilihan C menjadi bahan diskusi konflik. Tanda ini meminta bukti dan klarifikasi, bukan menyimpulkan karakter peserta.
- Rekomendasi mempertimbangkan batas setiap bagian A–D, indikator integritas, dan kelengkapan serta rata-rata wawancara. Tidak ada keputusan otomatis menerima atau menolak. Keputusan penguji disimpan terpisah.

Kuesioner E belum divalidasi secara statistik. Aplikasi ini alat saring internal, bukan alat tes psikologi baku atau diagnosis. Gunakan sebagai bahan diskusi bersama bukti perilaku dari wawancara.

## Penyimpanan dan pemasangan

Data disimpan di `.data/talenta.sqlite` (WAL), bukan di penyimpanan browser. `.data/` diabaikan Git. Cookie sesi `HttpOnly`, `SameSite=Strict`; kata sandi di-hash dengan scrypt. Kunci soal dan PDF hanya tersedia melalui endpoint penguji yang memerlukan autentikasi. Mutasi memerlukan header aplikasi dan memeriksa origin. Login dan penyiapan memiliki batas percobaan. Ekspor CSV melindungi sel dari formula spreadsheet.

Konfigurasi dibaca otomatis dari `.env` di folder proyek. Environment proses memiliki prioritas. Salin `.env.example` untuk lokal atau `.env.production.example` untuk server produksi:

| Variabel | Default | Fungsi |
| --- | --- | --- |
| `PORT` | `3000` | Port server |
| `HOST` | `0.0.0.0` | Alamat bind |
| `DATA_DIR` | `.data` dalam checkout | Direktori database persisten |
| `APP_ORIGIN` | origin permintaan lokal | Origin aplikasi untuk validasi permintaan; isi URL HTTPS sebenarnya saat dipasang publik |
| `COOKIE_SECURE` | aktif jika `APP_ORIGIN` HTTPS | `true` mewajibkan pengiriman cookie melalui HTTPS |
| `NODE_ENV` | development | `production` mewajibkan origin HTTPS dan memblokir domain contoh |
| `BOOTSTRAP_ACCOUNTS` | true pada lokal | Membuat dua akun acak hanya jika database kosong; false pada produksi |
| `SUPERADMIN_EMAIL` / `ADMIN_EMAIL` | akun lokal di atas | Identitas awal sebelum database diinisialisasi |
| `TRUST_PROXY` | false | Aktifkan hanya di belakang proxy tepercaya; container aplikasi tidak diekspos langsung |

Untuk pemasangan publik, jalankan di belakang reverse proxy HTTPS dengan `APP_ORIGIN` yang benar dan cookie Secure. Tautan undangan mengikuti origin yang sedang dipakai penguji, sehingga gunakan alamat publik saat membuat undangan. Gunakan satu proses server dan volume database persisten, batasi akses server pada operator, serta buat backup SQLite yang konsisten termasuk transaksi WAL. Jangan hanya menyalin file `.sqlite` saat database sedang ditulis.

Data akun, peserta, dan sesi tersimpan saat proses restart. Proses server harus dijalankan ulang setelah pemulihan lingkungan cloud. Snapshot cloud berbeda dari backup data produksi; jangan mempublikasikan snapshot yang memuat data peserta nyata atau sesi penguji aktif. Aplikasi belum dipasang ke layanan hosting publik oleh tugas ini.

## WebStorm dan operasi produksi

Buka folder proyek di WebStorm dan jalankan profil **Serviam HRD - Web** yang tersedia pada `.run/Serviam HRD.run.xml`. Windows menyediakan `Buka-WebStorm.bat`; panduan lengkap ada di `BUKA-DI-WEBSTORM.md`. Instalasi lokal dapat dijalankan tanpa paket tambahan, SMTP, atau database terpisah.

Konfigurasi Docker Compose dan proxy Caddy tersedia untuk server HTTPS dengan volume database persisten, aplikasi non-root, filesystem container read-only, restart otomatis, dan image dasar yang dipatok digest. Tahapan deployment, backup dan pemulihan ada di `PRODUKSI.md`. `npm run backup` membuat snapshot SQLite konsisten yang juga dapat dilakukan saat server aktif. `npm run check:production -- --online` memeriksa konfigurasi, integritas database, superadmin yang sudah mengganti kata sandi, dan endpoint HTTPS yang benar-benar sudah dipasang.

`/api/health` memeriksa server/database. `/api/ready` hanya siap setelah superadmin aktif menyelesaikan kata sandi awal. Pengelolaan akun dan audit diperiksa server berdasarkan peran, termasuk saat URL API dipanggil langsung.

## Validasi

`npm test` menjalankan 30 pengujian dengan database sementara yang terisolasi: kesesuaian kunci/bobot/ambang, skoring E, validitas, wawancara, autentikasi, CSRF, rotasi dan expiry, dua permintaan mulai bersamaan, deadline server, penguncian jawaban, penghapusan, ekspor CSV, ketahanan data dan sesi setelah restart, serta pengarahan HTML lokal, fallback pemuatan, CSP pembuka, dan perintah browser lintas platform. Pengujian tambahan memeriksa keutuhan seluruh butir setelah pengacakan, urutan per tautan, urutan setelah resume/restart/rotasi, skoring setelah pengacakan, migrasi database lama, serta pemuatan identitas dan logo.

Alur antarmuka juga telah diuji di Chromium: akun pertama, undangan, 48 jawaban, resume, penolakan browser kedua, skor 46/46, penyimpanan wawancara dan keputusan, pencarian, panduan, serta tata letak desktop/ponsel. Data uji tidak dimasukkan ke database aplikasi utama.

## Struktur

```text
server.js            HTTP server, autentikasi, dan API
lib/bank.js          Soal, kunci, analisis, dan panduan sumber (server saja)
lib/scoring.js       Skoring dan ringkasan peninjauan
lib/store.js         SQLite, sesi, lifecycle, dan audit
public/              Antarmuka penguji/peserta dan gaya responsif
scripts/setup-admin.js  Penyiapan akun dengan input kata sandi tersembunyi
tests/               Pengujian skoring dan API
docs/bank-soal.pdf    Dokumen lampiran asli
```

Pemeriksaan versi 1.2 mencakup browser desktop/mobile, alur Add invitation dan clipboard Copy link, kata sandi awal, peran admin/superadmin, container produksi non-root/read-only, backup dan kelanjutan sesi setelah container restart. Konfigurasi Caddy divalidasi. WebStorm tidak tersedia pada mesin pemeriksaan, sehingga membuka IDE di laptop dan penerbitan domain HTTPS nyata belum diuji.
