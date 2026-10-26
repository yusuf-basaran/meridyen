import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { refreshFreeFeed } from '../lib/free-feed.mjs';
import { logError } from '../lib/utils.mjs';

try {
  const path = new URL('../data/free-feed.json', import.meta.url);
  let previous = {};
  try { previous = JSON.parse(await readFile(path, 'utf8')); } catch { /* İlk kaynak yenilemesi. */ }
  const snapshot = await refreshFreeFeed(previous);
  if (!snapshot.items?.length && snapshot.sources?.every(source => !source.ok)) throw new Error('Ücretsiz kaynaklara erişilemedi; önceki kayıt korunuyor.');
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(new URL(`${path.href}.tmp`), JSON.stringify(snapshot, null, 2) + '\n');
  await rename(new URL(`${path.href}.tmp`), path);
  console.log(JSON.stringify({ items: snapshot.items.length, sources: snapshot.sources, changed: snapshot !== previous }));
} catch (error) { logError('free_feed', error); process.exitCode = 1; }
