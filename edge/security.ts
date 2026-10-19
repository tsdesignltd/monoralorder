import { configuration, database } from './database';
export function allowedOrigin(origin: string | null) {
  return origin === 'https://tsdesignltd.github.io' || origin === 'http://127.0.0.1:5174';
}
export async function requireUser(req: Request) {
  const authorization = req.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer ')) return null;
  const {url,key} = configuration();
  const response = await fetch(`${url}/auth/v1/user`,{headers:{Authorization:authorization,apikey:key!}});
  if(!response.ok) return null;
  const user = await response.json() as {id:string};
  if(!/^[a-f0-9-]{36}$/.test(user.id)) return null;
  const members = await database<{workspace_id:string}>(`monoral_members?user_id=eq.${user.id}&active=eq.true&select=workspace_id`);
  return members.length===1 ? {userId:members[0].workspace_id} : null;
}
