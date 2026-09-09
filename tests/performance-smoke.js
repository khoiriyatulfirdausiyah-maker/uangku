const fs=require('fs');
const vm=require('vm');
const path=require('path');
const appPath=path.join(__dirname,'..','app','src','main','assets','app.js');
let src=fs.readFileSync(appPath,'utf8').replace("applyThemeV82(false);\nsetHeader('home');render();",'').replace("setHeader('home');render();",'');
function assert(c,m){if(!c)throw new Error(m)}
let qsa=0;
const dummy={classList:{toggle(){},add(){},remove(){}},style:{},dataset:{},textContent:'',value:'',innerHTML:'',onclick:null,onchange:null,onsubmit:null,onkeydown:null,click(){},focus(){},setAttribute(){},addEventListener(){},querySelectorAll(){qsa++;return[]},closest(){return null},scrollTo(){},clientWidth:320,scrollLeft:0,scrollHeight:0,outerHTML:''};
const storage={};
const context={console,window:{scrollTo(){},Native:null},document:{documentElement:{dataset:{},style:{}},querySelector(){return dummy},querySelectorAll(){qsa++;return[]},createElement(){return dummy},addEventListener(){}},localStorage:{getItem(k){return storage[k]??null},setItem(k,v){storage[k]=String(v)},removeItem(k){delete storage[k]}},requestAnimationFrame(fn){fn();return 1},setTimeout(){return 0},clearTimeout(){},confirm(){return false},FormData:global.FormData,Blob:global.Blob,URL:global.URL,Date,Math,JSON,Intl,Number,String,Array,Object,Set,Map,RegExp,Promise};
context.global=context; vm.createContext(context); vm.runInContext(src,context,{filename:'app.js'});
const accounts=[{id:'a1',name:'Bank',type:'Bank',initial:5000000},{id:'a2',name:'Cash',type:'Cash',initial:1000000},{id:'a3',name:'Saving',type:'Tabungan',initial:3000000}];
const tx=[]; for(let i=0;i<2500;i++){const day=String((i%28)+1).padStart(2,'0');tx.push({id:'t'+i,type:i%3===0?'income':'expense',date:`2026-09-${day}`,amount:(i%17+1)*10000,accountId:i%2?'a1':'a2',category:i%4?'Makan & Minum':'Penjualan'})}
const demo={profile:{name:'Perf'},accounts,categories:['Makan & Minum','Penjualan','Lainnya'],categoryIcons:{},categoryGroups:{'Makan & Minum':'needs','Penjualan':'sales','Lainnya':'other'},categoryTypes:{'Makan & Minum':'expense','Penjualan':'income','Lainnya':'both'},transactions:tx,budgets:[{id:'b1',month:'2026-09',category:'Makan & Minum',limit:3000000}],goals:[],assets:{investment:[],property:[],physical:[]},debts:[],bills:[],routines:[],chat:[]};
context.demo=demo; vm.runInContext("state=normalizeState(demo); homePeriod='2026-09'; planPeriod='2026-09'; reportPeriod='2026-09'; includeInvestmentAssets=false; invalidateDerivedCacheV83();",context);
const t0=Date.now(); for(let i=0;i<15;i++)context.renderHome(); const elapsed=Date.now()-t0;
assert(elapsed<1200,`renderHome benchmark slow: ${elapsed}ms`);
const txHtml=context.renderTransactions();
const renderedItems=(txHtml.match(/data-edit-tx=/g)||[]).length;
assert(renderedItems<=60,`transaction pagination regression: rendered ${renderedItems}`);
assert(txHtml.includes('loadMoreTransactionsV811'),'load-more control missing');
qsa=0; context.currentPage='transactions'; context.bindPage(); const txQ=qsa;
qsa=0; context.currentPage='more'; context.bindPage(); const moreQ=qsa;
assert(txQ<12,`transactions bind scans too many selectors: ${txQ}`); assert(moreQ<10,`more bind scans too many selectors: ${moreQ}`);
console.log(`performance-smoke: OK (${elapsed}ms / 15 home renders, rendered=${renderedItems}, txQSA=${txQ}, moreQSA=${moreQ})`);
