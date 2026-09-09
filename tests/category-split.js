const fs=require('fs');
const vm=require('vm');
const path=require('path');

const root=path.resolve(__dirname,'..');
const jsPath=path.join(root,'app/src/main/assets/app.js');
const gradle=fs.readFileSync(path.join(root,'app/build.gradle'),'utf8');
let src=fs.readFileSync(jsPath,'utf8')
  .replace("applyThemeV82(false);\nsetHeader('home');render();",'')
  .replace("setHeader('home');render();",'');

function ok(cond,msg){
  if(!cond)throw new Error(msg);
  console.log(msg+':OK');
}

ok(src.includes("categoryTypes:{}"),'category-types-state');
ok(src.includes("function categoriesForTypeV810"),'type-filter-helper');
ok(src.includes("function applyCategorySplitPresetV810"),'category-migration');
ok(src.includes("Gaji"),'income-gaji');
ok(src.includes("Bonus / THR"),'income-bonus-thr');
ok(src.includes("Penjualan"),'income-sales');
ok(src.includes("Pendapatan Usaha"),'income-business');
ok(src.includes("Piutang Dibayar"),'income-receivable-paid');
ok(src.includes("Pinjaman Masuk"),'income-loan');
ok(src.includes("Refund / Pengembalian Dana"),'income-refund');
ok(src.includes("Keperluan Usaha / Modal Penjualan"),'expense-business-capital');
ok(src.includes("Cicilan & Bayar Utang"),'expense-debt-payment');
ok(src.includes("Tagihan & Langganan"),'expense-bills');
ok(src.includes("data-category-tab-v810"),'category-manager-tabs');
ok(src.includes("categoriesForTypeV810(selectedType)"),'new-transaction-filtered');
ok(src.includes("transactionCategoryOptionsV810(b?.category||'','expense')"),'budget-expense-only');
ok(/versionCode\s+91/.test(gradle)&&/versionName\s+"8\.11\.0"/.test(gradle),'android-version-8.11');

const dummy={
 classList:{toggle(){},add(){},remove(){}},
 style:{},dataset:{},textContent:'',value:'',innerHTML:'',
 click(){},focus(){},setAttribute(){},addEventListener(){},
 querySelectorAll(){return[]},closest(){return null},
 scrollTo(){},clientWidth:320,scrollLeft:0,scrollHeight:0
};

const storage={};
const context={
 console,
 window:{scrollTo(){},Native:null},
 document:{
   documentElement:{dataset:{},style:{}},
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
 setTimeout(){return 0},clearTimeout(){},
 confirm(){return false},
 FormData:global.FormData,Blob:global.Blob,URL:global.URL,
 Date,Math,JSON,Intl,Number,String,Array,Object,Set,Map,RegExp,Promise
};
context.global=context;
vm.createContext(context);
vm.runInContext(src,context,{filename:'app.js'});

vm.runInContext(`
state=normalizeState({
  accounts:[],transactions:[],budgets:[],goals:[],
  assets:{investment:[],property:[],physical:[]},
  debts:[],bills:[],routines:[],chat:[],
  categories:clone(defaults.categories),categoryIcons:{},categoryGroups:{},categoryTypes:{}
});
localStorage.removeItem('uangku_category_split_v810');
applyCategorySplitPresetV810();
`,context);

const income=context.categoriesForTypeV810('income');
const expense=context.categoriesForTypeV810('expense');

ok(income.includes('Gaji')&&!expense.includes('Gaji'),'gaji-income-only');
ok(income.includes('Pinjaman Masuk')&&!expense.includes('Pinjaman Masuk'),'loan-income-only');
ok(expense.includes('Makan & Minum')&&!income.includes('Makan & Minum'),'food-expense-only');
ok(expense.includes('Keperluan Usaha / Modal Penjualan')&&!income.includes('Keperluan Usaha / Modal Penjualan'),'business-capital-expense-only');
ok(income.includes('Lainnya')&&expense.includes('Lainnya'),'other-both-types');
