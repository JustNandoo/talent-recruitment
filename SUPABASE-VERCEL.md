# Supabase dan Vercel — Serviam HRD 1.3

Paket ini sudah menyiapkan koneksi PostgreSQL, tabel, akun awal, routing Vercel, cookie HTTPS, dan penyimpanan bersama antar instance. Anda perlu membuat proyek Supabase dalam akun sendiri dan memasukkan tiga nilai pribadi di Vercel. Tidak perlu membuat tabel atau menjalankan SQL secara manual. Penyiapan pertama berjalan otomatis saat web dibuka.

## 1. Buat proyek Supabase

1. Buka https://supabase.com/dashboard dan masuk.
2. Klik **New project**, pilih organisasi, beri nama `serviam-hrd`.
3. Tentukan password database yang kuat dan simpan di pengelola kata sandi. Ini berbeda dari password login aplikasi.
4. Pilih region **Singapore / Southeast Asia** jika tersedia. Buat proyek dan tunggu sampai database siap.
5. Klik **Connect**, pilih **Transaction pooler**, lalu salin connection string PostgreSQL yang menggunakan port **6543**. Pooler mendukung koneksi IPv4 dan banyak instance Vercel. Jangan memilih URL REST `https://...supabase.co` atau API key.
6. Ganti placeholder `[YOUR-PASSWORD]` dalam connection string dengan password database langkah 3. Jika password mengandung karakter khusus, lakukan URL encoding pada bagian password saja. Contoh karakter: `@` → `%40`, `#` → `%23`, `%` → `%25`, `/` → `%2F`, `:` → `%3A`. Jangan encode seluruh URL.

Format umumnya (ikuti nilai **Connect** milik proyek Anda):

```text
postgresql://postgres.PROJECT_REF:PASSWORD_TERENCODE@HOST_POOLER:6543/postgres
```

Connection string mengandung rahasia. Tempelkan langsung ke pengaturan Vercel; jangan kirim di chat, commit ke Git, atau masukkan ke file TXT yang diunggah.

## 2. Perbarui GitHub dengan paket terbaru

Ekstrak ZIP versi 1.3, lalu salin isinya ke folder repository `talent-recruitment` yang sudah Anda push. Pastikan `package.json`, `server.js`, `vercel.json`, dan folder `api`, `db`, `lib`, `public` berada dalam root yang sama. Pertahankan `.git`, `.env` pribadi, dan `.data` lokal Anda. Semua kode baru ada di paket; jangan hanya menyalin `vercel.json`.

Di terminal WebStorm/VS Code, dari folder repository:

```bash
git status
git add .
git commit -m "Configure Supabase and fix Vercel deployment"
git push origin main
```

`.gitignore` melindungi `.env` dan `.data`. Jika sebelumnya sudah terlanjur masuk Git, hapus dari pelacakan dengan `git rm --cached .env` dan `git rm -r --cached .data`, lalu commit. Jika rahasia pernah dipublikasikan, ganti melalui layanan terkait.

## 3. Isi tiga Environment Variables Vercel

Buka proyek **talent-recruitment → Settings → Environment Variables**. Untuk **Production**, tambahkan:

| Name | Value yang Anda isi sendiri |
| --- | --- |
| `DATABASE_URL` | Connection string Transaction pooler Supabase langkah 1 |
| `SUPERADMIN_PASSWORD` | Password awal superadmin yang Anda tentukan, 12–128 karakter |
| `ADMIN_PASSWORD` | Password awal admin yang berbeda, 12–128 karakter |

Password tidak memiliki nilai bawaan bersama untuk semua pengguna. Pilih password berbeda untuk kedua akun. Identitas login awal:

| Peran | Email login awal | Password awal |
| --- | --- | --- |
| Superadmin | `superadmin@serviam.local` | Nilai `SUPERADMIN_PASSWORD` Anda |
| Admin penguji | `admin@serviam.local` | Nilai `ADMIN_PASSWORD` Anda |

Email di atas adalah identitas login dan tidak mengirim email. Opsional: isi `SUPERADMIN_EMAIL` dan `ADMIN_EMAIL` dengan email pilihan Anda **sebelum** database pertama kali diinisialisasi. Sesudah akun tersimpan, perubahan email/password di environment atau TXT tidak mengubah akun. Password berikutnya diganti melalui aplikasi; superadmin juga dapat mereset password penguji.

Gunakan database Supabase terpisah untuk Preview bila Preview diaktifkan. Jangan hubungkan Preview yang tidak dipercaya ke database peserta produksi. Isi ketiga variabel pada environment yang memang akan Anda gunakan.

## 4. Redeploy dan buka web

1. Pastikan **Settings → Git** menghubungkan `JustNandoo/talent-recruitment`, branch produksi `main`.
2. **Root Directory** harus folder yang berisi `package.json`. **Node.js Version: 24.x**. Framework gunakan **Other** jika diminta. Konfigurasi build dan routing mengikuti `vercel.json`; hapus override lama Output Directory/Build Command yang tidak sesuai. Tidak perlu mengisi Output Directory.
3. Pastikan **Automatically expose System Environment Variables** aktif (pengaturan environment Vercel). Aplikasi mengambil domain HTTPS dari `VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL`. Jika sistem variable dimatikan atau Anda memakai custom domain, isi tambahan `APP_ORIGIN` dengan URL HTTPS utama, tanpa path akhir, misalnya `https://talent-recruitment-five.vercel.app`.
4. Buka **Deployments → deployment terbaru → Redeploy**, setelah variabel disimpan. Perubahan environment memerlukan deployment baru. Pada pembaruan pertama, matikan penggunaan build cache lama jika ada opsi tersebut.
5. Buka domain produksi, misalnya https://talent-recruitment-five.vercel.app. Request pertama membuat schema `serviam`, tabel, dan dua akun; tunggu beberapa detik. Akun dan tabel hanya dibuat bila belum ada.
6. Buka `/penguji`, masuk sebagai superadmin, kemudian ganti password awal. Masuk sebagai admin penguji dan ganti password awalnya juga.
7. Dashboard penguji: **Add invitation → isi peserta → Copy link**, lalu kirim link melalui kanal pilihan Anda. Email tidak dikirim otomatis. Peserta memperoleh satu kesempatan ujian, dengan urutan soal tersimpan per link.

`/api/health` harus mengembalikan `ok: true` dan `database: true`. `/api/ready` mengembalikan 503 sebelum superadmin mengganti password awal; ini pemeriksaan kesiapan yang disengaja. Sesudah mengganti password, endpoint harus mengembalikan `ready: true`. Panel superadmin **Sistem & aktivitas** menampilkan **PostgreSQL (Supabase)**.

## Yang dibuat otomatis

Backend menjalankan `db/supabase.sql` sekali melalui versioning dan lock database. Tabel `serviam.users`, `exams`, `sessions`, `audit`, dan `rate_limits` menampung akun, undangan/jawaban/hasil, sesi, aktivitas, dan batas percobaan. Schema ini privat, RLS aktif, akses role `anon` dan `authenticated` ditolak. Kunci tes dan akses database berada di server; browser tidak membutuhkan Supabase API key. Jika memeriksa tabel melalui dashboard Supabase, pilih schema **serviam**. Jangan menambahkannya ke exposed schemas API publik.

Setiap request mutasi dikomit sebelum respons dikirim. Penguncian baris mencegah start ganda dan jawaban paralel saling menimpa. Data, sesi, serta batas percobaan tersedia bagi seluruh instance Vercel. Vercel memakai handler `api/handler.js`, tanpa membuka port server atau menulis SQLite ke filesystem function.

Mengaktifkan Supabase memakai database cloud baru. Data SQLite lokal tetap ada, tetapi tidak dipindahkan ke Supabase oleh langkah ini. Akun Supabase dibuat dari environment awalnya sendiri.

## Jika masih gagal

| Gejala | Pemeriksaan |
| --- | --- |
| Build gagal: `File deployment hilang: public/index.html` | Gunakan `/index.html` (diawali slash) di `.vercelignore`, bukan `index.html`. Aturan tanpa slash juga membuang halaman aplikasi di folder `public`. Push perbaikan lalu deploy ulang. |
| 503 meminta `DATABASE_URL` | Isi variable Production, kemudian Redeploy. Pastikan format PostgreSQL pooler, bukan URL REST. |
| 503 meminta password akun | Isi kedua password yang berbeda dan minimal 12 karakter, lalu Redeploy. |
| 503 koneksi database | Buka Runtime Logs; periksa host/user/password/port connection string dan status proyek Supabase. Database yang paused harus di-resume. |
| `28P01` | Username/password database salah atau karakter khusus belum terencode. |
| `ENOTFOUND`, `ETIMEDOUT`, `ENETUNREACH` | Pilih Transaction pooler IPv4 port 6543 dari Connect, bukan direct connection yang memerlukan IPv6. Periksa network restrictions Supabase jika Anda mengaktifkannya. |
| Error sertifikat TLS | Pakai hostname resmi dari Connect. Jika proyek meminta CA tambahan, unduh root certificate resmi dari pengaturan database Supabase dan masukkan isi PEM ke `DATABASE_CA_CERT` Vercel. TLS tetap diverifikasi; jangan menonaktifkannya. |
| Origin tidak diizinkan | Gunakan domain utama atau isi `APP_ORIGIN` dengan domain HTTPS tempat penguji membuka aplikasi, lalu Redeploy. |
| Tetap `FUNCTION_INVOCATION_FAILED` | Pastikan kode versi 1.3 lengkap sudah masuk GitHub, root benar, Node 24.x, dan deployment terbaru digunakan. Periksa Runtime Logs untuk error aktual. |

Status Vercel **Ready** hanya menunjukkan build selesai. Koneksi database perlu diperiksa melalui `/api/health` dan login setelah deployment.

## Menjalankan dengan Supabase dari laptop (opsional)

Salin `.env.supabase.example` menjadi `.env` pribadi, isi ketiga nilai, kemudian:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run setup:supabase
npm start
```

Buka alamat HTTP yang dicetak terminal. `setup:supabase` boleh diulang; akun/database yang sudah ada tidak ditimpa. Untuk kembali ke SQLite lokal, kosongkan `DATABASE_URL` serta alias `POSTGRES_URL`/`SUPABASE_DB_URL` pada konfigurasi lokal Anda.

## Backup dan validasi produksi

Backup mengikuti fasilitas paket Supabase yang Anda pilih. Pastikan fasilitas backup/retensi benar-benar tersedia pada paket tersebut; paket gratis tidak menjamin fasilitas yang sama dengan paket berbayar. Simpan backup di lokasi pribadi dan uji pemulihan ke proyek terpisah. Operator PostgreSQL dapat menggunakan `pg_dump` dengan connection yang sesuai dari dashboard; jangan menyimpan file dump yang mengandung akun/jawaban dalam Git. `npm run backup` khusus SQLite dan menolak berjalan ketika database aktif Supabase.

Setelah data Supabase terhubung dan superadmin mengganti password, operator dapat menjalankan `npm run check:production -- --online` dari konfigurasi pribadi dengan `NODE_ENV=production`, `APP_ORIGIN` HTTPS, dan `DATABASE_URL`. Pemeriksaan memverifikasi database, kesiapan akun, HTTPS, dan HSTS.

Pengujian paket mencakup PostgreSQL 17 lokal dengan dua instance server serta handler Vercel: migrasi, akun, start link bersamaan, penyimpanan jawaban paralel, 48 soal/skor 46, analisis, wawancara, ekspor, cold start, rate limit bersama, timer, peran, CSRF, dan schema privat. Ini tidak menggantikan verifikasi koneksi proyek Supabase dan deployment milik Anda; keduanya memerlukan konfigurasi akun Anda di atas.

Build produksi berhasil diperiksa menggunakan Vercel CLI 63.1.2 dengan runtime Node.js 24.x. Function hasil build juga diperiksa lewat HTTPS dengan PostgreSQL TLS terverifikasi: antarmuka desktop/mobile, ganti password awal, 48 jawaban, skor 46/46, resume, akses sekali pakai, serta sesi/hasil setelah cold start. Tidak ada error JavaScript atau penulisan database lokal pada function.
