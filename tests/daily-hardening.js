process.env.TZ='Asia/Jakarta';

const fs=require('fs');
const vm=require('vm');
const path=require('path');

function assert(cond,msg){if(!cond)throw new Error(msg)}
function eq(actual,expected,msg){
  if(actual!==expected)throw new Error(`${msg}: expected ${expected}, got ${actual}`);
}

const root=path.join(__dirname,'..');
const appPath=path.join(root,'app','src','main','assets','app.js');
let src=fs.readFileSync(appPath,'utf8').replace("setHeader('home');render();",'');

const dummy={
  classList:{toggle(){},add(){},remove(){}},
  style:{},
  dataset:{},
  textContent:'',
  value:'',
  innerHTML:'',
  files:[],
  onclick:null,
  onchange:null,
  onsubmit:null,
  onkeydown:null,
  click(){},
  focus(){},
  setAttribute(){},
  addEventListener(){},
  querySelectorAll(){return[]},
  closest(){return null},
  scrollTo(){},
  clientWidth:320,
  scrollLeft:0,
  scrollHeight:0
};

const storage={};
const context={
  console,
  window:{scrollTo(){},Native:null},
  document:{
    querySelector(){return dummy},
    querySelectorAll(){return[]},
    createElement(){return dummy},
    addEventListener(){}
  },
  localStorage:{
    getItem(k){return storage[k]??null},
    setItem(k,v){storage[k]=String(v)},
    removeItem(k){delete storage[k]}
  },
  requestAnimationFrame(fn){fn();return 1},
  setTimeout(){return 0},
  clearTimeout(){},
  confirm(){return false},
  FormData:global.FormData,
  Blob:global.Blob,
  URL:global.URL,
  FileReader:function(){},
  Date,
  Math,
  JSON,
  Intl,
  Number,
  String,
  Array,
  Object,
  Set,
  Map,
  RegExp,
  Promise
};

context.global=context;
vm.createContext(context);
vm.runInContext(src,context,{filename:'app.js'});
vm.runInContext("globalThis.__setState=s=>{state=s}; globalThis.__getState=()=>state; globalThis.__setDebtTab=v=>{debtTab=v};",context);

eq(
  context.localDateISO(new Date('2026-09-08T17:30:00Z')),
  '2026-09-09',
  'WIB local date after UTC day boundary'
);
eq(
  context.localDateISO(new Date('2026-09-08T16:30:00Z')),
  '2026-09-08',
  'WIB local date before midnight'
);

const legacy={
  accounts:[{id:'cash',name:'Cash',type:'Cash',initial:500000}],
  transactions:[],
  categories:['Listrik','Pakan Hewan'],
  budgets:[],
  goals:[],
  assets:{investment:[],property:[],physical:[]},
  debts:[],
  bills:[],
  chat:[]
};
context.legacy=legacy;

const parsedLegacy=context.parseBackupPayloadV81(legacy);
assert(parsedLegacy.legacy===true,'legacy backup should be accepted');
eq(parsedLegacy.data.schemaVersion,81,'legacy data must migrate to schema 81');

context.__setState(context.normalizeState(legacy));
const payload=context.createBackupPayloadV81();
eq(payload.format,'UangKuBackup','backup format');
eq(payload.schemaVersion,81,'backup schema');
eq(payload.appVersion,'8.11.0','backup app version');
assert(payload.data&&Array.isArray(payload.data.accounts),'backup data missing');

let newerRejected=false;
try{
  context.parseBackupPayloadV81({
    format:'UangKuBackup',
    schemaVersion:999,
    data:legacy
  });
}catch(e){
  newerRejected=true;
}
assert(newerRejected,'newer backup schema must be rejected');

const routine=context.normalizeRoutineV81({
  id:'r1',
  name:'Token listrik',
  category:'Listrik',
  amount:50000,
  accountId:'cash'
});
context.__getState().routines=[routine];
context.__getState().transactions.push({
  id:'t1',
  type:'expense',
  date:'2026-09-08',
  amount:50000,
  accountId:'cash',
  category:'Listrik',
  source:'routine_expense',
  routineId:'r1'
});
const routineSummary=context.routineMonthSummaryV81(routine,'2026-09');
eq(routineSummary.count,1,'routine monthly count');
eq(routineSummary.total,50000,'routine monthly total');

context.__setDebtTab('routines');
const routinePage=context.renderDebtsBills();
assert(routinePage.includes('Pengeluaran Rutin'),'routine tab content missing');
assert(routinePage.includes('Token listrik'),'routine item missing');
assert(routinePage.includes('sudah dicatat 1x'),'routine status missing');

const mainJava=fs.readFileSync(path.join(root,'app','src','main','java','com','uangku','app','MainActivity.java'),'utf8');
assert(mainJava.includes('setAllowUniversalAccessFromFileURLs(false)'),'universal file URL access must be disabled');
assert(mainJava.includes('setAllowFileAccessFromFileURLs(false)'),'file-to-file access must be disabled');
assert(mainJava.includes('MIXED_CONTENT_NEVER_ALLOW'),'mixed content must be blocked');
assert(mainJava.includes('shouldOverrideUrlLoading'),'external URL routing missing');
assert(mainJava.includes('Intent.ACTION_VIEW'),'external links must leave the WebView');

const manifest=fs.readFileSync(path.join(root,'app','src','main','AndroidManifest.xml'),'utf8');
assert(manifest.includes('android:allowBackup="false"'),'Android automatic backup should be disabled');
assert(manifest.includes('android:usesCleartextTraffic="false"'),'cleartext traffic should be disabled');
assert(manifest.includes('android.permission.RECEIVE_BOOT_COMPLETED'),'boot permission missing');
assert(manifest.includes('.BillBootReceiver'),'boot receiver missing');

const scheduler=fs.readFileSync(path.join(root,'app','src','main','java','com','uangku','app','BillReminderScheduler.java'),'utf8');
assert(scheduler.includes('rescheduleAll'),'bill reschedule helper missing');
assert(scheduler.includes('getSharedPreferences'),'bill reminder persistence missing');

const gradle=fs.readFileSync(path.join(root,'app','build.gradle'),'utf8');
assert(gradle.includes('versionCode 91'),'versionCode must be 86');
assert(gradle.includes('versionName "8.11.0"'),'versionName must be 8.11.0');
assert(gradle.includes('UANGKU_KEYSTORE_PATH'),'release signing env config missing');

const workflow=fs.readFileSync(path.join(root,'.github','workflows','build.yml'),'utf8');
assert(workflow.includes('UANGKU_KEYSTORE_BASE64'),'GitHub signing secret missing');
assert(workflow.includes('UangKu-v8.11-SIGNED-release-apk'),'signed artifact missing');
assert(workflow.includes('daily-hardening.js'),'hardening test not wired into workflow');

console.log('daily-hardening: OK');
