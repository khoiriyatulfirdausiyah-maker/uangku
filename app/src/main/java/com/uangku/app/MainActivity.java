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
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.Uri;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
    private WebView webView;
    private static final int REQ_VOICE = 101;
    private static final int REQ_FILE = 102;
    private static final int REQ_EXPORT = 103;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingExportJson;
    private final TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
    private TextToSpeech textToSpeech;
    private boolean ttsReady = false;

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




    private void launchVoiceRecognizer() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "id-ID");
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "id-ID");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        intent.putExtra(
            RecognizerIntent.EXTRA_PROMPT,
            "Tanya keuangan atau catat transaksi, misalnya: saldo SEABANK berapa?"
        );

        try {
            startActivityForResult(intent, REQ_VOICE);
        } catch (Exception e) {
            callJs(
                "window.onVoiceError && window.onVoiceError(" +
                JSONObject.quote("Pengenalan suara tidak tersedia di perangkat ini.") +
                ")"
            );
        }
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
            } else if (resultCode != RESULT_CANCELED) {
                callJs(
                    "window.onVoiceError && window.onVoiceError(" +
                    JSONObject.quote("Pengenalan suara belum berhasil. Coba lagi.") +
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
