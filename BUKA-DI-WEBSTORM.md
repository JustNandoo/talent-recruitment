# Membuka proyek di WebStorm

1. Instal WebStorm dan **Node.js 24.x**. Ekstrak seluruh ZIP, misalnya ke `C:\alif\talenta-recruitment`. Saat memperbarui versi lama, pertahankan folder `.data`.
2. Klik `Buka-WebStorm.bat` pada Windows. Jika lokasi WebStorm tidak ditemukan (misalnya instalasi Toolbox khusus), buka WebStorm, pilih **File → Open**, dan pilih folder yang berisi `package.json`.
3. Bila diperlukan, pilih **Settings → Languages & Frameworks → Node.js** dan pilih interpreter Node.js 24.x yang terpasang. Untuk memakai Supabase, jalankan `npm ci --ignore-scripts` di terminal proyek terlebih dahulu.
4. Pilih profil **Serviam HRD - Web**, lalu tekan **Run** atau **Shift+F10**. Profil tersimpan di `.run/Serviam HRD.run.xml`. Alternatif: terminal WebStorm → `npm start`.
5. Browser lokal dibuka setelah server siap. Gunakan alamat yang tercetak di konsol, biasanya `http://localhost:3000/`. Biarkan proses Run tetap berjalan; Stop menghentikan aplikasi.
6. Pada instalasi baru, buka `.data/initial-accounts.txt` di editor **lokal**. Pilih akun `superadmin@serviam.local` atau `admin@serviam.local`. Masukkan kata sandi awal dari file, kemudian ganti melalui halaman keamanan yang muncul. Jangan mengunggah file ini ke GitHub.
7. Dari dashboard penguji, tekan **Add invitation**, isi nama dan email peserta, lalu pilih penempatan jabatan dari daftar atau **Tulis jabatan sendiri** beserta acuan penilaiannya. Tekan **Buat undangan**, lalu **Copy link**. Bagikan link sendiri melalui WhatsApp atau saluran lain.

Akun superadmin memiliki menu **Akun penguji** serta **Sistem & aktivitas**. Akun admin berfokus pada peserta dan hasil. Instalasi yang sudah mempunyai akun mempertahankannya; gunakan superadmin untuk menambah akun admin bila belum tersedia.

`localhost` hanya membuka web pada laptop yang menjalankan server. Untuk peserta di jaringan yang sama, buka dashboard melalui IP laptop yang benar-benar dapat dijangkau peserta, lalu buat undangan dari alamat itu; periksa firewall jaringan. Untuk peserta di internet, gunakan server dan domain HTTPS seperti panduan `PRODUKSI.md`. Profil WebStorm adalah mode lokal dan mengutamakan pengaturan development; deployment produksi dilakukan terpisah.

Jika port 3000 dipakai, hentikan proses aplikasi yang Anda jalankan sebelumnya. Ubah PORT pada run configuration bila diperlukan. Jika Node tidak ditemukan, pilih interpreter yang benar dan buka kembali IDE. Sesi WebStorm desktop tidak dijalankan pada mesin cloud; konfigurasi XML dan startup aplikasinya telah diperiksa.

Untuk deployment Vercel dan penyiapan Supabase otomatis, ikuti `SUPABASE-VERCEL.md`. Jangan unggah `.env` pribadi atau `.data`.
