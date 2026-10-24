import { createClient } from '@supabase/supabase-js';
import { assertEnv } from './utils.mjs';
let client;
export function database() {
  assertEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (!client) client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
export function checked(result) {
  if (result.error) throw new Error(`Veritabanı işlemi başarısız (${result.error.code || 'bağlantı'})`);
  return result.data;
}
export async function allRows(table, columns, apply = query => query) {
  let records = [];
  for (let offset = 0;; offset += 1000) {
    const data = checked(await apply(database().from(table).select(columns)).range(offset, offset + 999));
    records.push(...data);
    if (data.length < 1000) return records;
  }
}
export async function withRun(step, task) {
  const started = new Date().toISOString();
  try {
    const result = await task();
    checked(await database().from('pipeline_runs').insert({ step, started_at: started, finished_at: new Date().toISOString(), success: true, summary: result || {} }));
    return result;
  } catch (error) {
    try { await database().from('pipeline_runs').insert({ step, started_at: started, finished_at: new Date().toISOString(), success: false, summary: { code: 'step_failed' } }); } catch { /* Asıl hata korunur. */ }
    throw error;
  }
}
