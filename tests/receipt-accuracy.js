const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
let src=fs.readFileSync(path.join(root,'app/src/main/assets/app.js'),'utf8')
 .replace("applyThemeV82(false);\nsetHeader('home');render();",'')
 .replace("setHeader('home');render();",'');
function assert(c,m){if(!c)throw new Error(m)}
const dummy={classList:{toggle(){},add(){},remove(){}},style:{},dataset:{},textContent:'',value:'',innerHTML:'',options:[],click(){},focus(){},setAttribute(){},addEventListener(){},querySelectorAll(){return[]},closest(){return null},scrollTo(){},clientWidth:320,scrollLeft:0,scrollHeight:0};
const context={console,window:{scrollTo(){},Native:null},document:{documentElement:{dataset:{},style:{}},querySelector(){return dummy},querySelectorAll(){return[]},createElement(){return dummy},addEventListener(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},requestAnimationFrame(fn){fn();return 1},setTimeout(){return 0},clearTimeout(){},confirm(){return false},FormData:global.FormData,Blob:global.Blob,URL:global.URL,Date,Math,JSON,Intl,Number,String,Array,Object,Set,Map,RegExp,Promise};
context.global=context; vm.createContext(context); vm.runInContext(src,context,{filename:'app.js'});
context.state=context.normalizeState({accounts:[],categories:['Makan & Minum','Groceries','Lainnya'],transactions:[],budgets:[],goals:[],assets:{investment:[],property:[],physical:[]},debts:[],bills:[],routines:[],chat:[]});

const cases=[
 {name:'total-belanja-items-date-2digit',text:`INDOMARET PAITON\nJL RAYA PAITON\nTGL 08/09/26 14:20\nAQUA 600ML 6.500\nROTI COKLAT 12.000\nSUBTOTAL 18.500\nPPN 2.035\nTOTAL BELANJA 20.535\nTUNAI 50.000\nKEMBALI 29.465`,amount:20535,date:'2026-09-08',items:['AQUA 600ML','ROTI COKLAT']},
 {name:'grand-total-next-line',text:`ALFAMART\n08 SEP 2026 12:01\nSUSU UHT\n1 X 12.500\nROTI TAWAR 16.000\nGRAND TOTAL\nRp 28.500\nCASH 30.000\nCHANGE 1.500`,amount:28500,date:'2026-09-08',items:['SUSU UHT','ROTI TAWAR']},
 {name:'total-payment-ignore-qris',text:`TOKO MAKMUR\nTanggal: 8 September 2026\nBERAS 5KG 75.000\nMINYAK 2L 34.000\nTOTAL PEMBAYARAN 109.000\nQRIS 109.000\nREF 982734`,amount:109000,date:'2026-09-08',items:['BERAS 5KG','MINYAK 2L']},
 {name:'generic-total-vs-cash',text:`TOKO ABC\n2026-09-08 11:12\nMIE INSTAN 10.000\nTELUR 15.000\nTOTAL 25.000\nCASH 100.000\nKEMBALIAN 75.000`,amount:25000,date:'2026-09-08',items:['MIE INSTAN','TELUR']}
];
for(const c of cases){
 const p=context.parseReceiptTextV86(c.text);
 assert(p.amount===c.amount,`${c.name} amount expected ${c.amount}, got ${p.amount}`);
 assert(p.date===c.date,`${c.name} date expected ${c.date}, got ${p.date}`);
 for(const item of c.items)assert(p.items.some(x=>x.toLowerCase().includes(item.toLowerCase())),`${c.name} missing item ${item}: ${JSON.stringify(p.items)}`);
 assert(p.note&&p.note.length>2,`${c.name} note missing`);
}
const java=fs.readFileSync(path.join(root,'app/src/main/java/com/uangku/app/MainActivity.java'),'utf8');
assert(java.includes('new Thread(() -> scanReceiptUri(uri), "uangku-receipt-ocr").start();'),'OCR should start in its own thread immediately');
assert(java.includes('while (maxSide / sample > 900)'),'preview should be lightweight');
assert(java.includes('Bitmap.CompressFormat.JPEG, 68'),'preview compression should be lightweight');
console.log('receipt-accuracy: OK (total + date + items/note + parallel OCR preview)');
