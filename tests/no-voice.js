const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');

const js=fs.readFileSync(path.join(root,'app/src/main/assets/app.js'),'utf8');
const manifest=fs.readFileSync(path.join(root,'app/src/main/AndroidManifest.xml'),'utf8');
const java=fs.readFileSync(path.join(root,'app/src/main/java/com/uangku/app/MainActivity.java'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/build.yml'),'utf8');

function ok(cond,msg){
  if(!cond)throw new Error(msg);
  console.log(msg+':OK');
}

ok(!js.includes("voice:'Catat dengan Suara'"),'voice-route-title-removed');
ok(!js.includes("navigate('voice')"),'voice-navigation-removed');
ok(!js.includes('id="voiceBtn"'),'assistant-mic-button-removed');
ok(!js.includes('Voice AI'),'quick-add-voice-removed');
ok(!js.includes('function renderVoice'),'voice-page-removed');
ok(!manifest.includes('android.permission.RECORD_AUDIO'),'record-audio-permission-removed');
ok(!manifest.includes('android.speech.action.RECOGNIZE_SPEECH'),'speech-query-removed');
ok(!java.includes('SpeechRecognizer'),'speech-recognizer-removed');
ok(!java.includes('TextToSpeech'),'tts-removed');
ok(!java.includes('startVoice()'),'native-start-voice-removed');
ok(!workflow.includes('native-voice.js'),'native-voice-workflow-removed');
ok(!workflow.includes('voice-recovery.js'),'voice-recovery-workflow-removed');
ok(workflow.includes('UangKu-v8.11-TEST-debug-apk'),'v811-debug-artifact');
