/* UangKu v8.2 Theme + Daily Use Hardening
   Stable runtime with local-device dates, versioned backups, recurring flexible expenses,
   hardened Android integration, and consolidated event bindings. */

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=n=>'Rp '+Math.round(Number(n||0)).toLocaleString('id-ID');
const APP_VERSION='8.2.0';
const BACKUP_SCHEMA_VERSION=81;
function localDateISO(date=new Date()){
 const d=date instanceof Date?date:new Date(date);
 if(Number.isNaN(d.getTime()))return '';
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const today=()=>localDateISO();
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const clone=o=>JSON.parse(JSON.stringify(o));
const monthKey=d=>(d||today()).slice(0,7);

const defaults={
  schemaVersion:BACKUP_SCHEMA_VERSION,
  accounts:[],
  categories:['Makan & Minum','Transportasi','Groceries','Listrik','Pakan Hewan','Hadiah','Hiburan','Penyesuaian Saldo','Kantor','Lainnya','Penjualan','Utang & Cicilan'],
  categoryIcons:{},
  transactions:[],
  budgets:[],
  goals:[],
  assets:{investment:[],property:[],physical:[]},
  debts:[],
  bills:[],
  routines:[],
  chat:[{role:'bot',text:'Halo! Aku siap membantu mencatat transaksi, menjawab pertanyaan, dan memberi insight keuanganmu. 😊 Kamu bisa ketik, pakai suara, atau foto struk.'}]
};

let state=loadState(), currentPage='home', txFilter='all', planTab='budget', assetTab='investment', debtTab='bills';
let balanceHidden=localStorage.getItem('uangku_balance_hidden')==='1';
let manualTxType='income';
let homePeriod=localStorage.getItem('uangku_home_period')||monthKey();
let planPeriod=localStorage.getItem('uangku_plan_period')||monthKey();
let reportPeriod=localStorage.getItem('uangku_report_period')||monthKey();
let includeInvestmentAssets=localStorage.getItem('uangku_include_investment_assets')!=='0';
let netWorthExpanded=localStorage.getItem('uangku_networth_expanded')==='1';

let appThemeV82=localStorage.getItem('uangku_theme')==='dark'?'dark':'light';

function applyThemeV82(savePreference=false){
  const dark=appThemeV82==='dark';
  const htmlEl=document.documentElement;

  if(htmlEl){
    htmlEl.dataset.theme=dark?'dark':'light';
    htmlEl.style.colorScheme=dark?'dark':'light';
  }

  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',dark?'#111821':'#F7FAF4');

  const btn=$('#themeToggle');
  if(btn){
    const label=dark?'Mode gelap':'Mode terang';
    btn.setAttribute('aria-label',label);
    btn.setAttribute('title',label);
  }

  if(savePreference)localStorage.setItem('uangku_theme',appThemeV82);
}

function toggleThemeV82(){
  appThemeV82=appThemeV82==='dark'?'light':'dark';
  applyThemeV82(true);
}

function loadState(){
 try{
   const raw=localStorage.getItem('uangku_data_v3');
   return raw?normalizeState(JSON.parse(raw)):clone(defaults);
 }catch(e){
   console.error('loadState',e);
   return clone(defaults);
 }
}

function save(){
 state.schemaVersion=BACKUP_SCHEMA_VERSION;
 localStorage.setItem('uangku_data_v3',JSON.stringify(state));
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(t){const x=$('#toast');x.textContent=t;x.classList.remove('hidden');clearTimeout(window._tt);window._tt=setTimeout(()=>x.classList.add('hidden'),2100)}
function pageTitle(p){
 return ({
   home:'Beranda',
   transactions:'Transaksi',
   addTransaction:'Tambah Transaksi',
   assistant:'Asisten UangKu',
   voice:'Catat dengan Suara',
   receipt:'Foto Struk',
   accounts:'Akun & Dompet',
   plans:'Budget & Target',
   assets:'Investasi & Aset',
   debts:'Utang & Tagihan',
   more:'Lainnya',
   reports:'Laporan & Insight',
   categories:'Kategori',
   settings:'Pengaturan'
 })[p]||'Beranda';
}

const validPages=new Set([
 'home','transactions','addTransaction','assistant','voice','receipt',
 'accounts','plans','assets','debts','more','reports','categories','settings'
]);
let navStack=[];

function resolveRoute(page){
 if(page==='bills'){
   debtTab='bills';
   return 'debts';
 }
 if(page==='routines'){
   debtTab='routines';
   return 'debts';
 }
 return validPages.has(page)?page:'home';
}

function setHeader(p){
 const home=p==='home';
 const main=['home','transactions','assistant','more'].includes(p);
 $('#brandLogo')?.classList.toggle('hidden',!home);
 $('#brandTagline')?.classList.toggle('hidden',!home);
 $('#pageTitle')?.classList.toggle('hidden',home);
 if($('#pageTitle'))$('#pageTitle').textContent=pageTitle(p);
 $('#backBtn')?.classList.toggle('hidden',main);
 $('#headerAction')?.classList.toggle('hidden',!home);
 $('#themeToggle')?.classList.toggle('hidden',!home);
 $('#bottomNav')?.classList.toggle('hidden',!main);
}

function navigate(page,opts={}){
 const next=resolveRoute(page);
 if(!opts.fromBack && next!==currentPage)navStack.push(currentPage);
 currentPage=next;
 setHeader(currentPage);
 $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===currentPage));
 render();
 window.scrollTo({top:0,behavior:opts.instant?'auto':'smooth'});
}

function goBack(){
 const prev=navStack.pop()||'home';
 navigate(prev,{fromBack:true,instant:true});
}

$$('.nav-item').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
$('#quickAddNav')&&($('#quickAddNav').onclick=openQuickAddMenu);
$('#backBtn')&&($('#backBtn').onclick=goBack);
$('#headerAction')&&($('#headerAction').onclick=()=>navigate('bills'));
$('#themeToggle')&&($('#themeToggle').onclick=toggleThemeV82);

function render(){
 const c=$('#content');
 if(!c)return;
 try{
   const views={
     home:renderHome,
     transactions:renderTransactions,
     addTransaction:renderAddTransaction,
     assistant:renderAssistant,
     voice:renderVoice,
     receipt:renderReceipt,
     accounts:renderAccounts,
     plans:renderPlans,
     assets:renderAssets,
     debts:renderDebtsBills,
     more:renderMore,
     reports:renderReports,
     categories:renderCategories,
     settings:renderSettings
   };
   c.innerHTML=(views[currentPage]||renderHome)();
   bindPage();
 }catch(err){
   console.error('Render error:',currentPage,err);
   c.innerHTML=`<div class="card error-card">
     <div class="list-title">Halaman gagal dimuat</div>
     <div class="list-sub">Coba kembali lalu buka lagi. ${esc(err?.message||'')}</div>
     <button class="btn secondary block" id="recoverHome" style="margin-top:12px">Kembali ke Beranda</button>
   </div>`;
   $('#recoverHome')&&($('#recoverHome').onclick=()=>navigate('home',{instant:true}));
 }
}


function balanceEyeIcon(){
 return balanceHidden
 ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"/><path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 8a9.6 9.6 0 0 1-2.1 3.7"/><path d="M6.6 6.7C4.2 8.2 3 10.4 3 12c0 3 3.5 8 9 8 1.2 0 2.3-.2 3.3-.6"/></svg>`
 : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-8 9-8 9 8 9 8-3.5 8-9 8-9-8-9-8Z"/><circle cx="12" cy="12" r="2.5"/></svg>`;
}

function toggleBalanceVisibility(){
 balanceHidden=!balanceHidden;
 localStorage.setItem('uangku_balance_hidden',balanceHidden?'1':'0');
 if(currentPage==='home')render();
}

function quickAddIcon(kind){
 const icons={
   manual:`<svg viewBox="0 0 24 24" aria-hidden="true">
     <path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/>
     <path d="M13.5 6.5l4 4"/>
     <path d="M4 12V5a2 2 0 0 1 2-2h5"/>
   </svg>`,
   receipt:`<svg viewBox="0 0 24 24" aria-hidden="true">
     <path d="M7 3h10v18l-2-1.2L13 21l-2-1.2L9 21l-2-1.2L5 21V5a2 2 0 0 1 2-2Z"/>
     <path d="M9 8h6M9 12h6M9 16h4"/>
   </svg>`,
   voice:`<svg viewBox="0 0 24 24" aria-hidden="true">
     <rect x="9" y="3" width="6" height="11" rx="3"/>
     <path d="M6 11a6 6 0 0 0 12 0"/>
     <path d="M12 17v4"/>
     <path d="M9 21h6"/>
     <path d="M18.5 4.5l.4-1 .4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4Z"/>
   </svg>`
 };
 return icons[kind]||'';
}

function openQuickAddMenu(){
 openModal('Tambah Transaksi',`
   <div class="quick-add-grid quick-add-grid-three">
     <button type="button" class="quick-add-option manual" data-quick-add="manual">
       <span class="quick-add-icon">${quickAddIcon('manual')}</span>
       <span>
         <b>Manual</b>
         <small>Isi pemasukan atau pengeluaran sendiri</small>
       </span>
     </button>

     <button type="button" class="quick-add-option receipt" data-quick-add="receipt">
       <span class="quick-add-icon">${quickAddIcon('receipt')}</span>
       <span>
         <b>Foto Struk</b>
         <small>Scan struk lalu isi transaksi otomatis</small>
       </span>
     </button>

     <button type="button" class="quick-add-option voice" data-quick-add="voice">
       <span class="quick-add-icon">${quickAddIcon('voice')}</span>
       <span>
         <b>Voice AI</b>
         <small>Ucapkan transaksi, AI bantu mencatat</small>
       </span>
     </button>
   </div>
 `,()=>{});

 setTimeout(()=>{
   $$('[data-quick-add]').forEach(btn=>{
     btn.onclick=()=>{
       const action=btn.dataset.quickAdd;
       closeModal();
       if(action==='manual'){
         manualTxType='income';
         navigate('addTransaction');
       }else if(action==='receipt'){
         navigate('receipt');
       }else if(action==='voice'){
         navigate('voice');
       }
     };
   });
 },0);
}

function homeMascot(){return `<img class="home-mascot-image" src="images/uangku_mascot_home.png" alt="Maskot UangKu">`}
function mascot(){return `<div class="mascot mascot-image"><img src="mascot-home.png" alt="Maskot UangKu"></div>`}

function iconFor(cat){
 if(state.categoryIcons&&state.categoryIcons[cat])return state.categoryIcons[cat];
 const c=String(cat||'').toLowerCase();
 if(/makan|minum|kuliner|kopi|jajan/.test(c)) return '🍜';
 if(/transport|bensin|pertamax|parkir|ojek|motor/.test(c)) return '🛵';
 if(/grocer|sembako|belanja bulanan|sayur|buah/.test(c)) return '🛒';
 if(/tagihan|listrik|air|wifi|internet|pulsa/.test(c)) return '💡';
 if(/kesehatan|obat|dokter|vitamin|rumah sakit/.test(c)) return '💊';
 if(/pendidikan|sekolah|kursus|buku|belajar/.test(c)) return '📚';
 if(/hiburan|main|game|film|rekreasi/.test(c)) return '🎉';
 if(/rumah tangga|rumah|perabot|dapur|cleaning/.test(c)) return '🏠';
 if(/pakan hewan|hewan|kucing|pet/.test(c)) return '🐾';
 if(/gaji|salary|upah/.test(c)) return '💵';
 if(/bonus|hadiah|reward/.test(c)) return '🎁';
 if(/penjualan|jualan|jual|order|omzet/.test(c)) return '🛍️';
 if(/transfer|kirim uang/.test(c)) return '🔄';
 if(/investasi|saham|reksa|emas/.test(c)) return '📈';
 return '📁';
}

function iconClassFor(cat){
 const c=(cat||'').toLowerCase();
 if(/makan|minum|kuliner|kopi|jajan/.test(c)) return 'yellowbg';
 if(/transport|bensin|pertamax|parkir|ojek|motor/.test(c)) return 'bluebg';
 if(/grocer|sembako|belanja bulanan|sayur|buah/.test(c)) return 'greenbg';
 if(/tagihan|listrik|air|wifi|internet|pulsa/.test(c)) return 'yellowbg';
 if(/kesehatan|obat|dokter|vitamin|rumah sakit/.test(c)) return 'redbg';
 if(/pendidikan|sekolah|kursus|buku|belajar/.test(c)) return 'bluebg';
 if(/hiburan|main|game|film|rekreasi/.test(c)) return 'purplebg';
 if(/rumah tangga|rumah|perabot|dapur|cleaning/.test(c)) return 'greenbg';
 if(/pakan hewan|hewan|kucing|pet/.test(c)) return 'redbg';
 if(/gaji|salary|upah/.test(c)) return 'greenbg';
 if(/bonus|hadiah|reward/.test(c)) return 'purplebg';
 if(/penjualan|jualan|jual|order|omzet/.test(c)) return 'bluebg';
 if(/transfer|kirim uang/.test(c)) return 'yellowbg';
 if(/investasi|saham|reksa|emas/.test(c)) return 'bluebg';
 return 'greenbg';
}
function prettyDate(d){
 const s=String(d||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '-';
 const dt=new Date(s+'T12:00:00');
 return Number.isNaN(dt.getTime())?'-':dt.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
}

function renderReceipt(){
 return `<div class="receipt-box">
   <div id="receiptStage" class="receipt-stage">
     <div id="receiptMock" style="color:white;text-align:center"><div style="font-size:42px">▧</div><div style="font-size:12px;font-weight:800;margin-top:8px">Belum ada foto struk</div><div style="font-size:9px;opacity:.8;margin-top:4px">Ambil foto atau pilih dari galeri</div></div>
     <img id="receiptPreview" class="receipt-preview">
   </div>
   <input id="receiptFile" type="file" accept="image/*" capture="environment" hidden>
   <input id="receiptGallery" type="file" accept="image/*" hidden>
   <p class="list-sub" style="font-size:10px;margin:12px 0">Ambil foto struk untuk mengisi transaksi secara otomatis.</p>
   <button class="btn block" id="cameraBtn">📷 Ambil Foto</button>
   <button class="btn light block" id="galleryBtn" style="margin-top:8px">▧ Pilih dari Galeri</button>
   <button class="btn secondary block hidden" id="scanReceiptBtn" style="margin-top:8px">Scan & Isi Otomatis</button>
   <div id="ocrStatus" class="list-sub" style="margin-top:8px"></div>
 </div>`;
}

function renderMore(){
 const items=[
 ['accounts','Akun & Dompet','Bank, e-wallet, dan tunai'],
 ['plans','Budget & Target','Atur anggaran & tujuan'],
 ['assets','Investasi & Aset','Investasi, properti, fisik'],
 ['debts','Utang & Tagihan','Utang, jatuh tempo & pengeluaran rutin'],
 ['receipt','Foto Struk','Scan jadi transaksi'],
 ['reports','Laporan & Insight','Ringkasan keuangan'],
 ['categories','Kategori','Hingga 100 kategori'],
 ['settings','Pengaturan','Backup & data']
 ];
 return `<div class="menu-grid">${items.map(x=>`<button class="menu-card" data-nav="${x[0]}"><div class="mi mi-${x[0]}">${moreIcon(x[0])}</div><b>${x[1]}</b><small>${x[2]}</small></button>`).join('')}</div>`;
}

function moreIcon(page){
 const icons = {
  accounts: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M4 10h16"/><path d="M8 15h3"/></svg>`,
  plans: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 9v6"/><path d="M9 12h6"/></svg>`,
  assets: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18V6"/><path d="M5 18h14"/><path d="M7 15l4-4 3 2 4-6"/><path d="M14.5 7H18v3.5"/></svg>`,
  debts: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10"/><path d="M7 16h10"/><path d="M15 5l3 3-3 3"/><path d="M9 13l-3 3 3 3"/></svg>`,
  receipt: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16l-2-1-2 1-2-1-2 1-2-1z"/><path d="M9 9h6"/><path d="M9 13h6"/></svg>`,
  reports: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9"/><path d="M12 19V5"/><path d="M19 19v-8"/></svg>`,
  categories: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h4v4H7z"/><path d="M13 7h4v4h-4z"/><path d="M7 13h4v4H7z"/><path d="M13 13h4v4h-4z"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z"/><path d="M12 3v2.2"/><path d="M12 18.8V21"/><path d="M3 12h2.2"/><path d="M18.8 12H21"/><path d="M5.6 5.6l1.6 1.6"/><path d="M16.8 16.8l1.6 1.6"/><path d="M18.4 5.6l-1.6 1.6"/><path d="M7.2 16.8l-1.6 1.6"/></svg>`
 };
 return icons[page] || `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/></svg>`;
}

function closeModal(){$('#modal').classList.add('hidden');$('#modalBody').innerHTML=''}
function compressAccountLogo(file){
 return new Promise((resolve,reject)=>{
   if(!file){resolve('');return;}
   const reader=new FileReader();
   reader.onload=()=>{
     const img=new Image();
     img.onload=()=>{
       const size=160;
       const canvas=document.createElement('canvas');
       canvas.width=size;
       canvas.height=size;
       const ctx=canvas.getContext('2d');
       ctx.clearRect(0,0,size,size);
       const scale=Math.max(size/img.width,size/img.height);
       const w=img.width*scale,h=img.height*scale;
       const x=(size-w)/2,y=(size-h)/2;
       ctx.drawImage(img,x,y,w,h);
       resolve(canvas.toDataURL('image/png',0.9));
     };
     img.onerror=reject;
     img.src=reader.result;
   };
   reader.onerror=reject;
   reader.readAsDataURL(file);
 });
}

function normalizeTargetLink(url){
 let u=String(url||'').trim();
 if(!u)return '';
 if(!/^https?:\/\//i.test(u))u='https://'+u;
 return u;
}

function compressGoalImage(file){
 return new Promise((resolve,reject)=>{
   if(!file){resolve('');return;}
   const reader=new FileReader();
   reader.onload=()=>{
     const img=new Image();
     img.onload=()=>{
       const max=420;
       const scale=Math.min(1,max/Math.max(img.width,img.height));
       const canvas=document.createElement('canvas');
       canvas.width=Math.max(1,Math.round(img.width*scale));
       canvas.height=Math.max(1,Math.round(img.height*scale));
       const ctx=canvas.getContext('2d');
       ctx.clearRect(0,0,canvas.width,canvas.height);
       ctx.drawImage(img,0,0,canvas.width,canvas.height);
       resolve(canvas.toDataURL('image/jpeg',0.82));
     };
     img.onerror=reject;
     img.src=reader.result;
   };
   reader.onerror=reject;
   reader.readAsDataURL(file);
 });
}

const categoryIconChoices=[
 '🍜','🍚','🍗','🍔','🍕','☕','🧋','🍰',
 '🛵','🚗','⛽','🚌','🚆','✈️',
 '🛒','🛍️','👕','👟','💄','🧴',
 '💡','📱','🌐','💧','🏠','🧹',
 '💊','🩺','🏥','🧘',
 '📚','✏️','🎓','💻',
 '🎉','🎬','🎮','🎵','📷',
 '🐾','🐱','🐶','🐟',
 '💵','💰','🎁','📈','🪙','🏦',
 '🔄','💳','🧾','📁','❤️','⭐'
];

function categoryIconPicker(selected='📁'){
 return `<div class="field">
   <label>Pilih Ikon</label>
   <input type="hidden" name="icon" id="categoryIconValue" value="${selected}">
   <div class="category-icon-picker">
     ${categoryIconChoices.map(icon=>`<button type="button" class="category-icon-choice ${icon===selected?'selected':''}" data-category-icon="${icon}">${icon}</button>`).join('')}
   </div>
 </div>`;
}

function openCategoryModal(){
 if(state.categories.length>=100)return toast('Maksimal 100 kategori');
 openModal('Tambah Kategori',
 `<form class="form">
   <div class="field">
     <label>Nama Kategori</label>
     <input name="name" maxlength="40" placeholder="Contoh: Skincare" required>
   </div>
   ${categoryIconPicker('📁')}
   <button class="btn block">Simpan Kategori</button>
 </form>`,
 fd=>{
   const n=String(fd.get('name')).trim();
   const icon=String(fd.get('icon')||'📁');
   if(!n)return;
   if(state.categories.some(x=>x.toLowerCase()===n.toLowerCase())){
     toast('Kategori sudah ada.');
     return;
   }
   state.categories.push(n);
   state.categoryIcons=state.categoryIcons||{};
   state.categoryIcons[n]=icon;
   save();
   closeModal();
   render();
 });
 setTimeout(()=>{
   $$('#modalBody [data-category-icon]').forEach(btn=>{
     btn.onclick=()=>{
       $$('#modalBody [data-category-icon]').forEach(x=>x.classList.remove('selected'));
       btn.classList.add('selected');
       $('#categoryIconValue').value=btn.dataset.categoryIcon;
     };
   });
 },0);
}

function parseAmount(text){const s=text.toLowerCase().replace(/\./g,'').replace(/,/g,'.');let m=s.match(/(\d+(?:\.\d+)?)\s*(juta|jt)\b/);if(m)return Math.round(parseFloat(m[1])*1e6);m=s.match(/(\d+(?:\.\d+)?)\s*(ribu|rb|k)\b/);if(m)return Math.round(parseFloat(m[1])*1e3);m=s.match(/(?:rp\s*)?(\d{4,})/);return m?Number(m[1]):0}
function inferCategory(text,type){const t=text.toLowerCase(),rules=[['Makan & Minum',['makan','kopi','minum','bakso','mie','nasi','dimsum']],['Transportasi',['bensin','pertamax','parkir','ojek','transport']],['Groceries',['belanja','groceries','sayur','sembako']],['Listrik',['listrik','token']],['Tagihan',['wifi','internet','pdam','tagihan']],['Pakan Hewan',['kucing','pakan']],['Gaji',['gaji']],['Penjualan',['jualan','jual']]];for(const [c,k] of rules)if(k.some(x=>t.includes(x)))return c;return'Lainnya'}
let receiptDataUrl='';
async function handleReceiptFile(e){const f=e.target.files?.[0];if(!f)return;receiptDataUrl=await compressImage(f);$('#receiptMock').style.display='none';const p=$('#receiptPreview');p.src=receiptDataUrl;p.style.display='block';$('#scanReceiptBtn').classList.remove('hidden');$('#ocrStatus').textContent='Foto siap discan.'}
function compressImage(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const max=1280,s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.8))};im.onerror=rej;im.src=r.result};r.onerror=rej;r.readAsDataURL(file)})}
function scanReceipt(){if(!receiptDataUrl)return;$('#ocrStatus').textContent='Membaca struk...';try{window.Native?.scanReceipt?Native.scanReceipt(receiptDataUrl):toast('OCR aktif saat APK dijalankan')}catch(e){toast('OCR gagal')}}
window.onReceiptOCR=text=>{const p=parseReceiptText(text);navigate('addTransaction');setTimeout(()=>{$('#txType').value='expense';setTxType('expense');$('#txAmount').value=p.amount||'';$('[name=note]').value=p.merchant||'Belanja dari struk'},80)}
window.onReceiptOCRError=msg=>toast(msg)
function parseReceiptText(text){const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),merchant=lines.find(x=>/[A-Za-z]/.test(x)&&x.length>2)?.slice(0,50)||'Belanja dari struk';let nums=[...text.replace(/\./g,'').matchAll(/(?:rp\s*)?(\d{4,})/ig)].map(m=>Number(m[1])).filter(n=>n<1e9);return{merchant,amount:nums.length?Math.max(...nums):0}}

function createBackupPayloadV81(){
 return {
   format:'UangKuBackup',
   schemaVersion:BACKUP_SCHEMA_VERSION,
   appVersion:APP_VERSION,
   exportedAt:new Date().toISOString(),
   data:clone(state)
 };
}

function validateBackupDataV81(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Struktur backup tidak valid.');
 const known=['accounts','transactions','budgets','goals','assets','debts','bills','routines','chat','categories'];
 if(!known.some(k=>k in data))throw new Error('File ini tidak terlihat seperti backup UangKu.');
 return true;
}

function parseBackupPayloadV81(raw){
 const payload=raw&&typeof raw==='object'?raw:null;
 if(!payload)throw new Error('File JSON tidak valid.');

 if(payload.format==='UangKuBackup'){
   const schema=Number(payload.schemaVersion)||0;
   if(schema>BACKUP_SCHEMA_VERSION){
     throw new Error(`Backup dibuat oleh UangKu yang lebih baru (schema ${schema}). Update aplikasi terlebih dahulu.`);
   }
   validateBackupDataV81(payload.data);
   return {
     schema,
     appVersion:String(payload.appVersion||''),
     legacy:false,
     data:normalizeState(payload.data)
   };
 }

 validateBackupDataV81(payload);
 return {
   schema:Number(payload.schemaVersion)||0,
   appVersion:'',
   legacy:true,
   data:normalizeState(payload)
 };
}

function backupSummaryV81(data){
 return [
   `${(data.accounts||[]).length} akun`,
   `${(data.transactions||[]).length} transaksi`,
   `${(data.goals||[]).length} target`,
   `${(data.debts||[]).length} utang/piutang`,
   `${(data.bills||[]).length} tagihan`,
   `${(data.routines||[]).length} rutin`
 ].join(' • ');
}

function exportJSON(){
 const json=JSON.stringify(createBackupPayloadV81(),null,2);
 try{
   if(window.Native?.exportJson){
     Native.exportJson(json);
     return;
   }
 }catch(e){}

 const blob=new Blob([json],{type:'application/json'});
 const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);
 a.download=`uangku-backup-v8.1-${today()}.json`;
 a.click();
 URL.revokeObjectURL(a.href);
}
window.onExportDone=()=>toast('Backup versi 8.1 berhasil disimpan.');
window.onExportError=()=>toast('Backup gagal');

function importJSON(e){
 const input=e.target;
 const f=input.files?.[0];
 if(!f)return;

 const r=new FileReader();
 r.onload=()=>{
   try{
     const parsed=parseBackupPayloadV81(JSON.parse(r.result));
     const versionLabel=parsed.legacy
       ?'backup lama UangKu'
       :`backup schema ${parsed.schema}${parsed.appVersion?` • app ${parsed.appVersion}`:''}`;

     openConfirm(
       'Pulihkan Backup',
       `Terdeteksi ${versionLabel}. ${backupSummaryV81(parsed.data)}. Memulihkan backup akan mengganti data UangKu yang sedang aktif.`,
       'Pulihkan',
       ()=>{
         state=parsed.data;
         save();
         toast('Data berhasil dipulihkan.');
         navigate('home',{instant:true});
       }
     );
   }catch(err){
     console.error('importJSON',err);
     openInfo('Backup tidak bisa dipulihkan',err?.message||'File JSON tidak valid.');
   }finally{
     input.value='';
   }
 };
 r.onerror=()=>{
   input.value='';
   toast('File backup tidak dapat dibaca.');
 };
 r.readAsText(f);
}


function getBudgetUsage(k=monthKey()){
 const budgets=state.budgets.filter(x=>x&&x.month===k);
 if(!budgets.length)return 0;
 let used=0,limit=0;
 budgets.forEach(b=>{
   const lim=Math.max(0,Number(b.limit)||0);
   limit+=lim;
   used+=state.transactions
     .filter(t=>t&&t.type==='expense'&&t.category===b.category&&monthKey(t.date)===b.month)
     .reduce((s,t)=>s+(Number(t.amount)||0),0);
 });
 return limit>0?Math.round(used/limit*100):0;
}

function debtTotalAmount(d){
 if(!d)return 0;
 const hasBreakdown=d.principal!==undefined||d.interest!==undefined||d.admin!==undefined;
 return Math.max(0,hasBreakdown
   ?(Number(d.principal)||0)+(Number(d.interest)||0)+(Number(d.admin)||0)
   :(Number(d.amount)||0));
}

function debtOutstanding(d){
 if(!d||d.status==='paid')return 0;
 return Math.max(0,debtTotalAmount(d)-(Number(d.paid)||0));
}

function debtTotals(){
 let payable=0,receivable=0;
 state.debts.forEach(d=>{
   const left=debtOutstanding(d);
   d.type==='receivable'?receivable+=left:payable+=left;
 });
 return {payable,receivable};
}

function monthLabel(k){
 const m=/^(\d{4})-(\d{2})$/.exec(String(k||''));
 if(!m)return 'Bulan';
 const d=new Date(Number(m[1]),Number(m[2])-1,1);
 return d.toLocaleDateString('id-ID',{month:'long',year:'numeric'});
}

function shortMonthLabel(k){
 const m=/^(\d{4})-(\d{2})$/.exec(String(k||''));
 if(!m)return '-';
 const d=new Date(Number(m[1]),Number(m[2])-1,1);
 return d.toLocaleDateString('id-ID',{month:'short'});
}

function shiftMonth(k,delta){
 const m=/^(\d{4})-(\d{2})$/.exec(String(k||''));
 const d=m?new Date(Number(m[1]),Number(m[2])-1+delta,1):new Date();
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function monthSequence(endKey,count=6){
 const out=[];
 for(let i=count-1;i>=0;i--)out.push(shiftMonth(endKey,-i));
 return out;
}

function privacyMoney(n){return balanceHidden?'***':fmt(n)}
function numInputValue(n){return Number(n)>0?String(Number(n)):''}

function goalVisual(g,small=false){
 if(g?.image)return `<div class="goal-image ${small?'mini':''}"><img src="${g.image}" alt="${esc(g.name||'Target')}"></div>`;
 return `<div class="goal-image placeholder ${small?'mini':''}">${esc(g?.logo||'🎯')}</div>`;
}

function renderPeriodControl(id,k){
 return `<div class="period-control">
   <button type="button" class="period-arrow" data-period-prev="${id}" aria-label="Bulan sebelumnya">‹</button>
   <label class="period-label">
     <span>${monthLabel(k)}</span>
     <input type="month" id="${id}" value="${k}">
   </label>
   <button type="button" class="period-arrow" data-period-next="${id}" aria-label="Bulan berikutnya">›</button>
 </div>`;
}

const budgetPalette=['#61B96C','#F2BC4A','#6E9FE6','#9B83E5','#EC7D7D','#53B8A8','#E09250','#7CB1B7'];

function budgetAllocation(budgets){
 const total=budgets.reduce((s,b)=>s+Math.max(0,Number(b.limit)||0),0);
 return budgets.map((b,i)=>({
   ...b,
   color:budgetPalette[i%budgetPalette.length],
   share:total>0?(Math.max(0,Number(b.limit)||0)/total*100):0
 }));
}

function budgetGradient(budgets){
 const parts=budgetAllocation(budgets);
 if(!parts.length)return '#E8EFE6';
 let pos=0;
 return `conic-gradient(${parts.map(x=>{
   const start=pos;
   pos+=x.share;
   return `${x.color} ${start.toFixed(2)}% ${pos.toFixed(2)}%`;
 }).join(',')})`;
}

const assetTypeChoices={
 investment:[
   ['Saham','📊'],
   ['Reksa Dana Pasar Uang (RDPU)','💵'],
   ['Obligasi','📜'],
   ['SBN / Surat Berharga Negara','🇮🇩'],
   ['ETF','📈'],
   ['Deposito','🏦'],
   ['Emas digital','🪙'],
   ['Lainnya','✨']
 ],
 property:[
   ['Rumah','🏠'],
   ['Tanah','🌳'],
   ['Sawah','🌾'],
   ['Kos/kontrakan','🏘️'],
   ['Ruko','🏬']
 ],
 physical:[
   ['Emas & logam mulia','🪙'],
   ['Kendaraan','🚗'],
   ['Perhiasan','💍'],
   ['Barang elektronik bernilai','💻'],
   ['Barang koleksi','⌚'],
   ['Peralatan usaha','⚙️'],
   ['Ternak','🐄'],
   ['Aset pertanian','🚜'],
   ['Barang berharga lainnya','📦']
 ]
};

function assetKindLabel(a){
 if(!a)return 'Lainnya';
 return a.kind==='Lainnya'&&a.customKind?a.customKind:(a.kind||'Lainnya');
}

function assetIcon(tab,a){
 const label=a?.kind||'';
 const found=(assetTypeChoices[tab]||[]).find(x=>x[0]===label);
 if(found)return found[1];
 if(tab==='investment')return '📈';
 if(tab==='property')return '🏠';
 return '📦';
}

function debtMeta(d){
 const bits=[];
 if((Number(d?.principal)||0)>0)bits.push(`Pokok ${fmt(d.principal)}`);
 if((Number(d?.interest)||0)>0)bits.push(`Bunga ${fmt(d.interest)}`);
 if((Number(d?.admin)||0)>0)bits.push(`Admin ${fmt(d.admin)}`);
 if((Number(d?.installments)||0)>1)bits.push(`${Number(d.installments)}x cicilan`);
 if(d?.dueDate)bits.push(`Jatuh tempo ${prettyDate(d.dueDate)}`);
 return bits.join(' • ');
}

function safeDateValue(v){
 const s=String(v||'');
 return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'9999-12-31';
}

function addMonthsToDate(dateStr,months=1){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr||''));
 if(!m)return '';
 const y=Number(m[1]),mo=Number(m[2])-1,day=Number(m[3]);
 const first=new Date(y,mo+months,1);
 const lastDay=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 const d=new Date(first.getFullYear(),first.getMonth(),Math.min(day,lastDay));
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function scheduleBillReminder(b){
 if(!b?.notificationEnabled||!b?.dueDate)return;
 try{
   const daysBefore=b.notifyTiming==='day_before'?1:0;
   if(window.Native?.scheduleBillAdvanced){
     Native.scheduleBillAdvanced(b.id,b.name,fmt(b.amount),b.dueDate,b.recurrence==='monthly',daysBefore);
   }else if(window.Native?.scheduleBill){
     Native.scheduleBill(b.id,b.name,fmt(b.amount),b.dueDate);
   }
 }catch(e){console.warn('scheduleBillReminder',e)}
}

function cancelBillReminder(id){
 try{window.Native?.cancelBill&&Native.cancelBill(id)}catch(e){console.warn('cancelBillReminder',e)}
}

function billIcon(name){
 const n=String(name||'').toLowerCase();
 if(/listrik/.test(n))return '💡';
 if(/wifi|internet/.test(n))return '🌐';
 if(/air|pdam/.test(n))return '💧';
 if(/pulsa|data|telepon/.test(n))return '📱';
 if(/cicilan|paylater|kredit/.test(n))return '💳';
 if(/sewa|kontrak/.test(n))return '🏠';
 return '🧾';
}

function renderDebtsBills(){
 const body=debtTab==='bills'
   ?renderBillsInner()
   :debtTab==='routines'
     ?renderRoutinesInner()
     :renderDebtsInner();

 return `<div class="tabs debt-tabs-v81">
   <button class="tab ${debtTab==='debts'?'active':''}" data-debt-tab="debts">Utang</button>
   <button class="tab ${debtTab==='bills'?'active':''}" data-debt-tab="bills">Tagihan</button>
   <button class="tab ${debtTab==='routines'?'active':''}" data-debt-tab="routines">Rutin</button>
 </div>
 ${body}`;
}

function reportConclusion(k,m,budgetPct,debt,billsDue){
 const points=[];
 if(m.income===0&&m.expense===0){
   points.push(`Belum ada transaksi pada ${monthLabel(k)}.`);
 }else if(m.net>=0){
   points.push(`Arus kas positif ${fmt(m.net)}. Pemasukan masih lebih besar daripada pengeluaran.`);
 }else{
   points.push(`Arus kas defisit ${fmt(Math.abs(m.net))}. Pengeluaran lebih besar daripada pemasukan.`);
 }
 if(getBudgetTotal(k)>0){
   if(budgetPct>100)points.push(`Budget terlewati: pemakaian mencapai ${budgetPct}%.`);
   else if(budgetPct>=80)points.push(`Budget sudah terpakai ${budgetPct}%, jadi ruang pengeluaran mulai sempit.`);
   else points.push(`Pemakaian budget ${budgetPct}% dan masih berada di bawah batas.`);
 }
 if(debt.payable>0)points.push(`Masih ada liabilitas utang ${fmt(debt.payable)}.`);
 if(billsDue>0)points.push(`Tagihan yang jatuh tempo bulan ini berjumlah ${fmt(billsDue)}.`);
 return points;
}

function getBudgetTotal(k){
 return state.budgets.filter(b=>b&&b.month===k).reduce((s,b)=>s+(Number(b.limit)||0),0);
}

function reportBars(endKey){
 const keys=monthSequence(endKey,6);
 const rows=keys.map(k=>({k,...monthTotals(k)}));
 const max=Math.max(1,...rows.flatMap(x=>[x.income,x.expense]));
 return `<div class="bar-chart">
   <div class="chart-legend"><span><i class="income-dot"></i>Pemasukan</span><span><i class="expense-dot"></i>Pengeluaran</span></div>
   <div class="bar-plot">
     ${rows.map(x=>`<div class="bar-group">
       <div class="bar-pair">
         <i class="report-bar income" style="height:${x.income?Math.max(6,Math.round(x.income/max*100)):2}%"></i>
         <i class="report-bar expense" style="height:${x.expense?Math.max(6,Math.round(x.expense/max*100)):2}%"></i>
       </div>
       <small>${shortMonthLabel(x.k)}</small>
     </div>`).join('')}
   </div>
 </div>`;
}

function bindNumericInputUX(scope=document){
 const els=scope?.querySelectorAll?scope.querySelectorAll('input[type="number"]'):[];
 [...els].forEach(el=>{
   el.setAttribute('inputmode','decimal');
   el.addEventListener('focus',function(){
     if(this.value==='0')this.value='';
   });
 });
}

function openModal(title,html,onSubmit){
 $('#modalTitle').textContent=title;
 $('#modalBody').innerHTML=html;
 $('#modal').classList.remove('hidden');
 $$('[data-close-modal]').forEach(b=>b.onclick=closeModal);
 const f=$('#modalBody form');
 if(f&&onSubmit)f.onsubmit=e=>{
   e.preventDefault();
   onSubmit(new FormData(f));
 };
 bindNumericInputUX($('#modalBody'));
}

function openConfirm(title,text,confirmText,onConfirm){
 openModal(title,`<div class="confirm-box">
   <div class="confirm-icon">!</div>
   <p>${esc(text)}</p>
   <div class="row">
     <button type="button" class="btn light" data-close-modal>Batal</button>
     <button type="button" class="btn danger" id="confirmActionBtn">${esc(confirmText||'Hapus')}</button>
   </div>
 </div>`);
 setTimeout(()=>{
   $('#confirmActionBtn')&&($('#confirmActionBtn').onclick=()=>{
     closeModal();
     onConfirm&&onConfirm();
   });
   $$('[data-close-modal]').forEach(b=>b.onclick=closeModal);
 },0);
}

function openInfo(title,text){
 openModal(title,`<div class="confirm-box">
   <div class="confirm-icon info">i</div>
   <p>${esc(text)}</p>
   <button type="button" class="btn secondary block" data-close-modal>Oke</button>
 </div>`);
 $$('[data-close-modal]').forEach(b=>b.onclick=closeModal);
}

function openAmountEntry(title,label,onSave){
 openModal(title,`<form class="form">
   <div class="field"><label>${esc(label)}</label><input type="number" name="amount" min="1" placeholder="Masukkan nominal" required></div>
   <button class="btn block">Simpan</button>
 </form>`,fd=>{
   const n=Number(fd.get('amount')||0);
   if(n<=0)return toast('Nominal harus lebih dari 0.');
   onSave(n);
   closeModal();
   render();
 });
}

function requestDeleteAccount(id){
 const a=state.accounts.find(x=>x.id===id);
 if(!a)return;
 const bal=accountBalance(id);
 if(Math.abs(bal)>0.5){
   openInfo('Akun belum bisa dihapus',`Akun ${a.name} masih memiliki saldo ${fmt(bal)}. Pindahkan atau habiskan saldonya sampai Rp 0 terlebih dahulu.`);
   return;
 }
 openConfirm('Hapus Akun',`Hapus akun ${a.name}? Akun dengan saldo Rp 0 bisa dihapus. Riwayat transaksi lama tetap tersimpan.`,`Hapus`,()=>{
   state.accounts=state.accounts.filter(x=>x.id!==id);
   state.transactions.forEach(t=>{if(t.accountId===id)t.accountId=''});
   save();toast('Akun dihapus.');render();
 });
}

function openBudgetModal(editId=''){
 const b=editId?state.budgets.find(x=>x.id===editId):null;
 openModal(b?'Edit Budget':'Atur Budget',`<form class="form">
   <div class="field"><label>Bulan</label><input type="month" name="month" value="${b?.month||planPeriod}" required></div>
   <div class="field"><label>Kategori</label><select name="category">${state.categories.map(c=>`<option ${b?.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
   <div class="field"><label>Batas Budget</label><input type="number" name="limit" min="1" value="${numInputValue(b?.limit)}" placeholder="Masukkan batas budget" required></div>
   <div class="list-sub">Persentase pada kartu = pengeluaran kategori ÷ batas budget. Diagram lingkaran = porsi nominal tiap budget terhadap total budget.</div>
   <button class="btn block">${b?'Simpan Perubahan':'Simpan Budget'}</button>
 </form>`,fd=>{
   const month=String(fd.get('month')||''),category=String(fd.get('category')||''),limit=Number(fd.get('limit')||0);
   if(!month||!category||limit<=0)return toast('Isi budget dengan benar.');
   const duplicate=state.budgets.find(x=>x.id!==b?.id&&x.month===month&&x.category===category);
   if(duplicate)return toast('Budget kategori ini sudah ada pada bulan tersebut.');
   if(b)Object.assign(b,{month,category,limit});
   else state.budgets.push({id:uid(),month,category,limit});
   planPeriod=month;localStorage.setItem('uangku_plan_period',planPeriod);
   save();closeModal();toast(b?'Budget diperbarui.':'Budget ditambahkan.');render();
 });
}

const goalLogoChoices=['🎯','💻','📱','🏠','🚗','🛵','✈️','🎓','💍','📷','🛋️','🧳','💰','🎁','⭐','🌱'];

function goalLogoPicker(selected='🎯'){
 return `<div class="field"><label>Pilih Logo Target</label>
   <input type="hidden" id="goalLogoValue" name="logo" value="${esc(selected||'🎯')}">
   <div class="goal-logo-picker">
     ${goalLogoChoices.map(x=>`<button type="button" class="goal-logo-choice ${x===selected?'selected':''}" data-goal-logo="${x}">${x}</button>`).join('')}
   </div>
 </div>`;
}

function assetOptionsHTML(tab,selected=''){
 return (assetTypeChoices[tab]||[]).map(([label])=>`<option value="${esc(label)}" ${selected===label?'selected':''}>${esc(label)}</option>`).join('');
}

function openDebtModal(editId=''){
 const d=editId?state.debts.find(x=>x.id===editId):null;
 const principal=d?.principal!==undefined?Number(d.principal)||0:Number(d?.amount)||0;

 openModal(d?'Edit Utang / Piutang':'Tambah Utang / Piutang',`<form class="form">
   <div class="field"><label>Jenis</label><select name="type">
     <option value="payable" ${d?.type!=='receivable'?'selected':''}>Utang Saya</option>
     <option value="receivable" ${d?.type==='receivable'?'selected':''}>Piutang</option>
   </select></div>
   <div class="field"><label>Nama Pihak</label><input name="person" value="${esc(d?.person||'')}" required placeholder="Bank, paylater, teman, dll."></div>
   <div class="field"><label>Pokok</label><input type="number" name="principal" min="1" value="${numInputValue(principal)}" placeholder="Nominal pokok" required></div>
   <div class="row">
     <div class="field"><label>Bunga</label><input type="number" name="interest" min="0" value="${numInputValue(d?.interest)}" placeholder="Opsional"></div>
     <div class="field"><label>Biaya Admin</label><input type="number" name="admin" min="0" value="${numInputValue(d?.admin)}" placeholder="Opsional"></div>
   </div>
   <div class="field"><label>Jumlah Cicilan</label><input type="number" name="installments" min="1" value="${numInputValue(d?.installments)}" placeholder="Contoh: 12 (kosong jika bukan cicilan)"></div>
   <div class="field"><label>Jatuh Tempo</label><input type="date" name="dueDate" value="${esc(d?.dueDate||'')}"></div>
   <div class="field"><label>Catatan</label><input name="note" value="${esc(d?.note||'')}" placeholder="Opsional"></div>
   <div class="form-note">Total kewajiban akan dihitung dari pokok + bunga + biaya admin.</div>
   <button class="btn block">${d?'Simpan Perubahan':'Simpan'}</button>
 </form>`,fd=>{
   const principal=Number(fd.get('principal')||0),interest=Number(fd.get('interest')||0),admin=Number(fd.get('admin')||0);
   const amount=principal+interest+admin;
   if(principal<=0)return toast('Nominal pokok harus diisi.');
   const payload={
     type:fd.get('type')==='receivable'?'receivable':'payable',
     person:String(fd.get('person')||'').trim(),
     principal,interest,admin,amount,
     installments:Number(fd.get('installments')||0),
     dueDate:String(fd.get('dueDate')||''),
     note:String(fd.get('note')||'')
   };
   if(!payload.person)return toast('Nama pihak wajib diisi.');
   if(d){
     Object.assign(d,payload);
     d.paid=Math.min(Number(d.paid)||0,amount);
     d.status=d.paid>=amount?'paid':'active';
   }else state.debts.push({id:uid(),...payload,paid:0,status:'active',paidDate:''});
   save();closeModal();toast(d?'Catatan diperbarui.':'Catatan ditambahkan.');render();
 });
}

function markDebtPaid(id){
 const d=state.debts.find(x=>x.id===id);if(!d)return;
 openConfirm('Tandai Lunas',`Tandai ${d.type==='payable'?'utang':'piutang'} ${d.person} sebagai lunas?`,'Tandai Lunas',()=>{
   d.paid=debtTotalAmount(d);d.status='paid';d.paidDate=today();save();toast('Ditandai lunas.');render();
 });
}

function requestDeleteDebt(id){
 const d=state.debts.find(x=>x.id===id);if(!d)return;
 openConfirm('Hapus Catatan',`Hapus catatan ${d.person}?`,'Hapus',()=>{
   state.debts=state.debts.filter(x=>x.id!==id);save();toast('Catatan dihapus.');render();
 });
}

function openBillModal(editId=''){
 const b=editId?state.bills.find(x=>x.id===editId):null;
 openModal(b?'Edit Tagihan':'Tambah Tagihan',`<form class="form">
   <div class="field"><label>Nama Tagihan</label><input name="name" value="${esc(b?.name||'')}" required placeholder="Contoh: WiFi / BPJS / Air pascabayar"></div>
   <div class="field"><label>Nominal</label><input type="number" name="amount" min="1" value="${numInputValue(b?.amount)}" placeholder="Masukkan nominal" required></div>
   <div class="field"><label>Jatuh Tempo</label><input type="date" name="dueDate" value="${esc(b?.dueDate||'')}" required></div>
   <div class="field"><label>Pengulangan</label><select name="recurrence">
     <option value="once" ${b?.recurrence!=='monthly'?'selected':''}>Sekali</option>
     <option value="monthly" ${b?.recurrence==='monthly'?'selected':''}>Berulang setiap bulan</option>
   </select></div>
   <div class="form-note">Tagihan dipakai untuk kewajiban yang punya jatuh tempo. Untuk token listrik, bensin, pakan hewan, dan kebutuhan dengan tanggal fleksibel, gunakan tab <b>Rutin</b>.</div>
   <div class="notification-setting">
     <label class="checkbox-row"><input type="checkbox" name="notificationEnabled" ${b?.notificationEnabled===false?'':'checked'}><span>Aktifkan notifikasi jatuh tempo</span></label>
     <select name="notifyTiming">
       <option value="due" ${b?.notifyTiming!=='day_before'?'selected':''}>Saat tanggal jatuh tempo</option>
       <option value="day_before" ${b?.notifyTiming==='day_before'?'selected':''}>1 hari sebelum jatuh tempo</option>
     </select>
   </div>
   <div class="field"><label>Catatan</label><input name="note" value="${esc(b?.note||'')}" placeholder="Opsional"></div>
   <button class="btn block">${b?'Simpan Perubahan':'Simpan Tagihan'}</button>
 </form>`,fd=>{
   const payload={
     name:String(fd.get('name')||'').trim(),
     amount:Number(fd.get('amount')||0),
     dueDate:String(fd.get('dueDate')||''),
     recurrence:fd.get('recurrence')==='monthly'?'monthly':'once',
     notificationEnabled:fd.get('notificationEnabled')==='on',
     notifyTiming:fd.get('notifyTiming')==='day_before'?'day_before':'due',
     note:String(fd.get('note')||'')
   };
   if(!payload.name||payload.amount<=0||!payload.dueDate)return toast('Lengkapi tagihan dengan benar.');

   let target=b;
   if(target){
     Object.assign(target,payload);
     if(target.status==='paid')target.status='active';
   }else{
     target={id:uid(),...payload,status:'active',paidDate:'',lastPaidDate:'',lastPaidDueDate:''};
     state.bills.push(target);
   }

   if(target.notificationEnabled)scheduleBillReminder(target);
   else cancelBillReminder(target.id);

   save();closeModal();toast(b?'Tagihan diperbarui.':'Tagihan ditambahkan.');render();
 });
}

function markBillPaid(id){
 const b=state.bills.find(x=>x.id===id);if(!b)return;
 openConfirm('Tandai Lunas',`Tandai tagihan ${b.name} sebagai lunas?`,'Tandai Lunas',()=>{
   if(b.recurrence==='monthly'){
     b.lastPaidDate=today();
     b.lastPaidDueDate=b.dueDate;
     b.dueDate=addMonthsToDate(b.dueDate,1);
     b.status='active';
     if(b.notificationEnabled)scheduleBillReminder(b);
     toast('Lunas. Jatuh tempo berikutnya sudah dibuat.');
   }else{
     b.status='paid';b.paidDate=today();cancelBillReminder(b.id);toast('Tagihan ditandai lunas.');
   }
   save();render();
 });
}

function requestDeleteBill(id){
 const b=state.bills.find(x=>x.id===id);if(!b)return;
 openConfirm('Hapus Tagihan',`Hapus tagihan ${b.name}?`,'Hapus',()=>{
   cancelBillReminder(id);
   state.bills=state.bills.filter(x=>x.id!==id);
   save();toast('Tagihan dihapus.');render();
 });
}

function bindPage(){
 ensureCategoryGroupsV63();

 $$('[data-nav]').forEach(btn=>btn.onclick=()=>navigate(btn.dataset.nav));

 $('#toggleBalanceBtn')&&($('#toggleBalanceBtn').onclick=toggleBalanceVisibility);
 $('#toggleNetWorthDetail')&&($('#toggleNetWorthDetail').onclick=()=>{
   netWorthExpanded=!netWorthExpanded;
   localStorage.setItem('uangku_networth_expanded',netWorthExpanded?'1':'0');
   render();
 });
 $('#includeAssetsToggle')&&($('#includeAssetsToggle').onchange=e=>{
   includeInvestmentAssets=!!e.target.checked;
   localStorage.setItem('uangku_include_investment_assets',includeInvestmentAssets?'1':'0');
   render();
 });

 const bindPeriod=(id,get,set)=>{
   const input=$('#'+id);
   if(input){
     input.onchange=e=>{
       if(/^\d{4}-\d{2}$/.test(e.target.value)){
         set(e.target.value);
         render();
       }
     };
   }
   $$(`[data-period-prev="${id}"]`).forEach(btn=>btn.onclick=()=>{
     set(shiftMonth(get(),-1));
     render();
   });
   $$(`[data-period-next="${id}"]`).forEach(btn=>btn.onclick=()=>{
     set(shiftMonth(get(),1));
     render();
   });
 };
 bindPeriod('homeMonthInput',()=>homePeriod,v=>{
   homePeriod=v;
   localStorage.setItem('uangku_home_period',v);
 });
 bindPeriod('planMonthInput',()=>planPeriod,v=>{
   planPeriod=v;
   localStorage.setItem('uangku_plan_period',v);
 });
 bindPeriod('reportMonthInput',()=>reportPeriod,v=>{
   reportPeriod=v;
   localStorage.setItem('uangku_report_period',v);
 });

 $$('[data-tx-filter]').forEach(btn=>btn.onclick=()=>{
   txFilter=btn.dataset.txFilter;
   render();
 });

 $('#typeIncome')&&($('#typeIncome').onclick=()=>setTxType('income'));
 $('#typeExpense')&&($('#typeExpense').onclick=()=>setTxType('expense'));
 $('#typeTransfer')&&($('#typeTransfer').onclick=()=>setTxType('transfer'));

 $('#txCategory')&&($('#txCategory').onchange=()=>{
   syncDebtPanelsV62();
   syncSalesPaymentPanelV73();
 });
 syncDebtPanelsV62();
 syncSalesPaymentPanelV73();

 if(currentPage==='addTransaction'&&$('#txForm')){
   $('#txForm').onsubmit=e=>{
     e.preventDefault();
     saveManualTransactionV62(e.target);
   };
 }

 $$('[data-add-amount]').forEach(btn=>btn.onclick=()=>{
   const input=$('#txAmount');
   if(input)input.value=Number(input.value||0)+Number(btn.dataset.addAmount||0);
 });

 $$('[data-edit-tx]').forEach(btn=>btn.onclick=()=>openEditTransactionModal(btn.dataset.editTx));
 $$('[data-delete-tx]').forEach(btn=>btn.onclick=()=>requestDeleteTransaction(btn.dataset.deleteTx));

 $('#sendChat')&&($('#sendChat').onclick=sendChat);
 $('#chatInput')&&($('#chatInput').onkeydown=e=>{
   if(e.key==='Enter')sendChat();
 });
 $('#voiceBtn')&&($('#voiceBtn').onclick=()=>navigate('voice'));
 $$('.suggestion').forEach(btn=>btn.onclick=()=>{
   const input=$('#chatInput');
   if(input){
     input.value=btn.textContent;
     sendChat();
   }
 });
 if(currentPage==='voice'){
   startVoice();
   $('#voiceStop')&&($('#voiceStop').onclick=()=>navigate('assistant'));
 }

 $('#cameraBtn')&&($('#cameraBtn').onclick=()=>$('#receiptFile')?.click());
 $('#galleryBtn')&&($('#galleryBtn').onclick=()=>$('#receiptGallery')?.click());
 $('#receiptFile')&&($('#receiptFile').onchange=handleReceiptFile);
 $('#receiptGallery')&&($('#receiptGallery').onchange=handleReceiptFile);
 $('#scanReceiptBtn')&&($('#scanReceiptBtn').onclick=scanReceipt);

 $('#addAccountBtn')&&($('#addAccountBtn').onclick=()=>openAccountModal());
 $$('[data-edit-account]').forEach(btn=>btn.onclick=()=>openAccountModal(btn.dataset.editAccount));
 $$('[data-delete-account]').forEach(btn=>btn.onclick=()=>requestDeleteAccount(btn.dataset.deleteAccount));

 $$('[data-plan-tab]').forEach(btn=>btn.onclick=()=>{
   planTab=btn.dataset.planTab==='goal'?'goal':'budget';
   render();
 });
 $$('[data-plan-link]').forEach(btn=>btn.onclick=()=>{
   planTab=btn.dataset.planLink==='goal'?'goal':'budget';
   if(planTab==='budget'){
     planPeriod=homePeriod;
     localStorage.setItem('uangku_plan_period',planPeriod);
   }
   navigate('plans');
 });

 $('#addBudgetBtn')&&($('#addBudgetBtn').onclick=()=>openBudgetModal());
 $$('[data-edit-budget]').forEach(btn=>btn.onclick=()=>openBudgetModal(btn.dataset.editBudget));
 $$('[data-delete-budget]').forEach(btn=>btn.onclick=()=>{
   const budget=state.budgets.find(v=>v.id===btn.dataset.deleteBudget);
   if(!budget)return;
   openConfirm('Hapus Budget',`Hapus budget ${budget.category} untuk ${monthLabel(budget.month)}?`,'Hapus',()=>{
     state.budgets=state.budgets.filter(v=>v.id!==budget.id);
     save();
     toast('Budget dihapus.');
     render();
   });
 });
 $$('[data-budget-detail]').forEach(card=>{
   card.onclick=e=>{
     if(e.target.closest('button'))return;
     openBudgetCategoryDetailV75(card.dataset.budgetDetail);
   };
   card.onkeydown=e=>{
     if(e.target.closest('button'))return;
     if(e.key==='Enter'||e.key===' '){
       e.preventDefault();
       openBudgetCategoryDetailV75(card.dataset.budgetDetail);
     }
   };
 });

 $('#addGoalBtn')&&($('#addGoalBtn').onclick=()=>openGoalModal());
 $$('[data-edit-goal]').forEach(btn=>btn.onclick=()=>openGoalModal(btn.dataset.editGoal));
 $$('[data-add-goal]').forEach(btn=>btn.onclick=()=>openGoalAllocationModal(btn.dataset.addGoal));
 $$('[data-connect-goal]').forEach(btn=>btn.onclick=()=>openConnectLegacyGoalModal(btn.dataset.connectGoal));
 $$('[data-delete-goal]').forEach(btn=>btn.onclick=()=>{
   const goal=state.goals.find(x=>x.id===btn.dataset.deleteGoal);
   if(!goal)return;
   openConfirm(
     'Hapus Target',
     `Hapus target ${goal.name}? Alokasi dana target akan dilepas kembali menjadi dana bebas, tetapi saldo akun tidak berubah.`,
     'Hapus',
     ()=>{
       state.goals=state.goals.filter(x=>x.id!==goal.id);
       save();
       toast('Target dihapus. Dana kembali dianggap bebas.');
       render();
     }
   );
 });

 $$('[data-asset-tab]').forEach(btn=>btn.onclick=()=>{
   assetTab=['investment','property','physical'].includes(btn.dataset.assetTab)
     ?btn.dataset.assetTab
     :'investment';
   render();
 });
 $('#addAssetBtn')&&($('#addAssetBtn').onclick=()=>openAssetModal());
 $$('[data-edit-asset]').forEach(btn=>btn.onclick=()=>openAssetModal(btn.dataset.editAsset));
 $$('[data-delete-asset]').forEach(btn=>btn.onclick=()=>{
   const asset=(state.assets[assetTab]||[]).find(v=>v.id===btn.dataset.deleteAsset);
   if(!asset)return;
   openConfirm('Hapus Aset',`Hapus ${asset.name}?`,'Hapus',()=>{
     state.assets[assetTab]=state.assets[assetTab].filter(v=>v.id!==asset.id);
     save();
     toast('Aset dihapus.');
     render();
   });
 });
 $('#refreshGoldAllBtn')&&($('#refreshGoldAllBtn').onclick=()=>refreshAllGoldPrices(true));
 if(currentPage==='assets'&&assetTab==='physical')refreshAllGoldPrices(false);

 $$('[data-debt-tab]').forEach(btn=>btn.onclick=()=>{
   const next=btn.dataset.debtTab;
   debtTab=['debts','bills','routines'].includes(next)?next:'debts';
   render();
 });

 $('#addDebtBtn')&&($('#addDebtBtn').onclick=()=>openDebtModal());
 $$('[data-edit-debt]').forEach(btn=>btn.onclick=()=>openDebtModal(btn.dataset.editDebt));
 $$('[data-delete-debt]').forEach(btn=>btn.onclick=()=>requestDeleteDebt(btn.dataset.deleteDebt));
 $$('[data-pay-debt]').forEach(btn=>btn.onclick=()=>openDebtPaymentModal(btn.dataset.payDebt,false));
 $$('[data-paid-debt]').forEach(btn=>btn.onclick=()=>openDebtPaymentModal(btn.dataset.paidDebt,true));

 $('#addBillBtn')&&($('#addBillBtn').onclick=()=>openBillModal());
 $$('[data-edit-bill]').forEach(btn=>btn.onclick=()=>openBillModal(btn.dataset.editBill));
 $$('[data-delete-bill]').forEach(btn=>btn.onclick=()=>requestDeleteBill(btn.dataset.deleteBill));
 $$('[data-paid-bill]').forEach(btn=>btn.onclick=()=>openBillPaymentModal(btn.dataset.paidBill));

 $('#addRoutineBtn')&&($('#addRoutineBtn').onclick=()=>openRoutineModalV81());
 $$('[data-edit-routine]').forEach(btn=>btn.onclick=()=>openRoutineModalV81(btn.dataset.editRoutine));
 $$('[data-record-routine]').forEach(btn=>btn.onclick=()=>openRoutineRecordModalV81(btn.dataset.recordRoutine));
 $$('[data-delete-routine]').forEach(btn=>btn.onclick=()=>requestDeleteRoutineV81(btn.dataset.deleteRoutine));

 $('#addCategoryBtn')&&($('#addCategoryBtn').onclick=()=>openCategoryModalV63());
 $$('[data-edit-cat]').forEach(btn=>btn.onclick=()=>openCategoryModalV63(Number(btn.dataset.editCat)));
 $$('[data-delete-cat-v63]').forEach(btn=>btn.onclick=()=>deleteCategoryV63(Number(btn.dataset.deleteCatV63)));

 $('#toggleHomeSummaryV65')&&($('#toggleHomeSummaryV65').onclick=()=>{
   homeSummaryExpandedV65=!homeSummaryExpandedV65;
   localStorage.setItem('uangku_home_summary_v65',homeSummaryExpandedV65?'1':'0');
   render();
 });

 $('#saveUserNameV65')&&($('#saveUserNameV65').onclick=()=>{
   state.profile=state.profile&&typeof state.profile==='object'?state.profile:{};
   state.profile.name=String($('#settingsUserNameV65')?.value||'').trim();
   save();
   toast(state.profile.name?'Nama pengguna disimpan.':'Nama pengguna dikosongkan.');
   render();
 });

 $('#homeDebtSeeAllV70')&&($('#homeDebtSeeAllV70').onclick=()=>{
   debtTab='debts';
   navigate('debts');
 });

 $('#exportBtn')&&($('#exportBtn').onclick=exportJSON);
 $('#importBtn')&&($('#importBtn').onclick=()=>$('#importFile')?.click());
 $('#importFile')&&($('#importFile').onchange=importJSON);
 $('#resetBtn')&&($('#resetBtn').onclick=()=>{
   if(confirm('Hapus semua data UangKu?')){
     localStorage.removeItem('uangku_data_v3');
     localStorage.removeItem('uangku_balance_hidden');
     localStorage.removeItem('uangku_include_investment_assets');
     localStorage.removeItem('uangku_networth_expanded');
     localStorage.removeItem('uangku_home_period');
     localStorage.removeItem('uangku_plan_period');
     localStorage.removeItem('uangku_report_period');
     state=clone(defaults);
     balanceHidden=false;
     includeInvestmentAssets=true;
     netWorthExpanded=false;
     homePeriod=monthKey();
     planPeriod=monthKey();
     reportPeriod=monthKey();
     save();
     navigate('home');
   }
 });

 initFinancialCarouselV78();
 $('#openAccountsV78')&&($('#openAccountsV78').onclick=()=>navigate('accounts'));
 $$('[data-overview-breakdown]').forEach(btn=>btn.onclick=()=>openOverviewBreakdownV78(btn.dataset.overviewBreakdown));

 bindNumericInputUX($('#content'));
}


function accountName(id){
 const a=state.accounts.find(x=>x&&x.id===id);
 return a?.name||'Akun';
}

function totalBalance(){
 return state.accounts.reduce((s,a)=>s+accountBalance(a.id),0);
}

function savingsBalance(){
 return state.accounts
   .filter(a=>String(a?.type||'').toLowerCase()==='tabungan')
   .reduce((s,a)=>s+accountBalance(a.id),0);
}

function transferTotal(k=monthKey()){
 return state.transactions
   .filter(t=>t&&t.type==='transfer'&&monthKey(t.date)===k)
   .reduce((s,t)=>s+(Number(t.amount)||0),0);
}

function monthsSince(dateStr){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr||''));
 if(!m)return 0;
 const then=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
 const now=new Date();
 let months=(now.getFullYear()-then.getFullYear())*12+(now.getMonth()-then.getMonth());
 if(now.getDate()<then.getDate())months--;
 return Math.max(0,months);
}

function defaultDepRate(kind){
 const k=String(kind||'');
 if(k==='Kendaraan')return 10;
 if(k==='Barang elektronik bernilai')return 20;
 if(k==='Peralatan usaha')return 10;
 if(k==='Aset pertanian')return 10;
 if(k==='Barang koleksi')return 5;
 return 10;
}

function assetCurrentValue(a,tab){
 if(!a)return 0;
 if(tab!=='physical')return Math.max(0,Number(a.value)||0);

 if(a.kind==='Emas & logam mulia'){
   const grams=Math.max(0,Number(a.grams)||0);
   const current=Math.max(0,Number(a.currentPricePerGram)||0);
   const fallback=Math.max(0,Number(a.buyPricePerGram)||0);
   if(grams>0&&(current>0||fallback>0))return grams*(current||fallback);
 }

 if(a.valuationMethod==='depreciation'){
   const purchase=Math.max(0,Number(a.purchasePrice)||Number(a.value)||0);
   if(!purchase)return 0;
   const rate=Math.max(0,Math.min(95,Number(a.annualDepRate)||defaultDepRate(a.kind)))/100;
   const years=monthsSince(a.purchaseDate)/12;
   return Math.max(0,Math.round(purchase*Math.pow(1-rate,years)));
 }

 if(a.valuationMethod==='manual'){
   return Math.max(0,Number(a.currentMarketValue)||Number(a.value)||Number(a.purchasePrice)||0);
 }

 return Math.max(0,Number(a.value)||Number(a.currentMarketValue)||Number(a.purchasePrice)||0);
}

function totalAssets(){
 return ['investment','property','physical']
   .flatMap(tab=>(state.assets?.[tab]||[]).map(a=>assetCurrentValue(a,tab)))
   .reduce((s,v)=>s+v,0);
}
function budgetRemainingTotal(k=homePeriod){
 return state.budgets
   .filter(b=>b&&b.month===k)
   .reduce((sum,b)=>{
     const used=state.transactions
       .filter(t=>t&&t.type==='expense'&&t.category===b.category&&monthKey(t.date)===k)
       .reduce((s,t)=>s+(Number(t.amount)||0),0);
     return sum+Math.max(0,(Number(b.limit)||0)-used);
   },0);
}

function netWorthValue(){
 const d=debtTotals();
 return totalBalance()+d.receivable+(includeInvestmentAssets?totalAssets():0)-d.payable;
}

function setTxType(t){
 manualTxType=['income','expense','transfer'].includes(t)?t:'income';
 if(currentPage==='addTransaction')render();
}

function assetPurchaseValue(a){
 if(!a)return 0;
 if(a.kind==='Emas & logam mulia'){
   return Math.max(0,Number(a.grams)||0)*Math.max(0,Number(a.buyPricePerGram)||0);
 }
 return Math.max(0,Number(a.purchasePrice)||Number(a.value)||0);
}

function physicalChange(a){
 const current=assetCurrentValue(a,'physical');
 const buy=assetPurchaseValue(a);
 return {current,buy,diff:current-buy,pct:buy>0?Math.round((current-buy)/buy*100):0};
}

async function fetchLiveGoldIDRPerGram(){
 const [goldRes,fxRes]=await Promise.all([
   fetch('https://api.gold-api.com/price/XAU',{cache:'no-store'}),
   fetch('https://api.frankfurter.dev/v2/rate/USD/IDR',{cache:'no-store'})
 ]);
 if(!goldRes.ok||!fxRes.ok)throw new Error('Sumber harga tidak merespons');
 const gold=await goldRes.json();
 const fx=await fxRes.json();
 const usdPerOz=Number(gold.price);
 const idrPerUsd=Number(fx.rate);
 if(!usdPerOz||!idrPerUsd)throw new Error('Data harga tidak valid');
 return {
   pricePerGram:Math.round((usdPerOz*idrPerUsd)/31.1034768),
   updatedAt:gold.updatedAt||new Date().toISOString(),
   usdPerOz,
   idrPerUsd
 };
}

let goldRefreshRunning=false;
async function refreshAllGoldPrices(force=false){
 if(goldRefreshRunning)return;
 const goldAssets=(state.assets?.physical||[]).filter(a=>a?.kind==='Emas & logam mulia'&&(a.metal||'gold')==='gold'&&(Number(a.grams)||0)>0);
 if(!goldAssets.length)return;
 const newest=Math.max(0,...goldAssets.map(a=>new Date(a.priceUpdatedAt||0).getTime()||0));
 if(!force&&newest&&Date.now()-newest<6*60*60*1000)return;

 goldRefreshRunning=true;
 try{
   const live=await fetchLiveGoldIDRPerGram();
   goldAssets.forEach(a=>{a.currentPricePerGram=live.pricePerGram;a.priceUpdatedAt=live.updatedAt;a.value=assetCurrentValue(a,'physical')});
   save();
   if(currentPage==='assets'&&assetTab==='physical')render();
   if(force)toast('Harga emas berhasil diperbarui.');
 }catch(e){
   if(force)toast('Harga emas gagal diperbarui. Coba lagi saat internet tersedia.');
 }finally{goldRefreshRunning=false}
}

function physicalValuationFields(a,kind){
 const isGold=kind==='Emas & logam mulia';
 const method=a?.valuationMethod||(isGold?'gold':(['Kendaraan','Barang elektronik bernilai','Peralatan usaha'].includes(kind)?'depreciation':'manual'));
 return `
 <div id="goldAssetFields" class="${isGold?'':'hidden'}">
   <div class="field"><label>Jenis Logam</label><select name="metal" id="metalSelect">
     <option value="gold" ${(a?.metal||'gold')==='gold'?'selected':''}>Emas 24K — harga spot otomatis</option>
     <option value="silver" ${a?.metal==='silver'?'selected':''}>Perak / logam lain — harga manual</option>
   </select></div>
   <div class="row">
     <div class="field"><label>Berat (gram)</label><input type="number" step="0.001" name="grams" value="${numInputValue(a?.grams)}" placeholder="Contoh: 5"></div>
     <div class="field"><label>Harga beli / gram</label><input type="number" name="buyPricePerGram" value="${numInputValue(a?.buyPricePerGram)}" placeholder="Harga beli"></div>
   </div>
   <div class="field"><label>Tanggal Beli</label><input type="date" name="purchaseDate" value="${esc(a?.purchaseDate||'')}"></div>
   <div class="field"><label>Harga saat ini / gram</label><input id="currentPricePerGram" type="number" name="currentPricePerGram" value="${numInputValue(a?.currentPricePerGram)}" placeholder="Tekan Update Harga"></div>
   <button type="button" class="btn secondary block" id="updateGoldPriceBtn">↻ Update Harga Emas dari Internet</button>
   <input type="hidden" id="goldPriceUpdatedAt" name="priceUpdatedAt" value="${esc(a?.priceUpdatedAt||'')}">
   <div id="goldPriceStatus" class="form-note">${a?.priceUpdatedAt?`Terakhir update: ${esc(String(a.priceUpdatedAt))}`:'Untuk emas 24K, harga bisa diperbarui dari harga spot internasional.'}</div>
 </div>

 <div id="normalPhysicalFields" class="${isGold?'hidden':''}">
   <div class="field"><label>Harga Beli</label><input type="number" name="purchasePrice" value="${numInputValue(a?.purchasePrice||a?.value)}" placeholder="Masukkan harga beli"></div>
   <div class="field"><label>Tanggal Beli</label><input type="date" name="physicalPurchaseDate" value="${esc(a?.purchaseDate||'')}"></div>
   <div class="field"><label>Penilaian Saat Ini</label><select name="valuationMethod" id="valuationMethodSelect">
     <option value="depreciation" ${method==='depreciation'?'selected':''}>Estimasi penyusutan otomatis</option>
     <option value="manual" ${method!=='depreciation'?'selected':''}>Nilai pasar saat ini — isi manual</option>
   </select></div>
   <div id="depreciationFields" class="${method==='depreciation'?'':'hidden'}">
     <div class="field"><label>Penyusutan per tahun (%)</label><input type="number" step="0.1" name="annualDepRate" value="${numInputValue(a?.annualDepRate||defaultDepRate(kind))}" placeholder="Contoh: 20"></div>
     <div class="form-note">Nilai sekarang dihitung otomatis dari harga beli, tanggal beli, dan persentase penyusutan. Ini estimasi, bukan harga pasar riil.</div>
   </div>
   <div id="manualMarketField" class="${method==='depreciation'?'hidden':''}">
     <div class="field"><label>Nilai pasar saat ini</label><input type="number" name="currentMarketValue" value="${numInputValue(a?.currentMarketValue||a?.value)}" placeholder="Masukkan nilai pasar terbaru"></div>
   </div>
 </div>`;
}

function renderAssets(){
 const labels={investment:'Investasi',property:'Properti',physical:'Aset Fisik'};
 const arr=Array.isArray(state.assets?.[assetTab])?state.assets[assetTab]:[];
 const total=arr.reduce((s,x)=>s+assetCurrentValue(x,assetTab),0);
 const hasGold=assetTab==='physical'&&arr.some(a=>a?.kind==='Emas & logam mulia'&&(a.metal||'gold')==='gold');

 return `<div class="tabs">
   ${Object.keys(labels).map(k=>`<button class="tab ${assetTab===k?'active':''}" data-asset-tab="${k}">${labels[k]}</button>`).join('')}
 </div>
 <div class="asset-total">
   <div><div class="kicker">Nilai Total ${labels[assetTab]}</div><div class="big-value">${fmt(total)}</div></div>
   ${hasGold?'<button class="mini-action" id="refreshGoldAllBtn">↻ Harga emas</button>':arr.length?'<span class="gain">Aset tercatat</span>':''}
 </div>
 ${assetTab==='physical'?'<div class="asset-note">Untuk emas, nilai bisa mengikuti harga spot internet. Untuk motor/HP/laptop dan aset lain, UangKu bisa menghitung <b>estimasi penyusutan</b>; harga pasar riil tetap perlu pembanding pasar atau input manual.</div>':''}
 <div class="list">
   ${arr.length?arr.map(x=>{
     const current=assetCurrentValue(x,assetTab);
     if(assetTab!=='physical'){
       return `<div class="list-item asset-row-v5">
         <div class="asset-icon">${assetIcon(assetTab,x)}</div>
         <div class="list-main"><div class="list-title">${esc(x?.name||assetKindLabel(x))}</div><div class="list-sub">${esc(assetKindLabel(x))} • ${fmt(current)}${x?.note?' • '+esc(x.note):''}</div></div>
         <div class="record-actions vertical"><button class="mini-action" data-edit-asset="${esc(x.id)}">Edit</button><button class="mini-action danger-text" data-delete-asset="${esc(x.id)}">Hapus</button></div>
       </div>`;
     }

     const ch=physicalChange(x);
     const gold=x.kind==='Emas & logam mulia';
     const valueLabel=gold?'Nilai emas saat ini':x.valuationMethod==='depreciation'?'Estimasi nilai saat ini':'Nilai pasar saat ini';
     const detail=gold
       ?`${Number(x.grams||0).toLocaleString('id-ID')} gr • ${fmt(x.currentPricePerGram||x.buyPricePerGram||0)}/gr`
       :`${x.purchaseDate?`Beli ${prettyDate(x.purchaseDate)} • `:''}${x.valuationMethod==='depreciation'?`Penyusutan ${Number(x.annualDepRate||defaultDepRate(x.kind))}%/th`:'Update manual'}`;
     return `<div class="card compact physical-asset-card">
       <div class="asset-card-top">
         <div class="asset-icon">${assetIcon(assetTab,x)}</div>
         <div class="list-main">
           <div class="list-title">${esc(x?.name||assetKindLabel(x))}</div>
           <div class="list-sub">${esc(assetKindLabel(x))}</div>
           <div class="detail-note">${detail}</div>
         </div>
         <div class="asset-current-value"><small>${valueLabel}</small><b>${fmt(current)}</b></div>
       </div>
       ${ch.buy>0?`<div class="asset-change ${ch.diff>=0?'up':'down'}">${ch.diff>=0?'▲':'▼'} ${Math.abs(ch.pct)}% • ${ch.diff>=0?'+':'−'}${fmt(Math.abs(ch.diff))} dari nilai beli</div>`:''}
       ${gold&&x.priceUpdatedAt?`<div class="gold-source-note">Harga spot 24K • update ${esc(String(x.priceUpdatedAt))}</div>`:''}
       <div class="record-actions"><button class="mini-action" data-edit-asset="${esc(x.id)}">Edit</button><button class="mini-action danger-text" data-delete-asset="${esc(x.id)}">Hapus</button></div>
     </div>`;
   }).join(''):'<div class="empty">Belum ada aset.</div>'}
 </div>
 <button class="fab" id="addAssetBtn">+</button>`;
}

function openAssetModal(editId=''){
 const arr=state.assets[assetTab]||[];
 const a=editId?arr.find(x=>x.id===editId):null;
 const selected=a?.kind||(assetTypeChoices[assetTab]?.[0]?.[0]||'Lainnya');
 const tabLabel={investment:'Investasi',property:'Properti',physical:'Aset Fisik'}[assetTab];

 if(assetTab!=='physical'){
   openModal(a?`Edit ${tabLabel}`:`Tambah ${tabLabel}`,`<form class="form">
     <div class="field"><label>Jenis ${tabLabel}</label><select id="assetKindSelect" name="kind">${assetOptionsHTML(assetTab,selected)}</select></div>
     ${assetTab==='investment'?`<div class="field ${selected==='Lainnya'?'':'hidden'}" id="assetOtherWrap"><label>Jenis investasi lainnya</label><input name="customKind" value="${esc(a?.customKind||'')}" placeholder="Contoh: P2P Lending"></div>`:''}
     <div class="field"><label>Nama / Keterangan</label><input name="name" value="${esc(a?.name||'')}" required placeholder="${assetTab==='investment'?'Contoh: BBRI / RDPU Bibit':'Contoh: Rumah Paiton'}"></div>
     <div class="field"><label>Nilai Saat Ini</label><input type="number" name="value" min="0" value="${numInputValue(a?.value)}" placeholder="Masukkan nilai aset" required></div>
     <div class="field"><label>Catatan</label><input name="note" value="${esc(a?.note||'')}" placeholder="Opsional"></div>
     <button class="btn block">${a?'Simpan Perubahan':'Simpan'}</button>
   </form>`,fd=>{
     const payload={kind:String(fd.get('kind')||''),customKind:String(fd.get('customKind')||'').trim(),name:String(fd.get('name')||'').trim(),value:Number(fd.get('value')||0),note:String(fd.get('note')||'')};
     if(!payload.name)return toast('Nama aset wajib diisi.');
     if(a)Object.assign(a,payload);else arr.push({id:uid(),...payload});
     save();closeModal();toast(a?'Aset diperbarui.':'Aset ditambahkan.');render();
   });
   setTimeout(()=>{
     const sel=$('#assetKindSelect'),wrap=$('#assetOtherWrap');
     if(sel&&wrap)sel.onchange=()=>wrap.classList.toggle('hidden',sel.value!=='Lainnya');
   },0);
   return;
 }

 openModal(a?'Edit Aset Fisik':'Tambah Aset Fisik',`<form class="form">
   <div class="field"><label>Jenis Aset Fisik</label><select id="assetKindSelect" name="kind">${assetOptionsHTML('physical',selected)}</select></div>
   <div class="field"><label>Nama / Keterangan</label><input name="name" value="${esc(a?.name||'')}" required placeholder="Contoh: Emas Antam / Yamaha Fazzio / Samsung A55"></div>
   <div id="physicalDynamicFields">${physicalValuationFields(a,selected)}</div>
   <div class="field"><label>Catatan</label><input name="note" value="${esc(a?.note||'')}" placeholder="Opsional"></div>
   <button class="btn block">${a?'Simpan Perubahan':'Simpan Aset'}</button>
 </form>`,fd=>{
   const kind=String(fd.get('kind')||'');
   const payload={kind,name:String(fd.get('name')||'').trim(),note:String(fd.get('note')||'')};
   if(!payload.name)return toast('Nama aset wajib diisi.');

   if(kind==='Emas & logam mulia'){
     Object.assign(payload,{
       metal:String(fd.get('metal')||'gold'),
       grams:Number(fd.get('grams')||0),
       buyPricePerGram:Number(fd.get('buyPricePerGram')||0),
       currentPricePerGram:Number(fd.get('currentPricePerGram')||0),
       purchaseDate:String(fd.get('purchaseDate')||''),
       priceUpdatedAt:String(fd.get('priceUpdatedAt')||a?.priceUpdatedAt||''),
       valuationMethod:'gold'
     });
     if(payload.grams<=0)return toast('Berat gram wajib diisi.');
     payload.value=assetCurrentValue(payload,'physical');
   }else{
     Object.assign(payload,{
       purchasePrice:Number(fd.get('purchasePrice')||0),
       purchaseDate:String(fd.get('physicalPurchaseDate')||''),
       valuationMethod:String(fd.get('valuationMethod')||'manual'),
       annualDepRate:Number(fd.get('annualDepRate')||defaultDepRate(kind)),
       currentMarketValue:Number(fd.get('currentMarketValue')||0)
     });
     if(payload.purchasePrice<=0)return toast('Harga beli wajib diisi.');
     payload.value=assetCurrentValue(payload,'physical');
   }

   if(a)Object.assign(a,payload);else arr.push({id:uid(),...payload});
   save();closeModal();toast(a?'Aset diperbarui.':'Aset ditambahkan.');render();
 });

 setTimeout(()=>{
   const kindSelect=$('#assetKindSelect');
   const rebuild=()=>{
     const kind=kindSelect.value;
     const dynamic=$('#physicalDynamicFields');
     dynamic.innerHTML=physicalValuationFields(kind===selected?a:null,kind);
     bindNumericInputUX(dynamic);
     bindPhysicalFieldEvents(kind,a);
   };
   kindSelect&&(kindSelect.onchange=rebuild);
   bindPhysicalFieldEvents(selected,a);
 },0);
}

function bindPhysicalFieldEvents(kind,a){
 const method=$('#valuationMethodSelect');
 if(method)method.onchange=()=>{
   $('#depreciationFields')?.classList.toggle('hidden',method.value!=='depreciation');
   $('#manualMarketField')?.classList.toggle('hidden',method.value==='depreciation');
 };
 const updateBtn=$('#updateGoldPriceBtn');
 if(updateBtn)updateBtn.onclick=async()=>{
   const metal=$('#metalSelect')?.value||'gold';
   if(metal!=='gold')return toast('Update internet otomatis saat ini tersedia untuk emas 24K.');
   updateBtn.disabled=true;updateBtn.textContent='Mengambil harga...';
   try{
     const live=await fetchLiveGoldIDRPerGram();
     $('#currentPricePerGram').value=live.pricePerGram;
     if($('#goldPriceUpdatedAt'))$('#goldPriceUpdatedAt').value=live.updatedAt;
     $('#goldPriceStatus').textContent=`Spot emas 24K: ${fmt(live.pricePerGram)}/gram • ${live.updatedAt}`;
     if(a){a.priceUpdatedAt=live.updatedAt}
   }catch(e){toast('Harga emas gagal diambil. Pastikan internet aktif.')}
   finally{updateBtn.disabled=false;updateBtn.textContent='↻ Update Harga Emas dari Internet'}
 };
}

function renderReports(){
 const m=monthTotals(reportPeriod);
 const debt=debtTotals();
 const budgetTotal=getBudgetTotal(reportPeriod);
 const budgetPct=getBudgetUsage(reportPeriod);
 const transfers=transferTotal(reportPeriod);
 const top=Object.entries(
   state.transactions.filter(t=>t&&t.type==='expense'&&monthKey(t.date)===reportPeriod)
     .reduce((o,t)=>(o[t.category]=(o[t.category]||0)+(Number(t.amount)||0),o),{})
 ).sort((a,b)=>b[1]-a[1]).slice(0,5);

 const billsDue=state.bills
   .filter(b=>b&&monthKey(b.dueDate)===reportPeriod&&b.status!=='paid')
   .reduce((s,b)=>s+(Number(b.amount)||0),0);

 const billsPaid=state.bills
   .filter(b=>b&&(
     (b.status==='paid'&&monthKey(b.paidDate||b.dueDate)===reportPeriod) ||
     (b.lastPaidDate&&monthKey(b.lastPaidDate)===reportPeriod)
   ))
   .reduce((s,b)=>s+(Number(b.amount)||0),0);

 const conclusions=reportConclusion(reportPeriod,m,budgetPct,debt,billsDue);

 return `${renderPeriodControl('reportMonthInput',reportPeriod)}
 <div class="card report-chart-card">
   <div class="section-head"><div><h3>Arus Kas 6 Bulan</h3><p>Sampai ${monthLabel(reportPeriod)}</p></div></div>
   ${reportBars(reportPeriod)}
 </div>

 <div class="report-stat-grid">
   <div class="card flat"><div class="kicker">Pemasukan</div><div class="mini-value green">${fmt(m.income)}</div></div>
   <div class="card flat"><div class="kicker">Pengeluaran</div><div class="mini-value red">${fmt(m.expense)}</div></div>
   <div class="card flat"><div class="kicker">Transfer Antar Akun</div><div class="mini-value blue-text">${fmt(transfers)}</div></div>
   <div class="card flat"><div class="kicker">Arus Kas Bersih</div><div class="mini-value ${m.net>=0?'green':'red'}">${fmt(m.net)}</div></div>
   <div class="card flat"><div class="kicker">Budget Terpakai</div><div class="mini-value">${budgetTotal?budgetPct+'%':'—'}</div></div>
   <div class="card flat"><div class="kicker">Kekayaan Bersih</div><div class="mini-value">${fmt(netWorthValue())}</div></div>
 </div>

 <div class="card report-detail-card">
   <h3>Utang & Tagihan</h3>
   <div class="report-line"><span>Sisa utang</span><b class="red">${fmt(debt.payable)}</b></div>
   <div class="report-line"><span>Sisa piutang</span><b class="green">${fmt(debt.receivable)}</b></div>
   <div class="report-line"><span>Tagihan jatuh tempo bulan ini</span><b>${fmt(billsDue)}</b></div>
   <div class="report-line"><span>Tagihan dibayar bulan ini</span><b>${fmt(billsPaid)}</b></div>
 </div>

 <div class="card report-detail-card">
   <h3>Pengeluaran Terbesar</h3>
   ${top.length?top.map(([c,v],i)=>`<div class="report-line"><span>${i+1}. ${esc(c)}</span><b>${fmt(v)}</b></div>`).join(''):'<div class="list-sub">Belum ada pengeluaran pada bulan ini.</div>'}
 </div>

 <div class="card report-conclusion">
   <h3>Kesimpulan ${monthLabel(reportPeriod)}</h3>
   ${conclusions.map(x=>`<div class="conclusion-item"><span>•</span><p>${esc(x)}</p></div>`).join('')}
   ${transfers>0?`<div class="conclusion-item"><span>•</span><p>Transfer antar akun ${fmt(transfers)} hanya memindahkan saldo dan tidak dihitung sebagai pemasukan atau pengeluaran.</p></div>`:''}
 </div>`;
}


function goalLinkedTotal(g){
 return (g?.allocations||[]).reduce((s,a)=>s+(Number(a?.amount)||0),0);
}

function goalCurrent(g){
 return Math.max(0,Number(g?.legacyCurrent)||0)+goalLinkedTotal(g);
}

function syncGoalCurrent(g){
 if(g)g.current=goalCurrent(g);
 return g?.current||0;
}

function totalGoalAllocated(){
 return state.goals.reduce((s,g)=>s+goalLinkedTotal(g),0);
}

function goalAllocatedFromAccount(accountId){
 return state.goals.reduce((sum,g)=>
   sum+(g.allocations||[])
     .filter(a=>a.accountId===accountId)
     .reduce((s,a)=>s+(Number(a.amount)||0),0)
 ,0);
}

function accountAvailableForGoal(accountId){
 return Math.max(0,accountBalance(accountId)-goalAllocatedFromAccount(accountId));
}

function budgetCashBreakdown(k=homePeriod){
 const cash=Math.max(0,totalBalance());
 const targetAllocated=totalGoalAllocated();
 const plannedRemaining=budgetRemainingTotal(k);
 const afterTarget=Math.max(0,cash-targetAllocated);
 const budgetAllocated=Math.min(afterTarget,plannedRemaining);
 const free=Math.max(0,cash-targetAllocated-budgetAllocated);
 const overallocated=Math.max(0,targetAllocated+plannedRemaining-cash);
 return {targetAllocated,budgetAllocated,free,plannedRemaining,overallocated};
}

function goalDetail(g){
 const target=Math.max(0,Number(g?.target)||0);
 const current=goalCurrent(g);
 const rawPct=target>0?Math.round(current/target*100):0;
 const barPct=Math.max(0,Math.min(100,rawPct));
 const link=normalizeTargetLink(g?.link||'');

 return `<div class="card goal-detail-card">
   <div class="goal-detail-top">
     ${goalVisual(g)}
     <div class="goal-detail-main">
       <div class="goal-row"><div class="goal-title">${esc(g?.name||'Target')}</div><b class="green">${rawPct}%</b></div>
       <div class="goal-money">${fmt(current)} <span>/ ${fmt(target)}</span></div>
       <div class="progress"><i style="width:${barPct}%"></i></div>
     </div>
   </div>
   ${goalAllocationSummary(g)}
   <div class="goal-card-actions">
     <button class="btn secondary smallbtn" data-add-goal="${esc(g?.id||'')}">+ Alokasikan Dana</button>
     ${link?`<a class="btn light smallbtn target-link-btn" href="${esc(link)}" target="_blank" rel="noopener noreferrer">🔗 Lihat barang</a>`:''}
     <button class="mini-action" data-edit-goal="${esc(g?.id||'')}">Edit</button>
     <button class="mini-action danger-text" data-delete-goal="${esc(g?.id||'')}">Hapus</button>
   </div>
 </div>`;
}

function openGoalModalCore(editId=''){
 const g=editId?state.goals.find(x=>x.id===editId):null;
 const selectedLogo=g?.logo||'🎯';
 const image=g?.image||'';

 openModal(g?'Edit Target':'Tambah Target',`<form class="form">
   <div class="field"><label>Nama Target</label><input name="name" value="${esc(g?.name||'')}" required placeholder="Contoh: Laptop baru"></div>
   ${goalLogoPicker(selectedLogo)}
   <div class="field">
     <label>Gambar Target (Opsional)</label>
     <div class="goal-image-upload">
       <div id="goalImagePreview" class="goal-image-preview">${image?`<img src="${image}" alt="Preview target">`:`<span>${esc(selectedLogo)}</span>`}</div>
       <div class="goal-image-upload-actions">
         <input id="goalImageFile" type="file" accept="image/*" hidden>
         <button type="button" class="btn secondary smallbtn" id="chooseGoalImage">Pilih Gambar</button>
         <button type="button" class="btn light smallbtn ${image?'':'hidden'}" id="removeGoalImage">Hapus Gambar</button>
         <div class="list-sub">Kalau ada gambar, gambar akan tampil menggantikan logo.</div>
       </div>
     </div>
   </div>
   <div class="field"><label>Link Barang (Opsional)</label><input name="link" type="url" value="${esc(g?.link||'')}" placeholder="https://..."></div>
   <div class="field"><label>Target Nominal</label><input type="number" name="target" min="1" value="${numInputValue(g?.target)}" placeholder="Masukkan target nominal" required></div>

   ${g?`
     <div class="field"><label>Dana Sudah Dialokasikan</label><div class="readonly-box">${fmt(goalCurrent(g))}</div></div>
   `:`
     <div class="field"><label>Dana Awal (Opsional)</label><input type="number" name="initialAmount" min="0" placeholder="Masukkan jika sudah ada dana"></div>
     <div class="field"><label>Sumber Dana Awal</label><select name="initialAccountId" ${state.accounts.length?'':'disabled'}>
       ${state.accounts.length?state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)} • ${fmt(accountBalance(a.id))}</option>`).join(''):'<option>Tambahkan akun terlebih dahulu</option>'}
     </select></div>
   `}

   <input type="hidden" name="image" id="goalImageValue" value="${image}">
   <button class="btn block">${g?'Simpan Perubahan':'Simpan Target'}</button>
 </form>`,fd=>{
   const target=Number(fd.get('target')||0);
   const payload={
     name:String(fd.get('name')||'').trim(),target,
     logo:$('#goalLogoValue')?.value||'🎯',
     image:$('#goalImageValue')?.value||'',
     link:normalizeTargetLink(fd.get('link'))
   };
   if(!payload.name||target<=0)return toast('Lengkapi target dengan benar.');

   if(g){
     Object.assign(g,payload);syncGoalCurrent(g);
   }else{
     const initialAmount=Number(fd.get('initialAmount')||0);
     const initialAccountId=String(fd.get('initialAccountId')||'');
     if(initialAmount>0){
       if(!state.accounts.length)return toast('Tambahkan akun terlebih dahulu untuk sumber dana awal.');
       if(initialAmount>accountAvailableForGoal(initialAccountId))return toast('Saldo akun tidak mencukupi untuk dana awal target.');
     }
     const allocations=initialAmount>0?[{id:uid(),accountId:initialAccountId,amount:initialAmount,date:today(),note:'Dana awal'}]:[];
     const ng={id:uid(),...payload,legacyCurrent:0,allocations,current:initialAmount};
     state.goals.push(ng);
   }

   save();closeModal();toast(g?'Target diperbarui.':'Target ditambahkan.');render();
 });

 setTimeout(()=>{
   $$('#modalBody [data-goal-logo]').forEach(btn=>btn.onclick=()=>{
     $$('#modalBody [data-goal-logo]').forEach(x=>x.classList.remove('selected'));
     btn.classList.add('selected');$('#goalLogoValue').value=btn.dataset.goalLogo;
     if(!$('#goalImageValue').value)$('#goalImagePreview').innerHTML=`<span>${btn.dataset.goalLogo}</span>`;
   });
   const input=$('#goalImageFile'),choose=$('#chooseGoalImage'),remove=$('#removeGoalImage'),preview=$('#goalImagePreview'),value=$('#goalImageValue');
   choose&&(choose.onclick=()=>input.click());
   input&&(input.onchange=async e=>{
     const file=e.target.files?.[0];if(!file)return;
     try{const data=await compressGoalImage(file);value.value=data;preview.innerHTML=`<img src="${data}" alt="Preview target">`;remove.classList.remove('hidden')}
     catch(err){toast('Gambar tidak bisa dibaca.')}
   });
   remove&&(remove.onclick=()=>{value.value='';input.value='';preview.innerHTML=`<span>${$('#goalLogoValue').value||'🎯'}</span>`;remove.classList.add('hidden')});
 },0);
}


function normalizeState(raw){
 const x=raw&&typeof raw==='object'?raw:{};

 const accounts=Array.isArray(x.accounts)?x.accounts.filter(Boolean).map(a=>({
   ...a,
   id:a.id||uid(),
   name:String(a.name||'Akun'),
   type:String(a.type||'Bank'),
   initial:Number(a.initial)||0,
   logo:a.logo||'',
   holder:String(a.holder||'')
 })):[];

 const goals=Array.isArray(x.goals)?x.goals.filter(Boolean).map(g=>{
   const allocations=Array.isArray(g.allocations)?g.allocations.filter(Boolean).map(a=>({
     id:a.id||uid(),
     accountId:String(a.accountId||''),
     amount:Math.max(0,Number(a.amount)||0),
     date:a.date||today(),
     note:a.note||''
   })):[];
   const linked=allocations.reduce((s,a)=>s+(Number(a.amount)||0),0);
   const oldCurrent=Math.max(0,Number(g.current)||0);
   const legacyCurrent=g.legacyCurrent!==undefined
     ?Math.max(0,Number(g.legacyCurrent)||0)
     :Math.max(0,oldCurrent-linked);

   return {
     ...g,id:g.id||uid(),name:String(g.name||'Target'),
     target:Number(g.target)||0,current:legacyCurrent+linked,
     legacyCurrent,allocations,logo:g.logo||'🎯',image:g.image||'',link:g.link||''
   };
 }):[];

 const normAsset=a=>({
   ...a,id:a.id||uid(),name:String(a.name||'Aset'),
   value:Number(a.value)||0,kind:a.kind||a.typeName||'',
   customKind:a.customKind||'',note:a.note||''
 });

 const debts=Array.isArray(x.debts)?x.debts.filter(Boolean).map(d=>{
   const oldAmount=Number(d.amount)||0;
   const hasBreakdown=d.principal!==undefined||d.interest!==undefined||d.admin!==undefined;
   const principal=hasBreakdown?(Number(d.principal)||0):oldAmount;
   const interest=hasBreakdown?(Number(d.interest)||0):0;
   const admin=hasBreakdown?(Number(d.admin)||0):0;
   const amount=Math.max(0,hasBreakdown?(principal+interest+admin):oldAmount);
   const paid=Math.max(0,Number(d.paid)||0);
   return {...d,id:d.id||uid(),type:d.type==='receivable'?'receivable':'payable',
     person:String(d.person||''),principal,interest,admin,amount,
     installments:Math.max(0,Number(d.installments)||0),
     paid:Math.min(amount,paid),dueDate:d.dueDate||'',note:d.note||'',
     status:(d.status==='paid'||(amount>0&&paid>=amount))?'paid':'active',
     paidDate:d.paidDate||''};
 }):[];

 const bills=Array.isArray(x.bills)?x.bills.filter(Boolean).map(b=>({
   ...b,id:b.id||uid(),name:String(b.name||'Tagihan'),amount:Number(b.amount)||0,
   dueDate:b.dueDate||'',recurrence:b.recurrence==='monthly'?'monthly':'once',
   notificationEnabled:b.notificationEnabled===undefined?true:!!b.notificationEnabled,
   notifyTiming:b.notifyTiming==='day_before'?'day_before':'due',
   status:b.status==='paid'?'paid':'active',note:b.note||'',
   paidDate:b.paidDate||'',lastPaidDate:b.lastPaidDate||'',lastPaidDueDate:b.lastPaidDueDate||''
 })):[];

 const routines=Array.isArray(x.routines)?x.routines.filter(Boolean).map(normalizeRoutineV81):[];

 return {
   ...clone(defaults),...x,
   schemaVersion:BACKUP_SCHEMA_VERSION,
   accounts,goals,
   categories:Array.isArray(x.categories)&&x.categories.length?x.categories:clone(defaults.categories),
   categoryIcons:x.categoryIcons&&typeof x.categoryIcons==='object'?x.categoryIcons:{},
   transactions:Array.isArray(x.transactions)?x.transactions.filter(Boolean):[],
   budgets:Array.isArray(x.budgets)?x.budgets.filter(Boolean):[],
   assets:{
     investment:Array.isArray(x.assets?.investment)?x.assets.investment.filter(Boolean).map(normAsset):[],
     property:Array.isArray(x.assets?.property)?x.assets.property.filter(Boolean).map(normAsset):[],
     physical:Array.isArray(x.assets?.physical)?x.assets.physical.filter(Boolean).map(normAsset):[]
   },
   debts,bills,routines,
   chat:Array.isArray(x.chat)&&x.chat.length?x.chat:clone(defaults.chat)
 };
}

function titipanBalance(){
 return state.accounts
   .filter(a=>String(a?.type||'').toLowerCase()==='titipan')
   .reduce((s,a)=>s+accountBalance(a.id),0);
}

function accountSubtitle(a){
 const type=String(a?.type||'Akun');
 if(type==='Titipan'){
   return a?.holder?`Titipan • disimpan di ${esc(a.holder)}`:'Titipan / Disimpan di Orang';
 }
 return esc(type);
}

function accountLogoHTML(a){
 if(a?.logo)return `<div class="account-icon logo"><img src="${a.logo}" alt="Logo ${esc(a.name||'Akun')}"></div>`;
 const type=String(a?.type||'').toLowerCase();
 if(type==='titipan')return `<div class="account-icon held">👤</div>`;
 if(type==='tabungan')return `<div class="account-icon savings">🐷</div>`;
 if(/wallet/i.test(type))return `<div class="account-icon wallet">▣</div>`;
 if(/cash/i.test(type))return `<div class="account-icon cash">💵</div>`;
 return `<div class="account-icon">🏦</div>`;
}

function renderAccounts(){
 const savings=savingsBalance();
 const held=titipanBalance();

 return `<div class="account-summary-grid account-summary-grid-v54">
   <div class="card accounts-total">
     <div class="kicker">Total Saldo</div>
     <div class="big-value">${fmt(totalBalance())}</div>
   </div>
   <div class="card accounts-total savings-total">
     <div class="kicker">Tabungan</div>
     <div class="big-value">${fmt(savings)}</div>
   </div>
   <div class="card accounts-total held-total">
     <div class="kicker">Titipan / di Orang</div>
     <div class="big-value">${fmt(held)}</div>
   </div>
 </div>

 <div class="account-help">
   💡 <b>Titipan</b> dipakai untuk uang yang tetap milikmu tetapi disimpan/dipegang orang lain.
   Karena tetap milikmu, saldonya tetap masuk ke kekayaan bersih.
 </div>

 <div class="list">
   ${state.accounts.length?state.accounts.map(a=>`<div class="list-item account-row-v5">
     ${accountLogoHTML(a)}
     <div class="list-main">
       <div class="list-title">${esc(a.name)}</div>
       <div class="list-sub">${accountSubtitle(a)}</div>
     </div>
     <div class="account-right">
       <div class="amount">${fmt(accountBalance(a.id))}</div>
       <div class="record-actions right">
         <button class="mini-action" data-edit-account="${esc(a.id)}">Edit</button>
         <button class="mini-action danger-text" data-delete-account="${esc(a.id)}">Hapus</button>
       </div>
     </div>
   </div>`).join(''):'<div class="empty">Belum ada akun. Tekan + untuk menambahkan akun atau dompet.</div>'}
 </div>
 <button class="fab" id="addAccountBtn">+</button>`;
}

function openAccountModal(editId=''){
 const a=editId?state.accounts.find(x=>x.id===editId):null;
 const title=a?'Edit Akun':'Tambah Akun';
 const logo=a?.logo||'';
 const types=['Bank','e-Wallet','Cash','Tabungan','Titipan','Lainnya'];

 openModal(title,`<form class="form">
   <div class="field">
     <label>Nama Akun</label>
     <input name="name" value="${esc(a?.name||'')}" required placeholder="Contoh: BCA, Dana Darurat, Uang di Ibu">
   </div>

   <div class="field">
     <label>Jenis</label>
     <select name="type" id="accountTypeSelect">
       ${types.map(x=>`<option value="${x}" ${a?.type===x?'selected':''}>${x==='Titipan'?'Titipan / Disimpan di Orang':x}</option>`).join('')}
     </select>
   </div>

   <div class="field ${a?.type==='Titipan'?'':'hidden'}" id="accountHolderWrap">
     <label>Disimpan pada siapa</label>
     <input name="holder" value="${esc(a?.holder||'')}" placeholder="Contoh: Ibu, Kakak, Suami">
     <div class="list-sub">Ini bukan piutang. Uangnya tetap milikmu, hanya tempat penyimpanannya ada pada orang tersebut.</div>
   </div>

   <div class="field">
     <label>Logo Akun (Opsional)</label>
     <div class="account-logo-upload">
       <div id="accountLogoPreview" class="account-logo-preview">${logo?`<img src="${logo}" alt="Logo akun">`:`<span>${a?.type==='Titipan'?'👤':'🏦'}</span>`}</div>
       <div class="account-logo-upload-actions">
         <input id="accountLogoFile" type="file" accept="image/*" hidden>
         <button type="button" class="btn secondary smallbtn" id="chooseAccountLogo">Pilih Logo</button>
         <button type="button" class="btn light smallbtn ${logo?'':'hidden'}" id="removeAccountLogo">Hapus Logo</button>
         <div class="list-sub">Bisa pakai foto/logo sendiri. Kalau kosong, akun Titipan memakai ikon 👤.</div>
       </div>
     </div>
   </div>

   <div class="field">
     <label>Saldo Awal</label>
     <input type="number" name="initial" value="${numInputValue(a?.initial)}" placeholder="Masukkan saldo awal">
   </div>

   <input type="hidden" name="logo" id="accountLogoValue" value="${logo}">
   <button class="btn block">${a?'Simpan Perubahan':'Simpan Akun'}</button>
 </form>`,fd=>{
   const type=String(fd.get('type')||'Bank');
   const payload={
     name:String(fd.get('name')||'').trim(),
     type,
     initial:Number(fd.get('initial')||0),
     logo:$('#accountLogoValue')?.value||'',
     holder:type==='Titipan'?String(fd.get('holder')||'').trim():''
   };

   if(!payload.name)return toast('Nama akun wajib diisi.');
   if(type==='Titipan'&&!payload.holder)return toast('Isi nama orang yang menyimpan uang tersebut.');

   if(a)Object.assign(a,payload);
   else state.accounts.push({id:uid(),...payload});

   save();
   closeModal();
   toast(a?'Akun diperbarui.':'Akun ditambahkan.');
   render();
 });

 setTimeout(()=>{
   const typeSelect=$('#accountTypeSelect');
   const holderWrap=$('#accountHolderWrap');
   const holderInput=holderWrap?.querySelector('input[name="holder"]');
   const fileInput=$('#accountLogoFile');
   const choose=$('#chooseAccountLogo');
   const remove=$('#removeAccountLogo');
   const preview=$('#accountLogoPreview');
   const value=$('#accountLogoValue');

   const syncTypeUI=()=>{
     const isTitipan=typeSelect?.value==='Titipan';
     holderWrap?.classList.toggle('hidden',!isTitipan);
     if(holderInput)holderInput.required=isTitipan;
     if(preview&&!value?.value)preview.innerHTML=isTitipan?'<span>👤</span>':'<span>🏦</span>';
   };

   typeSelect&&(typeSelect.onchange=syncTypeUI);
   syncTypeUI();

   choose&&(choose.onclick=()=>fileInput.click());
   fileInput&&(fileInput.onchange=async e=>{
     const file=e.target.files?.[0];
     if(!file)return;
     try{
       const data=await compressAccountLogo(file);
       value.value=data;
       preview.innerHTML=`<img src="${data}" alt="Preview logo akun">`;
       remove.classList.remove('hidden');
     }catch(err){
       toast('Logo tidak bisa dibaca.');
     }
   });

   remove&&(remove.onclick=()=>{
     value.value='';
     fileInput.value='';
     preview.innerHTML=typeSelect?.value==='Titipan'?'<span>👤</span>':'<span>🏦</span>';
     remove.classList.add('hidden');
   });
 },0);
}

function goalSourceAccountLabel(accountId){
 const a=state.accounts.find(x=>x.id===accountId);
 if(!a)return 'Akun tidak ditemukan';
 if(a.type==='Titipan'&&a.holder)return `${a.name} • di ${a.holder}`;
 return a.name;
}

function goalAllocationSummary(g){
 const allocations=g?.allocations||[];
 const legacy=Math.max(0,Number(g?.legacyCurrent)||0);
 if(!allocations.length&&!legacy)return '';

 const grouped={};
 allocations.forEach(a=>{
   const key=a.accountId||'';
   grouped[key]=(grouped[key]||0)+(Number(a.amount)||0);
 });

 const rows=Object.entries(grouped).map(([accountId,amount])=>
   `<div class="goal-source-row">
     <span>${esc(goalSourceAccountLabel(accountId))}</span>
     <b>${fmt(amount)}</b>
   </div>`
 ).join('');

 const legacyRow=legacy>0?`
   <div class="goal-source-row legacy">
     <span>Dana lama / belum terhubung akun</span>
     <b>${fmt(legacy)}</b>
   </div>
   <button class="mini-action connect-goal-btn" data-connect-goal="${esc(g.id||'')}">🔗 Hubungkan ke akun</button>
 `:'';

 return `<div class="goal-source-box">
   <div class="goal-source-title">Sumber dana target</div>
   ${rows}
   ${legacyRow}
 </div>`;
}


function ensureCategory(name,icon='📁'){
 if(!state.categories.includes(name))state.categories.push(name);
 state.categoryIcons=state.categoryIcons||{};
 if(!state.categoryIcons[name])state.categoryIcons[name]=icon;
}

function paymentAccountOptions(mode='out'){
 if(!state.accounts.length)return '<option>Belum ada akun</option>';
 return state.accounts.map(a=>{
   const bal=accountBalance(a.id);
   const label=a.type==='Titipan'&&a.holder
     ?`${a.name} • di ${a.holder}`
     :a.name;
   return `<option value="${a.id}">${esc(label)} • saldo ${fmt(bal)}</option>`;
 }).join('');
}

function openDebtPaymentModalCore(id,full=false){
 const d=state.debts.find(x=>x.id===id);
 if(!d)return;
 if(d.status==='paid'||debtOutstanding(d)<=0)return toast('Catatan ini sudah lunas.');
 if(!state.accounts.length){
   return openInfo('Belum ada akun','Tambahkan akun terlebih dahulu agar pembayaran bisa dicatat ke saldo dan transaksi.');
 }

 const remaining=debtOutstanding(d);
 const isReceivable=d.type==='receivable';
 const title=isReceivable
   ?(full?'Terima Pelunasan':'Terima Pembayaran')
   :(full?'Lunasi Utang':'Bayar Cicilan');

 openModal(title,`<form class="form">
   <div class="field">
     <label>${isReceivable?'Piutang dari':'Utang ke'}</label>
     <div class="readonly-box">${esc(d.person||'Tanpa nama')} • sisa ${fmt(remaining)}</div>
   </div>

   <div class="field">
     <label>${isReceivable?'Masuk ke Akun':'Bayar Pakai Akun'}</label>
     <select name="accountId" required>
       ${paymentAccountOptions(isReceivable?'in':'out')}
     </select>
   </div>

   <div class="field">
     <label>Nominal ${isReceivable?'Diterima':'Pembayaran'}</label>
     ${full
       ?`<div class="readonly-box">${fmt(remaining)}</div><input type="hidden" name="amount" value="${remaining}">`
       :`<input type="number" name="amount" min="1" max="${remaining}" placeholder="Masukkan nominal" required>
          <div class="list-sub">Maksimal ${fmt(remaining)}.</div>`}
   </div>

   <div class="field">
     <label>Tanggal</label>
     <input type="date" name="date" value="${today()}" required>
   </div>

   <div class="form-note">
     ${isReceivable
       ?'Pembayaran akan menambah saldo akun yang dipilih dan otomatis tercatat sebagai Pemasukan di Transaksi.'
       :'Pembayaran akan mengurangi saldo akun yang dipilih dan otomatis tercatat sebagai Pengeluaran di Transaksi.'}
   </div>

   <button class="btn block">${full?'Simpan & Tandai Lunas':'Simpan Pembayaran'}</button>
 </form>`,fd=>{
   const accountId=String(fd.get('accountId')||'');
   const amount=Number(fd.get('amount')||0);
   const date=String(fd.get('date')||today());

   if(!accountId)return toast('Pilih akun.');
   if(amount<=0||amount>remaining)return toast('Nominal pembayaran tidak valid.');

   if(!isReceivable&&accountBalance(accountId)<amount){
     return toast(`Saldo ${accountName(accountId)} tidak mencukupi. Saldo saat ini ${fmt(accountBalance(accountId))}.`);
   }

   d.paid=Math.min(debtTotalAmount(d),(Number(d.paid)||0)+amount);
   d.payments=Array.isArray(d.payments)?d.payments:[];
   d.payments.push({
     id:uid(),
     date,
     amount,
     accountId,
     direction:isReceivable?'in':'out'
   });

   const done=d.paid>=debtTotalAmount(d)-0.5;
   if(done){
     d.paid=debtTotalAmount(d);
     d.status='paid';
     d.paidDate=date;
   }else{
     d.status='active';
   }

   recordLinkedTransaction({
     type:isReceivable?'income':'expense',
     amount,
     accountId,
     category:isReceivable?'Piutang':'Utang & Cicilan',
     note:isReceivable
       ?`Terima pembayaran ${d.person||'piutang'}`
       :`${full?'Pelunasan':'Bayar cicilan'} ${d.person||'utang'}`,
     date,
     debtId:d.id
   });

   save();
   closeModal();
   toast(done
     ?`${isReceivable?'Piutang':'Utang'} lunas dan transaksi sudah tercatat.`
     :'Pembayaran dan transaksi berhasil dicatat.'
   );
   render();
 });
}

function openBillPaymentModal(id){
 const b=state.bills.find(x=>x.id===id);
 if(!b)return;
 if(b.status==='paid')return toast('Tagihan ini sudah lunas.');
 if(!state.accounts.length){
   return openInfo('Belum ada akun','Tambahkan akun terlebih dahulu agar pembayaran tagihan bisa dicatat.');
 }

 const amount=Math.max(0,Number(b.amount)||0);

 openModal('Bayar Tagihan',`<form class="form">
   <div class="field">
     <label>Tagihan</label>
     <div class="readonly-box">${esc(b.name||'Tagihan')} • ${fmt(amount)}</div>
   </div>

   <div class="field">
     <label>Bayar Pakai Akun</label>
     <select name="accountId" required>
       ${paymentAccountOptions('out')}
     </select>
   </div>

   <div class="field">
     <label>Nominal</label>
     <div class="readonly-box">${fmt(amount)}</div>
     <input type="hidden" name="amount" value="${amount}">
   </div>

   <div class="field">
     <label>Tanggal Pembayaran</label>
     <input type="date" name="date" value="${today()}" required>
   </div>

   <div class="form-note">
     Pembayaran akan mengurangi saldo akun yang dipilih dan otomatis muncul di Transaksi sebagai Pengeluaran kategori Tagihan.
   </div>

   <button class="btn block">Bayar & Tandai Lunas</button>
 </form>`,fd=>{
   const accountId=String(fd.get('accountId')||'');
   const date=String(fd.get('date')||today());

   if(!accountId)return toast('Pilih akun pembayaran.');
   if(amount<=0)return toast('Nominal tagihan tidak valid.');
   if(accountBalance(accountId)<amount){
     return toast(`Saldo ${accountName(accountId)} tidak mencukupi. Saldo saat ini ${fmt(accountBalance(accountId))}.`);
   }

   b.paymentHistory=Array.isArray(b.paymentHistory)?b.paymentHistory:[];
   b.paymentHistory.push({
     id:uid(),
     accountId,
     amount,
     date,
     dueDate:b.dueDate
   });
   b.lastPaymentAccountId=accountId;

   recordLinkedTransaction({
     type:'expense',
     amount,
     accountId,
     category:'Tagihan',
     note:`Bayar tagihan ${b.name||''}`.trim(),
     date,
     billId:b.id
   });

   if(b.recurrence==='monthly'){
     b.lastPaidDate=date;
     b.lastPaidDueDate=b.dueDate;
     b.dueDate=addMonthsToDate(b.dueDate,1);
     b.status='active';
     if(b.notificationEnabled)scheduleBillReminder(b);
   }else{
     b.status='paid';
     b.paidDate=date;
     cancelBillReminder(b.id);
   }

   save();
   closeModal();
   toast(
     b.recurrence==='monthly'
       ?'Tagihan lunas, transaksi tercatat, dan periode berikutnya sudah dibuat.'
       :'Tagihan lunas dan transaksi sudah tercatat.'
   );
   render();
 });
}

function debtPaymentSummary(d){
 const list=Array.isArray(d?.payments)?d.payments:[];
 if(!list.length)return '';
 const last=list[list.length-1];
 return `<div class="detail-note payment-link-note">
   Terakhir ${d.type==='receivable'?'diterima ke':'dibayar dari'} ${esc(accountName(last.accountId))}
   • ${fmt(last.amount)} • ${prettyDate(last.date)}
 </div>`;
}

function billPaymentSummary(b){
 const list=Array.isArray(b?.paymentHistory)?b.paymentHistory:[];
 if(!list.length)return '';
 const last=list[list.length-1];
 return `<div class="detail-note payment-link-note">
   Terakhir dibayar dari ${esc(accountName(last.accountId))}
   • ${fmt(last.amount)} • ${prettyDate(last.date)}
 </div>`;
}

function renderBillsInner(){
 const active=[...state.bills].filter(b=>b&&b.status!=='paid').sort((a,b)=>safeDateValue(a.dueDate).localeCompare(safeDateValue(b.dueDate)));
 const paid=[...state.bills].filter(b=>b&&b.status==='paid').sort((a,b)=>safeDateValue(b.dueDate).localeCompare(safeDateValue(a.dueDate)));

 const card=b=>`<div class="card compact bill-card bill-card-v5">
   <div class="list-item" style="border:0;padding:0">
     <span class="round-icon ${b.status==='paid'?'greenbg':'yellowbg'}">${b.status==='paid'?'✓':billIcon(b.name)}</span>
     <div class="list-main">
       <div class="list-title">${esc(b.name||'Tagihan')}</div>
       <div class="list-sub">${b.status==='paid'?'Lunas':`Jatuh tempo ${b.dueDate?prettyDate(b.dueDate):'-'}`}</div>
       <div class="bill-chips">
         <span>${b.recurrence==='monthly'?'↻ Bulanan':'Sekali'}</span>
         <span>${b.notificationEnabled?'🔔 '+(b.notifyTiming==='day_before'?'1 hari sebelum':'Saat jatuh tempo'):'🔕 Notifikasi mati'}</span>
       </div>
       ${b.lastPaidDueDate?`<div class="detail-note success-text">✓ Periode ${prettyDate(b.lastPaidDueDate)} sudah lunas</div>`:''}
       ${billPaymentSummary(b)}
       ${b.note?`<div class="detail-note">${esc(b.note)}</div>`:''}
     </div>
     <div class="amount">${fmt(b.amount)}</div>
   </div>
   <div class="record-actions">
     ${b.status!=='paid'?`<button class="mini-action success-text" data-paid-bill="${esc(b.id)}">💳 Bayar & lunasi</button>`:''}
     <button class="mini-action" data-edit-bill="${esc(b.id)}">Edit</button>
     <button class="mini-action danger-text" data-delete-bill="${esc(b.id)}">Hapus</button>
   </div>
 </div>`;

 return `<div class="section-head">
   <div><h3>Akan Jatuh Tempo</h3><p>${active.length} tagihan aktif</p></div>
   <button class="link-btn" id="addBillBtn">+ Tambah</button>
 </div>
 <div class="list">${active.length?active.map(card).join(''):'<div class="empty">Belum ada tagihan aktif.</div>'}</div>
 ${paid.length?`<div class="section-head" style="margin-top:18px"><div><h3>Sudah Lunas</h3><p>${paid.length} tagihan</p></div></div><div class="list">${paid.map(card).join('')}</div>`:''}`;
}


function normalizeRoutineV81(r){
 return {
   ...r,
   id:r?.id||uid(),
   name:String(r?.name||'Pengeluaran Rutin'),
   category:String(r?.category||'Lainnya'),
   amount:Math.max(0,Number(r?.amount)||0),
   accountId:String(r?.accountId||''),
   note:String(r?.note||''),
   active:r?.active===undefined?true:!!r.active,
   createdAt:r?.createdAt||today()
 };
}

function routineMonthSummaryV81(r,k=monthKey()){
 const rows=(state.transactions||[]).filter(t=>
   t&&
   t.type==='expense'&&
   t.routineId===r.id&&
   monthKey(t.date)===k
 );
 return {
   count:rows.length,
   total:rows.reduce((s,t)=>s+(Number(t.amount)||0),0),
   last:[...rows].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0]||null
 };
}

function renderRoutinesInner(){
 const rows=(state.routines||[]).filter(Boolean);
 const k=monthKey();

 const card=r=>{
   const s=routineMonthSummaryV81(r,k);
   const account=r.accountId?accountName(r.accountId):'Pilih saat mencatat';
   return `<div class="card compact routine-card-v81">
     <div class="list-item" style="border:0;padding:0">
       <span class="round-icon ${iconClassFor(r.category)}">${iconFor(r.category)}</span>
       <div class="list-main">
         <div class="list-title">${esc(r.name)}</div>
         <div class="list-sub">${esc(r.category)} • nominal acuan ${fmt(r.amount)}</div>
         <div class="routine-meta-v81">Akun: ${esc(account)}</div>
         <div class="routine-month-v81 ${s.count?'done':''}">
           ${s.count
             ?`✓ ${monthLabel(k)} sudah dicatat ${s.count}x • ${fmt(s.total)}`
             :`Belum dicatat pada ${monthLabel(k)}`}
         </div>
         ${r.note?`<div class="detail-note">${esc(r.note)}</div>`:''}
       </div>
     </div>

     <div class="record-actions">
       <button class="mini-action success-text" data-record-routine="${esc(r.id)}">＋ Catat sekarang</button>
       <button class="mini-action" data-edit-routine="${esc(r.id)}">Edit</button>
       <button class="mini-action danger-text" data-delete-routine="${esc(r.id)}">Hapus</button>
     </div>
   </div>`;
 };

 return `<div class="routine-explainer-v81">
   <b>Pengeluaran Rutin</b>
   <span>Untuk kebutuhan yang sering muncul tetapi tidak punya tanggal jatuh tempo tetap, seperti token listrik, bensin, atau pakan hewan.</span>
 </div>

 <div class="section-head">
   <div><h3>Daftar Rutin</h3><p>${rows.length} pengeluaran rutin</p></div>
   <button class="link-btn" id="addRoutineBtn">+ Tambah</button>
 </div>

 <div class="list">
   ${rows.length?rows.map(card).join(''):'<div class="empty">Belum ada pengeluaran rutin. Contoh: token listrik, bensin, atau pakan hewan.</div>'}
 </div>`;
}

function openRoutineModalV81(editId=''){
 const r=editId?(state.routines||[]).find(x=>x.id===editId):null;
 const categories=state.categories||[];
 const accountOptions=(state.accounts||[]).map(a=>
   `<option value="${esc(a.id)}" ${r?.accountId===a.id?'selected':''}>${esc(a.name)} • ${fmt(accountBalance(a.id))}</option>`
 ).join('');

 openModal(r?'Edit Pengeluaran Rutin':'Tambah Pengeluaran Rutin',`<form class="form">
   <div class="field">
     <label>Nama</label>
     <input name="name" value="${esc(r?.name||'')}" placeholder="Contoh: Token listrik" required>
   </div>

   <div class="field">
     <label>Kategori</label>
     <select name="category">
       ${categories.map(c=>`<option value="${esc(c)}" ${r?.category===c?'selected':''}>${esc(c)}</option>`).join('')}
     </select>
   </div>

   <div class="field">
     <label>Nominal Acuan</label>
     <input type="number" name="amount" min="1" value="${numInputValue(r?.amount)}" placeholder="Contoh: 50000" required>
   </div>

   <div class="field">
     <label>Akun Default</label>
     <select name="accountId">
       <option value="">Pilih saat mencatat</option>
       ${accountOptions}
     </select>
   </div>

   <div class="field">
     <label>Catatan</label>
     <input name="note" value="${esc(r?.note||'')}" placeholder="Opsional">
   </div>

   <div class="form-note">
     Pengeluaran rutin tidak mempunyai jatuh tempo. UangKu baru mengurangi saldo saat kamu menekan <b>Catat sekarang</b>.
   </div>

   <button class="btn block">${r?'Simpan Perubahan':'Simpan Pengeluaran Rutin'}</button>
 </form>`,fd=>{
   const payload=normalizeRoutineV81({
     ...(r||{}),
     name:String(fd.get('name')||'').trim(),
     category:String(fd.get('category')||'Lainnya'),
     amount:Number(fd.get('amount')||0),
     accountId:String(fd.get('accountId')||''),
     note:String(fd.get('note')||'')
   });

   if(!payload.name||payload.amount<=0)return toast('Lengkapi pengeluaran rutin dengan benar.');

   if(r)Object.assign(r,payload);
   else{
     state.routines=Array.isArray(state.routines)?state.routines:[];
     state.routines.push(payload);
   }

   save();
   closeModal();
   toast(r?'Pengeluaran rutin diperbarui.':'Pengeluaran rutin ditambahkan.');
   render();
 });
}

function openRoutineRecordModalV81(id){
 const r=(state.routines||[]).find(x=>x.id===id);
 if(!r)return;
 if(!state.accounts.length)return openInfo('Belum ada akun','Tambahkan akun terlebih dahulu agar pengeluaran rutin bisa dicatat.');

 const defaultAccount=(r.accountId&&state.accounts.some(a=>a.id===r.accountId))
   ?r.accountId
   :state.accounts[0].id;

 openModal('Catat Pengeluaran Rutin',`<form class="form">
   <div class="field">
     <label>Pengeluaran</label>
     <div class="readonly-box">${esc(r.name)} • ${esc(r.category)}</div>
   </div>

   <div class="field">
     <label>Nominal</label>
     <input type="number" name="amount" min="1" value="${numInputValue(r.amount)}" required>
   </div>

   <div class="field">
     <label>Akun</label>
     <select name="accountId" required>
       ${state.accounts.map(a=>`<option value="${esc(a.id)}" ${a.id===defaultAccount?'selected':''}>${esc(a.name)} • ${fmt(accountBalance(a.id))}</option>`).join('')}
     </select>
   </div>

   <div class="field">
     <label>Tanggal</label>
     <input type="date" name="date" value="${today()}" required>
   </div>

   <div class="field">
     <label>Catatan Transaksi</label>
     <input name="note" value="${esc(r.note||r.name)}">
   </div>

   <button class="btn block">Catat Pengeluaran</button>
 </form>`,fd=>{
   const amount=Number(fd.get('amount')||0);
   const accountId=String(fd.get('accountId')||'');
   const date=String(fd.get('date')||today());
   const note=String(fd.get('note')||r.name);

   if(amount<=0)return toast('Nominal harus lebih dari 0.');
   if(!accountId)return toast('Pilih akun.');
   if(accountBalance(accountId)<amount){
     return toast(`Saldo ${accountName(accountId)} tidak mencukupi. Saldo saat ini ${fmt(accountBalance(accountId))}.`);
   }

   ensureCategory(r.category,iconFor(r.category));
   state.transactions.push({
     id:uid(),
     type:'expense',
     date,
     amount,
     accountId,
     category:r.category,
     note,
     source:'routine_expense',
     routineId:r.id
   });

   r.accountId=accountId;
   r.amount=amount;
   r.lastRecordedDate=date;
   save();
   closeModal();
   toast('Pengeluaran rutin berhasil dicatat.');
   render();
 });
}

function requestDeleteRoutineV81(id){
 const r=(state.routines||[]).find(x=>x.id===id);
 if(!r)return;
 const count=(state.transactions||[]).filter(t=>t?.routineId===id).length;

 openConfirm(
   'Hapus Pengeluaran Rutin',
   `Hapus ${r.name}? ${count?`${count} transaksi yang pernah dibuat dari rutin ini tetap disimpan di riwayat.`:'Belum ada transaksi terkait.'}`,
   'Hapus',
   ()=>{
     state.routines=state.routines.filter(x=>x.id!==id);
     save();
     toast('Pengeluaran rutin dihapus.');
     render();
   }
 );
}

function recordLinkedTransaction({
 type,amount,accountId,category,note,date,debtId='',billId=''
}){
 ensureCategory(category,category==='Utang & Cicilan'?'💳':category==='Piutang'?'🤝':'🧾');
 const tx={
   id:uid(),type,date:date||today(),amount:Number(amount)||0,accountId,
   category,note,source:'linked_payment'
 };
 if(debtId){
   tx.debtId=debtId;
   const d=state.debts.find(x=>x.id===debtId);
   const direction=type==='income'?'in':'out';
   const p=[...(d?.payments||[])].reverse().find(p=>
     !p.txId&&p.accountId===accountId&&Number(p.amount)===Number(amount)&&p.date===(date||today())&&p.direction===direction
   );
   if(p){p.txId=tx.id;tx.paymentId=p.id;}
 }
 if(billId){
   tx.billId=billId;
   const b=state.bills.find(x=>x.id===billId);
   const p=[...(b?.paymentHistory||[])].reverse().find(p=>
     !p.txId&&p.accountId===accountId&&Number(p.amount)===Number(amount)&&p.date===(date||today())
   );
   if(p){p.txId=tx.id;tx.paymentId=p.id;}
 }
 state.transactions.push(tx);
 return tx;
}

function renderTransactions(){
 let tx=[...state.transactions].filter(Boolean).sort((a,b)=>(String(b.date||'')+String(b.id||'')).localeCompare(String(a.date||'')+String(a.id||'')));
 if(txFilter!=='all')tx=tx.filter(t=>t.type===txFilter);
 const groups={};tx.forEach(t=>(groups[t.date]??=[]).push(t));
 return `<div class="tabs tx-tabs-v51">
   <button class="tab ${txFilter==='all'?'active':''}" data-tx-filter="all">Semua</button>
   <button class="tab ${txFilter==='income'?'active':''}" data-tx-filter="income">Pemasukan</button>
   <button class="tab ${txFilter==='expense'?'active':''}" data-tx-filter="expense">Pengeluaran</button>
   <button class="tab ${txFilter==='transfer'?'active':''}" data-tx-filter="transfer">Transfer</button>
 </div>
 ${Object.keys(groups).length?Object.entries(groups).map(([d,arr])=>`<div class="day-title">${prettyDate(d)}</div><div class="list transaction-list-v56">${arr.map(txItem).join('')}</div>`).join(''):'<div class="empty">Belum ada transaksi.</div>'}`;
}

function findDebtPaymentForTx(d,t){
 const list=d?.payments||[];
 return list.find(p=>p.id===t.paymentId||p.txId===t.id)
   || [...list].reverse().find(p=>
     p.accountId===t.accountId&&Number(p.amount)===Number(t.amount)&&p.date===t.date&&p.direction===(t.type==='income'?'in':'out')
   );
}

function findBillPaymentForTx(b,t){
 const list=b?.paymentHistory||[];
 return list.find(p=>p.id===t.paymentId||p.txId===t.id)
   || [...list].reverse().find(p=>
     p.accountId===t.accountId&&Number(p.amount)===Number(t.amount)&&p.date===t.date
   );
}

function openEditTransactionModal(id){
 const t=state.transactions.find(x=>x.id===id);
 if(!t)return;
 const linked=!!(t.debtId||t.billId);
 const accounts=state.accounts||[];

 if(t.type==='transfer'){
   openModal('Edit Transaksi',`<form class="form">
     <div class="field"><label>Jenis</label><div class="readonly-box">Transfer Antar Akun</div></div>
     <div class="field"><label>Tanggal</label><input type="date" name="date" value="${esc(t.date||today())}" required></div>
     <div class="field"><label>Jumlah</label><input type="number" name="amount" min="1" value="${Number(t.amount)||''}" required></div>
     <div class="field"><label>Dari Akun</label><select name="fromAccountId">${accounts.map(a=>`<option value="${a.id}" ${t.fromAccountId===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></div>
     <div class="field"><label>Ke Akun</label><select name="toAccountId">${accounts.map(a=>`<option value="${a.id}" ${t.toAccountId===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></div>
     <div class="field"><label>Catatan</label><textarea name="note">${esc(t.note||'')}</textarea></div>
     <button class="btn block">Simpan Perubahan</button>
   </form>`,fd=>{
     const amount=Number(fd.get('amount')||0),from=String(fd.get('fromAccountId')||''),to=String(fd.get('toAccountId')||'');
     if(amount<=0)return toast('Nominal harus lebih dari 0.');
     if(!from||!to||from===to)return toast('Akun asal dan tujuan harus berbeda.');
     if(accountBalanceBeforeEditV74(from,t)<amount)return toast(`Saldo ${accountName(from)} tidak mencukupi.`);
     Object.assign(t,{date:String(fd.get('date')||today()),amount,fromAccountId:from,toAccountId:to,note:String(fd.get('note')||'')});
     save();closeModal();toast('Transaksi diperbarui.');render();
   });
   return;
 }

 openModal('Edit Transaksi',`<form class="form">
   ${linked?`<div class="form-note">🔗 ${esc(linkedTxLabel(t))}. Perubahan nominal, akun, atau tanggal akan ikut disinkronkan ke catatan terkait.</div>`:''}
   <div class="field"><label>Jenis</label>${linked?`<div class="readonly-box">${t.type==='income'?'Pemasukan':'Pengeluaran'}</div><input type="hidden" name="type" value="${t.type}">`:`<select name="type"><option value="income" ${t.type==='income'?'selected':''}>Pemasukan</option><option value="expense" ${t.type==='expense'?'selected':''}>Pengeluaran</option></select>`}</div>
   <div class="field"><label>Tanggal</label><input type="date" name="date" value="${esc(t.date||today())}" required></div>
   <div class="field"><label>Jumlah</label><input type="number" name="amount" min="1" value="${Number(t.amount)||''}" required></div>
   <div class="field"><label>Akun</label><select name="accountId">${accounts.map(a=>`<option value="${a.id}" ${t.accountId===a.id?'selected':''}>${esc(a.name)} • ${fmt(accountBalance(a.id))}</option>`).join('')}</select></div>
   ${linked?`<div class="field"><label>Kategori</label><div class="readonly-box">${esc(t.category||'Lainnya')}</div><input type="hidden" name="category" value="${esc(t.category||'Lainnya')}"></div>`:`<div class="field"><label>Kategori</label><select name="category">${transactionCategoryOptionsV76(t.category)}</select></div>`}
   <div class="field"><label>Catatan</label><textarea name="note">${esc(t.note||'')}</textarea></div>
   <button class="btn block">Simpan Perubahan</button>
 </form>`,fd=>{
   const old={...t};
   const type=linked?t.type:(fd.get('type')==='expense'?'expense':'income');
   const accountId=String(fd.get('accountId')||''),amount=Number(fd.get('amount')||0);
   if(amount<=0)return toast('Nominal harus lebih dari 0.');
   if(!accountId)return toast('Pilih akun.');
   if(type==='expense'&&accountBalanceBeforeEditV74(accountId,t)<amount)return toast(`Saldo ${accountName(accountId)} tidak mencukupi.`);
   Object.assign(t,{type,date:String(fd.get('date')||today()),amount,accountId,category:String(fd.get('category')||'Lainnya'),note:String(fd.get('note')||'')});
   if(linked)applyLinkedTransactionEdit(t,old);
   save();closeModal();toast('Transaksi diperbarui.');render();
 });
}

function requestDeleteTransactionCore(id){
 const t=state.transactions.find(x=>x.id===id);if(!t)return;
 const linked=linkedTxLabel(t);
 const extra=linked?` Transaksi ini ${linked.toLowerCase()}, jadi catatan terkait juga akan disesuaikan.`:'';
 openConfirm('Hapus Transaksi',`Hapus transaksi ${t.note||t.category||'ini'}?${extra}`,'Hapus',()=>{
   if(t.debtId||t.billId)removeLinkedTransactionEffects(t);
   state.transactions=state.transactions.filter(x=>x.id!==id);
   save();toast('Transaksi dihapus.');render();
 });
}


const monthlyAllocationPalette={
 debt:'#E66F72',
 bills:'#F2B84B',
 living:'#67A1E6',
 target:'#8C79DE',
 free:'#69B978'
};


function isDebtExpenseTx(t){
 if(!t||t.type!=='expense')return false;
 const cat=String(t.category||'').toLowerCase();
 return !!t.debtId || cat==='cicilan' || cat==='utang' || cat==='utang & cicilan';
}

function isBillExpenseTx(t){
 if(!t||t.type!=='expense')return false;
 const cat=String(t.category||'').toLowerCase();
 return !!t.billId || cat==='tagihan';
}

function isLivingExpenseTx(t){
 return !!t && t.type==='expense' && !isDebtExpenseTx(t) && !isBillExpenseTx(t);
}

function budgetedLivingUsedForMonth(k){
 const budgetCats=new Set(state.budgets.filter(b=>b&&b.month===k).map(b=>b.category));
 return state.transactions
   .filter(t=>t&&monthKey(t.date)===k&&isLivingExpenseTx(t)&&budgetCats.has(t.category))
   .reduce((s,t)=>s+(Number(t.amount)||0),0);
}

function renderPlans(){
 const budgets=state.budgets.filter(b=>b&&b.month===planPeriod);
 const alloc=budgetAllocation(budgets);
 const totalBudget=budgets.reduce((s,b)=>s+(Number(b.limit)||0),0);
 const totalUsed=budgetedLivingUsedForMonth(planPeriod);
 const totalUsedPct=totalBudget>0?Math.round(totalUsed/totalBudget*100):0;
 const totalRemaining=Math.max(0,totalBudget-totalUsed);
 const livingTotal=monthlyMoneyAllocation(planPeriod).living;
 const outsideBudget=Math.max(0,livingTotal-totalUsed);

 return `<div class="tabs">
   <button class="tab ${planTab==='budget'?'active':''}" data-plan-tab="budget">Budget</button>
   <button class="tab ${planTab==='goal'?'active':''}" data-plan-tab="goal">Target</button>
 </div>

 ${planTab==='budget'?`
   ${renderPeriodControl('planMonthInput',planPeriod)}
   ${renderMonthlyMoneyAllocation(planPeriod)}

   <div class="budget-subsection-title">
     <div>
       <h3>Rincian Budget Hidup</h3>
       <p>Batas pengeluaran harian dan kebutuhan per kategori</p>
     </div>
   </div>

   <div class="card flat budget-overview-v57">
     <div class="section-head">
       <div>
         <h3>Alokasi Budget</h3>
         <p>Pembagian total budget ke tiap kategori</p>
       </div>
       <button class="link-btn" id="addBudgetBtn">+ Atur</button>
     </div>

     <div class="budget-overview-main">
       <div class="donut-holder budget-donut-v57">
         <div class="donut" style="background:${budgetGradient(budgets)}"></div>
         <div class="donut-label budget-donut-label-v57">
           <b>${totalBudget?fmt(totalBudget):'Rp 0'}</b>
           <small>Total Budget</small>
         </div>
       </div>

       <div class="budget-total-used">
         <div class="kicker">Budget terpakai</div>
         <div class="used-main-value">${fmt(totalUsed)}</div>
         <div class="list-sub">dari ${fmt(totalBudget)}</div>
         <div class="budget-total-progress">
           <i class="${totalUsedPct>100?'over':''}" style="width:${Math.min(100,totalUsedPct)}%"></i>
         </div>
         <div class="budget-used-footer">
           <b class="${totalUsedPct>100?'red':totalUsedPct>=80?'budget-warning':'green'}">${totalUsedPct}% terpakai</b>
           <span>Sisa budget ${fmt(totalRemaining)}</span>
         </div>
         <div class="outside-budget-row">
           <span>Pengeluaran di luar budget</span>
           <b>${fmt(outsideBudget)}</b>
         </div>
       </div>
     </div>

     ${alloc.length?`
       <div class="budget-legend">
         ${alloc.map(x=>`
           <div>
             <i style="background:${x.color}"></i>
             <span>${esc(x.category)}</span>
             <b>${Math.round(x.share)}%</b>
           </div>
         `).join('')}
       </div>
       <div class="budget-legend-note">
         Persentase warna menunjukkan <b>porsi alokasi budget</b>. Pemakaian aktual terlihat pada kartu tiap kategori.
       </div>
     `:''}
   </div>

   <div class="section list">
     ${budgets.length
       ?budgets.map((b,i)=>budgetCard(b,i)).join('')
       :'<div class="empty">Belum ada budget untuk bulan ini.</div>'}
   </div>
 `:`
   <div class="section-head">
     <div><h3>Target Keuangan</h3><p>${state.goals.length} target</p></div>
     <button class="link-btn" id="addGoalBtn">+ Tambah</button>
   </div>
   <div class="section list">
     ${state.goals.length
       ?state.goals.map(g=>goalDetail(g)).join('')
       :'<div class="empty">Belum ada target.</div>'}
   </div>
 `}`;
}

function renderHomeBudget(k){
 const budgets=state.budgets.filter(b=>b&&b.month===k);
 const total=budgets.reduce((s,b)=>s+(Number(b.limit)||0),0);
 const used=budgetedLivingUsedForMonth(k);
 const pct=total>0?Math.round(used/total*100):0;

 return `<section class="card home-budget-card">
   <div class="section-head">
     <div><h3>Budget ${shortMonthLabel(k)}</h3><p>Alokasi budget hidup bulan ini</p></div>
     <button class="link-btn" data-plan-link="budget">Lihat semua</button>
   </div>
   ${budgets.length?`
     <div class="home-budget-main">
       <div class="donut-holder home-budget-donut">
         <div class="donut" style="background:${budgetGradient(budgets)}"></div>
         <div class="donut-label home-budget-center">
           <b>${fmt(total)}</b>
           <small>Total Budget</small>
         </div>
       </div>
       <div class="home-budget-info">
         <div class="kicker">Terpakai</div>
         <div class="mini-value">${fmt(used)}</div>
         <div class="list-sub">${pct}% dari total budget</div>
         <div class="budget-total-progress"><i class="${pct>100?'over':''}" style="width:${Math.min(100,pct)}%"></i></div>
       </div>
     </div>
     <div class="home-budget-legend">
       ${budgetAllocation(budgets).slice(0,5).map(x=>`<span><i style="background:${x.color}"></i>${esc(x.category)} ${Math.round(x.share)}%</span>`).join('')}
       ${budgets.length>5?`<span>+${budgets.length-5} kategori</span>`:''}
     </div>
   `:'<div class="empty compact-empty">Belum ada budget untuk bulan ini.</div>'}
 </section>`;
}

function cicilanCategorySelected(){
 const sel=$('#txCategory');
 return manualTxType==='expense' && /cicilan|utang/i.test(String(sel?.value||''));
}

function syncCicilanPanel(){
 const panel=$('#cicilanLinkPanel');
 if(!panel)return;
 const show=cicilanCategorySelected();
 panel.classList.toggle('hidden',!show);

 const mode=$('#cicilanDebtMode');
 const existing=$('#existingDebtWrap');
 const fresh=$('#newDebtWrap');
 if(mode){
   const syncMode=()=>{
     existing?.classList.toggle('hidden',mode.value!=='existing');
     fresh?.classList.toggle('hidden',mode.value!=='new');
   };
   mode.onchange=syncMode;
   syncMode();
 }
}

function saveManualTransactionV60(form){
 const fd=new FormData(form);
 const type=String(fd.get('type')||manualTxType);
 const amount=Number(fd.get('amount')||0);
 const date=String(fd.get('date')||today());

 if(amount<=0)return toast('Nominal harus lebih dari 0.');

 if(type==='transfer'){
   if(state.accounts.length<2)return toast('Transfer membutuhkan minimal 2 akun.');
   const fromAccountId=String(fd.get('fromAccountId')||'');
   const toAccountId=String(fd.get('toAccountId')||'');
   if(!fromAccountId||!toAccountId||fromAccountId===toAccountId)return toast('Pilih akun asal dan tujuan yang berbeda.');
   if(accountBalance(fromAccountId)<amount)return toast(`Saldo ${accountName(fromAccountId)} tidak mencukupi.`);
   state.transactions.push({id:uid(),type:'transfer',date,amount,fromAccountId,toAccountId,category:'Transfer',note:String(fd.get('note')||'')});
   save();toast('Transfer tersimpan.');navigate('transactions');return;
 }

 if(!state.accounts.length)return toast('Tambahkan akun terlebih dahulu.');
 const accountId=String(fd.get('accountId')||'');
 const category=String(fd.get('category')||'Lainnya');
 const note=String(fd.get('note')||'');

 if(type==='expense'&&accountBalance(accountId)<amount){
   return toast(`Saldo ${accountName(accountId)} tidak mencukupi.`);
 }

 if(type==='expense'&&/cicilan|utang/i.test(category)){
   const mode=String(fd.get('cicilanDebtMode')||'new');
   let debt=null;

   if(mode==='existing'){
     debt=state.debts.find(d=>d.id===String(fd.get('existingDebtId')||'')&&d.type==='payable');
     if(!debt)return toast('Pilih utang yang ingin dibayar.');
     if(amount>debtOutstanding(debt))return toast(`Sisa utang hanya ${fmt(debtOutstanding(debt))}.`);
   }else{
     const person=String(fd.get('newDebtPerson')||'').trim();
     const principal=Number(fd.get('newDebtPrincipal')||0);
     const interest=Number(fd.get('newDebtInterest')||0);
     const admin=Number(fd.get('newDebtAdmin')||0);
     const total=principal+interest+admin;

     if(!person)return toast('Isi nama pihak atau layanan utang.');
     if(principal<=0)return toast('Isi total pokok utang.');
     if(total<amount)return toast('Total utang tidak boleh lebih kecil dari cicilan yang sedang dibayar.');

     debt={
       id:uid(),type:'payable',person,principal,interest,admin,amount:total,
       installments:Number(fd.get('newDebtInstallments')||0),
       paid:0,dueDate:String(fd.get('newDebtDueDate')||''),
       note:'Dibuat otomatis dari transaksi kategori Cicilan',
       status:'active',paidDate:'',payments:[]
     };
     state.debts.push(debt);
   }

   const txId=uid();
   const paymentId=uid();

   debt.payments=Array.isArray(debt.payments)?debt.payments:[];
   debt.payments.push({id:paymentId,txId,date,amount,accountId,direction:'out'});
   debt.paid=Math.min(debtTotalAmount(debt),(Number(debt.paid)||0)+amount);

   if(debt.paid>=debtTotalAmount(debt)-0.5){
     debt.paid=debtTotalAmount(debt);
     debt.status='paid';
     debt.paidDate=date;
   }else{
     debt.status='active';
   }

   state.transactions.push({
     id:txId,type:'expense',date,amount,accountId,category:'Cicilan',
     note:note||`Bayar cicilan ${debt.person}`,
     debtId:debt.id,paymentId,source:'linked_payment'
   });

   save();
   toast(mode==='new'?'Utang dibuat dan cicilan tercatat.':'Cicilan dan sisa utang berhasil diperbarui.');
   navigate('transactions');
   return;
 }

 state.transactions.push({id:uid(),type,date,amount,accountId,category,note});
 save();toast('Transaksi tersimpan');navigate('transactions');
}


function ensureDebtCategoriesV62(){
 let changed=false;
 state.categoryIcons=state.categoryIcons||{};
 const rows=[
   ['Utang & Cicilan','💳'],
   ['Cicilan','💳']
 ];
 rows.forEach(([name,icon])=>{
   if(!state.categories.includes(name)){
     state.categories.push(name);
     changed=true;
   }
   if(!state.categoryIcons[name]){
     state.categoryIcons[name]=icon;
     changed=true;
   }
 });
 if(changed)save();
}

function debtCategorySelectedV62(){
 const sel=$('#txCategory');
 return /utang|cicilan/i.test(String(sel?.value||''));
}

function loanIncomeSelectedV62(){
 return manualTxType==='income' && debtCategorySelectedV62();
}

function debtPaymentSelectedV62(){
 return manualTxType==='expense' && debtCategorySelectedV62();
}

function activePayableDebtsV62(){
 return state.debts.filter(d=>
   d&&d.type==='payable'&&d.status!=='paid'&&debtOutstanding(d)>0
 );
}

function loanIncomePanelV62(){
 const active=activePayableDebtsV62();

 return `<div id="loanIncomePanelV62" class="debt-smart-panel hidden">
   <div class="form-note debt-smart-note income-note">
     💰 <b>Pemasukan + Utang & Cicilan</b> berarti kamu sedang menerima uang pinjaman.
     Saldo akun bertambah dan utang otomatis dibuat/ditambah.
   </div>

   <div class="field">
     <label>Jenis Pinjaman</label>
     <select id="loanModeV62" name="loanMode">
       <option value="new">Pinjaman baru</option>
       ${active.length?'<option value="topup">Tambah pinjaman yang sudah ada</option>':''}
     </select>
   </div>

   <div id="loanNewWrapV62">
     <div class="field">
       <label>Sumber Utang</label>
       <select name="loanSourceType">
         <option>PayLater / Cicilan</option>
         <option>Pinjaman Orang</option>
         <option>Bank / Koperasi</option>
         <option>Kartu Kredit</option>
         <option>Lainnya</option>
       </select>
     </div>

     <div class="field">
       <label>Pinjam dari siapa / layanan apa</label>
       <input name="loanPerson" placeholder="Contoh: YUP, Shopee PayLater, Ibu, Bank">
     </div>

     <div class="row">
       <div class="field">
         <label>Total Bunga</label>
         <input type="number" name="loanInterest" min="0" placeholder="Opsional">
       </div>
       <div class="field">
         <label>Biaya Admin</label>
         <input type="number" name="loanAdmin" min="0" placeholder="Opsional">
       </div>
     </div>

     <div class="row">
       <div class="field">
         <label>Jumlah Cicilan</label>
         <input type="number" name="loanInstallments" min="1" placeholder="Contoh: 12">
       </div>
       <div class="field">
         <label>Jatuh Tempo</label>
         <input type="date" name="loanDueDate">
       </div>
     </div>
   </div>

   <div id="loanTopupWrapV62" class="hidden">
     <div class="field">
       <label>Pilih Utang</label>
       <select name="loanExistingDebtId">
         ${active.map(d=>`
           <option value="${d.id}">
             ${esc(d.person||'Utang')} • sisa ${fmt(debtOutstanding(d))}
           </option>
         `).join('')}
       </select>
     </div>

     <div class="row">
       <div class="field">
         <label>Tambahan Bunga</label>
         <input type="number" name="loanTopupInterest" min="0" placeholder="Opsional">
       </div>
       <div class="field">
         <label>Tambahan Admin</label>
         <input type="number" name="loanTopupAdmin" min="0" placeholder="Opsional">
       </div>
     </div>
   </div>

   <div class="form-note">
     Nominal transaksi dianggap sebagai <b>pokok pinjaman yang benar-benar masuk ke akun</b>.
     Total kewajiban = pokok + bunga + admin.
   </div>
 </div>`;
}

function debtPaymentPanelV62(){
 const active=activePayableDebtsV62();
 const defaultMode=active.length?'existing':'new';

 return `<div id="debtPaymentPanelV62" class="debt-smart-panel hidden">
   <div class="form-note debt-smart-note expense-note">
     💳 <b>Pengeluaran + Utang & Cicilan</b> berarti kamu sedang membayar utang/cicilan.
   </div>

   <div class="field">
     <label>Hubungkan Pembayaran</label>
     <select id="debtPayModeV62" name="debtPayMode">
       ${active.length?'<option value="existing">Utang yang sudah ada</option>':''}
       <option value="new" ${defaultMode==='new'?'selected':''}>Buat utang baru</option>
     </select>
   </div>

   <div id="debtPayExistingWrapV62" class="${defaultMode==='existing'?'':'hidden'}">
     <div class="field">
       <label>Pilih Utang</label>
       <select name="existingDebtId">
         ${active.map(d=>`
           <option value="${d.id}">
             ${esc(d.person||'Utang')} • sisa ${fmt(debtOutstanding(d))}
           </option>
         `).join('')}
       </select>
     </div>
   </div>

   <div id="debtPayNewWrapV62" class="${defaultMode==='new'?'':'hidden'}">
     <div class="field">
       <label>Utang ke siapa / layanan apa</label>
       <input name="newDebtPerson" placeholder="Contoh: YUP, Shopee PayLater, BCA">
     </div>

     <div class="field">
       <label>Total Pokok Utang</label>
       <input type="number" name="newDebtPrincipal" min="1" placeholder="Total pokok, bukan cicilan hari ini">
     </div>

     <div class="row">
       <div class="field">
         <label>Total Bunga</label>
         <input type="number" name="newDebtInterest" min="0" placeholder="Opsional">
       </div>
       <div class="field">
         <label>Biaya Admin</label>
         <input type="number" name="newDebtAdmin" min="0" placeholder="Opsional">
       </div>
     </div>

     <div class="row">
       <div class="field">
         <label>Jumlah Cicilan</label>
         <input type="number" name="newDebtInstallments" min="1" placeholder="Contoh: 12">
       </div>
       <div class="field">
         <label>Jatuh Tempo</label>
         <input type="date" name="newDebtDueDate">
       </div>
     </div>
   </div>
 </div>`;
}

function renderAddTransaction(){
 ensureDebtCategoriesV62();

 const selectedType=['income','expense','transfer'].includes(manualTxType)
   ?manualTxType
   :'income';

 const accounts=state.accounts||[];

 if(selectedType==='transfer'){
   return `<div class="card flat">
     <div class="tabs tx-type-tabs">
       <button class="tab" id="typeIncome">Pemasukan</button>
       <button class="tab" id="typeExpense">Pengeluaran</button>
       <button class="tab active" id="typeTransfer">Transfer</button>
     </div>

     <form id="txForm" class="form">
       <input type="hidden" name="type" id="txType" value="transfer">

       <div class="field">
         <label>Tanggal</label>
         <input type="date" name="date" value="${today()}" required>
       </div>

       <div class="field">
         <label>Jumlah</label>
         <input id="txAmount" type="number" name="amount" min="1" placeholder="Masukkan nominal" required>
       </div>

       <div class="field">
         <label>Dari Akun</label>
         <select name="fromAccountId" ${accounts.length>=2?'':'disabled'}>
           ${accounts.map(a=>`<option value="${a.id}">${esc(a.name)} • ${fmt(accountBalance(a.id))}</option>`).join('')}
         </select>
       </div>

       <div class="field">
         <label>Ke Akun</label>
         <select name="toAccountId" ${accounts.length>=2?'':'disabled'}>
           ${accounts.map((a,i)=>`<option value="${a.id}" ${i===1?'selected':''}>${esc(a.name)}</option>`).join('')}
         </select>
       </div>

       ${accounts.length<2?'<div class="form-note">Transfer membutuhkan minimal 2 akun.</div>':''}

       <div class="field">
         <label>Catatan</label>
         <textarea name="note" placeholder="Contoh: Pindah dana ke tabungan"></textarea>
       </div>

       <div class="quick-amounts">
         <button type="button" data-add-amount="10000">+10rb</button>
         <button type="button" data-add-amount="50000">+50rb</button>
         <button type="button" data-add-amount="100000">+100rb</button>
       </div>

       <button class="btn block big-save" type="submit" ${accounts.length<2?'disabled':''}>Simpan Transfer</button>
     </form>
   </div>`;
 }

 return `<div class="card flat">
   <div class="tabs tx-type-tabs">
     <button class="tab ${selectedType==='income'?'active':''}" id="typeIncome">Pemasukan</button>
     <button class="tab ${selectedType==='expense'?'active':''}" id="typeExpense">Pengeluaran</button>
     <button class="tab" id="typeTransfer">Transfer</button>
   </div>

   <form id="txForm" class="form">
     <input type="hidden" name="type" id="txType" value="${selectedType}">

     <div class="field">
       <label>Tanggal</label>
       <input type="date" name="date" value="${today()}" required>
     </div>

     <div class="field">
       <label>Jumlah</label>
       <input id="txAmount" type="number" name="amount" min="1" placeholder="Masukkan nominal" required>
     </div>

     <div class="field">
       <label>Kategori</label>
       <select id="txCategory" name="category">
         ${state.categories.map(c=>`<option>${esc(c)}</option>`).join('')}
       </select>
     </div>

     ${salesPaymentPanelV73()}
     ${loanIncomePanelV62()}
     ${debtPaymentPanelV62()}

     <div class="field">
       <label>${selectedType==='income'?'Masuk ke Akun':'Bayar dari Akun'}</label>
       <select name="accountId" ${accounts.length?'':'disabled'}>
         ${accounts.length
           ?accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')
           :'<option>Belum ada akun — tambah dulu di Akun & Dompet</option>'}
       </select>
     </div>

     <div class="field">
       <label>Catatan</label>
       <textarea name="note" placeholder="Tulis catatan..."></textarea>
     </div>

     <div class="quick-amounts">
       <button type="button" data-add-amount="10000">+10rb</button>
       <button type="button" data-add-amount="50000">+50rb</button>
       <button type="button" data-add-amount="100000">+100rb</button>
     </div>

     <button class="btn block big-save" type="submit">Simpan</button>
   </form>
 </div>`;
}

function syncDebtPanelsV62(){
 const incomePanel=$('#loanIncomePanelV62');
 const paymentPanel=$('#debtPaymentPanelV62');

 incomePanel?.classList.toggle('hidden',!loanIncomeSelectedV62());
 paymentPanel?.classList.toggle('hidden',!debtPaymentSelectedV62());

 const loanMode=$('#loanModeV62');
 const newWrap=$('#loanNewWrapV62');
 const topupWrap=$('#loanTopupWrapV62');

 if(loanMode){
   const syncLoanMode=()=>{
     newWrap?.classList.toggle('hidden',loanMode.value!=='new');
     topupWrap?.classList.toggle('hidden',loanMode.value!=='topup');
   };
   loanMode.onchange=syncLoanMode;
   syncLoanMode();
 }

 const payMode=$('#debtPayModeV62');
 const payExisting=$('#debtPayExistingWrapV62');
 const payNew=$('#debtPayNewWrapV62');

 if(payMode){
   const syncPayMode=()=>{
     payExisting?.classList.toggle('hidden',payMode.value!=='existing');
     payNew?.classList.toggle('hidden',payMode.value!=='new');
   };
   payMode.onchange=syncPayMode;
   syncPayMode();
 }
}

function createLoanIncomeV62(fd,amount,date,accountId,note){
 const mode=String(fd.get('loanMode')||'new');

 if(mode==='topup'){
   const debt=state.debts.find(d=>
     d.id===String(fd.get('loanExistingDebtId')||'')&&
     d.type==='payable'
   );
   if(!debt)return toast('Pilih utang yang ingin ditambah.');

   const addInterest=Math.max(0,Number(fd.get('loanTopupInterest')||0));
   const addAdmin=Math.max(0,Number(fd.get('loanTopupAdmin')||0));

   debt.principal=Math.max(0,Number(debt.principal)||0)+amount;
   debt.interest=Math.max(0,Number(debt.interest)||0)+addInterest;
   debt.admin=Math.max(0,Number(debt.admin)||0)+addAdmin;
   debt.amount=debt.principal+debt.interest+debt.admin;
   debt.status=debt.paid>=debt.amount-0.5?'paid':'active';
   if(debt.status!=='paid')debt.paidDate='';

   const txId=uid();
   state.transactions.push({
     id:txId,
     type:'income',
     date,
     amount,
     accountId,
     category:'Utang & Cicilan',
     note:note||`Tambah pinjaman ${debt.person||''}`.trim(),
     debtId:debt.id,
     source:'debt_proceeds',
     loanMode:'topup'
   });

   save();
   toast(`Pinjaman bertambah. Total utang sekarang ${fmt(debt.amount)}.`);
   navigate('transactions');
   return true;
 }

 const person=String(fd.get('loanPerson')||'').trim();
 const sourceType=String(fd.get('loanSourceType')||'Lainnya');
 const interest=Math.max(0,Number(fd.get('loanInterest')||0));
 const admin=Math.max(0,Number(fd.get('loanAdmin')||0));
 const installments=Math.max(0,Number(fd.get('loanInstallments')||0));
 const dueDate=String(fd.get('loanDueDate')||'');

 if(!person){
   toast('Isi nama pihak atau layanan tempat kamu meminjam.');
   return false;
 }

 const debtId=uid();
 const txId=uid();
 const totalDebt=amount+interest+admin;

 state.debts.push({
   id:debtId,
   type:'payable',
   person,
   sourceType,
   principal:amount,
   interest,
   admin,
   amount:totalDebt,
   installments,
   paid:0,
   dueDate,
   note:'Dibuat otomatis dari pemasukan kategori Utang & Cicilan',
   status:'active',
   paidDate:'',
   payments:[],
   sourceTransactionId:txId
 });

 state.transactions.push({
   id:txId,
   type:'income',
   date,
   amount,
   accountId,
   category:'Utang & Cicilan',
   note:note||`Pinjaman dari ${person}`,
   debtId,
   source:'debt_proceeds',
   loanMode:'new'
 });

 save();
 toast(`Uang pinjaman masuk. Utang ${fmt(totalDebt)} otomatis dibuat.`);
 navigate('transactions');
 return true;
}

function createDebtPaymentV62(fd,amount,date,accountId,note){
 const mode=String(fd.get('debtPayMode')||'new');
 let debt=null;

 if(mode==='existing'){
   debt=state.debts.find(d=>
     d.id===String(fd.get('existingDebtId')||'')&&
     d.type==='payable'
   );

   if(!debt)return toast('Pilih utang yang ingin dibayar.');
   if(amount>debtOutstanding(debt)){
     return toast(`Sisa utang hanya ${fmt(debtOutstanding(debt))}.`);
   }
 }else{
   const person=String(fd.get('newDebtPerson')||'').trim();
   const principal=Math.max(0,Number(fd.get('newDebtPrincipal')||0));
   const interest=Math.max(0,Number(fd.get('newDebtInterest')||0));
   const admin=Math.max(0,Number(fd.get('newDebtAdmin')||0));
   const total=principal+interest+admin;

   if(!person)return toast('Isi nama pihak atau layanan utang.');
   if(principal<=0)return toast('Isi total pokok utang.');
   if(total<amount)return toast('Total utang tidak boleh lebih kecil dari cicilan hari ini.');

   debt={
     id:uid(),
     type:'payable',
     person,
     principal,
     interest,
     admin,
     amount:total,
     installments:Math.max(0,Number(fd.get('newDebtInstallments')||0)),
     paid:0,
     dueDate:String(fd.get('newDebtDueDate')||''),
     note:'Dibuat otomatis dari pengeluaran kategori Utang & Cicilan',
     status:'active',
     paidDate:'',
     payments:[]
   };
   state.debts.push(debt);
 }

 const txId=uid();
 const paymentId=uid();

 debt.payments=Array.isArray(debt.payments)?debt.payments:[];
 debt.payments.push({
   id:paymentId,
   txId,
   date,
   amount,
   accountId,
   direction:'out'
 });

 debt.paid=Math.min(debtTotalAmount(debt),(Number(debt.paid)||0)+amount);

 if(debt.paid>=debtTotalAmount(debt)-0.5){
   debt.paid=debtTotalAmount(debt);
   debt.status='paid';
   debt.paidDate=date;
 }else{
   debt.status='active';
   debt.paidDate='';
 }

 state.transactions.push({
   id:txId,
   type:'expense',
   date,
   amount,
   accountId,
   category:'Utang & Cicilan',
   note:note||`Bayar cicilan ${debt.person||''}`.trim(),
   debtId:debt.id,
   paymentId,
   source:'linked_payment'
 });

 save();
 toast(mode==='new'
   ?'Utang dibuat dan pembayaran cicilan tercatat.'
   :'Pembayaran cicilan dan sisa utang diperbarui.'
 );
 navigate('transactions');
 return true;
}

function saveManualTransactionCore(form){
 const fd=new FormData(form);
 const type=String(fd.get('type')||manualTxType);
 const amount=Number(fd.get('amount')||0);
 const date=String(fd.get('date')||today());

 if(amount<=0)return toast('Nominal harus lebih dari 0.');

 if(type==='transfer'){
   if(state.accounts.length<2)return toast('Transfer membutuhkan minimal 2 akun.');

   const fromAccountId=String(fd.get('fromAccountId')||'');
   const toAccountId=String(fd.get('toAccountId')||'');

   if(!fromAccountId||!toAccountId||fromAccountId===toAccountId){
     return toast('Pilih akun asal dan tujuan yang berbeda.');
   }

   if(accountBalance(fromAccountId)<amount){
     return toast(`Saldo ${accountName(fromAccountId)} tidak mencukupi.`);
   }

   state.transactions.push({
     id:uid(),
     type:'transfer',
     date,
     amount,
     fromAccountId,
     toAccountId,
     category:'Transfer',
     note:String(fd.get('note')||'')
   });

   save();
   toast('Transfer tersimpan.');
   navigate('transactions');
   return;
 }

 if(!state.accounts.length)return toast('Tambahkan akun terlebih dahulu.');

 const accountId=String(fd.get('accountId')||'');
 const category=String(fd.get('category')||'Lainnya');
 const note=String(fd.get('note')||'');

 if(type==='income'&&/utang|cicilan/i.test(category)){
   return createLoanIncomeV62(fd,amount,date,accountId,note);
 }

 if(type==='expense'&&/utang|cicilan/i.test(category)){
   if(accountBalance(accountId)<amount){
     return toast(`Saldo ${accountName(accountId)} tidak mencukupi.`);
   }
   return createDebtPaymentV62(fd,amount,date,accountId,note);
 }

 if(type==='expense'&&accountBalance(accountId)<amount){
   return toast(`Saldo ${accountName(accountId)} tidak mencukupi.`);
 }

 state.transactions.push({
   id:uid(),
   type,
   date,
   amount,
   accountId,
   category,
   note
 });

 save();
 toast('Transaksi tersimpan');
 navigate('transactions');
}

function applyLinkedTransactionEditCore(t,old){
 if(t.debtId){
   const d=state.debts.find(x=>x.id===t.debtId);

   if(d&&t.source==='debt_proceeds'){
     const delta=(Number(t.amount)||0)-(Number(old.amount)||0);

     d.principal=Math.max(0,(Number(d.principal)||0)+delta);
     d.amount=d.principal+(Number(d.interest)||0)+(Number(d.admin)||0);

     if((Number(d.paid)||0)>d.amount){
       d.paid=d.amount;
     }

     if(d.amount>0&&(Number(d.paid)||0)>=d.amount-0.5){
       d.status='paid';
       d.paidDate=t.date;
     }else{
       d.status='active';
       d.paidDate='';
     }
     return;
   }

   if(d){
     const p=findDebtPaymentForTx(d,old)||findDebtPaymentForTx(d,t);
     if(p){
       p.amount=Number(t.amount)||0;
       p.accountId=t.accountId;
       p.date=t.date;
       p.direction=t.type==='income'?'in':'out';
       p.txId=t.id;
       t.paymentId=p.id;
     }

     const delta=(Number(t.amount)||0)-(Number(old.amount)||0);
     d.paid=Math.max(0,Math.min(debtTotalAmount(d),(Number(d.paid)||0)+delta));

     if(d.paid>=debtTotalAmount(d)-0.5){
       d.paid=debtTotalAmount(d);
       d.status='paid';
       d.paidDate=t.date;
     }else{
       d.status='active';
       d.paidDate='';
     }
   }
 }

 if(t.billId){
   const b=state.bills.find(x=>x.id===t.billId);
   if(b){
     const p=findBillPaymentForTx(b,old)||findBillPaymentForTx(b,t);
     if(p){
       p.amount=Number(t.amount)||0;
       p.accountId=t.accountId;
       p.date=t.date;
       p.txId=t.id;
       t.paymentId=p.id;
     }

     if(b.recurrence!=='monthly'&&b.status==='paid')b.paidDate=t.date;
     if(b.recurrence==='monthly'&&p&&p.dueDate===b.lastPaidDueDate)b.lastPaidDate=t.date;
   }
 }
}

function removeLinkedTransactionEffectsCore(t){
 if(t.debtId){
   const d=state.debts.find(x=>x.id===t.debtId);

   if(d&&t.source==='debt_proceeds'){
     const hasPayments=(d.payments||[]).length>0||(Number(d.paid)||0)>0;

     if(t.loanMode==='new'&&!hasPayments){
       state.debts=state.debts.filter(x=>x.id!==d.id);
       return;
     }

     d.principal=Math.max(0,(Number(d.principal)||0)-(Number(t.amount)||0));
     d.amount=d.principal+(Number(d.interest)||0)+(Number(d.admin)||0);

     if((Number(d.paid)||0)>d.amount)d.paid=d.amount;

     if(d.amount<=0&&!hasPayments){
       state.debts=state.debts.filter(x=>x.id!==d.id);
     }else if(d.amount>0&&(Number(d.paid)||0)>=d.amount-0.5){
       d.status='paid';
     }else{
       d.status='active';
       d.paidDate='';
     }
     return;
   }

   if(d){
     const p=findDebtPaymentForTx(d,t);
     d.paid=Math.max(0,(Number(d.paid)||0)-(Number(t.amount)||0));
     if(p)d.payments=(d.payments||[]).filter(x=>x.id!==p.id);
     if(d.paid<debtTotalAmount(d)-0.5){
       d.status='active';
       d.paidDate='';
     }
   }
 }

 if(t.billId){
   const b=state.bills.find(x=>x.id===t.billId);
   if(b){
     const p=findBillPaymentForTx(b,t);
     const wasLatest=p&&p.dueDate===b.lastPaidDueDate;

     if(p)b.paymentHistory=(b.paymentHistory||[]).filter(x=>x.id!==p.id);

     if(b.recurrence==='monthly'){
       if(wasLatest){
         b.dueDate=p.dueDate;
         const prev=[...(b.paymentHistory||[])]
           .sort((a,z)=>String(a.dueDate||'').localeCompare(String(z.dueDate||'')))
           .at(-1);

         b.lastPaidDueDate=prev?.dueDate||'';
         b.lastPaidDate=prev?.date||'';
       }

       b.status='active';
       if(b.notificationEnabled)scheduleBillReminder(b);
     }else{
       b.status='active';
       b.paidDate='';
       if(p?.dueDate)b.dueDate=p.dueDate;
       if(b.notificationEnabled)scheduleBillReminder(b);
     }
   }
 }
}


const categoryGroupDefsV63 = {
  debt:{label:'Utang / Cicilan', color:'#E66F72', icon:'💳'},
  bills:{label:'Tagihan', color:'#F2B84B', icon:'💡'},
  needs:{label:'Kebutuhan', color:'#65A2E3', icon:'🛒'},
  wants:{label:'Keinginan', color:'#9A7BDB', icon:'🎁'},
  sales:{label:'Penjualan', color:'#56B7A6', icon:'🛍️'},
  other:{label:'Lainnya', color:'#AAB4AD', icon:'📁'}
};

function defaultCategoryGroupV63(cat){
  const c=String(cat||'').toLowerCase();

  if(/utang|cicilan/.test(c)) return 'debt';

  if(/tagihan|listrik|air|wifi|internet|pulsa|telepon|pdam/.test(c)){
    return 'bills';
  }

  if(/makan|minum|transport|bensin|pertamax|parkir|ojek|grocer|sembako|sayur|buah|kesehatan|obat|dokter|vitamin|rumah sakit|pendidikan|sekolah|kursus|buku|rumah tangga|perabot|dapur|cleaning|pakan hewan|hewan|kucing|pet/.test(c)){
    return 'needs';
  }

  if(/hadiah|hiburan|game|film|rekreasi|jajan|shopping|belanja pribadi|hobi/.test(c)){
    return 'wants';
  }

  if(/penjualan|jualan|jual|omzet|order/.test(c)){
    return 'sales';
  }

  return 'other';
}

function ensureCategoryGroupsV63(){
  state.categoryGroups = state.categoryGroups && typeof state.categoryGroups==='object'
    ? state.categoryGroups
    : {};

  let changed=false;

  state.categories.forEach(c=>{
    if(!categoryGroupDefsV63[state.categoryGroups[c]]){
      state.categoryGroups[c]=defaultCategoryGroupV63(c);
      changed=true;
    }
  });

  // Migrate a few defaults explicitly so old data such as "Listrik" is fixed.
  const forced = {
    'Utang & Cicilan':'debt',
    'Cicilan':'debt',
    'Tagihan':'bills',
    'Listrik':'needs',
    'Air':'bills',
    'WiFi':'bills',
    'Internet':'bills',
    'Makan & Minum':'needs',
    'Transportasi':'needs',
    'Groceries':'needs',
    'Kesehatan':'needs',
    'Pendidikan':'needs',
    'Rumah Tangga':'needs',
    'Pakan Hewan':'needs',
    'Hadiah':'wants',
    'Hiburan':'wants',
    'Penjualan':'sales',
    'Lainnya':'other'
  };

  Object.entries(forced).forEach(([cat,group])=>{
    if(state.categories.includes(cat) && state.categoryGroups[cat]!==group){
      state.categoryGroups[cat]=group;
      changed=true;
    }
  });

  if(changed) save();
  return state.categoryGroups;
}

function categoryGroupV63(cat){
  ensureCategoryGroupsV63();
  return state.categoryGroups[cat] || defaultCategoryGroupV63(cat);
}

function categoryGroupOptionsV63(selected='other'){
  return Object.entries(categoryGroupDefsV63).map(([key,v])=>
    `<option value="${key}" ${selected===key?'selected':''}>${v.icon} ${v.label}</option>`
  ).join('');
}

function openCategoryModalV63(index=null){
  const editing=Number.isInteger(index)&&index>=0&&index<state.categories.length;
  if(!editing && state.categories.length>=100)return toast('Maksimal 100 kategori');

  ensureCategoryGroupsV63();

  const oldName=editing?state.categories[index]:'';
  const selectedIcon=editing?(state.categoryIcons?.[oldName]||iconFor(oldName)):'📁';
  const selectedGroup=editing?categoryGroupV63(oldName):'other';

  openModal(editing?'Edit Kategori':'Tambah Kategori',
  `<form class="form">
    <div class="field">
      <label>Nama Kategori</label>
      <input name="name" maxlength="40" value="${esc(oldName)}" placeholder="Contoh: Skincare" required>
    </div>

    ${categoryIconPicker(selectedIcon)}

    <div class="field">
      <label>Kelompok Pengeluaran</label>
      <select name="group">
        ${categoryGroupOptionsV63(selectedGroup)}
      </select>
      <div class="list-sub">
        Dipakai untuk Ringkasan Beranda dan pie Alokasi Pengeluaran.
        Kalau kategori ini dipakai sebagai pemasukan, kelompok ini tidak mengubah perhitungan pemasukan.
      </div>
    </div>

    <button class="btn block">${editing?'Simpan Perubahan':'Simpan Kategori'}</button>
  </form>`,
  fd=>{
    const n=String(fd.get('name')||'').trim();
    const icon=String(fd.get('icon')||'📁');
    const group=String(fd.get('group')||'other');

    if(!n)return toast('Nama kategori wajib diisi.');
    if(!categoryGroupDefsV63[group])return toast('Kelompok kategori tidak valid.');

    const duplicate=state.categories.some((x,idx)=>
      idx!==index && x.toLowerCase()===n.toLowerCase()
    );
    if(duplicate)return toast('Kategori sudah ada.');

    state.categoryIcons=state.categoryIcons||{};
    state.categoryGroups=state.categoryGroups||{};

    if(editing){
      if(n!==oldName){
        state.transactions.forEach(t=>{
          if(t&&t.category===oldName)t.category=n;
        });
        state.budgets.forEach(b=>{
          if(b&&b.category===oldName)b.category=n;
        });

        delete state.categoryIcons[oldName];
        delete state.categoryGroups[oldName];
        state.categories[index]=n;
      }

      state.categoryIcons[n]=icon;
      state.categoryGroups[n]=group;
    }else{
      state.categories.push(n);
      state.categoryIcons[n]=icon;
      state.categoryGroups[n]=group;
    }

    save();
    closeModal();
    toast(editing?'Kategori diperbarui.':'Kategori ditambahkan.');
    render();
  });

  setTimeout(()=>{
    $$('#modalBody [data-category-icon]').forEach(btn=>{
      btn.onclick=()=>{
        $$('#modalBody [data-category-icon]').forEach(x=>x.classList.remove('selected'));
        btn.classList.add('selected');
        $('#categoryIconValue').value=btn.dataset.categoryIcon;
      };
    });
  },0);
}

function expenseGroupForTxV63(t){
  if(!t||t.type!=='expense')return null;

  if(t.debtId)return 'debt';
  if(t.billId)return 'bills';

  return categoryGroupV63(t.category);
}

function homeExpenseComposition(k){
  ensureCategoryGroupsV63();

  const values={debt:0,bills:0,needs:0,wants:0,sales:0,other:0};

  state.transactions
    .filter(t=>t&&t.type==='expense'&&monthKey(t.date)===k)
    .forEach(t=>{
      const group=expenseGroupForTxV63(t)||'other';
      values[group]=(values[group]||0)+(Number(t.amount)||0);
    });

  const total=Object.values(values).reduce((s,v)=>s+v,0);
  const share=n=>total>0?n/total*100:0;

  return {
    total,
    ...values,
    debtPct:share(values.debt),
    billsPct:share(values.bills),
    needsPct:share(values.needs),
    wantsPct:share(values.wants),
    salesPct:share(values.sales),
    otherPct:share(values.other)
  };
}

function monthlyMoneyAllocation(k){
  const income=monthTotals(k).income;
  const x=homeExpenseComposition(k);
  const spent=x.total;
  const spentPct=income>0?Math.round(spent/income*100):0;
  const overSpending=Math.max(0,spent-income);

  return {
    income,
    debt:x.debt,
    bills:x.bills,
    needs:x.needs,
    wants:x.wants,
    sales:x.sales,
    other:x.other,
    living:x.needs+x.wants+x.sales+x.other,
    spent,
    spentPct,
    overSpending
  };
}

function monthlyAllocationItems(k){
  const a=monthlyMoneyAllocation(k);
  return ['debt','bills','needs','wants','sales','other']
    .map(key=>({
      key,
      label:categoryGroupDefsV63[key].label,
      amount:Number(a[key])||0,
      color:categoryGroupDefsV63[key].color
    }))
    .filter(x=>x.amount>0);
}

function monthlyAllocationGradient(k){
  const items=monthlyAllocationItems(k);
  const total=items.reduce((s,x)=>s+x.amount,0);
  if(total<=0)return '#E9EFE7';

  let pos=0;
  return `conic-gradient(${items.map(x=>{
    const start=pos;
    pos+=x.amount/total*100;
    return `${x.color} ${start.toFixed(2)}% ${pos.toFixed(2)}%`;
  }).join(',')})`;
}

function renderMonthlyMoneyAllocation(k){
  const a=monthlyMoneyAllocation(k);
  const items=monthlyAllocationItems(k);
  const base=Math.max(1,a.spent);

  return `<div class="card monthly-allocation-card monthly-allocation-v63">
    <div class="section-head">
      <div>
        <h3>Alokasi Pengeluaran ${monthLabel(k)}</h3>
        <p>Seluruh pengeluaran bulan ini menurut kelompok kategorinya</p>
      </div>
    </div>

    <div class="monthly-allocation-main">
      <div class="donut-holder monthly-allocation-donut">
        <div class="donut" style="background:${monthlyAllocationGradient(k)}"></div>
        <div class="donut-label monthly-allocation-center">
          <small>Total Pengeluaran</small>
          <b>${fmt(a.spent)}</b>
          <em>${a.income>0?`${a.spentPct}% dari pemasukan`:'bulan ini'}</em>
        </div>
      </div>

      <div class="monthly-allocation-summary">
        <div class="kicker">Pemasukan bulan ini</div>
        <div class="allocation-main-value">${fmt(a.income)}</div>
        <div class="list-sub">Pengeluaran ${fmt(a.spent)}</div>

        ${a.income>0?`
          <div class="allocation-progress">
            <i class="${a.spentPct>100?'over':''}" style="width:${Math.min(100,a.spentPct)}%"></i>
          </div>
          <div class="allocation-summary-footer">
            <b class="${a.spentPct>100?'red':a.spentPct>=90?'budget-warning':'green'}">${a.spentPct}% terpakai</b>
            <span>${a.spent<=a.income?`Sisa pemasukan ${fmt(a.income-a.spent)}`:`Lebih ${fmt(a.spent-a.income)}`}</span>
          </div>
        `:''}
      </div>
    </div>

    <div class="monthly-allocation-legend">
      ${items.length?items.map(x=>{
        const pct=Math.round(x.amount/base*100);
        return `<div class="allocation-legend-row">
          <i style="background:${x.color}"></i>
          <span>${x.label}</span>
          <b>${fmt(x.amount)}</b>
          <em>${pct}%</em>
        </div>`;
      }).join(''):'<div class="list-sub">Belum ada pengeluaran pada bulan ini.</div>'}
    </div>

    ${a.overSpending>0?`
      <div class="allocation-over-warning">
        ⚠️ Pengeluaran melebihi pemasukan bulan ini sebesar <b>${fmt(a.overSpending)}</b>.
        Kemungkinan sebagian dibayar dari saldo bulan sebelumnya.
      </div>
    `:''}
  </div>`;
}

ensureCategoryGroupsV63();


let homeSummaryExpandedV65 = localStorage.getItem('uangku_home_summary_v65') === '1';

function getUserNameV65(){
  return String(state.profile?.name||'').trim();
}

function isSavingsAccountV65(accountId){
  const a=state.accounts.find(x=>x&&x.id===accountId);
  return String(a?.type||'').toLowerCase()==='tabungan';
}

function isNeedSummaryCategoryV65(cat){
  const c=String(cat||'').toLowerCase();
  return /makan|minum|grocer|sembako|sayur|buah|transport|bensin|pertamax|parkir|ojek|kesehatan|obat|dokter|vitamin|rumah sakit|pendidikan|sekolah|kursus|buku|rumah tangga|perabot|dapur|cleaning|pakan hewan|hewan|kucing|pet|listrik|air|wifi|internet|pulsa|telepon|pdam/.test(c);
}

function isWantSummaryCategoryV65(cat){
  const c=String(cat||'').toLowerCase();
  if(/hadiah|hiburan|game|film|rekreasi|hobi/.test(c))return true;
  return typeof categoryGroupV63==='function' && categoryGroupV63(cat)==='wants';
}

function monthlyHomeSummaryV65(k){
  const m=monthTotals(k);
  const income=Math.max(0,Number(m.income)||0);

  const totalBudget=state.budgets
    .filter(b=>b&&b.month===k)
    .reduce((s,b)=>s+(Number(b.limit)||0),0);

  const budgetUsed=typeof budgetedLivingUsedForMonth==='function'
    ?budgetedLivingUsedForMonth(k)
    :0;

  let needs=0;
  let debt=0;
  let wantsOnly=0;

  state.transactions
    .filter(t=>t&&t.type==='expense'&&monthKey(t.date)===k)
    .forEach(t=>{
      const n=Number(t.amount)||0;
      if(typeof isDebtExpenseTx==='function' && isDebtExpenseTx(t)){
        debt+=n;
      }else if(isNeedSummaryCategoryV65(t.category)){
        needs+=n;
      }else if(isWantSummaryCategoryV65(t.category)){
        wantsOnly+=n;
      }
    });

  const wants=debt+wantsOnly;
  const sales=typeof salesSummary==='function'
    ?salesSummary(k)
    :{income:0,expense:0,profit:0};

  const savings=monthlySavingsAddedV65(k);

  const pct=n=>income>0?Math.round((Math.max(0,n)/income)*100):0;

  return {
    income,
    totalBudget,
    budgetUsed,
    budgetPct:pct(totalBudget),
    needs,
    needsPct:pct(needs),
    debt,
    debtPct:pct(debt),
    wantsOnly,
    wantsOnlyPct:pct(wantsOnly),
    wants,
    wantsPct:pct(wants),
    sales,
    salesPct:pct(sales.income),
    savings,
    savingsPct:pct(savings.total)
  };
}

function homeRecentTxItemV65(t){
  if(t.type==='transfer'){
    return `<div class="home-recent-tx-v65">
      <span class="round-icon bluebg">↔</span>
      <div class="list-main">
        <div class="list-title">${esc(t.note||'Transfer antar akun')}</div>
        <div class="list-sub">${esc(accountName(t.fromAccountId))} → ${esc(accountName(t.toAccountId))}</div>
      </div>
      <b class="home-recent-amount-v65 transfer">${fmt(t.amount)}</b>
    </div>`;
  }

  return `<div class="home-recent-tx-v65">
    <span class="round-icon ${t.type==='income'?'greenbg':'redbg'}">${iconFor(t.category)}</span>
    <div class="list-main">
      <div class="list-title">${esc(t.note||t.category||'Transaksi')}</div>
      <div class="list-sub">${esc(t.category||'Lainnya')} • ${esc(accountName(t.accountId))}</div>
    </div>
    <b class="home-recent-amount-v65 ${t.type==='income'?'in':'out'}">${t.type==='income'?'+':'−'} ${fmt(t.amount)}</b>
  </div>`;
}

function renderRecentTransactionsV65(){
  const recent=[...state.transactions]
    .filter(Boolean)
    .sort((a,b)=>(String(b.date||'')+String(b.id||'')).localeCompare(String(a.date||'')+String(a.id||'')))
    .slice(0,5);

  return `<section class="section recent-section-v65">
    <div class="section-head">
      <div>
        <h3>5 Transaksi Terakhir</h3>
        <p>${recent.length?`${recent.length} transaksi terbaru`:'Belum ada transaksi'}</p>
      </div>
      <button class="link-btn" data-nav="transactions">Lihat semua</button>
    </div>

    <div class="card recent-card-v65">
      ${recent.length
        ?recent.map(homeRecentTxItemV65).join('')
        :'<div class="empty compact-empty">Belum ada transaksi.</div>'}
    </div>
  </section>`;
}

function renderSettings(){
  const name=getUserNameV65();

  return `<div class="list">
    <div class="card settings-profile-v65">
      <h3 style="margin:0">Profil Pengguna</h3>
      <p class="list-sub">Nama ini akan tampil di sapaan Beranda.</p>

      <div class="field" style="margin-top:12px">
        <label>Nama Pengguna</label>
        <input id="settingsUserNameV65" value="${esc(name)}" placeholder="Contoh: Firda">
      </div>

      <button class="btn secondary block" id="saveUserNameV65">Simpan Nama</button>
    </div>

    <div class="card">
      <h3 style="margin:0">Backup Data</h3>
      <p class="list-sub">Backup UangKu v8.1 memakai schema versi ${BACKUP_SCHEMA_VERSION}. Import akan diperiksa dulu sebelum mengganti data aktif.</p>
      <div class="row" style="margin-top:12px">
        <button class="btn secondary" id="exportBtn">Export JSON</button>
        <button class="btn light" id="importBtn">Import JSON</button>
      </div>
      <input id="importFile" type="file" accept="application/json" hidden>
    </div>

    <button class="btn danger block" id="resetBtn">Hapus Semua Data</button>
  </div>`;
}


function homeSummarySegmentsV67(k){
  const s=monthlyHomeSummaryV65(k);

  const rows=[
    {key:'budget',label:'Budget',pct:s.budgetPct,color:'#59B96C'},
    {key:'needs',label:'Kebutuhan',pct:s.needsPct,color:'#67A1E6'},
    {key:'wants',label:'Keinginan',pct:s.wantsPct,color:'#9A7BDB'},
    {key:'sales',label:'Penjualan',pct:s.salesPct,color:'#56B7A6'}
  ];

  // Persentase asli tetap ditampilkan apa adanya.
  // Untuk panjang segmen pada satu bar, keempat indikator dinormalisasi
  // hanya untuk visual agar selalu muat dalam satu garis.
  const totalForVisual=rows.reduce((sum,r)=>sum+Math.max(0,Number(r.pct)||0),0);

  return rows.map(r=>({
    ...r,
    visualPct:totalForVisual>0
      ?(Math.max(0,Number(r.pct)||0)/totalForVisual*100)
      :25
  }));
}

function renderHomeSummaryV65(k){
  const s=monthlyHomeSummaryV65(k);
  const segments=homeSummarySegmentsV67(k);

  return `<section class="card home-summary-v65 home-summary-v67">
    <div class="section-head">
      <div>
        <h3>Ringkasan ${monthLabel(k)}</h3>
        <p>Budget, kebutuhan, keinginan, dan penjualan bulan ini</p>
      </div>
      <button class="link-btn" id="toggleHomeSummaryV65">
        ${homeSummaryExpandedV65?'Sembunyikan':'Lihat semua'}
      </button>
    </div>

    <div class="segmented home-summary-segmented-v66">
      ${segments.map(r=>`
        <i style="width:${r.visualPct}%;background:${r.color}" title="${r.label} ${r.pct}%"></i>
      `).join('')}
    </div>

    <div class="home-summary-labels-v66 home-summary-labels-v67">
      ${segments.map(r=>`
        <div class="home-summary-label-v66">
          <div class="home-summary-label-name-v66">
            <i style="background:${r.color}"></i>
            <span>${r.label}</span>
          </div>
          <b>${r.pct}%</b>
        </div>
      `).join('')}
    </div>

    ${renderSavingsStripV67(k)}

    ${homeSummaryExpandedV65?`
      <div class="home-summary-details-v65">
        <div class="summary-detail-card-v65">
          <div class="summary-detail-title-v65"><b>Budget</b><strong>${s.budgetPct}%</strong></div>
          <div class="summary-detail-line-v65"><span>Alokasi budget bulan ini</span><b>${fmt(s.totalBudget)}</b></div>
          <div class="summary-detail-line-v65"><span>Sudah terpakai</span><b>${fmt(s.budgetUsed)}</b></div>
          <small>Persentase Budget = total alokasi budget ÷ pemasukan bulan ini.</small>
        </div>

        <div class="summary-detail-card-v65">
          <div class="summary-detail-title-v65"><b>Kebutuhan</b><strong>${s.needsPct}%</strong></div>
          <div class="summary-detail-line-v65"><span>Makan, groceries, transportasi, kesehatan, pendidikan, rumah tangga, pakan hewan, listrik/air/WiFi/internet/pulsa</span><b>${fmt(s.needs)}</b></div>
          <small>Persentase Kebutuhan = pengeluaran kebutuhan ÷ pemasukan bulan ini.</small>
        </div>

        <div class="summary-detail-card-v65">
          <div class="summary-detail-title-v65"><b>Keinginan</b><strong>${s.wantsPct}%</strong></div>
          <div class="summary-detail-line-v65 debt-breakdown-v65"><span>Utang / Cicilan</span><b>${fmt(s.debt)} • ${s.debtPct}%</b></div>
          <div class="summary-detail-line-v65"><span>Hadiah / Hiburan / kategori Keinginan</span><b>${fmt(s.wantsOnly)} • ${s.wantsOnlyPct}%</b></div>
          <small>Utang/Cicilan tetap di-breakdown sendiri agar terlihat jelas porsinya.</small>
        </div>

        <div class="summary-detail-card-v65">
          <div class="summary-detail-title-v65"><b>Penjualan</b><strong>${s.salesPct}%</strong></div>
          <div class="summary-detail-line-v65"><span>Penjualan masuk</span><b>${fmt(s.sales.income)}</b></div>
          <div class="summary-detail-line-v65"><span>Penjualan keluar</span><b>${fmt(s.sales.expense)}</b></div>
          <div class="summary-detail-line-v65"><span>Keuntungan</span><b class="${s.sales.profit>=0?'green':'red'}">${s.sales.profit>=0?'':'− '}${fmt(Math.abs(s.sales.profit))}</b></div>
          <small>Persentase Penjualan = pemasukan kategori Penjualan ÷ seluruh pemasukan bulan ini.</small>
        </div>

        <div class="summary-savings-explain-v67">
          💰 Saving Rate = tabungan baru bulan ini ÷ pemasukan bulan ini.
          Saldo tabungan lama tidak ikut dihitung sehingga persentasenya tidak membengkak.
        </div>
      </div>
    `:''}
  </section>`;
}


function isLegacyGoalAllocationV68(a){
  if(!a)return false;

  const source=String(a.source||'').toLowerCase();
  const note=String(a.note||'').toLowerCase();

  return source==='legacy_link'
    || source==='legacy_goal_link'
    || /menghubungkan dana target lama/.test(note)
    || /hubungkan dana target lama/.test(note)
    || /dana lama.*terhubung akun/.test(note);
}

function renderSavingsStripV67(k){
  const s=monthlyHomeSummaryV65(k);

  return `<div class="home-savings-strip-v67">
    <div class="home-savings-strip-left-v67">
      <span class="home-savings-icon-v67">💰</span>
      <div>
        <b>Tabungan bulan ini</b>
        <small>Dana baru ke tabungan & tujuan • dana target lama tidak dihitung</small>
      </div>
    </div>
    <div class="home-savings-strip-right-v67">
      <b>${fmt(s.savings.total)}</b>
      <span>Saving Rate ${s.savingsPct}%</span>
    </div>
  </div>`;
}

function openConnectLegacyGoalModal(goalId){
  const g=state.goals.find(x=>x.id===goalId);
  if(!g)return;

  const legacy=Math.max(0,Number(g.legacyCurrent)||0);
  if(legacy<=0)return toast('Tidak ada dana lama yang perlu dihubungkan.');

  if(!state.accounts.length){
    return openInfo(
      'Belum ada akun',
      'Tambahkan akun, tabungan, atau akun Titipan terlebih dahulu sebelum menghubungkan dana target.'
    );
  }

  openModal('Hubungkan Dana ke Akun',`
    <form class="form">
      <div class="field">
        <label>Target</label>
        <div class="readonly-box">${esc(g.name)} • dana lama ${fmt(legacy)}</div>
      </div>

      <div class="field">
        <label>Pilih tempat dana berada</label>
        <select name="accountId">
          ${state.accounts.map(a=>`
            <option value="${a.id}">
              ${esc(goalSourceAccountLabel(a.id))} • saldo ${fmt(accountBalance(a.id))}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="field">
        <label>Nominal yang Dihubungkan</label>
        <input type="number" name="amount" min="1" max="${legacy}" value="${legacy}" required>
        <div class="list-sub">Maksimal ${fmt(legacy)}.</div>
      </div>

      <div class="form-note">
        Ini hanya memberi tahu UangKu tempat dana target lama berada.
        <b>Tidak dianggap sebagai tabungan baru bulan ini</b> dan tidak masuk Saving Rate.
      </div>

      <button class="btn block">Hubungkan Dana</button>
    </form>
  `,fd=>{
    const accountId=String(fd.get('accountId')||'');
    const amount=Number(fd.get('amount')||0);

    if(amount<=0||amount>legacy)return toast('Nominal yang dihubungkan tidak valid.');

    const available=accountAvailableForGoal(accountId);
    if(amount>available)return toast(`Dana bebas untuk target di akun ini hanya ${fmt(available)}.`);

    g.allocations=g.allocations||[];
    g.allocations.push({
      id:uid(),
      accountId,
      amount,
      date:today(),
      note:'Menghubungkan dana target lama ke akun',
      source:'legacy_link'
    });

    g.legacyCurrent=Math.max(0,legacy-amount);
    syncGoalCurrent(g);

    save();
    closeModal();
    toast('Dana target lama sudah terhubung dan tidak dihitung sebagai tabungan baru.');
    render();
  });
}

function openGoalAllocationModal(goalId){
  const g=state.goals.find(x=>x.id===goalId);
  if(!g)return;
  if(!state.accounts.length){
    return openInfo(
      'Belum ada akun',
      'Tambahkan akun atau tabungan terlebih dahulu sebelum mengalokasikan dana ke target.'
    );
  }

  openModal('Alokasikan Dana Target',`
    <form class="form">
      <div class="field">
        <label>Target</label>
        <div class="readonly-box">${esc(g.name)} • ${fmt(goalCurrent(g))} / ${fmt(g.target)}</div>
      </div>

      <div class="field">
        <label>Sumber Akun</label>
        <select name="accountId" id="goalSourceAccount">
          ${state.accounts.map(a=>`
            <option value="${a.id}">
              ${esc(a.name)} • tersedia untuk target ${fmt(accountAvailableForGoal(a.id))}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="field">
        <label>Nominal Alokasi</label>
        <input type="number" name="amount" min="1" placeholder="Masukkan nominal" required>
      </div>

      <div class="field">
        <label>Catatan</label>
        <input name="note" placeholder="Opsional">
      </div>

      <div class="form-note">
        Dana ini dicatat sebagai <b>alokasi target baru</b>.
        Kalau sumbernya sudah akun Tabungan, Saving Rate tidak menghitungnya dua kali.
      </div>

      <button class="btn block">Simpan Alokasi</button>
    </form>
  `,fd=>{
    const accountId=String(fd.get('accountId')||'');
    const amount=Number(fd.get('amount')||0);

    if(amount<=0)return toast('Nominal harus lebih dari 0.');
    if(amount>accountAvailableForGoal(accountId)){
      return toast('Dana yang tersedia di akun untuk target tidak mencukupi.');
    }

    g.allocations=g.allocations||[];
    g.allocations.push({
      id:uid(),
      accountId,
      amount,
      date:today(),
      note:String(fd.get('note')||''),
      source:'new_goal_allocation'
    });

    syncGoalCurrent(g);
    save();
    closeModal();
    toast('Dana baru berhasil dialokasikan ke target.');
    render();
  });
}

function tagFreshGoalAllocationsV68(beforeIds){
  state.goals.forEach(g=>{
    (g?.allocations||[]).forEach(a=>{
      if(!beforeIds.has(a.id) && !a.source && !isLegacyGoalAllocationV68(a)){
        a.source='new_goal_allocation';
      }
    });
  });
}

/* Tandai Dana Awal target baru sebagai alokasi baru tanpa mengubah alur modal lama. */
function openGoalModal(editId=''){
  const beforeIds=new Set(
    state.goals.flatMap(g=>(g?.allocations||[]).map(a=>a.id))
  );

  openGoalModalCore(editId);

  // Base modal menyimpan saat submit; setelah save berikutnya render akan membaca
  // source. Binding submit dibungkus setelah modal terpasang.
  setTimeout(()=>{
    const form=$('#modalBody form');
    if(!form || editId)return;

    const oldSubmit=form.onsubmit;
    if(typeof oldSubmit==='function'){
      form.onsubmit=e=>{
        const result=oldSubmit.call(form,e);
        setTimeout(()=>{
          tagFreshGoalAllocationsV68(beforeIds);
          save();
        },0);
        return result;
      };
    }
  },0);
}


function goalPercentV70(g){
  return g
    ?Math.max(0,Math.min(100,Math.round(goalCurrent(g)/(Number(g.target)||1)*100)))
    :0;
}


function debtReceivableGradientV70(){
  const d=debtTotals();
  const total=d.payable+d.receivable;
  if(total<=0)return '#E9EFE7';
  const payablePct=d.payable/total*100;
  return `conic-gradient(#F0B44C 0 ${payablePct.toFixed(2)}%,#69A7FF ${payablePct.toFixed(2)}% 100%)`;
}

function renderDebtReceivableHomeV70(){
  const d=debtTotals();
  const total=d.payable+d.receivable;
  const net=d.receivable-d.payable;
  const netLabel=net>=0?'Net Piutang':'Net Utang';

  return `<section class="card home-debt-card-v70">
    <div class="section-head">
      <div>
        <h3>Utang & Piutang</h3>
        <p>Sisa kewajiban dan uang yang masih harus diterima</p>
      </div>
      <button class="link-btn" id="homeDebtSeeAllV70">Lihat semua</button>
    </div>

    ${total>0?`
      <div class="home-debt-main-v70">
        <div class="donut-holder home-debt-donut-v70">
          <div class="donut" style="background:${debtReceivableGradientV70()}"></div>
          <div class="donut-label home-debt-center-v70">
            <small>${netLabel}</small>
            <b class="${net>=0?'green':'red'}">${fmt(Math.abs(net))}</b>
          </div>
        </div>

        <div class="home-debt-stats-v70">
          <div>
            <span><i class="debt-dot-v70 payable"></i>Sisa Utang</span>
            <b style="color:#C9871F">${fmt(d.payable)}</b>
          </div>
          <div>
            <span><i class="debt-dot-v70 receivable"></i>Sisa Piutang</span>
            <b style="color:#3A79D9">${fmt(d.receivable)}</b>
          </div>
        </div>
      </div>
    `:`
      <div class="empty compact-empty">Belum ada utang atau piutang aktif.</div>
    `}
  </section>`;
}

function goalSymbolV70(g){
  return goalVisual(g,true);
}

function renderHomeGoalsV70(){
  const goals=(state.goals||[]).slice(0,3);

  return `<section class="section home-goals-section-v70">
    <div class="section-head">
      <div>
        <h3>Tujuan Keuangan</h3>
        <p>${state.goals.length?`${state.goals.length} target`:'Belum ada target'}</p>
      </div>
      <button class="link-btn" data-plan-link="goal">Lihat semua</button>
    </div>

    ${goals.length?`
      <div class="home-goals-grid-v70">
        ${goals.map(g=>`
          <div class="card home-goal-mini-v70">
            ${goalSymbolV70(g)}
            <div class="home-goal-mini-main-v70">
              <b>${esc(g.name||'Target')}</b>
              <strong>${goalPercentV70(g)}%</strong>
            </div>
          </div>
        `).join('')}
      </div>
    `:`
      <div class="empty">Belum ada target.</div>
    `}
  </section>`;
}


function transactionCashAmountV73(t){
  if(!t)return 0;
  if(t.source==='sale_receivable_origin'){
    return Math.max(0,Number(t.cashAmount)||0);
  }
  return Math.max(0,Number(t.amount)||0);
}

function accountBalance(id){
  const a=state.accounts.find(x=>x&&x.id===id);
  let b=Number(a?.initial||0);

  state.transactions.forEach(t=>{
    if(!t)return;
    const amount=transactionCashAmountV73(t);

    if(t.type==='income'&&t.accountId===id)b+=amount;
    else if(t.type==='expense'&&t.accountId===id)b-=amount;
    else if(t.type==='transfer'){
      const n=Math.max(0,Number(t.amount)||0);
      if(t.fromAccountId===id)b-=n;
      if(t.toAccountId===id)b+=n;
    }
  });

  return b;
}

function monthTotals(k=monthKey()){
  let income=0,expense=0;

  state.transactions
    .filter(t=>t&&monthKey(t.date)===k)
    .forEach(t=>{
      if(t.type==='income')income+=transactionCashAmountV73(t);
      else if(t.type==='expense')expense+=transactionCashAmountV73(t);
    });

  return {income,expense,net:income-expense};
}

function monthlySavingsAddedV65(k){
  let savingsAccountNet=0;

  state.transactions
    .filter(t=>t&&monthKey(t.date)===k)
    .forEach(t=>{
      if(t.type==='income'&&isSavingsAccountV65(t.accountId)){
        savingsAccountNet+=transactionCashAmountV73(t);
      }else if(t.type==='expense'&&isSavingsAccountV65(t.accountId)){
        savingsAccountNet-=transactionCashAmountV73(t);
      }else if(t.type==='transfer'){
        const n=Math.max(0,Number(t.amount)||0);
        if(isSavingsAccountV65(t.toAccountId))savingsAccountNet+=n;
        if(isSavingsAccountV65(t.fromAccountId))savingsAccountNet-=n;
      }
    });

  savingsAccountNet=Math.max(0,savingsAccountNet);

  let goalFromNonSavings=0;
  let goalFromSavings=0;
  let legacyGoalLinked=0;

  state.goals.forEach(g=>{
    (g?.allocations||[])
      .filter(a=>a&&monthKey(a.date)===k)
      .forEach(a=>{
        const n=Math.max(0,Number(a.amount)||0);

        if(typeof isLegacyGoalAllocationV68==='function'&&isLegacyGoalAllocationV68(a)){
          legacyGoalLinked+=n;
          return;
        }

        if(isSavingsAccountV65(a.accountId))goalFromSavings+=n;
        else goalFromNonSavings+=n;
      });
  });

  return {
    savingsAccountNet,
    goalFromNonSavings,
    goalFromSavings,
    legacyGoalLinked,
    total:savingsAccountNet+goalFromNonSavings
  };
}

function isSalesIncomeSelectionV73(){
  const cat=String($('#txCategory')?.value||'').toLowerCase();
  return manualTxType==='income' && /penjualan|jualan/.test(cat);
}

function salesPaymentPanelV73(){
  return `<div id="salesPaymentPanelV73" class="sales-payment-panel-v73 hidden">
    <div class="form-note sales-payment-note-v73">
      🛍️ Untuk Penjualan, nilai transaksi tetap dicatat sebagai <b>omzet</b>.
      Saldo akun hanya bertambah sebesar uang yang benar-benar sudah diterima.
    </div>

    <div class="field">
      <label>Status Pembayaran</label>
      <select id="salePaymentStatusV73" name="salePaymentStatus">
        <option value="paid">✅ Sudah dibayar</option>
        <option value="unpaid">🕒 Belum dibayar / Piutang</option>
        <option value="partial">💸 Dibayar sebagian</option>
      </select>
    </div>

    <div id="salePartialWrapV73" class="hidden">
      <div class="field">
        <label>Sudah Diterima</label>
        <input type="number" name="saleReceivedAmount" min="1" placeholder="Nominal yang sudah dibayar pembeli">
      </div>
    </div>

    <div id="saleReceivableWrapV73" class="hidden">
      <div class="field">
        <label>Nama Pembeli / Pelanggan</label>
        <input name="saleCustomer" placeholder="Contoh: Siti, Toko A, pelanggan">
      </div>

      <div class="field">
        <label>Jatuh Tempo Piutang</label>
        <input type="date" name="saleDueDate">
      </div>

      <div class="form-note">
        Sisa yang belum dibayar otomatis masuk ke <b>Utang & Tagihan → Piutang</b>
        sebagai <b>Piutang Penjualan</b>.
      </div>
    </div>
  </div>`;
}

function syncSalesPaymentPanelV73(){
  const panel=$('#salesPaymentPanelV73');
  if(!panel)return;

  panel.classList.toggle('hidden',!isSalesIncomeSelectionV73());

  const status=$('#salePaymentStatusV73');
  const partial=$('#salePartialWrapV73');
  const receivable=$('#saleReceivableWrapV73');

  if(status){
    const sync=()=>{
      const isPartial=status.value==='partial';
      const hasReceivable=status.value==='partial'||status.value==='unpaid';
      partial?.classList.toggle('hidden',!isPartial);
      receivable?.classList.toggle('hidden',!hasReceivable);
    };
    status.onchange=sync;
    sync();
  }
}

function createSalesIncomeV73(fd,total,date,accountId,note){
  const status=String(fd.get('salePaymentStatus')||'paid');
  const customer=String(fd.get('saleCustomer')||'').trim();
  const dueDate=String(fd.get('saleDueDate')||'');
  let received=total;

  if(status==='unpaid'){
    received=0;
  }else if(status==='partial'){
    received=Math.max(0,Number(fd.get('saleReceivedAmount')||0));
    if(received<=0)return toast('Isi nominal yang sudah diterima.');
    if(received>=total)return toast('Kalau sudah diterima penuh, pilih status "Sudah dibayar".');
  }

  if((status==='unpaid'||status==='partial')&&!customer){
    return toast('Isi nama pembeli/pelanggan untuk membuat Piutang Penjualan.');
  }

  const txId=uid();

  if(status==='paid'){
    state.transactions.push({
      id:txId,
      type:'income',
      date,
      amount:total,
      cashAmount:total,
      accountId,
      category:'Penjualan',
      note:note||'Penjualan',
      source:'sale_cash_sale',
      salePaymentStatus:'paid'
    });

    save();
    toast('Penjualan tercatat dan saldo akun bertambah.');
    navigate('transactions');
    return true;
  }

  const debtId=uid();
  const initialPaymentId=received>0?uid():'';

  const debt={
    id:debtId,
    type:'receivable',
    person:customer,
    principal:total,
    interest:0,
    admin:0,
    amount:total,
    paid:received,
    dueDate,
    note:'Piutang otomatis dari transaksi Penjualan',
    status:received>=total?'paid':'active',
    paidDate:received>=total?date:'',
    payments:received>0?[{
      id:initialPaymentId,
      txId,
      date,
      amount:received,
      accountId,
      direction:'in',
      source:'sale_initial_payment'
    }]:[],
    receivableKind:'sale',
    saleOriginTxId:txId,
    saleDate:date
  };

  state.debts.push(debt);

  state.transactions.push({
    id:txId,
    type:'income',
    date,
    amount:total,
    cashAmount:received,
    accountId,
    category:'Penjualan',
    note:note||`Penjualan ke ${customer}`,
    source:'sale_receivable_origin',
    salePaymentStatus:status,
    saleCustomer:customer,
    saleDueDate:dueDate,
    debtId
  });

  save();
  toast(status==='unpaid'
    ?'Penjualan tercatat sebagai omzet dan Piutang Penjualan dibuat.'
    :'Penjualan sebagian dibayar. Sisanya otomatis menjadi Piutang Penjualan.'
  );
  navigate('transactions');
  return true;
}

function saveManualTransactionV62(form){
  const fd=new FormData(form);
  const type=String(fd.get('type')||manualTxType);
  const category=String(fd.get('category')||'Lainnya');
  const amount=Number(fd.get('amount')||0);

  if(type==='income'&&/penjualan|jualan/i.test(category)){
    if(amount<=0)return toast('Nilai penjualan harus lebih dari 0.');
    if(!state.accounts.length)return toast('Tambahkan akun terlebih dahulu.');

    const accountId=String(fd.get('accountId')||'');
    if(!accountId)return toast('Pilih akun.');

    return createSalesIncomeV73(
      fd,
      amount,
      String(fd.get('date')||today()),
      accountId,
      String(fd.get('note')||'')
    );
  }

  return saveManualTransactionCore(form);
}
function salesSummary(k){
  let omzet=0;
  let received=0;
  let expense=0;

  state.transactions
    .filter(t=>t&&monthKey(t.date)===k)
    .forEach(t=>{
      const cat=String(t.category||'');

      if(t.type==='expense'&&/penjualan/i.test(cat)){
        expense+=Math.max(0,Number(t.amount)||0);
        return;
      }

      if(t.type==='income'&&/penjualan/i.test(cat)){
        omzet+=Math.max(0,Number(t.amount)||0);
        received+=transactionCashAmountV73(t);
        return;
      }

      if(t.type==='income'&&t.source==='sale_receivable_payment'){
        received+=Math.max(0,Number(t.amount)||0);
      }
    });

  const receivable=state.debts
    .filter(d=>
      d&&
      d.type==='receivable'&&
      d.receivableKind==='sale'&&
      monthKey(d.saleDate||'')===k
    )
    .reduce((sum,d)=>sum+debtOutstanding(d),0);

  return {
    income:omzet,
    omzet,
    received,
    receivable,
    expense,
    profit:omzet-expense
  };
}

function salesGradientV73(k){
  const s=salesSummary(k);
  const total=s.omzet+s.expense;
  if(total<=0)return '#E9EFE7';
  const omzetPct=s.omzet/total*100;
  return `conic-gradient(#4EB8A6 0 ${omzetPct.toFixed(2)}%,#F28C82 ${omzetPct.toFixed(2)}% 100%)`;
}

function renderSalesHome(k){
  const s=salesSummary(k);
  const has=s.omzet>0||s.expense>0;
  const profitPositive=s.profit>=0;

  return `<section class="card home-sales-card">
    <div class="section-head">
      <div>
        <h3>Penjualan ${shortMonthLabel(k)}</h3>
        <p>Omzet, uang diterima, piutang, dan keuntungan</p>
      </div>
    </div>

    ${has?`
      <div class="home-sales-main">
        <div class="donut-holder home-sales-donut">
          <div class="donut" style="background:${salesGradientV73(k)}"></div>
          <div class="donut-label home-sales-center">
            <small>${profitPositive?'Keuntungan':'Kerugian'}</small>
            <b class="${profitPositive?'green':'red'}">${fmt(Math.abs(s.profit))}</b>
            <em>${profitPositive?'untung':'rugi'}</em>
          </div>
        </div>

        <div class="home-sales-stats home-sales-stats-v73">
          <div>
            <span><i class="sales-dot in"></i>Omzet</span>
            <b class="green">${fmt(s.omzet)}</b>
          </div>
          <div>
            <span><i class="sales-dot received-v73"></i>Diterima</span>
            <b>${fmt(s.received)}</b>
          </div>
          <div>
            <span><i class="sales-dot receivable-v73"></i>Piutang Penjualan</span>
            <b class="sales-receivable-value-v73">${fmt(s.receivable)}</b>
          </div>
          <div>
            <span><i class="sales-dot out"></i>Pengeluaran</span>
            <b class="red">${fmt(s.expense)}</b>
          </div>
          <div class="profit-line">
            <span>Keuntungan</span>
            <b class="${profitPositive?'green':'red'}">${profitPositive?'':'− '}${fmt(Math.abs(s.profit))}</b>
          </div>
        </div>
      </div>
    `:`
      <div class="empty compact-empty">Belum ada transaksi penjualan bulan ini.</div>
    `}
  </section>`;
}

function linkedTxLabel(t){
  if(t?.debtId){
    const d=state.debts.find(x=>x.id===t.debtId);

    if(t.source==='sale_receivable_origin'){
      return d
        ?`Piutang Penjualan • ${d.person}`
        :'Piutang Penjualan';
    }

    if(t.source==='sale_receivable_payment'){
      return d
        ?`Pembayaran Piutang Penjualan • ${d.person}`
        :'Pembayaran Piutang Penjualan';
    }

    if(t.source==='debt_proceeds'){
      return d
        ?`Pinjaman masuk • ${d.person}`
        :'Pinjaman masuk';
    }

    return d
      ?`Terhubung ${d.type==='receivable'?'Piutang':'Utang'} • ${d.person}`
      :'Terhubung Utang/Piutang';
  }

  if(t?.billId){
    const b=state.bills.find(x=>x.id===t.billId);
    return b?`Terhubung Tagihan • ${b.name}`:'Terhubung Tagihan';
  }

  return '';
}

function saleStatusLabelV73(t){
  if(t.source!=='sale_receivable_origin')return '';
  const cash=transactionCashAmountV73(t);
  const total=Math.max(0,Number(t.amount)||0);

  if(cash<=0)return `🕒 Belum dibayar • Piutang ${fmt(total)}`;
  if(cash<total)return `💸 Diterima ${fmt(cash)} • Piutang ${fmt(total-cash)}`;
  return '✅ Sudah dibayar';
}

function txItem(t){
  const linked=linkedTxLabel(t);

  if(t.type==='transfer'){
    return `<div class="card compact transaction-card-v56">
      <div class="list-item tx-list-main" style="border:0;padding:0">
        <span class="round-icon bluebg">↔</span>
        <div class="list-main">
          <div class="list-title">${esc(t.note||'Transfer antar akun')}</div>
          <div class="list-sub">${esc(accountName(t.fromAccountId))} → ${esc(accountName(t.toAccountId))}</div>
        </div>
        <div class="amount transfer">${fmt(t.amount)}</div>
      </div>
      <div class="transaction-actions">
        <button class="mini-action" data-edit-tx="${esc(t.id)}">Edit</button>
        <button class="mini-action danger-text" data-delete-tx="${esc(t.id)}">Hapus</button>
      </div>
    </div>`;
  }

  const saleOrigin=t.source==='sale_receivable_origin';
  const cash=transactionCashAmountV73(t);

  return `<div class="card compact transaction-card-v56">
    <div class="list-item tx-list-main" style="border:0;padding:0">
      <span class="round-icon ${t.type==='income'?'greenbg':'redbg'}">${iconFor(t.category)}</span>
      <div class="list-main">
        <div class="list-title">${esc(t.note||t.category)}</div>
        <div class="list-sub">${esc(t.category||'Lainnya')} • ${esc(accountName(t.accountId))}</div>
        ${saleOrigin?`<div class="tx-sale-status-v73">${saleStatusLabelV73(t)}</div>`:''}
        ${linked?`<div class="tx-linked-chip">🔗 ${esc(linked)}</div>`:''}
      </div>
      <div class="amount ${t.type==='income'?'in':'out'}">
        ${t.type==='income'?'+':'−'} ${fmt(t.amount)}
        ${saleOrigin&&cash!==Number(t.amount)?`<small class="tx-cash-impact-v73">Kas +${fmt(cash)}</small>`:''}
      </div>
    </div>
    <div class="transaction-actions">
      <button class="mini-action" data-edit-tx="${esc(t.id)}">Edit</button>
      <button class="mini-action danger-text" data-delete-tx="${esc(t.id)}">Hapus</button>
    </div>
  </div>`;
}

function renderDebtsInner(){
  const totals=debtTotals();
  const active=state.debts.filter(d=>d&&d.status!=='paid');
  const paid=state.debts.filter(d=>d&&d.status==='paid');

  const card=d=>{
    const left=debtOutstanding(d);
    const saleReceivable=d.type==='receivable'&&d.receivableKind==='sale';

    return `<div class="card compact debt-card-v5">
      <div class="list-item" style="border:0;padding:0">
        <span class="round-icon ${
          d.status==='paid'?'greenbg':
          d.type==='payable'?'redbg':
          saleReceivable?'greenbg':'bluebg'
        }">${
          d.status==='paid'?'✓':
          d.type==='payable'?'💳':
          saleReceivable?'🛍️':'🤝'
        }</span>

        <div class="list-main">
          <div class="list-title">${esc(d.person||'Tanpa nama')}</div>
          <div class="list-sub">
            ${d.type==='payable'?'Utang saya':saleReceivable?'Piutang Penjualan':'Piutang'}
            • ${d.status==='paid'?'Lunas':`sisa ${fmt(left)}`}
          </div>
          ${saleReceivable?`<div class="tx-linked-chip">🛍️ Berasal dari Penjualan${d.saleDate?` • ${prettyDate(d.saleDate)}`:''}</div>`:''}
          ${debtMeta(d)?`<div class="detail-note">${debtMeta(d)}</div>`:''}
          ${debtPaymentSummary(d)}
        </div>

        <div class="amount">${fmt(debtTotalAmount(d))}</div>
      </div>

      <div class="record-actions">
        ${d.status!=='paid'
          ?`<button class="mini-action" data-pay-debt="${esc(d.id)}">${
              d.type==='payable'?'Bayar cicilan':
              saleReceivable?'Terima pembayaran penjualan':'Terima pembayaran'
            }</button>
            <button class="mini-action success-text" data-paid-debt="${esc(d.id)}">✓ ${
              d.type==='payable'?'Lunasi':
              saleReceivable?'Terima pelunasan':'Terima pelunasan'
            }</button>`
          :''}
        <button class="mini-action" data-edit-debt="${esc(d.id)}">Edit</button>
        <button class="mini-action danger-text" data-delete-debt="${esc(d.id)}">Hapus</button>
      </div>
    </div>`;
  };

  return `<div class="row">
    <div class="card flat"><div class="kicker">Sisa Utang</div><div class="mini-value red">${fmt(totals.payable)}</div></div>
    <div class="card flat"><div class="kicker">Sisa Piutang</div><div class="mini-value green">${fmt(totals.receivable)}</div></div>
  </div>

  <div class="section-head" style="margin-top:14px">
    <div><h3>Aktif</h3><p>${active.length} catatan</p></div>
    <button class="link-btn" id="addDebtBtn">+ Tambah</button>
  </div>

  <div class="list">${active.length?active.map(card).join(''):'<div class="empty">Belum ada utang/piutang aktif.</div>'}</div>

  ${paid.length?`
    <div class="section-head" style="margin-top:18px">
      <div><h3>Sudah Lunas</h3><p>${paid.length} catatan</p></div>
    </div>
    <div class="list">${paid.map(card).join('')}</div>
  `:''}`;
}

function openDebtPaymentModal(id,full=false){
  const d=state.debts.find(x=>x.id===id);
  if(!d)return;

  const saleReceivable=d.type==='receivable'&&d.receivableKind==='sale';
  if(!saleReceivable){
    return openDebtPaymentModalCore(id,full);
  }

  if(d.status==='paid'||debtOutstanding(d)<=0)return toast('Piutang Penjualan ini sudah lunas.');
  if(!state.accounts.length){
    return openInfo('Belum ada akun','Tambahkan akun terlebih dahulu agar pembayaran piutang bisa masuk ke saldo.');
  }

  const remaining=debtOutstanding(d);

  openModal(full?'Terima Pelunasan Penjualan':'Terima Pembayaran Penjualan',`
    <form class="form">
      <div class="field">
        <label>Piutang Penjualan dari</label>
        <div class="readonly-box">${esc(d.person||'Pelanggan')} • sisa ${fmt(remaining)}</div>
      </div>

      <div class="field">
        <label>Masuk ke Akun</label>
        <select name="accountId" required>
          ${paymentAccountOptions('in')}
        </select>
      </div>

      <div class="field">
        <label>Nominal Diterima</label>
        ${full
          ?`<div class="readonly-box">${fmt(remaining)}</div><input type="hidden" name="amount" value="${remaining}">`
          :`<input type="number" name="amount" min="1" max="${remaining}" placeholder="Masukkan nominal" required>
             <div class="list-sub">Maksimal ${fmt(remaining)}.</div>`}
      </div>

      <div class="field">
        <label>Tanggal</label>
        <input type="date" name="date" value="${today()}" required>
      </div>

      <div class="form-note">
        Uang yang diterima akan menambah saldo akun, tetapi <b>tidak menambah omzet lagi</b>
        karena penjualan sudah dicatat saat transaksi awal.
      </div>

      <button class="btn block">${full?'Simpan & Tandai Lunas':'Simpan Pembayaran'}</button>
    </form>
  `,fd=>{
    const accountId=String(fd.get('accountId')||'');
    const amount=Number(fd.get('amount')||0);
    const date=String(fd.get('date')||today());

    if(!accountId)return toast('Pilih akun.');
    if(amount<=0||amount>remaining)return toast('Nominal pembayaran tidak valid.');

    const txId=uid();
    const paymentId=uid();

    d.paid=Math.min(debtTotalAmount(d),(Number(d.paid)||0)+amount);
    d.payments=Array.isArray(d.payments)?d.payments:[];
    d.payments.push({
      id:paymentId,
      txId,
      date,
      amount,
      accountId,
      direction:'in',
      source:'sale_receivable_payment'
    });

    const done=d.paid>=debtTotalAmount(d)-0.5;
    if(done){
      d.paid=debtTotalAmount(d);
      d.status='paid';
      d.paidDate=date;
    }else{
      d.status='active';
      d.paidDate='';
    }

    ensureCategory('Piutang Penjualan','🛍️');

    state.transactions.push({
      id:txId,
      type:'income',
      date,
      amount,
      accountId,
      category:'Piutang Penjualan',
      note:`Terima piutang penjualan ${d.person||'pelanggan'}`,
      source:'sale_receivable_payment',
      debtId:d.id,
      paymentId,
      saleOriginTxId:d.saleOriginTxId||''
    });

    save();
    closeModal();
    toast(done
      ?'Piutang Penjualan lunas. Pembayaran masuk saldo tanpa menambah omzet.'
      :'Pembayaran Piutang Penjualan berhasil dicatat.'
    );
    render();
  });
}
function applyLinkedTransactionEdit(t,old){
  if(t?.source==='sale_receivable_origin'&&t.debtId){
    const d=state.debts.find(x=>x.id===t.debtId);
    if(!d)return;

    t.cashAmount=Math.min(
      Math.max(0,Number(t.cashAmount)||0),
      Math.max(0,Number(t.amount)||0)
    );

    d.principal=Math.max(0,Number(t.amount)||0);
    d.amount=d.principal;

    const initial=(d.payments||[]).find(p=>p.source==='sale_initial_payment'||p.txId===t.id);
    if(initial){
      initial.amount=t.cashAmount;
      initial.accountId=t.accountId;
      initial.date=t.date;
    }

    d.saleDate=t.date;
    d.person=t.saleCustomer||d.person;

    const paidFromPayments=(d.payments||[]).reduce((s,p)=>s+(Number(p.amount)||0),0);
    d.paid=Math.min(d.amount,paidFromPayments);

    if(d.paid>=d.amount-0.5){
      d.paid=d.amount;
      d.status='paid';
      d.paidDate=t.date;
    }else{
      d.status='active';
      d.paidDate='';
    }
    return;
  }

  return applyLinkedTransactionEditCore(t,old);
}
function removeLinkedTransactionEffects(t){
  if(t?.source==='sale_receivable_origin'&&t.debtId){
    const d=state.debts.find(x=>x.id===t.debtId);
    if(d){
      state.transactions=state.transactions.filter(x=>
        !(x&&x.id!==t.id&&x.debtId===d.id&&x.source==='sale_receivable_payment')
      );
      state.debts=state.debts.filter(x=>x.id!==d.id);
    }
    return;
  }

  return removeLinkedTransactionEffectsCore(t);
}
function requestDeleteTransaction(id){
  const t=state.transactions.find(x=>x.id===id);
  if(!t)return;

  if(t.source==='sale_receivable_origin'&&t.debtId){
    const d=state.debts.find(x=>x.id===t.debtId);
    const paymentCount=state.transactions.filter(x=>
      x&&x.debtId===t.debtId&&x.source==='sale_receivable_payment'
    ).length;

    return openConfirm(
      'Hapus Penjualan',
      `Hapus transaksi penjualan ini? Piutang Penjualan${d?` ${d.person}`:''} dan ${paymentCount} pembayaran terkait juga akan dihapus agar saldo dan omzet tetap konsisten.`,
      'Hapus',
      ()=>{
        removeLinkedTransactionEffects(t);
        state.transactions=state.transactions.filter(x=>x.id!==id);
        save();
        toast('Penjualan, piutang, dan pembayaran terkait dihapus.');
        render();
      }
    );
  }

  return requestDeleteTransactionCore(id);
}

function originalCashImpactV74(t){
  if(!t)return 0;
  if(typeof transactionCashAmountV73==='function'){
    return Math.max(0,Number(transactionCashAmountV73(t))||0);
  }
  return Math.max(0,Number(t.amount)||0);
}

function accountBalanceBeforeEditV74(accountId,t){
  // Mulai dari saldo yang saat ini terlihat di Akun & Dompet.
  let balance=Number(accountBalance(accountId))||0;
  if(!t)return balance;

  const originalCash=originalCashImpactV74(t);

  // Kembalikan efek transaksi lama dulu.
  // Dengan begitu validasi menghitung saldo "sebelum transaksi yang sedang diedit".
  if(t.type==='income'&&t.accountId===accountId){
    balance-=originalCash;
  }else if(t.type==='expense'&&t.accountId===accountId){
    balance+=originalCash;
  }else if(t.type==='transfer'){
    const amount=Math.max(0,Number(t.amount)||0);
    if(t.fromAccountId===accountId)balance+=amount;
    if(t.toAccountId===accountId)balance-=amount;
  }

  return balance;
}


function budgetTransactionsV75(b){
  if(!b)return [];

  return state.transactions
    .filter(t=>
      t &&
      t.type==='expense' &&
      monthKey(t.date)===b.month &&
      t.category===b.category &&
      isLivingExpenseTx(t)
    )
    .sort((a,z)=>
      (String(z.date||'')+String(z.id||''))
        .localeCompare(String(a.date||'')+String(a.id||''))
    );
}

function budgetDetailRowV75(t){
  return `<div class="budget-detail-tx-v75">
    <div class="budget-detail-icon-v75 ${iconClassFor(t.category||'')}">
      ${iconFor(t.category||'Lainnya')}
    </div>

    <div class="budget-detail-main-v75">
      <b>${esc(t.note||t.category||'Pengeluaran')}</b>
      <span>${prettyDate(t.date)} • ${esc(accountName(t.accountId))}</span>
    </div>

    <strong>− ${fmt(t.amount)}</strong>
  </div>`;
}

function openBudgetCategoryDetailV75(budgetId){
  const b=state.budgets.find(x=>x&&x.id===budgetId);
  if(!b)return;

  const tx=budgetTransactionsV75(b);
  const limit=Math.max(0,Number(b.limit)||0);
  const used=tx.reduce((s,t)=>s+(Number(t.amount)||0),0);
  const remaining=Math.max(0,limit-used);
  const pct=limit>0?Math.round(used/limit*100):0;

  openModal(
    `${iconFor(b.category||'Lainnya')} ${b.category||'Rincian Budget'}`,
    `<div class="budget-detail-v75">
      <div class="budget-detail-summary-v75">
        <div>
          <span>Terpakai ${monthLabel(b.month)}</span>
          <b>${fmt(used)}</b>
        </div>
        <div>
          <span>Budget</span>
          <b>${fmt(limit)}</b>
        </div>
        <div>
          <span>${used>limit?'Melebihi':'Sisa'}</span>
          <b class="${used>limit?'red':'green'}">
            ${fmt(used>limit?used-limit:remaining)}
          </b>
        </div>
      </div>

      <div class="budget-detail-progress-v75">
        <i class="${pct>100?'over':''}" style="width:${Math.min(100,Math.max(0,pct))}%"></i>
      </div>
      <div class="budget-detail-progress-label-v75">
        <b class="${pct>100?'red':pct>=80?'budget-warning':'green'}">${pct}% terpakai</b>
        <span>${tx.length} transaksi</span>
      </div>

      <div class="budget-detail-title-v75">
        Semua Pengeluaran ${esc(b.category||'')}
      </div>

      <div class="budget-detail-list-v75">
        ${tx.length
          ?tx.map(budgetDetailRowV75).join('')
          :'<div class="empty compact-empty">Belum ada pengeluaran pada kategori ini di bulan tersebut.</div>'}
      </div>
    </div>`
  );
}

function budgetCard(b,i){
  const limit=Math.max(0,Number(b?.limit)||0);
  const used=budgetTransactionsV75(b)
    .reduce((s,t)=>s+(Number(t.amount)||0),0);
  const rawPct=limit>0?Math.round(used/limit*100):0;
  const barPct=Math.max(0,Math.min(100,rawPct));
  const color=budgetPalette[i%budgetPalette.length];

  return `<div
    class="card compact budget-row budget-card-v5 budget-card-clickable-v75"
    data-budget-detail="${esc(b?.id||'')}"
    role="button"
    tabindex="0"
    aria-label="Lihat semua pengeluaran ${esc(b?.category||'budget')}"
  >
    <span class="round-icon ${iconClassFor(b?.category||'')}">${iconFor(b?.category||'Lainnya')}</span>

    <div class="budget-info">
      <div class="goal-row">
        <div class="list-title">${esc(b?.category||'Tanpa kategori')}</div>
        <b class="small ${rawPct>100?'red':rawPct>=80?'budget-warning':''}">${rawPct}% terpakai</b>
      </div>

      <div class="budget-nominal">
        ${fmt(used)} <span>dari ${fmt(limit)}</span>
      </div>

      <div class="budget-bar">
        <i style="width:${barPct}%;background:${rawPct>100?'#FF6668':color}"></i>
      </div>

      <div class="budget-click-hint-v75">Klik untuk lihat semua pengeluaran</div>

      <div class="record-actions">
        <button class="mini-action" data-edit-budget="${esc(b.id||'')}">Edit</button>
        <button class="mini-action danger-text" data-delete-budget="${esc(b.id||'')}">Hapus</button>
      </div>
    </div>
  </div>`;
}


const preferredCategoriesV76 = [
  {name:'Makan & Minum', icon:'🍜', group:'needs'},
  {name:'Transportasi', icon:'🛵', group:'needs'},
  {name:'Groceries', icon:'🛒', group:'needs'},
  {name:'Listrik', icon:'💡', group:'needs'},
  {name:'Pakan Hewan', icon:'🐾', group:'needs'},

  {name:'Hadiah', icon:'🎁', group:'wants'},
  {name:'Hiburan', icon:'🎉', group:'wants'},

  {name:'Penyesuaian Saldo', icon:'⚖️', group:'other'},
  {name:'Kantor', icon:'💼', group:'other'},
  {name:'Lainnya', icon:'📁', group:'other'},

  {name:'Penjualan', icon:'🛍️', group:'sales'},
  {name:'Utang & Cicilan', icon:'💳', group:'debt'}
];

const legacyDefaultCategoriesV76 = new Set([
  'Tagihan',
  'Kesehatan',
  'Pendidikan',
  'Rumah Tangga',
  'Gaji',
  'Bonus',
  'Transfer',
  'Cicilan'
]);

function applyPreferredCategoryPresetV76(){
  if(localStorage.getItem('uangku_category_preset_v76')==='1')return;

  const desiredNames=preferredCategoriesV76.map(x=>x.name);
  const desiredSet=new Set(desiredNames);

  // Pertahankan kategori custom milik pengguna dan kategori sistem yang muncul
  // dari fitur tertentu (mis. Piutang Penjualan). Hanya default lama yang dipangkas.
  const custom=(state.categories||[]).filter(c=>
    !desiredSet.has(c) &&
    !legacyDefaultCategoriesV76.has(c)
  );

  state.categories=[
    ...desiredNames,
    ...custom.filter((c,i,a)=>c&&a.indexOf(c)===i)
  ].slice(0,100);

  state.categoryIcons=state.categoryIcons&&typeof state.categoryIcons==='object'
    ?state.categoryIcons
    :{};

  state.categoryGroups=state.categoryGroups&&typeof state.categoryGroups==='object'
    ?state.categoryGroups
    :{};

  preferredCategoriesV76.forEach(x=>{
    state.categoryIcons[x.name]=x.icon;
    state.categoryGroups[x.name]=x.group;
  });

  localStorage.setItem('uangku_category_preset_v76','1');
  save();
}

function transactionCategoryOptionsV76(current=''){
  const active=[...(state.categories||[])];
  const options=[];

  // Jika transaksi lama memakai kategori yang sudah dihapus dari daftar aktif,
  // kategorinya tetap muncul saat transaksi itu diedit.
  if(current&&!active.includes(current)){
    options.push(`<option value="${esc(current)}" selected>${esc(current)} • kategori lama</option>`);
  }

  options.push(...active.map(c=>
    `<option value="${esc(c)}" ${current===c?'selected':''}>${esc(c)}</option>`
  ));

  return options.join('');
}

function deleteCategoryV63(index){
  const c=state.categories[index];
  if(!c)return;

  const usedTx=state.transactions.some(t=>t&&t.category===c);
  const usedBudget=state.budgets.some(b=>b&&b.category===c);
  const used=usedTx||usedBudget;

  const detail=[
    usedTx?'transaksi lama':'',
    usedBudget?'budget':''
  ].filter(Boolean).join(' dan ');

  openConfirm(
    'Hapus dari Daftar Kategori',
    used
      ?`${c} masih dipakai pada ${detail}. Kategori ini tetap boleh dihapus dari daftar pilihan. Data lama tidak akan ikut terhapus dan tetap menampilkan nama ${c}.`
      :`Hapus kategori ${c} dari daftar pilihan?`,
    'Hapus',
    ()=>{
      state.categories.splice(index,1);

      // Kalau masih dipakai data lama, simpan ikon/kelompok agar histori tetap rapi.
      if(!used){
        if(state.categoryIcons)delete state.categoryIcons[c];
        if(state.categoryGroups)delete state.categoryGroups[c];
      }

      save();
      toast(used
        ?'Kategori dihapus dari pilihan. Data lama tetap aman.'
        :'Kategori dihapus.'
      );
      render();
    }
  );
}

function renderCategories(){
  ensureCategoryGroupsV63();

  return `<div class="section-head">
    <div>
      <h3>Kategori Aktif</h3>
      <p>${state.categories.length}/100 kategori tersedia</p>
    </div>
    <button class="link-btn" id="addCategoryBtn">+ Tambah</button>
  </div>

  <div class="category-preset-note-v76">
    Aku sederhanakan kategori awal ke yang paling sering kamu pakai.
    Kategori lain bisa ditambahkan kapan saja. Menghapus kategori yang pernah dipakai
    <b>tidak menghapus transaksi lamanya</b>.
  </div>

  <div class="category-group-help">
    Kelompok dipakai untuk Ringkasan dan analisis pengeluaran.
    <b>Listrik</b> sekarang masuk Kebutuhan, <b>Penjualan</b> masuk Jual - Beli,
    dan <b>Utang & Cicilan</b> defaultnya Utang/Cicilan tetapi bisa kamu Edit menjadi Keinginan.
  </div>

  <div class="list">
    ${state.categories.map((c,i)=>{
      const group=categoryGroupV63(c);
      const def=categoryGroupDefsV63[group]||categoryGroupDefsV63.other;

      return `<div class="list-item category-row-v63">
        <span class="round-icon ${iconClassFor(c)}">${iconFor(c)}</span>

        <div class="list-main">
          <div class="list-title">${esc(c)}</div>
          <div class="category-group-chip" style="--group-color:${def.color}">
            <i></i>${def.label}
          </div>
        </div>

        <div class="record-actions right">
          <button class="mini-action" data-edit-cat="${i}">Edit</button>
          <button class="mini-action danger-text" data-delete-cat-v63="${i}">Hapus</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

/* Label kelompok Penjualan dibuat lebih sesuai fungsi jual-beli. */
categoryGroupDefsV63.sales.label='Jual - Beli';

/* Pastikan preset pengguna ini diterapkan sekali saja pada data yang sudah ada. */
applyPreferredCategoryPresetV76();
ensureCategoryGroupsV63();


function isMovingAccountV78(a){
  const type=String(a?.type||'').toLowerCase().replace(/\s+/g,'');
  return type==='bank'||type==='cash'||type==='e-wallet'||type==='ewallet';
}
function movingAccountsV78(){return (state.accounts||[]).filter(isMovingAccountV78)}
function movingAccountsTotalV78(){return movingAccountsV78().reduce((s,a)=>s+(Number(accountBalance(a.id))||0),0)}
function averageIncomeV78(){
  const eligible=(state.transactions||[]).filter(t=>t&&t.type==='income'&&t.date&&t.source!=='debt_proceeds'&&t.source!=='sale_receivable_payment');
  const months=[...new Set(eligible.map(t=>monthKey(t.date)).filter(Boolean))].sort().slice(-6);
  if(!months.length)return {amount:0,months:0};
  const total=months.reduce((sum,k)=>sum+eligible.filter(t=>monthKey(t.date)===k).reduce((s,t)=>s+(typeof transactionCashAmountV73==='function'?transactionCashAmountV73(t):(Number(t.amount)||0)),0),0);
  return {amount:Math.round(total/months.length),months:months.length};
}
function overviewIconV78(type){
  const icons={
    income:`<svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6.5" width="16" height="11" rx="3"></rect>
      <circle cx="12" cy="12" r="2.3"></circle>
      <path d="M7 12h.01M17 12h.01"></path>
    </svg>`,
    savings:`<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.5 10.5c0-2.7 2.2-4.8 5-4.8 1.3 0 2.6.4 3.5 1.1.9 0 1.7.1 2.4.4-.6.5-1.1 1.2-1.3 2.1 1 .8 1.6 2 1.6 3.4 0 3-2.5 5.4-5.6 5.4H10c-2 0-3.6-1.6-3.6-3.6v-4.2c0-.5.4-.9.9-.9h.2z"></path>
      <circle cx="14.5" cy="10.1" r=".8" fill="currentColor" stroke="none"></circle>
      <path d="M9.4 9.1 11 7.7M9.6 18v1.2M15.6 18v1.2M18.1 12.1h1.3"></path>
    </svg>`,
    debt:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="3"></rect><path d="M7 10h10M7 14h6"></path></svg>`,
    receivable:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10v10H7z"></path><path d="M10 5h9v9M17 5l2 2-2 2"></path></svg>`
  };
  return icons[type]||icons.income;
}
function financialSlideArrowsV78(index){
  return `<div class="finance-slide-arrows-v78">${index>0?`<button type="button" class="finance-arrow-v78" data-finance-prev="${index}" aria-label="Geser ke kiri">‹</button>`:''}<span>${index+1}/3</span>${index<2?`<button type="button" class="finance-arrow-v78" data-finance-next="${index}" aria-label="Geser ke kanan">›</button>`:''}</div>`;
}
function renderMovingAccountsSlideV78(){
  const accounts=movingAccountsV78(), total=movingAccountsTotalV78();
  return `<section class="card financial-slide-card-v78 moving-accounts-card-v78"><div class="finance-slide-head-v78">${financialSlideArrowsV78(1)}</div><div class="section-head moving-accounts-title-v78"><div><div class="kicker">Saldo Akun</div><div class="big-value moving-total-v78">${privacyMoney(total)}</div><p>Bank + Cash + e-Wallet</p></div><button class="link-btn" id="openAccountsV78">Kelola</button></div><div class="moving-account-list-v78">${accounts.length?accounts.map(a=>`<div class="moving-account-row-v78">${accountLogoHTML(a)}<div class="moving-account-main-v78"><b>${esc(a.name)}</b><span>${esc(a.type||'Akun')}</span></div><strong>${privacyMoney(accountBalance(a.id))}</strong></div>`).join(''):'<div class="empty compact-empty">Belum ada akun Bank, Cash, atau e-Wallet.</div>'}</div><div class="finance-swipe-hint-v78">← Kekayaan Bersih • Overview →</div></section>`;
}
function renderOverviewSlideV78(){
  const avg=averageIncomeV78(), debts=debtTotals(), savings=savingsBalance();
  return `<section class="card financial-slide-card-v78 financial-overview-card-v78"><div class="finance-slide-head-v78">${financialSlideArrowsV78(2)}</div><div class="section-head overview-title-v78"><div><div class="kicker">Financial Overview</div><p>Ringkasan kondisi keuangan utama</p></div></div><div class="overview-grid-v78">
    <div class="overview-box-v78 income"><div class="overview-icon-v78">${overviewIconV78('income')}</div><span>Rata-rata Pemasukan</span><b>${privacyMoney(avg.amount)}</b><small>${avg.months?`${avg.months} bulan tercatat`:'belum ada data'}</small></div>
    <div class="overview-box-v78 savings"><div class="overview-icon-v78">${overviewIconV78('savings')}</div><span>Total Tabungan</span><b>${privacyMoney(savings)}</b><small>saldo akun jenis Tabungan</small></div>
    <button type="button" class="overview-box-v78 debt clickable" data-overview-breakdown="payable"><div class="overview-icon-v78">${overviewIconV78('debt')}</div><span>Total Utang <em>›</em></span><b>${privacyMoney(debts.payable)}</b><small>klik untuk breakdown</small></button>
    <button type="button" class="overview-box-v78 receivable clickable" data-overview-breakdown="receivable"><div class="overview-icon-v78">${overviewIconV78('receivable')}</div><span>Total Piutang <em>›</em></span><b>${privacyMoney(debts.receivable)}</b><small>klik untuk breakdown</small></button>
  </div><div class="finance-swipe-hint-v78">← Geser kiri untuk Saldo Akun</div></section>`;
}
function renderFinancialCarouselV78(m,debts,worth,cash,savings){return `<section class="financial-carousel-shell-v78"><div class="financial-carousel-track-v78" id="financialCarouselV78"><div class="financial-slide-v78" data-finance-slide="0">${renderNetWorthSlideV78(m,debts,worth,cash,savings)}</div><div class="financial-slide-v78" data-finance-slide="1">${renderMovingAccountsSlideV78()}</div><div class="financial-slide-v78" data-finance-slide="2">${renderOverviewSlideV78()}</div></div><div class="financial-carousel-dots-v78" id="financialCarouselDotsV78"><i class="active"></i><i></i><i></i></div></section>`}
function debtBreakdownItemsV78(type){return (state.debts||[]).filter(d=>d&&d.type===type&&debtOutstanding(d)>0).sort((a,b)=>debtOutstanding(b)-debtOutstanding(a))}
function openOverviewBreakdownV78(type){
  const isR=type==='receivable', items=debtBreakdownItemsV78(isR?'receivable':'payable'), total=items.reduce((s,d)=>s+debtOutstanding(d),0);
  openModal(isR?'Rincian Piutang Belum Diterima':'Rincian Utang Belum Bayar',`<div class="overview-breakdown-v78"><div class="overview-breakdown-total-v78"><span>${isR?'Total Piutang':'Total Utang'}</span><b class="${isR?'green':'red'}">${privacyMoney(total)}</b></div><div class="overview-breakdown-list-v78">${items.length?items.map(d=>{const sale=isR&&d.receivableKind==='sale';return `<div class="overview-breakdown-row-v78"><span class="round-icon ${isR?'greenbg':'redbg'}">${sale?'🛍️':isR?'🤝':'💳'}</span><div class="overview-breakdown-main-v78"><b>${esc(d.person||d.name||'Tanpa nama')}</b><small>${sale?'Piutang Penjualan':isR?'Piutang':'Utang'}${d.dueDate?` • jatuh tempo ${prettyDate(d.dueDate)}`:''}</small></div><strong class="${isR?'green':'red'}">${privacyMoney(debtOutstanding(d))}</strong></div>`}).join(''):`<div class="empty compact-empty">${isR?'Tidak ada piutang aktif.':'Tidak ada utang aktif.'}</div>`}</div><button type="button" class="btn secondary block" id="openDebtPageFromOverviewV78">Buka Utang & Tagihan</button></div>`);
  setTimeout(()=>{$('#openDebtPageFromOverviewV78')&&($('#openDebtPageFromOverviewV78').onclick=()=>{closeModal();debtTab='debts';navigate('debts')})},0);
}
function initFinancialCarouselV78(){
  const track=$('#financialCarouselV78'), dots=$$('#financialCarouselDotsV78 i'); if(!track||!dots.length)return;
  const go=i=>{const n=Math.max(0,Math.min(2,i)), left=track.clientWidth*n; if(typeof track.scrollTo==='function')track.scrollTo({left,behavior:'smooth'});else track.scrollLeft=left};
  $$('[data-finance-next]').forEach(b=>b.onclick=e=>{e.stopPropagation();go(Number(b.dataset.financeNext)+1)});
  $$('[data-finance-prev]').forEach(b=>b.onclick=e=>{e.stopPropagation();go(Number(b.dataset.financePrev)-1)});
  let raf=0; track.addEventListener('scroll',()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const i=Math.max(0,Math.min(2,Math.round(track.scrollLeft/Math.max(1,track.clientWidth))));dots.forEach((d,n)=>d.classList.toggle('active',n===i))})},{passive:true});
}
function renderHome(){
  const m=monthTotals(homePeriod), debts=debtTotals(), worth=netWorthValue(), cash=budgetCashBreakdown(homePeriod), savings=savingsBalance(), userName=getUserNameV65();
  return `<section class="welcome-card"><div><div class="hello">${userName?`Hai, ${esc(userName)}! 👋`:'Hai! 👋'}</div><div class="hello-copy">Kelola uang hari ini,<br>untuk hidup yang kamu mau.</div></div>${homeMascot()}</section>${renderPeriodControl('homeMonthInput',homePeriod)}${renderFinancialCarouselV78(m,debts,worth,cash,savings)}${renderHomeSummaryV65(homePeriod)}${renderHomeBudget(homePeriod)}${renderSalesHome(homePeriod)}${renderDebtReceivableHomeV70()}${renderHomeGoalsV70()}${renderRecentTransactionsV65()}`;
}

function normalizeVoiceTextV79(text){
  return String(text||'')
    .toLowerCase()
    .replace(/[?!,;:]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function parseBelowThousandV79(tokens){
  const unit={
    nol:0,satu:1,dua:2,tiga:3,empat:4,lima:5,enam:6,tujuh:7,delapan:8,sembilan:9
  };

  let total=0;
  let i=0;

  while(i<tokens.length){
    const w=tokens[i];

    if(w==='seratus'){total+=100;i++;continue}
    if(w==='sepuluh'){total+=10;i++;continue}
    if(w==='sebelas'){total+=11;i++;continue}

    if(unit[w]!==undefined){
      const n=unit[w];

      if(tokens[i+1]==='ratus'){
        total+=n*100;i+=2;continue;
      }

      if(tokens[i+1]==='puluh'){
        total+=n*10;
        i+=2;
        if(unit[tokens[i]]!==undefined){
          total+=unit[tokens[i]];
          i++;
        }
        continue;
      }

      if(tokens[i+1]==='belas'){
        total+=10+n;
        i+=2;
        continue;
      }

      total+=n;
      i++;
      continue;
    }

    i++;
  }

  return total;
}

function parseNumberWordPhraseV79(tokens){
  if(!tokens.length)return 0;

  let total=0;
  let rest=[...tokens];

  const jutaIndex=rest.indexOf('juta');
  if(jutaIndex>=0){
    const left=rest.slice(0,jutaIndex);
    total+=(parseBelowThousandV79(left)||1)*1000000;
    rest=rest.slice(jutaIndex+1);
  }

  const ribuIndex=rest.indexOf('ribu');
  if(ribuIndex>=0){
    const left=rest.slice(0,ribuIndex);
    total+=(parseBelowThousandV79(left)||1)*1000;
    rest=rest.slice(ribuIndex+1);
  }

  total+=parseBelowThousandV79(rest);
  return total;
}

function parseAmountV79(text){
  const old=parseAmount(text);
  if(old>0)return old;

  const numericWords=new Set([
    'nol','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan',
    'sepuluh','sebelas','belas','puluh','seratus','ratus','seribu','ribu','sejuta','juta'
  ]);

  const raw=normalizeVoiceTextV79(text)
    .replace(/\bseribu\b/g,'satu ribu')
    .replace(/\bsejuta\b/g,'satu juta');

  const tokens=raw.split(' ');
  let best=0;
  let current=[];

  const flush=()=>{
    if(!current.length)return;
    best=Math.max(best,parseNumberWordPhraseV79(current));
    current=[];
  };

  tokens.forEach(w=>{
    if(numericWords.has(w))current.push(w);
    else flush();
  });
  flush();

  return best;
}

function findMentionedAccountV79(text){
  const t=normalizeVoiceTextV79(text);
  const accounts=[...(state.accounts||[])].sort((a,b)=>
    String(b.name||'').length-String(a.name||'').length
  );

  return accounts.find(a=>{
    const name=String(a.name||'').toLowerCase().trim();
    if(!name)return false;
    return t.includes(name);
  })||null;
}

function findMentionedCategoryV79(text){
  const t=normalizeVoiceTextV79(text);

  const exact=[...(state.categories||[])].sort((a,b)=>b.length-a.length)
    .find(c=>t.includes(String(c).toLowerCase()));

  if(exact)return exact;

  const aliases=[
    ['Makan & Minum',['makan','minum','jajan','kopi','mie','bakso','nasi','dimsum','kebab']],
    ['Transportasi',['transport','bensin','pertamax','parkir','ojek','motor']],
    ['Groceries',['groceries','sembako','belanja bulanan','sayur','buah']],
    ['Listrik',['listrik','token listrik']],
    ['Pakan Hewan',['pakan','kucing','hewan']],
    ['Hadiah',['hadiah','kado']],
    ['Hiburan',['hiburan','film','game','rekreasi']],
    ['Penjualan',['penjualan','jualan','jual']],
    ['Utang & Cicilan',['utang','hutang','cicilan']],
    ['Kantor',['kantor']],
    ['Penyesuaian Saldo',['penyesuaian saldo','koreksi saldo']]
  ];

  for(const [cat,words] of aliases){
    if(words.some(w=>t.includes(w)))return cat;
  }

  return '';
}

function currentMonthKeyV79(){
  return typeof homePeriod==='string'&&/^\d{4}-\d{2}$/.test(homePeriod)
    ?homePeriod
    :monthKey(today());
}

function activeBillsTotalV79(){
  return (state.bills||[])
    .filter(b=>b&&b.status!=='paid')
    .reduce((s,b)=>s+(Number(b.amount)||0),0);
}

function recentTransactionReplyV79(){
  const tx=[...(state.transactions||[])]
    .filter(Boolean)
    .sort((a,b)=>(String(b.date||'')+String(b.id||'')).localeCompare(String(a.date||'')+String(a.id||'')))
    .slice(0,3);

  if(!tx.length)return'Belum ada transaksi yang tercatat.';

  const items=tx.map(t=>{
    if(t.type==='transfer')return`${t.note||'Transfer'} ${fmt(t.amount)}`;
    return`${t.note||t.category||'Transaksi'} ${t.type==='income'?'masuk':'keluar'} ${fmt(t.amount)}`;
  });

  return`Tiga transaksi terakhirmu: ${items.join('; ')}.`;
}

function assistantProcess(text){
  const raw=String(text||'').trim();
  const t=normalizeVoiceTextV79(raw);
  const k=currentMonthKeyV79();

  if(!t)return'Aku belum menangkap pertanyaannya. Coba ucapkan lagi, ya.';

  if(/^(hai|halo|hello|pagi|siang|sore|malam)\b/.test(t)){
    return'Hai! Aku siap bantu cek kondisi keuanganmu atau mencatat transaksi lewat suara.';
  }

  // Pertanyaan akun/saldo.
  if(/\b(saldo|uang di akun|uangku di)\b/.test(t)){
    const account=findMentionedAccountV79(t);

    if(account){
      return`Saldo ${account.name} sekarang ${fmt(accountBalance(account.id))}.`;
    }

    if(/bergerak|bank.*cash|cash.*bank|e.?wallet/.test(t)&&typeof movingAccountsTotalV78==='function'){
      return`Total saldo akun bergerakmu ${fmt(movingAccountsTotalV78())}. Ini hanya Bank, Cash, dan e-Wallet.`;
    }

    return`Saldo seluruh Akun & Dompetmu ${fmt(totalBalance())}.`;
  }

  if(/kekayaan bersih|net worth|total kekayaan/.test(t)){
    return`Kekayaan bersihmu saat ini ${fmt(netWorthValue())}. Nilainya sudah memperhitungkan aset yang dipilih, piutang, dan mengurangi utang.`;
  }

  if(/rata.?rata pemasukan|average pemasukan/.test(t)){
    const avg=typeof averageIncomeV78==='function'?averageIncomeV78():{amount:0,months:0};
    return avg.months
      ?`Rata-rata pemasukanmu ${fmt(avg.amount)} per bulan, berdasarkan ${avg.months} bulan data terakhir.`
      :'Belum cukup data untuk menghitung rata-rata pemasukan.';
  }

  if(/\b(tabungan|total tabungan)\b/.test(t)&&/(berapa|total|saldo|punya|sekarang)/.test(t)){
    return`Total saldo akun jenis Tabunganmu ${fmt(savingsBalance())}.`;
  }

  if(/\b(piutang)\b/.test(t)&&/(berapa|sisa|total|punya|belum)/.test(t)){
    const d=debtTotals();
    return`Sisa piutangmu ${fmt(d.receivable)}.`;
  }

  if(/\b(utang|hutang)\b/.test(t)&&/(berapa|sisa|total|punya|belum|bayar)/.test(t)){
    const d=debtTotals();
    return`Sisa utangmu ${fmt(d.payable)}.`;
  }

  if(/\b(tagihan)\b/.test(t)&&/(berapa|total|aktif|belum|bulan)/.test(t)){
    const active=(state.bills||[]).filter(b=>b&&b.status!=='paid').length;
    return`Kamu punya ${active} tagihan aktif dengan total ${fmt(activeBillsTotalV79())}.`;
  }

  if(/pengeluaran rutin|rutin bulan|rutin berapa/.test(t)){
    const rows=(state.transactions||[]).filter(x=>x&&x.type==='expense'&&x.source==='routine_expense'&&monthKey(x.date)===k);
    const total=rows.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
    return`Pengeluaran rutin yang sudah dicatat pada ${monthLabel(k)} adalah ${fmt(total)} dari ${rows.length} transaksi. Kamu punya ${(state.routines||[]).length} daftar rutin.`;
  }

  if(/\b(pengeluaran|keluar)\b/.test(t)&&/(bulan|september|agustus|januari|februari|maret|april|mei|juni|juli|oktober|november|desember|berapa|total)/.test(t)){
    const cat=findMentionedCategoryV79(t);

    if(cat){
      const value=(state.transactions||[])
        .filter(x=>x&&x.type==='expense'&&monthKey(x.date)===k&&x.category===cat)
        .reduce((s,x)=>s+(Number(x.amount)||0),0);

      return`Pengeluaran ${cat} untuk ${monthLabel(k)} adalah ${fmt(value)}.`;
    }

    return`Total pengeluaran ${monthLabel(k)} adalah ${fmt(monthTotals(k).expense)}.`;
  }

  if(/\b(pemasukan|masuk)\b/.test(t)&&/(bulan|september|agustus|januari|februari|maret|april|mei|juni|juli|oktober|november|desember|berapa|total)/.test(t)){
    return`Total pemasukan ${monthLabel(k)} adalah ${fmt(monthTotals(k).income)}.`;
  }

  if(/\b(budget|anggaran)\b/.test(t)){
    const cat=findMentionedCategoryV79(t);
    const budgets=(state.budgets||[]).filter(b=>b&&b.month===k);

    if(cat){
      const b=budgets.find(x=>x.category===cat);
      if(!b)return`Belum ada budget ${cat} untuk ${monthLabel(k)}.`;

      const used=typeof budgetTransactionsV75==='function'
        ?budgetTransactionsV75(b).reduce((s,x)=>s+(Number(x.amount)||0),0)
        :(state.transactions||[])
          .filter(x=>x&&x.type==='expense'&&monthKey(x.date)===k&&x.category===cat)
          .reduce((s,x)=>s+(Number(x.amount)||0),0);

      const remaining=Math.max(0,(Number(b.limit)||0)-used);
      return`Budget ${cat} ${fmt(b.limit)}. Sudah terpakai ${fmt(used)}, sisa ${fmt(remaining)}.`;
    }

    const total=budgets.reduce((s,b)=>s+(Number(b.limit)||0),0);
    return`Total alokasi budget ${monthLabel(k)} adalah ${fmt(total)}.`;
  }

  if(/\b(penjualan|jualan)\b/.test(t)&&/(berapa|bulan|omzet|untung|rugi|keuntungan|piutang|diterima)/.test(t)){
    const s=salesSummary(k);
    const profitWord=s.profit>=0?'keuntungan':'kerugian';
    return`Penjualan ${monthLabel(k)}: omzet ${fmt(s.omzet??s.income)}, diterima ${fmt(s.received??s.income)}, piutang penjualan ${fmt(s.receivable||0)}, pengeluaran ${fmt(s.expense)}, dan ${profitWord} ${fmt(Math.abs(s.profit))}.`;
  }

  if(/\b(target|tujuan keuangan)\b/.test(t)){
    const goals=state.goals||[];
    if(!goals.length)return'Belum ada tujuan keuangan yang dibuat.';

    const named=goals.find(g=>t.includes(String(g.name||'').toLowerCase()));
    if(named){
      const current=goalCurrent(named);
      const pct=Math.round(current/(Number(named.target)||1)*100);
      return`Target ${named.name} sudah ${pct} persen, yaitu ${fmt(current)} dari ${fmt(named.target)}.`;
    }

    return`Kamu punya ${goals.length} tujuan keuangan dengan total dana teralokasi ${fmt(goals.reduce((s,g)=>s+goalCurrent(g),0))}.`;
  }

  if(/transaksi terakhir|terakhir transaksi|riwayat terbaru/.test(t)){
    return recentTransactionReplyV79();
  }

  if(/ringkasan|kondisi keuangan|keuangan aku|keuangan saya/.test(t)){
    const m=monthTotals(k);
    const d=debtTotals();
    return`Ringkasan ${monthLabel(k)}: pemasukan ${fmt(m.income)}, pengeluaran ${fmt(m.expense)}, saldo akun ${fmt(totalBalance())}, sisa utang ${fmt(d.payable)}, dan kekayaan bersih ${fmt(netWorthValue())}.`;
  }

  // Perintah pencatatan transaksi diletakkan setelah seluruh intent pertanyaan,
  // supaya kalimat seperti "utang yang harus dibayar berapa" tidak dianggap transaksi.
  const out=/\b(keluar|catat pengeluaran|pengeluaran|beli|belanja|bayar)\b/.test(t);
  const inc=/\b(masuk|catat pemasukan|pemasukan|terima|gaji|jualan|penjualan)\b/.test(t);

  if(out||inc){
    const amount=parseAmountV79(t);

    if(!amount){
      return'Nominalnya belum jelas. Contohnya, ucapkan “keluar dua puluh lima ribu makan siang”.';
    }

    const type=out?'expense':'income';
    const cat=findMentionedCategoryV79(t)||inferCategory(t,type)||'Lainnya';

    if(!state.accounts.length){
      return`Aku menangkap ${type==='expense'?'pengeluaran':'pemasukan'} ${fmt(amount)}, tetapi belum ada akun. Tambahkan akun dulu di Akun & Dompet.`;
    }

    const mentioned=findMentionedAccountV79(t);
    const account=mentioned||state.accounts[0];

    if(type==='expense'&&accountBalance(account.id)<amount){
      return`Aku menangkap pengeluaran ${fmt(amount)}, tetapi saldo ${account.name} hanya ${fmt(accountBalance(account.id))}. Jadi belum aku catat.`;
    }

    state.transactions.push({
      id:uid(),
      type,
      date:today(),
      amount,
      accountId:account.id,
      category:cat,
      note:raw,
      source:'assistant_voice_or_chat'
    });

    save();

    return`Siap. ${type==='expense'?'Pengeluaran':'Pemasukan'} ${fmt(amount)} sudah dicatat ke ${account.name}, kategori ${cat}.`;
  }

  return'Aku belum yakin maksudnya. Kamu bisa tanya saldo, kekayaan bersih, pemasukan, pengeluaran, tabungan, utang, piutang, budget, penjualan, target, atau minta aku mencatat transaksi.';
}

function speakAssistantV79(text){
  const spoken=String(text||'')
    .replace(/\bRp\s*/g,'rupiah ')
    .replace(/[•]/g,', ')
    .replace(/\s+/g,' ')
    .trim();

  try{
    if(window.Native?.speak){
      Native.speak(spoken);
    }
  }catch(e){}
}

function appendAssistantExchangeV79(text,{speak=false}={}){
  const clean=String(text||'').trim();
  if(!clean)return;

  state.chat.push({role:'user',text:clean});
  const answer=assistantProcess(clean);
  state.chat.push({role:'bot',text:answer});
  save();
  render();

  setTimeout(()=>{
    const box=$('#chatBox');
    if(box)box.scrollTop=box.scrollHeight;
  },20);

  if(speak)speakAssistantV79(answer);
}

function sendChat(){
  const input=$('#chatInput');
  const text=input?.value.trim();
  if(!text)return;
  appendAssistantExchangeV79(text,{speak:false});
}

function startVoice(){
  try{
    if(window.Native?.startVoice){
      Native.startVoice();
    }else{
      toast('Voice aktif saat APK Android dijalankan');
    }
  }catch(e){
    toast('Voice tidak tersedia');
  }
}

window.onVoiceResult=text=>{
  const clean=String(text||'').trim();

  navigate('assistant');

  setTimeout(()=>{
    if(!clean){
      const answer='Aku belum menangkap suaranya. Tekan mikrofon dan coba ucapkan lagi.';
      state.chat.push({role:'bot',text:answer});
      save();
      render();
      speakAssistantV79(answer);
      return;
    }

    appendAssistantExchangeV79(clean,{speak:true});
  },120);
};

window.onVoiceError=msg=>{
  navigate('assistant');

  setTimeout(()=>{
    const answer=`Aku belum berhasil mendengar dengan jelas. ${String(msg||'Coba tekan mikrofon dan ucapkan lagi.')}`;
    state.chat.push({role:'bot',text:answer});
    save();
    render();
    speakAssistantV79(answer);
  },80);
};

function renderAssistant(){
  return `<div class="chat-wrap">
    <div class="bot-head">
      Tanya apa saja tentang keuanganmu
      <small class="assistant-voice-hint-v79">🎙 Kalau bertanya lewat voice, jawabanku juga akan dibacakan.</small>
    </div>

    <div id="chatBox" class="chat">
      ${state.chat.map(m=>`<div class="bubble ${m.role==='user'?'user':'bot'}">${esc(m.text)}</div>`).join('')}
    </div>

    <div class="suggestions">
      <button class="suggestion">Saldo SEABANK berapa?</button>
      <button class="suggestion">Pengeluaran makan bulan ini</button>
      <button class="suggestion">Sisa utang berapa?</button>
      <button class="suggestion">Penjualan bulan ini gimana?</button>
    </div>

    <div class="chat-input">
      <input id="chatInput" placeholder="Ketik atau tanyakan lewat suara...">
      <button id="voiceBtn" class="voice-btn" aria-label="Tanya dengan suara">🎙</button>
      <button id="sendChat" class="send-btn">↑</button>
    </div>
  </div>`;
}

function renderVoice(){
  return `<div class="voice-page">
    <div class="voice-mascot">
      <img class="voice-mascot-image" src="images/uangku_mascot_voice.png" alt="Maskot UangKu sedang mendengarkan">
    </div>

    <h3 class="voice-title-v79">Aku mendengarkan...</h3>
    <div class="list-sub voice-copy-v79">
      Sekarang kamu bisa <b>bertanya</b> atau <b>mencatat transaksi</b>.<br>
      Contoh: “Saldo SEABANK berapa?” atau “Keluar dua puluh lima ribu makan”.
    </div>

    <div class="voice-wave">${'<i></i>'.repeat(6)}</div>
    <button class="stop-btn" id="voiceStop">■</button>

    <div class="tip-card">
      <b>💡 Voice lebih pintar</b><br>
      • Bisa tanya saldo akun tertentu, utang, piutang, budget, penjualan, target, dan kekayaan bersih.<br>
      • Nominal dalam kata seperti “dua puluh lima ribu” juga bisa dibaca.
    </div>
  </div>`;
}


function renderNetWorthSlideV78(m,debts,worth,cash,savings){
  return `<section class="card balance-card networth-card financial-slide-card-v78 networth-card-v711 ${netWorthExpanded?'expanded':''}">
    <div class="finance-slide-head-v78">${financialSlideArrowsV78(0)}</div>

    <div class="balance-top">
      <div class="balance-main">
        <div class="balance-label-row">
          <div class="kicker">Kekayaan Bersih</div>
          <button id="toggleBalanceBtn" class="balance-eye-btn" type="button">${balanceEyeIcon()}</button>
        </div>
        <div class="big-value balance-value">${privacyMoney(worth)}</div>
        <div class="list-sub">Aset yang dimiliki − liabilitas utang</div>
      </div>

      <button id="toggleNetWorthDetail" class="detail-toggle" type="button">
        ${netWorthExpanded?'Tutup':'Rincian'} <span>${netWorthExpanded?'⌃':'⌄'}</span>
      </button>
    </div>

    ${netWorthExpanded?`
      <div class="networth-detail">
        <div class="nw-row"><span>Akun & Dompet</span><b>${privacyMoney(totalBalance())}</b></div>

        <div class="nw-allocation-box-v69">
          <div class="nw-allocation-head-v69">
            <div>
              <b>Komposisi saldo akun</b>
              <small>Ini hanya pembagian dari saldo Akun & Dompet, bukan aset tambahan.</small>
            </div>
          </div>

          <div class="nw-allocation-main-v69">
            <div class="nw-allocation-total-v69">
              <span>Dana teralokasi</span>
              <b>${privacyMoney((cash.targetAllocated||0)+(cash.budgetAllocated||0))}</b>
            </div>

            <div class="nw-allocation-sub-v69">
              <span>↳ Target Keuangan</span>
              <b>${privacyMoney(cash.targetAllocated||0)}</b>
            </div>

            <div class="nw-allocation-sub-v69">
              <span>↳ Budget ${shortMonthLabel(homePeriod)}</span>
              <b>${privacyMoney(cash.budgetAllocated||0)}</b>
            </div>

            <div class="nw-allocation-free-v69">
              <span>Dana bebas</span>
              <b>${privacyMoney(cash.free||0)}</b>
            </div>
          </div>
        </div>

        ${savings!==0?`
          <div class="nw-savings-info-v69">
            <div>
              <span>🐷 Saldo akun jenis Tabungan</span>
              <small>Informasi jenis akun • bisa tumpang tindih dengan dana Target/Budget</small>
            </div>
            <b>${privacyMoney(savings)}</b>
          </div>
        `:''}

        <div class="nw-help">
          Kekayaan bersih tetap menghitung seluruh saldo Akun & Dompet satu kali.
          Dana Target, Budget, dan saldo akun Tabungan hanya rincian.
        </div>

        <div class="nw-row"><span>Piutang</span><b>${privacyMoney(debts.receivable)}</b></div>
        <div class="nw-row"><span>Investasi & Aset</span><b>${privacyMoney(totalAssets())}</b></div>

        <div class="asset-inclusion">
          <div>
            <b>Ikut hitung Investasi & Aset</b>
            <small>${includeInvestmentAssets?'Termasuk dalam kekayaan bersih':'Tidak termasuk dalam kekayaan bersih'}</small>
          </div>
          <label class="switch">
            <input id="includeAssetsToggle" type="checkbox" ${includeInvestmentAssets?'checked':''}>
            <span></span>
          </label>
        </div>

        <div class="nw-row liability"><span>Liabilitas (Utang)</span><b>− ${privacyMoney(debts.payable)}</b></div>
      </div>
    `:''}

    <div class="inout inout-vertical-v711">
      <div class="inout-box inout-wide-v711">
        <span class="round-icon greenbg">↑</span>
        <div class="inout-wide-main-v711">
          <small>Pemasukan • ${shortMonthLabel(homePeriod)}</small>
          <b class="green">${privacyMoney(m.income)}</b>
        </div>
      </div>

      <div class="inout-box inout-wide-v711">
        <span class="round-icon redbg">↓</span>
        <div class="inout-wide-main-v711">
          <small>Pengeluaran • ${shortMonthLabel(homePeriod)}</small>
          <b class="red">${privacyMoney(m.expense)}</b>
        </div>
      </div>
    </div>
  </section>`;
}

applyThemeV82(false);
setHeader('home');render();
