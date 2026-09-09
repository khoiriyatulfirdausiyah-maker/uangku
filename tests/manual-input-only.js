const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'app/src/main/assets/app.js'),'utf8');
const java=fs.readFileSync(path.join(root,'app/src/main/java/com/uangku/app/MainActivity.java'),'utf8');
const manifest=fs.readFileSync(path.join(root,'app/src/main/AndroidManifest.xml'),'utf8');
const gradle=fs.readFileSync(path.join(root,'app/build.gradle'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/build.yml'),'utf8');

function ok(cond,msg){if(!cond)throw new Error(msg);console.log(msg+':OK')}

ok(!js.includes("receipt:'Foto Struk'"),'receipt-title-removed');
ok(!js.includes("navigate('receipt')"),'receipt-navigation-removed');
ok(!js.includes('function renderReceipt'),'receipt-view-removed');
ok(!js.includes('Foto Struk'),'receipt-label-removed');
ok(!js.includes('scanReceipt('),'receipt-js-scan-removed');
ok(!js.includes('onReceiptOCR'),'receipt-js-callback-removed');
ok(!java.includes('openReceiptCamera'),'native-camera-removed');
ok(!java.includes('TextRecognizer'),'mlkit-java-removed');
ok(!java.includes('REQ_RECEIPT_'),'receipt-request-codes-removed');
ok(!manifest.includes('FileProvider'),'file-provider-removed');
ok(!gradle.includes('text-recognition'),'mlkit-dependency-removed');
ok(!workflow.includes('receipt-scanner.js'),'receipt-workflow-removed');
ok(!workflow.includes('receipt-accuracy.js'),'receipt-accuracy-workflow-removed');
ok(js.includes("function openQuickAddMenu(){\n  manualTxType='income';\n  navigate('addTransaction');"),'plus-direct-manual');
ok(workflow.includes('UangKu-v8.11-TEST-debug-apk'),'v811-debug-artifact');
