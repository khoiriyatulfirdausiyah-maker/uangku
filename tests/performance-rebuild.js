const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
let src=fs.readFileSync(path.join(root,'app/src/main/assets/app.js'),'utf8')
  .replace("applyThemeV82(false);\nsetHeader('home');render();",'')
  .replace("setHeader('home');render();",'');
function ok(c,m){if(!c)throw new Error(m);console.log(m+':OK')}
const dummy={classList:{toggle(){},add(){},remove(){}},style:{},dataset:{},textContent:'',value:'',innerHTML:'',outerHTML:'',onclick:null,onchange:null,onsubmit:null,onkeydown:null,click(){},focus(){},setAttribute(){},addEventListener(){},querySelectorAll(){return[]},closest(){return null},scrollTo(){},clientWidth:320,scrollLeft:0,scrollHeight:0};
const storage={};
const context={console,window:{scrollTo(){},Native:null},document:{documentElement:{dataset:{},style:{}},querySelector(){return dummy},querySelectorAll(){return[]},createElement(){return dummy},addEventListener(){}},localStorage:{getItem(k){return storage[k]??null},setItem(k,v){storage[k]=String(v)},removeItem(k){delete storage[k]}},requestAnimationFrame(fn){fn();return 1},setTimeout(){return 0},clearTimeout(){},confirm(){return false},FormData:global.FormData,Blob:global.Blob,URL:global.URL,Date,Math,JSON,Intl,Number,String,Array,Object,Set,Map,RegExp,Promise};
context.global=context;vm.createContext(context);vm.runInContext(src,context,{filename:'app.js'});
const accounts=[{id:'a1',name:'Bank',type:'Bank',initial:15000000},{id:'a2',name:'Cash',type:'Cash',initial:2000000},{id:'a3',name:'Tabungan',type:'Tabungan',initial:5000000}];
const cats=['Makan & Minum','Groceries','Transportasi & Bensin','Keperluan Usaha / Modal Penjualan','Penjualan'];
const tx=[];
for(let i=0;i<10000;i++){
 const day=String((i%28)+1).padStart(2,'0');
 const income=i%5===0;
 tx.push({id:'stress'+i,type:income?'income':'expense',date:`2026-09-${day}`,amount:(i%29+1)*7500,accountId:i%2?'a1':'a2',category:income?'Penjualan':cats[i%4]});
}
const demo={profile:{name:'Stress'},accounts,categories:[...cats,'Lainnya'],categoryIcons:{},categoryGroups:{'Makan & Minum':'needs','Groceries':'needs','Transportasi & Bensin':'needs','Keperluan Usaha / Modal Penjualan':'sales','Penjualan':'sales','Lainnya':'other'},categoryTypes:{'Penjualan':'income','Lainnya':'both'},transactions:tx,budgets:[{id:'b1',month:'2026-09',category:'Makan & Minum',limit:3000000},{id:'b2',month:'2026-09',category:'Groceries',limit:2000000},{id:'b3',month:'2026-09',category:'Transportasi & Bensin',limit:1500000}],goals:[],assets:{investment:[],property:[],physical:[]},debts:[],bills:[],routines:[],chat:[]};
context.demo=demo;
vm.runInContext("state=normalizeState(demo);homePeriod='2026-09';planPeriod='2026-09';includeInvestmentAssets=false;invalidateDerivedCacheV83();txVisibleCountV811=TX_PAGE_SIZE_V811;",context);
const t0=Date.now();
for(let i=0;i<10;i++)context.renderHome();
const elapsed=Date.now()-t0;
ok(elapsed<1800,`10k-home-render-under-1800ms (${elapsed}ms)`);
const html=context.renderTransactions();
const rows=(html.match(/data-edit-tx=/g)||[]).length;
ok(rows<=60,`transaction-first-page-max-60 (${rows})`);
ok(html.length<120000,`transaction-html-bounded (${html.length})`);
ok(context.recentTransactionsV811(5).length===5,'recent-cache-five');
const first=context.monthAnalyticsV811('2026-09');
const second=context.monthAnalyticsV811('2026-09');
ok(first===second,'month-analytics-memoized');
ok(src.includes('bindHomeSummaryToggleV811'),'partial-home-summary-update');
ok(src.includes("$$('[data-private-money]').forEach"),'partial-private-money-update');
