# Operasi produksi HRD Division PT Serviam Group Shipyard

Untuk hosting **Vercel + Supabase**, gunakan `SUPABASE-VERCEL.md`. Langkah di bawah membahas alternatif server Docker dengan SQLite persisten.

Paket menyertakan konfigurasi produksi, bukan server internet yang sudah diterbitkan. Hosting/server, domain sebenarnya, DNS dan akses 80/443 perlu disiapkan operator. Undangan adalah **link manual**; SMTP tidak digunakan.

## Deployment Docker Compose

Memerlukan Docker Engine dan Docker Compose pada server, domain yang menunjuk server tersebut, serta port 80/443 yang dapat diakses untuk HTTPS Caddy. Port aplikasi 3000 tidak dipublikasikan. Jika memperbarui deployment, jangan menghapus volume `exam_data`.

1. Salin `.env.production.example` menjadi `.env`. Isi `APP_DOMAIN` dengan domain sebenarnya; untuk konfigurasi Node non-Docker sesuaikan `APP_ORIGIN` juga. Isi identitas admin/superadmin yang dikehendaki sebelum inisialisasi pertama. Domain `.example` ditolak aplikasi.
2. Bangun image: `docker compose build`.
3. Inisialisasi akun sekali: `docker compose run --rm app npm run setup:accounts`. Data dan file akun awal disimpan dalam volume persisten. Jika akun sudah ada, perintah tidak menimpanya.
4. Jalankan: `docker compose up -d`.
5. Untuk membaca kredensial awal, akses secara pribadi pada server: `docker compose exec app cat /app/.data/initial-accounts.txt`. Masuk melalui domain HTTPS sebagai superadmin dan admin, lalu ganti kedua kata sandi awal. Setelah itu hapus file akun awal dari volume melalui alat operator.
6. Verifikasi layanan yang sudah dipasang: `docker compose exec app npm run check:production -- --online`. HTTPS tervalidasi, HSTS dan readiness wajib lulus. Jangan menyebut layanan siap apabila pemeriksaan ini belum berhasil.
7. Buka dashboard dari alamat HTTPS publik sebelum membuat link peserta. Link yang dibuat backend mengikuti APP_ORIGIN yang dikonfigurasi.

Aplikasi menggunakan satu proses Node/SQLite dan volume persisten. Image Node dan Caddy dipatok ke digest yang telah diperiksa; lakukan pembaruan image secara terencana disertai pengujian. Aplikasi berjalan sebagai pengguna node non-root, filesystem read-only, dan volume data dapat ditulis. TRUST_PROXY hanya dinyalakan karena aplikasi berada di jaringan internal Compose di belakang Caddy; jangan publikasikan langsung port Node dengan TRUST_PROXY aktif. Proxy tidak menyimpan access log URL undangan, sehingga token pribadi tidak dicatat sebagai URL.

## Backup dan pemulihan

Jalankan `docker compose exec app npm run backup`, atau `npm run backup` pada server Node. Backup dibuat pada `.data/backups` menggunakan API backup SQLite, diperiksa integritasnya, dan berupa satu file `.sqlite` konsisten termasuk transaksi WAL. Jadwalkan rutin melalui scheduler server dan salin backup ke penyimpanan operator yang terlindungi. SQLite backup berisi akun dan jawaban; hindari memasukkannya ke Git/ZIP publik.

Uji pemulihan pada folder/volume **baru**, dengan aplikasi berhenti: simpan folder/volume data lama, salin file backup menjadi `talenta.sqlite` pada data directory baru, pastikan pemilik/izin sesuai pengguna server, lalu jalankan dengan DATA_DIR/volume baru. Jangan menempelkan backup ke database yang masih berjalan atau ke pasangan WAL lama. Setelah pemulihan periksa `/api/ready`, login, peserta, jawaban dan hasil. Akun/sesi dikembalikan sesuai waktu backup.

## Validasi paket dan batas pemeriksaan

30 pengujian otomatis memeriksa ujian, skoring, akses, migrasi, peran, ganti sandi, dan backup. Alur desktop/mobile serta clipboard link diuji melalui Chromium. Container production dengan aplikasi non-root/read-only diuji untuk akun, cookie Secure/HSTS, link manual, penyimpanan jawaban, backup dan sesi setelah restart. Konfigurasi Compose/Caddy valid. Domain HTTPS publik, penerbitan sertifikat untuk domain milik operator, WebStorm desktop dan beban peserta nyata harus diverifikasi pada lingkungan pemasangan yang sebenarnya; paket ini belum diterbitkan ke hosting publik.
