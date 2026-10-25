import { config } from '../config.js';
import { safeURL } from './utils.mjs';

export async function ensurePagesProject({accountId,token,projectName,siteURL='',repository='',fetcher=fetch}) {
  if(!/^[a-f0-9]{32}$/i.test(accountId||'')||!token||!/^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/.test(projectName||''))throw new Error('Cloudflare hesap, token veya proje ayarı eksik/geçersiz.');
  if(siteURL&&(!safeURL(siteURL)||new URL(siteURL).protocol!=='https:'))throw new Error('SITE_URL bir HTTPS adresi olmalıdır.');
  const url=`${config.endpoints.cloudflare}/accounts/${accountId}/pages/projects`;
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  let response=await fetcher(`${url}/${encodeURIComponent(projectName)}`,{headers,signal:AbortSignal.timeout(15000)});
  let created=false;
  if(response.status===404){
    response=await fetcher(url,{method:'POST',headers,body:JSON.stringify({name:projectName,production_branch:'main'}),signal:AbortSignal.timeout(15000)});
    created=true;
  }
  if(!response.ok)throw new Error(`Cloudflare proje işlemi başarısız (HTTP ${response.status}).`);
  const data=await response.json();
  if(!data.success||!data.result)throw new Error('Cloudflare proje yanıtı geçersiz.');
  const project=data.result;
  if(project.production_branch!=='main')throw new Error('Mevcut Cloudflare projesinin üretim dalı main değil; proje ayarını kontrol edin.');
  const linked=project.source?.config;
  if(linked?.repo_name&&repository&&`${linked.owner}/${linked.repo_name}`!==repository)throw new Error('Cloudflare projesi farklı bir GitHub deposuna bağlı.');
  if(!/^[a-z0-9-]+\.pages\.dev$/.test(project.subdomain||''))throw new Error('Cloudflare site adresi geçersiz.');
  return {projectName,created,siteURL:safeURL(siteURL)||`https://${project.subdomain}`};
}
