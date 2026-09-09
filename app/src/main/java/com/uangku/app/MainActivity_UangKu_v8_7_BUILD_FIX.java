package com.uangku.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.provider.MediaStore;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.speech.RecognitionListener;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
    private WebView webView;
    private static final int REQ_VOICE = 101;
    private static final int REQ_FILE = 102;
    private static final int REQ_EXPORT = 103;
    private static final int REQ_RECEIPT_CAMERA = 104;
    private static final int REQ_RECEIPT_GALLERY = 105;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingExportJson;
    private Uri currentReceiptUri;
    private Uri pendingReceiptCameraUri;
    private final TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
    private TextToSpeech textToSpeech;
    private boolean ttsReady = false;
    private SpeechRecognizer speechRecognizer;
    private boolean voiceListening = false;
    private boolean voiceSpeechStarted = false;
    private boolean voiceFallbackTried = false;
    private long voiceSessionId = 0L;
    private long voiceStartedAtMs = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        createNotificationChannel();

        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = textToSpeech.setLanguage(new Locale("id", "ID"));
                ttsReady = result != TextToSpeech.LANG_MISSING_DATA &&
                           result != TextToSpeech.LANG_NOT_SUPPORTED;
                textToSpeech.setSpeechRate(1.02f);
                textToSpeech.setPitch(1.0f);
            }
        });

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);

        // UangKu hanya menjalankan UI lokal dari android_asset.
        // File input tetap diizinkan, tetapi halaman lokal tidak boleh membaca URL/file lain
        // secara bebas atau melakukan mixed-content network access.
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setGeolocationEnabled(false);
        s.setMediaPlaybackRequiresUserGesture(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(true);
        }

        webView.setWebViewClient(new WebViewClient() {
            private boolean handleUrl(Uri uri) {
                if (uri == null) return true;

                String scheme = uri.getScheme();
                String url = uri.toString();

                if ("file".equalsIgnoreCase(scheme) &&
                    url.startsWith("file:///android_asset/")) {
                    return false;
                }

                if ("http".equalsIgnoreCase(scheme) ||
                    "https".equalsIgnoreCase(scheme) ||
                    "mailto".equalsIgnoreCase(scheme) ||
                    "tel".equalsIgnoreCase(scheme)) {
                    try {
                        Intent external = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(external);
                    } catch (Exception ignored) {}
                    return true;
                }

                // Blokir scheme lain agar JavascriptInterface tidak pernah terekspos
                // pada konten selain halaman lokal UangKu.
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request == null ? null : request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url == null ? null : Uri.parse(url));
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                String type = "*/*";
                String[] accept = fileChooserParams.getAcceptTypes();
                if (accept != null && accept.length > 0 && accept[0] != null && !accept[0].isEmpty()) {
                    type = accept[0];
                }
                intent.setType(type);
                try {
                    startActivityForResult(Intent.createChooser(intent, "Pilih file"), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        webView.addJavascriptInterface(new NativeBridge(), "Native");
        webView.loadUrl("file:///android_asset/index.html");

        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 300);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "bill_reminders",
                "Pengingat Tagihan",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Pengingat jatuh tempo tagihan UangKu");
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            nm.createNotificationChannel(channel);
        }
    }

    public class NativeBridge {
        @JavascriptInterface
        public void startVoice() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 23 &&
                    checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 301);
                    return;
                }

                launchVoiceRecognizer();
            });
        }

        @JavascriptInterface
        public void stopVoice() {
            runOnUiThread(() -> stopVoiceRecognizer(true));
        }

        @JavascriptInterface
        public void speak(String text) {
            runOnUiThread(() -> {
                if (textToSpeech != null && ttsReady && text != null && !text.trim().isEmpty()) {
                    textToSpeech.speak(
                        text,
                        TextToSpeech.QUEUE_FLUSH,
                        null,
                        "uangku-assistant-" + System.currentTimeMillis()
                    );
                }
            });
        }

        @JavascriptInterface
        public void stopSpeaking() {
            runOnUiThread(() -> {
                if (textToSpeech != null) textToSpeech.stop();
            });
        }

        @JavascriptInterface
        public void openReceiptCamera() {
            runOnUiThread(() -> launchReceiptCamera());
        }

        @JavascriptInterface
        public void openReceiptGallery() {
            runOnUiThread(() -> launchReceiptGallery());
        }

        @JavascriptInterface
        public void scanLastReceipt() {
            Uri uri = currentReceiptUri;
            if (uri == null) {
                callJs(
                    "window.onReceiptOCRError && window.onReceiptOCRError(" +
                    JSONObject.quote("Belum ada foto struk yang dipilih.") +
                    ")"
                );
                return;
            }

            new Thread(() -> scanReceiptUri(uri)).start();
        }

        @JavascriptInterface
        public void scanReceipt(String dataUrl) {
            try {
                String base64 = dataUrl;
                int comma = dataUrl.indexOf(',');
                if (comma >= 0) base64 = dataUrl.substring(comma + 1);

                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                if (bitmap == null) {
                    callJs("window.onReceiptOCRError && window.onReceiptOCRError(" + JSONObject.quote("Gambar tidak dapat dibaca.") + ")");
                    return;
                }

                InputImage image = InputImage.fromBitmap(bitmap, 0);
                recognizer.process(image)
                    .addOnSuccessListener(result -> callJs(
                        "window.onReceiptOCR && window.onReceiptOCR(" + JSONObject.quote(result.getText()) + ")"
                    ))
                    .addOnFailureListener(e -> callJs(
                        "window.onReceiptOCRError && window.onReceiptOCRError(" + JSONObject.quote("OCR gagal: " + e.getMessage()) + ")"
                    ));
            } catch (Exception e) {
                callJs("window.onReceiptOCRError && window.onReceiptOCRError(" + JSONObject.quote("OCR gagal membaca gambar.") + ")");
            }
        }

        @JavascriptInterface
        public void exportJson(String json) {
            pendingExportJson = json;
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, "uangku-backup-" +
                    new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()) + ".json");
                startActivityForResult(intent, REQ_EXPORT);
            });
        }

        @JavascriptInterface
        public void scheduleBill(String id, String title, String amount, String dueDate) {
            BillReminderScheduler.schedule(
                MainActivity.this,
                id,
                title,
                amount,
                dueDate,
                false,
                1,
                true
            );
        }

        @JavascriptInterface
        public void scheduleBillAdvanced(String id, String title, String amount, String dueDate, boolean monthly, int daysBefore) {
            BillReminderScheduler.schedule(
                MainActivity.this,
                id,
                title,
                amount,
                dueDate,
                monthly,
                Math.max(0, daysBefore),
                true
            );
        }

        @JavascriptInterface
        public void cancelBill(String id) {
            BillReminderScheduler.cancel(MainActivity.this, id, true);
        }

    }




    private Intent buildVoiceIntent() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "id-ID");
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "id-ID");
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        intent.putExtra(
            RecognizerIntent.EXTRA_PROMPT,
            "Tanya keuangan atau catat transaksi, misalnya: saldo SEABANK berapa?"
        );
        return intent;
    }

    private void launchVoiceRecognizer() {
        runOnUiThread(() -> {
            if (textToSpeech != null) {
                try { textToSpeech.stop(); } catch (Exception ignored) {}
            }

            cancelCurrentVoiceSession();

            final long sessionId = ++voiceSessionId;
            voiceListening = false;
            voiceSpeechStarted = false;
            voiceFallbackTried = false;
            voiceStartedAtMs = System.currentTimeMillis();

            callJs("window.onVoicePreparing && window.onVoicePreparing()");

            if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                launchSystemVoiceFallback(sessionId);
                return;
            }

            startDirectVoiceRecognizer(sessionId);
        });
    }

    private void startDirectVoiceRecognizer(final long sessionId) {
        runOnUiThread(() -> {
            if (sessionId != voiceSessionId) return;

            try {
                final SpeechRecognizer recognizer = SpeechRecognizer.createSpeechRecognizer(this);
                speechRecognizer = recognizer;

                recognizer.setRecognitionListener(new RecognitionListener() {
                    @Override
                    public void onReadyForSpeech(Bundle params) {
                        if (!isCurrentVoiceSession(sessionId, recognizer)) return;
                        voiceListening = true;
                        callJs("window.onVoiceListening && window.onVoiceListening()");
                    }

                    @Override
                    public void onBeginningOfSpeech() {
                        if (!isCurrentVoiceSession(sessionId, recognizer)) return;
                        voiceSpeechStarted = true;
                        callJs("window.onVoiceSpeechStart && window.onVoiceSpeechStart()");
                    }

                    @Override public void onRmsChanged(float rmsdB) {}
                    @Override public void onBufferReceived(byte[] buffer) {}

                    @Override
                    public void onEndOfSpeech() {
                        if (!isCurrentVoiceSession(sessionId, recognizer)) return;
                        callJs("window.onVoiceSpeechEnd && window.onVoiceSpeechEnd()");
                    }

                    @Override
                    public void onError(int error) {
                        if (!isCurrentVoiceSession(sessionId, recognizer)) return;

                        voiceListening = false;
                        destroySpecificRecognizer(recognizer);

                        if (shouldTryVoiceFallback(error)) {
                            launchSystemVoiceFallback(sessionId);
                            return;
                        }

                        callJs(
                            "window.onVoiceError && window.onVoiceError(" +
                            JSONObject.quote(voiceErrorMessage(error)) +
                            ")"
                        );
                    }

                    @Override
                    public void onResults(Bundle results) {
                        if (!isCurrentVoiceSession(sessionId, recognizer)) return;

                        voiceListening = false;
                        ArrayList<String> matches = results == null
                            ? null
                            : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);

                        destroySpecificRecognizer(recognizer);

                        if (matches != null && !matches.isEmpty()) {
                            callJs(
                                "window.onVoiceResult && window.onVoiceResult(" +
                                JSONObject.quote(matches.get(0)) +
                                ")"
                            );
                        } else {
                            callJs(
                                "window.onVoiceError && window.onVoiceError(" +
                                JSONObject.quote("Aku belum menangkap ucapanmu. Coba lagi dengan kalimat sedikit lebih pelan.") +
                                ")"
                            );
                        }
                    }

                    @Override
                    public void onPartialResults(Bundle partialResults) {
                        if (!isCurrentVoiceSession(sessionId, recognizer)) return;

                        ArrayList<String> partial = partialResults == null
                            ? null
                            : partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);

                        if (partial != null && !partial.isEmpty()) {
                            callJs(
                                "window.onVoicePartial && window.onVoicePartial(" +
                                JSONObject.quote(partial.get(0)) +
                                ")"
                            );
                        }
                    }

                    @Override public void onEvent(int eventType, Bundle params) {}
                });

                recognizer.startListening(buildVoiceIntent());
            } catch (Exception directError) {
                destroySpecificRecognizer(speechRecognizer);
                launchSystemVoiceFallback(sessionId);
            }
        });
    }

    private boolean isCurrentVoiceSession(long sessionId, SpeechRecognizer recognizer) {
        return sessionId == voiceSessionId && speechRecognizer == recognizer;
    }

    private boolean shouldTryVoiceFallback(int error) {
        if (voiceFallbackTried) return false;

        long elapsed = Math.max(0L, System.currentTimeMillis() - voiceStartedAtMs);
        boolean failedImmediately = !voiceSpeechStarted && elapsed < 2500L;

        if (error == SpeechRecognizer.ERROR_CLIENT ||
            error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ||
            error == SpeechRecognizer.ERROR_SERVER) {
            return true;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (error == SpeechRecognizer.ERROR_SERVER_DISCONNECTED ||
                error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED ||
                error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE) {
                return true;
            }
        }

        return failedImmediately;
    }

    private void launchSystemVoiceFallback(long sessionId) {
        runOnUiThread(() -> {
            if (sessionId != voiceSessionId) return;

            if (voiceFallbackTried) {
                callJs(
                    "window.onVoiceError && window.onVoiceError(" +
                    JSONObject.quote(
                        "Pengenalan suara Android belum siap. Pastikan layanan input suara Google/Samsung aktif, lalu coba lagi."
                    ) +
                    ")"
                );
                return;
            }

            voiceFallbackTried = true;
            callJs("window.onVoiceFallback && window.onVoiceFallback()");

            try {
                Intent fallback = buildVoiceIntent();
                startActivityForResult(fallback, REQ_VOICE);
            } catch (Exception fallbackError) {
                callJs(
                    "window.onVoiceError && window.onVoiceError(" +
                    JSONObject.quote(
                        "Layanan pengenalan suara Android belum aktif. Aktifkan Input Suara Google/Samsung di pengaturan keyboard, lalu coba lagi."
                    ) +
                    ")"
                );
            }
        });
    }

    private void destroySpecificRecognizer(SpeechRecognizer recognizer) {
        if (recognizer == null) return;

        try { recognizer.destroy(); } catch (Exception ignored) {}

        if (speechRecognizer == recognizer) {
            speechRecognizer = null;
        }

        voiceListening = false;
    }

    private void cancelCurrentVoiceSession() {
        voiceSessionId++;

        SpeechRecognizer recognizer = speechRecognizer;
        speechRecognizer = null;
        voiceListening = false;
        voiceSpeechStarted = false;

        if (recognizer != null) {
            try { recognizer.cancel(); } catch (Exception ignored) {}
            try { recognizer.destroy(); } catch (Exception ignored) {}
        }
    }

    private String voiceErrorMessage(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "Mikrofon belum bisa digunakan. Coba tutup aplikasi lain yang sedang memakai mikrofon.";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "Izin mikrofon belum diberikan untuk UangKu.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "Pengenalan suara membutuhkan koneksi. Periksa internet lalu coba lagi.";
            case SpeechRecognizer.ERROR_NO_MATCH:
                return "Ucapan belum terbaca. Coba bicara lebih dekat ke mikrofon dan sedikit lebih pelan.";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "Pengenalan suara masih sibuk. Tunggu sebentar lalu coba lagi.";
            case SpeechRecognizer.ERROR_SERVER:
                return "Layanan pengenalan suara sedang bermasalah. Coba lagi sebentar lagi.";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "Belum terdengar ucapan. Tekan mikrofon lalu mulai bicara setelah indikator mendengarkan muncul.";
            case SpeechRecognizer.ERROR_CLIENT:
            default:
                return "Pengenalan suara belum berhasil. Coba tekan mikrofon sekali lagi.";
        }
    }

    private void destroySpeechRecognizer() {
        cancelCurrentVoiceSession();
    }

    private void stopVoiceRecognizer(boolean silent) {
        cancelCurrentVoiceSession();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode,
                                           String[] permissions,
                                           int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == 301) {
            if (grantResults.length > 0 &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                launchVoiceRecognizer();
            } else {
                callJs(
                    "window.onVoiceError && window.onVoiceError(" +
                    JSONObject.quote("Izin mikrofon belum diberikan.") +
                    ")"
                );
            }
        }
    }

    private void launchReceiptCamera() {
        try {
            File dir = new File(getCacheDir(), "receipt_images");
            if (!dir.exists() && !dir.mkdirs()) {
                throw new Exception("Folder kamera tidak dapat dibuat.");
            }

            File photo = File.createTempFile("uangku-receipt-", ".jpg", dir);
            pendingReceiptCameraUri = FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                photo
            );

            Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            if (camera.resolveActivity(getPackageManager()) == null) {
                pendingReceiptCameraUri = null;
                callJs(
                    "window.onReceiptOCRError && window.onReceiptOCRError(" +
                    JSONObject.quote("Aplikasi kamera tidak ditemukan.") +
                    ")"
                );
                return;
            }

            camera.putExtra(MediaStore.EXTRA_OUTPUT, pendingReceiptCameraUri);
            camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(camera, REQ_RECEIPT_CAMERA);
        } catch (Exception e) {
            pendingReceiptCameraUri = null;
            callJs(
                "window.onReceiptOCRError && window.onReceiptOCRError(" +
                JSONObject.quote("Kamera tidak dapat dibuka: " + e.getMessage()) +
                ")"
            );
        }
    }

    private void launchReceiptGallery() {
        try {
            Intent gallery = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            gallery.addCategory(Intent.CATEGORY_OPENABLE);
            gallery.setType("image/*");
            gallery.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            gallery.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            startActivityForResult(gallery, REQ_RECEIPT_GALLERY);
        } catch (Exception e) {
            callJs(
                "window.onReceiptOCRError && window.onReceiptOCRError(" +
                JSONObject.quote("Galeri tidak dapat dibuka.") +
                ")"
            );
        }
    }

    private void handleReceiptUri(Uri uri, String source) {
        if (uri == null) {
            callJs(
                "window.onReceiptOCRError && window.onReceiptOCRError(" +
                JSONObject.quote("Foto struk tidak ditemukan.") +
                ")"
            );
            return;
        }

        currentReceiptUri = uri;

        // OCR and preview must not block each other. OCR starts immediately from
        // the original-resolution URI, while a small thumbnail is prepared in parallel.
        callJs("window.setReceiptScanningV84 && window.setReceiptScanningV84(true,'Membaca total, tanggal, dan barang...')");
        new Thread(() -> scanReceiptUri(uri), "uangku-receipt-ocr").start();

        new Thread(() -> {
            try {
                String preview = buildReceiptPreviewDataUrl(uri);
                if (preview != null && !preview.isEmpty()) {
                    callJs(
                        "window.onReceiptImageReady && window.onReceiptImageReady(" +
                        JSONObject.quote(preview) + "," +
                        JSONObject.quote(source == null ? "" : source) +
                        ")"
                    );
                }
            } catch (Exception ignored) {}
        }, "uangku-receipt-preview").start();
    }

    private void scanReceiptUri(Uri uri) {
        try {
            InputImage image = InputImage.fromFilePath(this, uri);
            recognizer.process(image)
                .addOnSuccessListener(result -> {
                    String text = result == null ? "" : result.getText();

                    if (text == null || text.trim().isEmpty()) {
                        callJs(
                            "window.onReceiptOCRError && window.onReceiptOCRError(" +
                            JSONObject.quote("Teks struk belum terbaca. Coba foto lebih dekat, lurus, dan terang.") +
                            ")"
                        );
                        return;
                    }

                    callJs(
                        "window.onReceiptOCR && window.onReceiptOCR(" +
                        JSONObject.quote(text) +
                        ")"
                    );
                })
                .addOnFailureListener(e -> callJs(
                    "window.onReceiptOCRError && window.onReceiptOCRError(" +
                    JSONObject.quote("OCR gagal membaca struk: " + e.getMessage()) +
                    ")"
                ));
        } catch (Exception e) {
            callJs(
                "window.onReceiptOCRError && window.onReceiptOCRError(" +
                JSONObject.quote("Foto tidak dapat diproses oleh OCR.") +
                ")"
            );
        }
    }

    private String buildReceiptPreviewDataUrl(Uri uri) throws Exception {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;

        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) return "";
            BitmapFactory.decodeStream(in, null, bounds);
        }

        int maxSide = Math.max(bounds.outWidth, bounds.outHeight);
        int sample = 1;
        while (maxSide / sample > 900) sample *= 2;

        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = Math.max(1, sample);
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;

        Bitmap bitmap;
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) return "";
            bitmap = BitmapFactory.decodeStream(in, null, options);
        }

        if (bitmap == null) return "";

        int orientation = ExifInterface.ORIENTATION_NORMAL;
        try (InputStream exifStream = getContentResolver().openInputStream(uri)) {
            if (exifStream != null) {
                ExifInterface exif = new ExifInterface(exifStream);
                orientation = exif.getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL
                );
            }
        } catch (Exception ignored) {}

        Matrix matrix = new Matrix();
        switch (orientation) {
            case ExifInterface.ORIENTATION_ROTATE_90:
                matrix.postRotate(90);
                break;
            case ExifInterface.ORIENTATION_ROTATE_180:
                matrix.postRotate(180);
                break;
            case ExifInterface.ORIENTATION_ROTATE_270:
                matrix.postRotate(270);
                break;
            case ExifInterface.ORIENTATION_FLIP_HORIZONTAL:
                matrix.preScale(-1, 1);
                break;
            case ExifInterface.ORIENTATION_FLIP_VERTICAL:
                matrix.preScale(1, -1);
                break;
            default:
                break;
        }

        Bitmap oriented = bitmap;
        if (!matrix.isIdentity()) {
            oriented = Bitmap.createBitmap(
                bitmap,
                0,
                0,
                bitmap.getWidth(),
                bitmap.getHeight(),
                matrix,
                true
            );
            if (oriented != bitmap) bitmap.recycle();
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        oriented.compress(Bitmap.CompressFormat.JPEG, 68, out);
        if (!oriented.isRecycled()) oriented.recycle();

        return "data:image/jpeg;base64," +
            Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    private void callJs(String js) {
        runOnUiThread(() -> webView.evaluateJavascript(js, null));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQ_VOICE) {
            if (resultCode == RESULT_OK && data != null) {
                ArrayList<String> matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);

                if (matches != null && !matches.isEmpty()) {
                    callJs(
                        "window.onVoiceResult && window.onVoiceResult(" +
                        JSONObject.quote(matches.get(0)) +
                        ")"
                    );
                } else {
                    callJs(
                        "window.onVoiceError && window.onVoiceError(" +
                        JSONObject.quote("Aku belum menangkap ucapanmu. Coba lagi dengan kalimat sedikit lebih pelan.") +
                        ")"
                    );
                }
            } else if (resultCode == RESULT_CANCELED) {
                callJs("window.onVoiceCancelled && window.onVoiceCancelled()");
            } else {
                callJs(
                    "window.onVoiceError && window.onVoiceError(" +
                    JSONObject.quote("Pengenalan suara Android belum berhasil. Coba lagi atau periksa layanan input suara di pengaturan HP.") +
                    ")"
                );
            }
            return;
        }

        if (requestCode == REQ_RECEIPT_CAMERA) {
            if (resultCode == RESULT_OK && pendingReceiptCameraUri != null) {
                Uri uri = pendingReceiptCameraUri;
                pendingReceiptCameraUri = null;
                handleReceiptUri(uri, "camera");
            } else {
                pendingReceiptCameraUri = null;
                if (resultCode != RESULT_CANCELED) {
                    callJs(
                        "window.onReceiptOCRError && window.onReceiptOCRError(" +
                        JSONObject.quote("Foto dari kamera belum berhasil diambil.") +
                        ")"
                    );
                }
            }
            return;
        }

        if (requestCode == REQ_RECEIPT_GALLERY) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri uri = data.getData();

                try {
                    final int takeFlags = data.getFlags() &
                        (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    getContentResolver().takePersistableUriPermission(
                        uri,
                        takeFlags & Intent.FLAG_GRANT_READ_URI_PERMISSION
                    );
                } catch (Exception ignored) {}

                handleReceiptUri(uri, "gallery");
            } else if (resultCode != RESULT_CANCELED) {
                callJs(
                    "window.onReceiptOCRError && window.onReceiptOCRError(" +
                    JSONObject.quote("Foto dari galeri belum berhasil dipilih.") +
                    ")"
                );
            }
            return;
        }

        if (requestCode == REQ_FILE) {
            if (fileCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
            fileCallback.onReceiveValue(results);
            fileCallback = null;
            return;
        }

        if (requestCode == REQ_EXPORT) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingExportJson != null) {
                try {
                    java.io.OutputStream out = getContentResolver().openOutputStream(data.getData());
                    if (out != null) {
                        out.write(pendingExportJson.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                        out.close();
                        callJs("window.onExportDone && window.onExportDone()");
                    }
                } catch (Exception e) {
                    callJs("window.onExportError && window.onExportError()");
                }
            }
            pendingExportJson = null;
        }
    }

    @Override
    protected void onDestroy() {
        stopVoiceRecognizer(true);

        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }

        if (recognizer != null) {
            recognizer.close();
        }

        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
