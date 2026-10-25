export const SETUP_SECRETS = ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN'];

export async function setupReport({env,contact,checkDatabase}) {
  const credentials=Object.fromEntries(SETUP_SECRETS.map(name=>[name,Boolean(env[name]?.trim())]));
  const contactFields=Object.fromEntries(['owner','email','address'].map(name=>[name,Boolean(contact[name]?.trim())]));
  let schema='not_checked';
  if(['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'].every(name=>credentials[name]))schema=await checkDatabase()?'ready':'missing_or_unreachable';
  return {checkedAt:new Date().toISOString(),credentials,contactFields,schema,ready:Object.values(credentials).every(Boolean)&&Object.values(contactFields).every(Boolean)&&schema==='ready'};
}

export function configureContact(source,contact) {
  const next=Object.fromEntries(['owner','email','address'].map(name=>[name,String(contact[name]||'').trim()]));
  if(Object.values(next).every(value=>!value))return source;
  if(!next.owner||next.owner.length>160||!next.address||next.address.length>1000||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email))throw new Error('Site sahibi, geçerli iletişim e-postası ve adres birlikte doldurulmalıdır.');
  const pattern=/^(\s*)contact:\s*\{[^\n]*\},\s*$/gm;
  if([...source.matchAll(pattern)].length!==1)throw new Error('Künye ayar satırı bulunamadı; config.js dosyasını kontrol edin.');
  return source.replace(pattern,(_line,indent)=>`${indent}contact: ${JSON.stringify(next)},`);
}
