import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createCompleter } from '../lib/llm.mjs';
import { checkLiveSource } from '../lib/live-source-check.mjs';
import { sanitizeError } from '../lib/utils.mjs';

let requests = 0;
const maxRequests = Number(process.env.LIVE_AI_REQUEST_LIMIT || 3);
if (![1, 3].includes(maxRequests)) throw new Error('Deneme sınırı 1 veya 3 olmalı.');
const apiAttempts = [];
const auditedFetch = async (url, options) => {
  const response = await fetch(url, options);
  if (options?.method === 'POST') {
    const entry = { httpStatus: response.status, model: new URL(url).pathname.split('/').at(-1).split(':')[0] };
    try {
      const body = await response.clone().json();
      if (typeof body.error?.status === 'string') entry.providerStatus = body.error.status;
      if (typeof body.error?.message === 'string') entry.message = sanitizeError(body.error.message);
      const usage = body.usageMetadata;
      if (usage) entry.tokens = Object.fromEntries(
        ['promptTokenCount', 'candidatesTokenCount', 'totalTokenCount']
          .filter(key => Number.isInteger(usage[key]) && usage[key] >= 0)
          .map(key => [key, usage[key]])
      );
    } catch {}
    apiAttempts.push(entry);
  }
  return response;
};
const complete = createCompleter({
  fetcher: auditedFetch,
  // Separate bounded test: no database or production quota RPC.
  reserve: async provider => provider === 'gemini' && requests < maxRequests ? (++requests, true) : false
});
let report;
try {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY eksik.');
  const snapshot = JSON.parse(await readFile(new URL('../data/free-feed.json', import.meta.url), 'utf8'));
  report = await checkLiveSource({ snapshot, complete });
  if (!report.modelResponsesComplete) process.exitCode = 1;
} catch (error) {
  report = {
    mode: 'live-source-sample', checkedAt: new Date().toISOString(),
    status: 'unavailable', generationRequested: requests > 0,
    autoPublish: false, autoPublishUnlocked: false, published: false,
    error: sanitizeError(error)
  };
  process.exitCode = 1;
}
report.requests = requests;
report.requestLimit = maxRequests;
report.apiAttempts = apiAttempts;
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL('../artifacts/live-ai-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '## Canlı Gemini denemesi', '',
    '- Durum: ' + report.status,
    '- İstek sayısı: ' + requests + ' / ' + maxRequests,
    '- Model yanıtları: ' + (report.modelResponsesComplete ? 'tamamlandı' : 'eksik'),
    '- Kaynakla metin uyumu: ' + (report.contentPass ? 'uyumlu' : 'editör incelemesi gerekli'),
    '- Bağımsız denetim: ' + (report.independent ? 'var' : 'sağlanmadı'),
    '- Yayın: yapılmadı', '',
    'Bu yalnızca kısa kaynak özetiyle yapılan canlı bir denemedir; gerçek olgu teyidi veya tam yayın değerlendirmesi değildir. Otomatik yayın kilidi açılmaz.'
  ];
  await writeFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n', { flag: 'a' });
}
