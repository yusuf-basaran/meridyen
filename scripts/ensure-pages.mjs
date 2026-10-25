import { writeFile } from 'node:fs/promises';
import { ensurePagesProject } from '../lib/pages-project.mjs';
import { logError } from '../lib/utils.mjs';
import { config } from '../config.js';
try{
  const accountId=process.env.CLOUDFLARE_ACCOUNT_ID||config.deployment.cloudflareAccountId;
  const result=await ensurePagesProject({accountId,token:process.env.CLOUDFLARE_API_TOKEN,projectName:process.env.PAGES_PROJECT||config.deployment.pagesProject,siteURL:process.env.SITE_URL,repository:process.env.GITHUB_REPOSITORY});
  if(process.env.GITHUB_ENV)await writeFile(process.env.GITHUB_ENV,`SITE_URL=${result.siteURL}\nCLOUDFLARE_ACCOUNT_ID=${accountId}\nPAGES_PROJECT=${result.projectName}\n`,{flag:'a'});
  console.log(`Cloudflare projesi ${result.created?'oluşturuldu':'hazır'}: ${result.projectName}`);
  console.log(`Site adresi: ${result.siteURL}`);
}catch(error){logError('pages_setup',error);process.exitCode=1;}
