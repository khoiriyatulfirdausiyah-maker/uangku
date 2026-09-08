const fs=require('fs');
const vm=require('vm');
const path=require('path');

const root=path.resolve(__dirname,'..');
const appPath=path.join(root,'app','src','main','assets','app.js');
const mainPath=path.join(root,'app','src','main','java','com','uangku','app','MainActivity.java');
const manifestPath=path.join(root,'app','src','main','AndroidManifest.xml');
const pathsXml=path.join(root,'app','src','main','res','xml','file_paths.xml');

let src=fs.readFileSync(appPath,'utf8')
  .replace("applyThemeV82(false);\nsetHeader('home');render();",'')
  .replace("setHeader('home');render();",'');

function assert(cond,msg){if(!cond)throw new Error(msg)}

const dummy={
 classList:{toggle(){},add(){},remove(){}},
 style:{},dataset:{},textContent:'',value:'',innerHTML:'',
 options:[],
 onclick:null,onchange:null,onsubmit:null,onkeydown:null,
 click(){},focus(){},setAttribute(){},addEventListener(){},
 querySelectorAll(){return[]},closest(){return null},scrollTo(){},
 clientWidth:320,scrollLeft:0,scrollHeight:0
};
const storage={};
const documentElement={dataset:{},style:{}};
const context={
 console,
 window:{scrollTo(){},Native:null},
 document:{
   documentElement,
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

context.state=context.normalizeState({
 accounts:[],
 categories:['Makan & Minum','Groceries','Lainnya'],
 transactions:[],budgets:[],goals:[],
 assets:{investment:[],property:[],physical:[]},
 debts:[],bills:[],routines:[],chat:[]
});

const cases=[
 {
   name:'indomaret-total-before-cash',
   text:`INDOMARET PAITON
JL RAYA PAITON
08/09/2026 13:10
AQUA 600ML 6.500
ROTI 12.000
SUBTOTAL 18.500
PPN 2.035
TOTAL BELANJA 20.535
TUNAI 50.000
KEMBALI 29.465`,
   total:20535
 },
 {
   name:'alfamart-comma-thousands',
   text:`ALFAMART
PAITON
08-09-2026
SUSU 12,500
ROTI 16,000
TOTAL 28,500
CASH 30,000
CHANGE 1,500`,
   total:28500
 },
 {
   name:'ignore-invoice-number',
   text:`DIMSUM MENTAI
INVOICE 202609081234
TANGGAL 08/09/2026
3 PCS 25.000
GRAND TOTAL RP 25.000`,
   total:25000
 },
 {
   name:'total-on-next-line',
   text:`TOKO MAKMUR
08/09/2026
BELANJA 47.175
TOTAL BAYAR
Rp 47.175
TUNAI Rp 50.000`,
   total:47175
 }
];

for(const c of cases){
 const parsed=context.parseReceiptTextV84(c.text);
 assert(parsed.amount===c.total,`${c.name}: expected ${c.total}, got ${parsed.amount}`);
}

const dated=context.parseReceiptTextV84(cases[0].text);
assert(dated.date==='2026-09-08',`receipt date expected 2026-09-08, got ${dated.date}`);
assert(dated.merchant && dated.merchant.length>=3,'merchant should be detected');

const main=fs.readFileSync(mainPath,'utf8');
const manifest=fs.readFileSync(manifestPath,'utf8');
const pathXml=fs.readFileSync(pathsXml,'utf8');

assert(main.includes('public void openReceiptCamera()'),'native camera bridge missing');
assert(main.includes('MediaStore.ACTION_IMAGE_CAPTURE'),'direct camera intent missing');
assert(main.includes('public void openReceiptGallery()'),'native gallery bridge missing');
assert(main.includes('InputImage.fromFilePath(this, uri)'),'full-resolution URI OCR missing');
assert(main.includes('public void scanLastReceipt()'),'native rescan bridge missing');
assert(manifest.includes('androidx.core.content.FileProvider'),'FileProvider missing');
assert(pathXml.includes('receipt_images'),'receipt FileProvider path missing');

console.log('receipt-scanner: OK (camera direct + native URI OCR + total parser)');
