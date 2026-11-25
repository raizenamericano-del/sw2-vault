# STATUSVAULT

Pengelola status WhatsApp pribadi, self-hosted. Satu server Node.js menyajikan React, API, Socket.IO, SQLite/Prisma, dan Baileys. Login admin tunggal dikonfigurasi lewat environment variable; tidak ada registrasi atau multi-user. Tidak ada PostgreSQL, Redis, ataupun database eksternal.

## Sebelum menggunakan

- Hubungkan **hanya akun WhatsApp Anda sendiri** dan hormati privasi kontak. Baileys adalah klien tidak resmi, bukan API resmi WhatsApp; perubahan protokol, pembatasan WhatsApp atau pemblokiran akun dapat menyebabkan kegagalan. Tidak ada jaminan pairing akan selalu berhasil.
- Status bukan endpoint arsip yang bisa ditarik penuh sesuka hati. Aplikasi menangani `messages.upsert` dengan `remoteJid === status@broadcast` dan menyimpan foto/video yang benar-benar dikirim ke perangkat tertaut. Tidak membypass privasi dan **tidak menjanjikan status lama atau semua status**. Tombol Refresh hanya memuat ulang koleksi lokal, bukan meminta WhatsApp mengirim ulang semua status. Perangkat tertaut mungkin tidak menerima status tertentu. Status teks tidak didukung.
- Media diunduh saat event diterima, sekali per ID status; file asli disimpan secara lokal bila masih bisa diunduh. Hanya JPEG, PNG, WebP dan MP4 yang diterima setelah pemeriksaan signature; ukuran maksimal 100 MiB per media. Media yang kedaluwarsa, rusak, tidak tersedia, atau berformat lain dilewati. Tidak ada konversi FFmpeg; video ditampilkan dengan decoder browser, sehingga codec tertentu mungkin tidak dapat diputar. Thumbnail video memakai preview video browser, bukan gambar thumbnail FFmpeg.
- Koleksi dan unduhan **tidak otomatis dihapus setelah 24 jam**. Gunakan volume dengan ruang cukup dan backup yang aman. Recent artinya timestamp dalam 24 jam terakhir. Saved adalah bookmark di aplikasi, bukan fitur WhatsApp. Load more menggunakan pagination, bukan infinite scroll otomatis. Riwayat menampilkan 200 entri terbaru; total download menghitung entri riwayat saat ini. Clear history hanya menghapus riwayat, bukan berkas yang sudah tersimpan di server.

## Deploy Railway (satu service, satu volume)

1. Ekstrak ZIP dan unggah folder project ke repositori GitHub pribadi. Di Railway buat project dari repo tersebut, pilih root project ini. Railway mendeteksi `Dockerfile` dan `railway.json`. Jangan tambahkan database service.
2. Di service → **Volumes**, tambahkan satu volume dan mount di `/data`. Volume harus terpasang sebelum service dipakai. Jangan memakai lebih dari satu replica/service yang berbagi sesi ini. Volume dikonfigurasi melalui dashboard Railway, bukan otomatis dibuat oleh `railway.json`.
3. Pada **Variables**, isi:

   ```text
   NODE_ENV=production
   PORT=3000
   DATA_DIR=/data
   ADMIN_USERNAME=nama-admin-pilihan
   ADMIN_PASSWORD=password-panjang-unik-minimal-12-karakter
   SESSION_SECRET=rahasia-acak-unik-minimal-32-karakter
   PUBLIC_ORIGIN=https://domain-anda.up.railway.app
   ```

   `PUBLIC_ORIGIN` opsional jika host/protokol forwarding proxy Railway sesuai; sebaiknya tetapkan ke origin HTTPS yang benar **tanpa slash di akhir**. Beberapa origin bisa dipisahkan dengan koma. Buat secret dengan `openssl rand -hex 32`. Jangan pakai nilai contoh. Hindari tanda kutip tambahan jika mengisi field Railway. `PORT` harus sesuai port yang diarahkan Railway; Railway dapat menyediakannya sendiri.
4. Generate domain HTTPS di Settings → Networking (atau gunakan akses privat/VPN). Set `PUBLIC_ORIGIN` dengan URL tersebut dan deploy ulang. Health check `/health` dikonfigurasi dalam `railway.json`. Saat startup, script membuat direktori, menjalankan `prisma migrate deploy`, lalu memulai server. Database `/data/statusvault.db` dibuat otomatis. Migrations harus berhasil agar server berjalan.
5. Buka URL, login dengan nilai `ADMIN_USERNAME` dan `ADMIN_PASSWORD`, lalu buka **WhatsApp Connection**. Masukkan nomor dengan kode negara, digit saja (contoh `6281234567890`), klik **Generate pairing code**. Di WhatsApp pada ponsel pilih **Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon**, lalu masukkan kode. Nama menu WhatsApp dapat berubah. Tunggu indikator Connected. Gunakan **Delete session** untuk menghapus kredensial dan memasangkan ulang.

Perubahan username/password/secret memerlukan redeploy/restart dan akan membatalkan seluruh cookie sesi sebelumnya. Setelah restart, sesi WhatsApp yang sudah terdaftar dicoba lagi secara otomatis; tombol Disconnect menghentikan koneksi saat proses berjalan tetapi restart akan mencoba lagi. Delete session juga mengirim logout ke WhatsApp bila koneksi aktif dan menghapus direktori auth lokal.

## Instalasi lokal

Persyaratan: Node.js 22, npm, ruang disk dan akses internet. Linux direkomendasikan. Dari root project:

```bash
npm ci
cp .env.example .env
# Edit ADMIN_USERNAME, ADMIN_PASSWORD dan SESSION_SECRET di .env terlebih dahulu.
npm run build
npm start
```

Buka `http://localhost:3000`. `.env.example` memakai `NODE_ENV=development` dan `DATA_DIR=./data`; aplikasi tidak akan start jika username kosong, password kurang dari 12 karakter, atau secret kurang dari 32 karakter. Jangan pakai `NODE_ENV=production` di HTTP lokal karena cookie produksi mewajibkan HTTPS. Untuk menjalankan dev server: pastikan migrasi sudah diterapkan dengan `npm start` sekali, hentikan dengan Ctrl+C, kemudian `npm run dev` dan buka port Vite. Vite melakukan proxy API dan Socket.IO ke port 3000. Untuk development, jangan ubah port backend tanpa menyesuaikan proxy `vite.config.ts`.

## Penyimpanan

Semua data persisten disimpan di `DATA_DIR` (produksi: `/data`):

- `statusvault.db`: database SQLite, tanpa BLOB media.
- `auth/`: kredensial multi-file Baileys; jangan pernah dibagikan, dipublikasikan atau dibackup secara tidak terenkripsi.
- `media/`: media asli status yang berhasil diterima.
- `thumbnails/`: thumbnail foto dari Sharp.
- `downloads/`: salinan file yang diunduh melalui aplikasi.
- `temp/`: file saat transfer; file temporer sisa kegagalan mendadak dapat dibersihkan saat server berhenti.

Tidak ada direktori `/data` yang disajikan statis. Akses media dan unduhan harus melalui API terautentikasi. Buat backup semua isi volume ketika aplikasi berhenti untuk menghindari snapshot SQLite yang tidak konsisten. Backup termasuk kredensial WhatsApp yang sensitif. Untuk penghapusan media dan pembersihan file download secara permanen, hentikan aplikasi lalu kelola volume secara manual; menghapus file media tanpa menghapus baris DB akan membuat preview gagal. Menghapus history tidak menghapus file fisik.

## Keamanan & batasan operasional

- Admin: cookie HttpOnly, SameSite Strict, Secure di production, sesi ditandatangani, berlaku 12 jam. Logout menghapus cookie browser; token yang sudah dicuri tetap berlaku sampai kedaluwarsa atau kredensial/secret dirotasi. Tidak ada MFA, dan ini bukan pengganti VPN/private networking.
- Helmet, CSP, validasi Zod, rate limit login dan API, pemeriksaan Origin untuk mutasi, autentikasi Socket.IO, pembatasan ukuran media dan validasi tipe, serta path berbasis nama yang aman. Batasi akses deployment menggunakan VPN/jaringan privat bila memungkinkan. Railway public domain berarti endpoint login tetap terlihat di internet. Pastikan HTTPS aktif dan gunakan kredensial kuat.
- Rate limit disimpan di memori satu proses dan akan reset saat restart. Aplikasi memang didesain untuk **satu instance**, bukan load-balanced.
- Docker berjalan sebagai root untuk kompatibilitas mount volume Railway; lindungi service/volume dan jangan berikan akses shell kepada pihak lain.
- Saat pembuatan proyek ini `npm audit --omit=dev` melaporkan empat temuan high terkait dependensi transitif CLI Prisma 6 (`@prisma/config`, `effect`, `deepmerge-ts`). CLI dipakai untuk migrasi saat startup, bukan untuk memproses request pengguna; tetap tinjau advisory dan update versi setelah pengujian kompatibilitas. Jangan mengeklaim zero vulnerabilities.
- Monitoring koneksi berupa event dan status koneksi Baileys, bukan jaminan WhatsApp tersedia. Reconnect otomatis memakai retry tiga detik untuk penutupan non-logout. Setelah logout paksa, hapus sesi dan pair kembali. Pesan error unduhan media dicatat tanpa mencetak kredensial.

## Pengujian

`npm run build` melakukan Prisma generate, TypeScript check, build Vite dan bundle backend. Smoke test integrasi menggunakan DB sekali pakai; **jangan jalankan terhadap volume pribadi**, karena test membuat data dan menghapus riwayat download. Contoh di dua terminal:

```bash
# terminal 1, setelah npm ci dan npm run build
ADMIN_USERNAME=admin ADMIN_PASSWORD=test-password-123456 SESSION_SECRET=this-is-a-local-test-secret-1234567890 DATA_DIR=/tmp/statusvault-test NODE_ENV=development npm start
# terminal 2
DATA_DIR=/tmp/statusvault-test npm test
```

Pastikan `/tmp/statusvault-test` baru/kosong sebelum test. Test memeriksa migrasi/startup secara tidak langsung, health, proteksi login dan origin, Socket.IO, validasi input, query gallery, bookmark, media, unduhan, settings, dan history. Test memakai media sintetis hanya pada database test. Test tidak menguji koneksi WhatsApp nyata dan tidak menguji deployment Docker/Railway; hal tersebut membutuhkan akun, volume dan lingkungan Railway Anda.
