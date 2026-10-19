import { createClient } from '@supabase/supabase-js';
export const supabaseUrl = 'https://dvvxuunqqokvhffrlvbj.supabase.co';
export const publicKey = 'sb_publishable_5oh3K7Pz4qZLIgZVoKNVGQ_paCEF5QG';
export const authClient = createClient(supabaseUrl, publicKey);
export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data, error } = await authClient.auth.getSession();
  if (error || !data.session) throw new Error('ログインしてください');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${data.session.access_token}`);
  headers.set('apikey', publicKey);
  return fetch(`${supabaseUrl}/functions/v1/monoral-api${path.replace(/^\/api/, '')}`, {...init, headers});
}
