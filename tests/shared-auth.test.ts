import assert from 'node:assert/strict';
import { requireUser, allowedOrigin } from '../edge/security';
const originalFetch=globalThis.fetch;
(globalThis as any).Deno={env:{get:(key:string)=>key==='SUPABASE_URL'?'https://example.supabase.co':'server-only'}};
let calls=0;
globalThis.fetch=async()=>{calls++;return Response.json({id:'11111111-1111-4111-8111-111111111111'})};
assert.equal(await requireUser(new Request('https://example.test')),null);
assert.equal(calls,0);
globalThis.fetch=async()=>new Response('',{status:401});
assert.equal(await requireUser(new Request('https://example.test',{headers:{Authorization:'Bearer invalid'}})),null);
globalThis.fetch=async url=>String(url).includes('/auth/')?Response.json({id:'11111111-1111-4111-8111-111111111111'}):Response.json([]);
assert.equal(await requireUser(new Request('https://example.test',{headers:{Authorization:'Bearer valid'}})),null);
for(const id of ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222']) {
 globalThis.fetch=async url=>String(url).includes('/auth/')?Response.json({id}):Response.json([{workspace_id:'monoral'}]);
 assert.deepEqual(await requireUser(new Request('https://example.test',{headers:{Authorization:'Bearer valid'}})),{userId:'monoral'});
}
assert.equal(allowedOrigin('https://evil.example'),false);
assert.equal(allowedOrigin('https://tsdesignltd.github.io'),true);
globalThis.fetch=originalFetch;
console.log('Shared account authorization checks passed');
