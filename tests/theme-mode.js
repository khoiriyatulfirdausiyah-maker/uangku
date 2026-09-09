const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/style.css'),'utf8');
const js=fs.readFileSync(path.join(root,'app/src/main/assets/app.js'),'utf8');
const gradle=fs.readFileSync(path.join(root,'app/build.gradle'),'utf8');

function ok(cond,msg){
  if(!cond)throw new Error(msg);
  console.log(msg+':OK');
}

ok(html.includes('id="themeToggle"'),'theme-toggle-present');
ok(html.includes('theme-sun-v82')&&html.includes('theme-moon-v82'),'sun-moon-icons-present');
ok(js.includes("localStorage.getItem('uangku_theme')"),'theme-preference-load');
ok(js.includes("localStorage.setItem('uangku_theme',appThemeV82)"),'theme-preference-save');
ok(js.includes('function toggleThemeV82()'),'theme-toggle-function');
ok(js.includes("$('#themeToggle')?.classList.toggle('hidden',!home)"),'theme-home-only');
ok(css.includes('html[data-theme="dark"]'),'dark-theme-css-present');
ok(css.includes('.theme-sun-v82')&&css.includes('.theme-moon-v82'),'theme-icon-css-present');
ok(js.includes("const APP_VERSION='8.11.0';"),'app-version-8.6');
ok(/versionCode\s+91/.test(gradle)&&/versionName\s+"8\.11\.0"/.test(gradle),'android-version-8.11');
