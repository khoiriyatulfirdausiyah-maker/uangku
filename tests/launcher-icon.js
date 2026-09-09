const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
function ok(c,m){if(!c)throw new Error(m);console.log(m+':OK')}
const res=path.join(root,'app/src/main/res');
for(const d of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){
 ok(fs.existsSync(path.join(res,`mipmap-${d}`,'ic_launcher.png')),`launcher-${d}`);
 ok(fs.existsSync(path.join(res,`mipmap-${d}`,'ic_launcher_round.png')),`launcher-round-${d}`);
}
const adaptive=fs.readFileSync(path.join(res,'mipmap-anydpi-v26','ic_launcher.xml'),'utf8');
ok(adaptive.includes('@drawable/uangku_launcher_full'),'adaptive-user-artwork');
ok(fs.existsSync(path.join(res,'drawable-nodpi','uangku_launcher_full.png')),'launcher-full-artwork');
ok(fs.existsSync(path.join(root,'app/src/main/assets','uangku-app-icon.png')),'web-icon-artwork');
