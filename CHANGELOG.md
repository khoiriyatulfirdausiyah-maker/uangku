# Changelog

## 8.7.0 — Voice Recovery

- Memperbaiki race condition SpeechRecognizer yang dapat membuat halaman voice langsung berhenti.
- Menambahkan session token untuk mengabaikan callback sesi lama.
- Menambahkan fallback otomatis ke pengenal suara Android sistem.
- Error voice tidak lagi langsung menutup halaman Voice.
- Menambahkan tombol Coba lagi.
- Menambahkan `tests/voice-recovery.js`.
- `versionCode` 87 / `versionName` 8.7.0.

## 8.6.0 — Receipt Accuracy & Performance

- Total belanja diprioritaskan dari label total dan mengecualikan cash/tender/change/payment noise.
- Tanggal OCR mendukung tahun 2/4 digit dan nama bulan Indonesia/Inggris.
- Nama barang diekstrak sebagai catatan transaksi.
- OCR dan thumbnail preview berjalan paralel.
- Preview scanner diturunkan ke 900px/JPEG 68 tanpa menurunkan resolusi OCR.
- Menghindari data URI besar di template render receipt.
- Menambahkan content-visibility dan shadow lebih ringan untuk mengurangi repaint.
- Menambahkan `tests/receipt-accuracy.js`.
- `versionCode` 86 / `versionName` 8.6.0.

## 8.5.0 — Native Voice Fix

- Mengganti jalur utama voice ke Android `SpeechRecognizer` native.
- Menambahkan `RecognitionListener`, partial result, dan stop/cancel native.
- Menambahkan manifest query untuk speech recognition + fallback RecognizerIntent.
- Error voice tidak lagi memenuhi riwayat chat.
- Membersihkan spam error teknis lama satu kali.
- Menambahkan `tests/native-voice.js`.
- `versionCode` 85 / `versionName` 8.5.0.

## 8.4.0 — Receipt Scanner

- Tombol kamera Foto Struk sekarang membuka kamera Android langsung lewat `ACTION_IMAGE_CAPTURE`.
- Menambahkan FileProvider untuk foto kamera sementara.
- Galeri dipisahkan ke `ACTION_OPEN_DOCUMENT`.
- OCR ML Kit membaca URI foto asli agar teks kecil pada struk tidak hilang karena kompresi awal.
- Preview foto dikoreksi berdasarkan orientasi EXIF.
- OCR berjalan otomatis setelah kamera/galeri selesai.
- Parser total struk memprioritaskan GRAND TOTAL / TOTAL BAYAR dan mengabaikan Cash/Tunai, Kembalian, Diskon, Pajak, serta nomor referensi.
- Menambahkan halaman review hasil scan sebelum transaksi dibuat.
- Menambahkan `tests/receipt-scanner.js`.
- `versionCode` 84 / `versionName` 8.4.0.

## 8.3.0 — Responsif & Ringan

- Page-scoped event binding.
- Cache runtime saldo akun dan transaksi bulanan.
- Tap/navigasi dibuat lebih langsung.
- Backdrop blur berat dihapus.
- WebView hardware acceleration dipastikan aktif.
- Fix Kotlin duplicate classes dimasukkan.
- Performance smoke test ditambahkan.
- versionCode 83 / versionName 8.3.0.

## 8.2.0 — Tema Terang & Gelap

- Menambahkan tombol tema di Beranda pojok kanan atas.
- Ikon matahari menunjukkan mode terang; ikon bulan menunjukkan mode gelap.
- Tema tersimpan di perangkat dan dipulihkan saat aplikasi dibuka kembali.
- Menambahkan dark theme untuk kartu, form, modal, bottom navigation, carousel keuangan, Asisten, serta modul utama.
- Warna `theme-color` ikut menyesuaikan tema.
- Menambahkan `tests/theme-mode.js`.
- `versionCode` menjadi `82`; `versionName` menjadi `8.2.0`.

## 8.1.0 — Daily Use Hardening

- Tanggal default memakai timezone lokal perangkat, bukan UTC.
- Menambahkan tab **Pengeluaran Rutin** untuk token listrik, bensin, pakan hewan, dan kebutuhan fleksibel lain.
- Menambahkan `BillReminderScheduler` + `BillBootReceiver` agar reminder Tagihan dijadwalkan ulang setelah restart/update aplikasi.
- Menambahkan backup envelope schema `81` dan validasi import sebelum mengganti data aktif.
- Mempertahankan kompatibilitas import JSON versi lama.
- WebView diperketat: universal file access dan mixed content dimatikan; link eksternal dibuka di browser luar.
- Android automatic backup dan cleartext traffic dimatikan.
- `bindPage()` dikonsolidasikan menjadi satu set event binding final; binding yang saling menimpa dibuang.
- Menghapus bridge voice lama yang sudah ditimpa implementasi voice final.
- Menambahkan konfigurasi release signing melalui GitHub Actions Secrets.
- Menambahkan `SIGNING_SETUP.md`.
- Menambahkan `tests/daily-hardening.js`.
- `versionCode` menjadi `81`; `versionName` menjadi `8.1.0`.

## 8.0.0 — Clean & Stable

- 122 deklarasi fungsi lama yang tertimpa dihapus.
- Semua deklarasi fungsi global dibuat unik.
- 13 lapis override `bindPage` dikonsolidasikan.
- Wrapper transaksi/piutang lama dirapikan.
- Helper lama yang tidak dipakai dibuang.
- Bug laten modal Target diperbaiki.
- Test code-health dan finance-smoke ditambahkan.
