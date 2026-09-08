# UangKu — Setup APK Update yang Aman

UangKu v8.6 sudah dikonfigurasi untuk menghasilkan **signed release APK** dengan signing key yang sama pada setiap build.

> Penting: private key/keystore tidak disertakan di project atau ZIP. Simpan sendiri. Jika key hilang, APK dengan package `com.uangku.app` tidak bisa di-update menggunakan key baru.

## 1. Buat keystore sekali saja

Di komputer yang memiliki Java/JDK, buka PowerShell lalu jalankan:

```powershell
keytool -genkeypair -v -keystore uangku-release.jks -alias uangku -keyalg RSA -keysize 2048 -validity 10000
```

Simpan:
- file `uangku-release.jks`
- password keystore
- alias (contoh `uangku`)
- password key

Jangan upload file `.jks` ke repository.

## 2. Ubah keystore menjadi Base64

PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("uangku-release.jks")) | Set-Clipboard
```

## 3. Tambahkan 4 GitHub Actions Secrets

Buka repository → **Settings → Secrets and variables → Actions → New repository secret**.

Buat:

- `UANGKU_KEYSTORE_BASE64` → paste Base64 dari langkah 2
- `UANGKU_KEYSTORE_PASSWORD` → password keystore
- `UANGKU_KEY_ALIAS` → alias, misalnya `uangku`
- `UANGKU_KEY_PASSWORD` → password key


## Jika sekarang UangKu yang terpasang masih APK debug lama

APK debug lama dan signed release memakai tanda tangan berbeda, jadi Android biasanya tidak mengizinkan release baru menimpa debug lama.

Lakukan **sekali saja** saat pindah ke jalur release:

1. Dari UangKu lama → **Pengaturan → Export JSON**.
2. Pastikan file backup tersimpan.
3. Uninstall APK debug lama.
4. Install artifact `UangKu-v8.6-SIGNED-release-apk`.
5. Import kembali backup JSON.
6. Mulai setelah itu, versi release berikutnya dapat dipasang sebagai update selama signing key tetap sama dan `versionCode` naik.

## 4. Build

Buka **Actions → Build Android APK → Run workflow**.

Artifact:
- `UangKu-v8.6-TEST-debug-apk` = hanya untuk tes.
- `UangKu-v8.6-SIGNED-release-apk` = **pakai ini untuk instalasi harian dan update berikutnya**.

Selama package name tetap `com.uangku.app`, signing key tetap sama, dan `versionCode` selalu naik, APK baru dapat dipasang sebagai update di atas versi release sebelumnya.
