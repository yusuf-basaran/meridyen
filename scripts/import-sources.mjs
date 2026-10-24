import { readFile } from 'node:fs/promises';
import { CATEGORIES } from '../config.js';
import { database,checked } from '../lib/supabase.mjs';
import { fetchFeed } from '../lib/rss.mjs';
import { logError,safeURL } from '../lib/utils.mjs';
try{
  const sources=JSON.parse(await readFile(new URL('../sources.json',import.meta.url),'utf8'));
  for(const source of sources){
    if(!CATEGORIES.includes(source.category)||!Number.isInteger(source.trust_level)||source.trust_level<1||source.trust_level>3||!source.publisher_key)throw new Error('Kaynak yapılandırması geçersiz');
    const record={...source,active:false};
    if(source.active){
      if(!source.terms_confirmed||!safeURL(source.terms_url))throw new Error(`${source.name}: kullanım koşulları ve izin kaydı gerekli`);
      await fetchFeed(source.feed_url);record.active=true;
    }
    const existing=checked(await database().from('sources').select('id').eq('feed_url',source.feed_url));
    if(!existing.length)checked(await database().from('sources').insert(record));
    console.log(`${source.name}: ${existing.length?'mevcut kayıt korundu':record.active?'aktif eklendi':'pasif eklendi'}`);
  }
}catch(error){logError('source_import',error);process.exitCode=1;}
