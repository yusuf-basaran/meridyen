import { readFile } from 'node:fs/promises';
import { config } from '../config.js';
import { hash } from './utils.mjs';
export async function evaluationFingerprint(){
  const files=['lib/prompts.mjs','lib/verification.mjs','lib/validation.mjs','lib/llm.mjs','scripts/eval/cases.mjs','scripts/eval/run.mjs'];
  const contents=await Promise.all(files.map(file=>readFile(new URL(`../${file}`,import.meta.url),'utf8')));
  return hash(JSON.stringify({contents,providers:config.providers,roles:config.roles,score:config.scoreThreshold,cross:config.crossSourceThreshold}));
}
export async function autoPublishAllowed(){
  // Yazardan ve iki denetçiden üç ayrı sağlayıcı şartı mevcut Gemini/Groq düzeninde sağlanamaz.
  if(Object.keys(config.providers).length<3)return false;
  try{
    const report=JSON.parse(await readFile(new URL('../eval-results/live.json',import.meta.url),'utf8'));
    const age=Date.now()-Date.parse(report.finishedAt);
    return report.live===true&&report.passed===true&&report.completeResponses===true&&report.fingerprint===await evaluationFingerprint()&&age>=0&&age<config.evaluationMaxAgeDays*86400000&&report.detectedBad>=.9&&report.acceptedGood>=.7;
  }catch{return false;}
}
