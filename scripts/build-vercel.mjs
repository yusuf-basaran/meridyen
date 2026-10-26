import { spawnSync } from 'node:child_process';
import { vercelBuildMode } from '../lib/build-settings.mjs';

const mode = vercelBuildMode();
console.log(`Vercel derleme modu: ${mode}.`);
for (const args of [
  ['scripts/build.mjs', ...(mode === 'launch' ? ['--launch'] : [])],
  ['scripts/audit.mjs']
]) {
  const result = spawnSync(process.execPath, ['--use-env-proxy', ...args], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
