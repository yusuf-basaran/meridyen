import { readFile,writeFile } from 'node:fs/promises';
import { configureContact } from '../lib/setup.mjs';
const path=new URL('../config.js',import.meta.url);
const source=await readFile(path,'utf8');
const next=configureContact(source,{owner:process.env.SITE_OWNER,email:process.env.CONTACT_EMAIL,address:process.env.CONTACT_ADDRESS});
if(source!==next){await writeFile(path,next);console.log('Künye bilgileri kaydedildi.');}
