import { readdir,readFile,stat } from 'node:fs/promises';
import { resolve,relative } from 'node:path';
const root=resolve('dist');const problems=[];
try{await stat(resolve(root,'test-fixture.json'));problems.push('Test verileri canlıya dağıtılamaz.');}catch{}
let count=0;
for(const entry of await readdir(root,{recursive:true,withFileTypes:true})){
  if(!entry.isFile())continue;count++;
  const path=resolve(entry.parentPath,entry.name);const name=relative(root,path);
  if((await stat(path)).size>25*1024*1024)problems.push(`25 MiB üstünde dosya: ${name}`);
  if(/\.(html|js|json|css|txt|xml)$/.test(name)){
    const text=await readFile(path,'utf8');
    for(const key of ['SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY','GROQ_API_KEY','OPENROUTER_API_KEY','CLOUDFLARE_API_TOKEN','TELEGRAM_BOT_TOKEN','BLUESKY_APP_PASSWORD']){
      const secret=process.env[key];if(secret&&secret.length>8&&text.includes(secret))problems.push(`Gizli değer çıktı içinde: ${name}`);
    }
    if(/sb_secret_[a-zA-Z0-9_-]{12,}|AIza[0-9A-Za-z_-]{30,}|gsk_[A-Za-z0-9]{30,}/.test(text))problems.push(`Gizli anahtar biçimi: ${name}`);
    if(name.endsWith('.html')){
      if(!text.includes('<html lang="tr">'))problems.push(`Dil eksik: ${name}`);
      if(!text.includes('name="description"'))problems.push(`Açıklama eksik: ${name}`);
      const visible=text.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ');
      if(/yapay zek[aâ]|otomatik üretildi|doğrulandı|\p{Emoji_Presentation}/iu.test(visible))problems.push(`Yayın dili kuralı: ${name}`);
      if(name.startsWith('haber/')&&!text.includes('Kaynak:'))problems.push(`Kaynak eksik: ${name}`);
    }
  }
}
if(count>20000)problems.push('Ücretsiz Pages dosya sınırı aşıldı.');
const result=JSON.parse(await readFile('.cache/build-result.json','utf8'));
if(result.demo&&!process.argv.includes('--allow-demo'))problems.push('Gösterim verileri canlıya dağıtılamaz.');
if(!result.demo){
  const {config}=await import('../config.js');
  if(!config.contact.owner||!config.contact.email||!config.contact.address)problems.push('Künye ve KVKK için gerçek site sahibi, e-posta ve adres bilgileri tamamlanmalı.');
}
if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}else console.log(`${count} dosyada dil, kaynak, dosya sınırı ve gizli değer kontrolü başarılı.`);
