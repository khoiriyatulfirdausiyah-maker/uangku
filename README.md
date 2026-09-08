# UangKu v8.7 — Voice Recovery

UangKu adalah aplikasi keuangan Android mobile-first berbasis WebView lokal.

Versi 8.5 memperbaiki alur Foto Struk: tombol kamera membuka kamera Android secara langsung dan OCR membaca foto asli beresolusi tinggi, lalu menampilkan hasil untuk dicek sebelum dijadikan transaksi.

## Fitur utama

- Pemasukan, pengeluaran, transfer antar akun
- Dashboard / Kekayaan Bersih / Saldo Akun / Financial Overview
- Budget dan Target Keuangan
- Investasi, properti, aset fisik
- Multi akun: bank, e-wallet, cash, tabungan, titipan
- Utang, piutang, Piutang Penjualan
- Tagihan dengan jatuh tempo dan reminder
- **Pengeluaran Rutin** tanpa jatuh tempo tetap
- Edit & hapus transaksi
- Asisten keuangan lokal + voice Android + Text-to-Speech
- Foto struk dengan OCR Google ML Kit
- Laporan dan insight
- Kategori kustom
- Export / import JSON dengan versioned backup schema

## Perubahan v8.7

- Memperbaiki kasus halaman voice muncul sebentar lalu langsung tertutup.
- Callback SpeechRecognizer lama tidak boleh lagi menghentikan sesi voice baru.
- Jika recognizer langsung gagal, UangKu otomatis mencoba pengenal suara Android sistem.
- Error voice tetap berada di halaman Voice dan menampilkan tombol **Coba lagi**.
- Membatalkan voice mengembalikan pengguna ke Asisten tanpa menambah bubble error.
- `versionCode = 87`, `versionName = 8.7.0`.

## Perubahan v8.6

### Foto Struk lebih akurat
- Nominal transaksi diprioritaskan dari **TOTAL BELANJA / GRAND TOTAL / TOTAL BAYAR / TOTAL PEMBAYARAN / TOTAL**.
- Tunai/Cash, kembalian, QRIS, kartu, diskon, pajak, dan nomor referensi tidak dianggap sebagai total belanja.
- Tanggal struk membaca format `08/09/2026`, `08/09/26`, `2026-09-08`, hingga `8 September 2026`.
- Nama barang pada struk diekstrak menjadi **Catatan / Nama Belanjaan** dan otomatis dimasukkan ke catatan transaksi.
- Hasil scan menampilkan sumber nominal supaya lebih mudah dicek.

### Foto Struk lebih ringan
- OCR foto asli dan pembuatan thumbnail preview berjalan paralel.
- OCR tidak lagi menunggu proses kompres preview selesai.
- Thumbnail preview diturunkan ke sekitar 900px / JPEG 68 karena hanya untuk tampilan; OCR tetap memakai URI foto asli.
- Data URI foto tidak lagi ditempel langsung ke HTML saat render halaman.
- Blur overlay scanner dihapus.

### Respons aplikasi
- Menambahkan lazy rendering (`content-visibility`) untuk kartu/section di bawah layar.
- Shadow kartu dibuat lebih ringan untuk mengurangi repaint di Android WebView.
- `versionCode = 86`, `versionName = 8.6.0`.

## Perubahan v8.5

### Voice Assistant Android
- Mikrofon sekarang memakai **Android SpeechRecognizer langsung di dalam aplikasi**.
- Menambahkan query service recognition untuk Android 11+ dan fallback `RecognizerIntent`.
- Hasil ucapan parsial ditampilkan saat bicara.
- Tombol stop menghentikan recognizer native.
- Error voice tidak lagi disimpan sebagai bubble chat berulang.
- Spam error teknis lama yang identik dibersihkan satu kali.
- Pesan error dibedakan untuk izin mikrofon, koneksi, tidak ada ucapan, recognizer sibuk, dan server.
- `versionCode = 85`, `versionName = 8.5.0`.

## Perubahan v8.4

### Kamera struk langsung
- Tombol **Ambil Foto dari Kamera** memakai `ACTION_IMAGE_CAPTURE`, jadi pada APK tidak lagi masuk ke pemilih galeri.
- Foto kamera disimpan sementara melalui Android `FileProvider`.
- Tombol **Pilih dari Galeri** tetap terpisah dan khusus membuka gambar.

### OCR struk lebih akurat
- ML Kit sekarang membaca **URI foto asli** dari kamera/galeri, bukan hanya JPEG 1280px yang sudah dikompres.
- Orientasi foto dipertahankan untuk OCR dan preview dikoreksi memakai metadata EXIF.
- Setelah foto dipilih, OCR berjalan otomatis.
- Tombol **Scan Ulang** tetap tersedia.

### Deteksi total yang lebih aman
- Parser tidak lagi sekadar mengambil angka terbesar di struk.
- Baris seperti **GRAND TOTAL, TOTAL BAYAR, TOTAL BELANJA, JUMLAH BAYAR** diprioritaskan.
- **Tunai/Cash, Kembalian/Change, Diskon, PPN/Tax, nomor invoice/member/telepon** tidak dianggap total belanja.
- Format `25.000`, `25,000`, `25.000,00`, dan `25,000.00` didukung.

### Review sebelum transaksi
Hasil scan menampilkan:
- merchant/toko,
- total belanja,
- tanggal,
- kategori.

Pengguna dapat mengoreksi hasil sebelum menekan **Gunakan Hasil Scan**, lalu UangKu mengisi form transaksi pengeluaran.

### Build
- `versionCode = 84`, `versionName = 8.4.0`.
- Menambahkan `tests/receipt-scanner.js`.

## Perubahan v8.3

- Event binding dibatasi per halaman agar klik tidak memindai semua tombol aplikasi.
- Navigasi tidak lagi menjalankan smooth scroll setelah tap.
- Saldo akun serta data transaksi bulanan memakai cache runtime yang otomatis dibersihkan saat data berubah.
- `touch-action: manipulation` untuk respons tap yang lebih langsung.
- Backdrop blur pada header dan bottom navigation dihapus karena berat pada sebagian WebView Android.
- Hardware acceleration WebView dipastikan aktif.
- Over-scroll dan scrollbar WebView yang tidak perlu dimatikan.
- Fix duplicate Kotlin stdlib dimasukkan ke project agar build GitHub tetap aman.
- GitHub Actions checkout/setup-java diperbarui.
- Menambahkan `tests/performance-smoke.js`.
- `versionCode = 83`, `versionName = 8.3.0`.

## Perubahan v8.2

### Tema Terang / Gelap
- Tombol tema ada di **Beranda pojok kanan atas**, di sebelah ikon notifikasi.
- Ikon **matahari** menandakan mode terang.
- Ikon **bulan** menandakan mode gelap.
- Klik ikon untuk berpindah tema.
- Pilihan tema tersimpan di perangkat dan tetap sama saat aplikasi dibuka kembali.
- Mode gelap mencakup Beranda, kartu, form, modal, bottom navigation, Asisten, Budget/Target, Utang/Tagihan/Rutin, dan halaman utama lainnya.
- `versionCode = 82`, `versionName = 8.2.0`.

## Perubahan v8.1

### 1. Tanggal lokal perangkat
Tanggal transaksi default tidak lagi memakai tanggal UTC. UangKu sekarang memakai tanggal lokal perangkat, sehingga transaksi yang dibuat setelah tengah malam WIB tidak bergeser ke hari sebelumnya.

### 2. Tagihan vs Pengeluaran Rutin
Menu **Utang & Tagihan** sekarang memiliki tiga tab:

- **Utang** — kewajiban/sisa pinjaman atau piutang.
- **Tagihan** — pembayaran dengan jatuh tempo, seperti WiFi/BPJS/air pascabayar.
- **Rutin** — pengeluaran berulang dengan tanggal fleksibel, seperti token listrik, bensin, dan pakan hewan.

Pengeluaran Rutin tidak otomatis mengurangi saldo. Saldo baru berubah saat tombol **Catat sekarang** digunakan.

### 3. Reminder tahan restart/update
Data reminder Tagihan disimpan juga di Android SharedPreferences. Setelah HP restart atau aplikasi di-update, `BillBootReceiver` menjadwalkan ulang reminder yang masih aktif.

### 4. Backup schema v81
Export JSON sekarang memakai envelope:

- `format: UangKuBackup`
- `schemaVersion: 81`
- `appVersion: 8.1.0`
- `exportedAt`
- `data`

Import lama tetap didukung. Backup dari versi yang lebih baru akan ditolak agar data tidak rusak. Sebelum import mengganti data aktif, UangKu menampilkan ringkasan isi backup untuk konfirmasi.

### 5. WebView hardening
- Universal access dari file URL dimatikan.
- File-to-file access dari halaman lokal dimatikan.
- Mixed content diblokir.
- Cleartext HTTP dinonaktifkan pada manifest.
- Link web eksternal dibuka di browser luar, bukan di WebView yang memiliki Android bridge.
- Android automatic backup dimatikan; gunakan Export JSON agar backup berada dalam kontrol pengguna.

### 6. Event binding dibersihkan
`bindPage()` sekarang merupakan satu alur final. Binding lama yang sebelumnya kemudian ditimpa binding lain sudah dihapus.

### 7. Jalur signed release untuk update APK
`versionCode = 81`, `versionName = 8.1.0`.

GitHub Actions selalu membuat debug APK untuk pengujian. Jika 4 signing secret telah dipasang, workflow juga menghasilkan artifact:

`UangKu-v8.7-SIGNED-release-apk`

Gunakan release APK untuk instalasi harian dan update selanjutnya. Lihat **SIGNING_SETUP.md**.

> Jika APK yang sekarang terpasang masih debug lama, export JSON terlebih dahulu, uninstall debug sekali, install signed release, lalu import JSON. Setelah berpindah ke release, update berikutnya dapat dipasang di atas aplikasi lama selama signing key tetap sama.

## Test otomatis

Workflow menjalankan:

```bash
node tests/code-health.js
node tests/finance-smoke.js
node tests/daily-hardening.js
```

Test meliputi:

- tidak ada deklarasi fungsi global ganda;
- `bindPage()` hanya memiliki satu handler final untuk form transaksi;
- seluruh halaman utama dapat dirender;
- transfer tidak mengubah Kekayaan Bersih;
- bayar utang / menerima piutang tidak menggandakan kekayaan;
- Piutang Penjualan memisahkan omzet, kas diterima, dan sisa piutang;
- Saving Rate tidak menghitung ulang dana target lama;
- rincian Budget sesuai bulan dan kategori;
- parser voice nominal bahasa Indonesia;
- tanggal lokal WIB di sekitar pergantian hari UTC;
- legacy backup bermigrasi ke schema 81;
- backup schema yang lebih baru ditolak;
- data Pengeluaran Rutin terhubung ke transaksi;
- konfigurasi WebView security;
- persistence dan re-scheduling Tagihan setelah restart;
- konfigurasi signed release.

## Build APK lewat GitHub

1. Upload seluruh isi folder ini ke repository GitHub.
2. Buka **Actions → Build Android APK**.
3. Jalankan workflow.
4. Untuk testing, artifact debug selalu tersedia.
5. Untuk APK harian yang bisa di-update, setup signing sekali mengikuti **SIGNING_SETUP.md**, lalu unduh artifact signed release.

## Penyimpanan data

Data utama masih disimpan lokal melalui `localStorage` WebView untuk menjaga kompatibilitas dengan data versi sebelumnya. Backup JSON berkala tetap disarankan.

## Catatan OCR & Voice

- OCR memakai Google ML Kit dan hasil tetap perlu dicek sebelum transaksi disimpan.
- Voice memakai Android Speech Recognizer bahasa Indonesia.
- Jawaban voice Asisten dapat dibacakan lewat Text-to-Speech Android.
