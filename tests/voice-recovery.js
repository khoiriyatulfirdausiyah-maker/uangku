const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const java=fs.readFileSync(path.join(root,'app/src/main/java/com/uangku/app/MainActivity.java'),'utf8');
const js=fs.readFileSync(path.join(root,'app/src/main/assets/app.js'),'utf8');

function ok(cond,msg){
  if(!cond)throw new Error(msg);
  console.log(msg+':OK');
}

ok(java.includes('private long voiceSessionId = 0L;'),'session-token-field');
ok(java.includes('if (!isCurrentVoiceSession(sessionId, recognizer)) return;'),'stale-listener-protection');
ok(java.includes('ERROR_CLIENT'),'client-error-handled');
ok(java.includes('launchSystemVoiceFallback(sessionId);'),'client-fallback-present');
ok(java.includes('startActivityForResult(fallback, REQ_VOICE);'),'system-fallback-launch');
ok(js.includes("if(currentPage==='voice')"),'error-stays-on-voice-page');
ok(js.includes('id="voiceRetryV87"'),'retry-button-present');
ok(!js.includes("window.onVoiceError=msg=>{\\n  navigate('assistant');"),'error-does-not-auto-dismiss-page');
