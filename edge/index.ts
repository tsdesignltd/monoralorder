import * as records from './handlers/records';
import * as monthly from './handlers/monthly';
import * as customers from './handlers/import-customers';
import { allowedOrigin } from './security';
declare const Deno: { serve(handler:(req:Request)=>Promise<Response>):void };
export async function handler(req: Request): Promise<Response> {
  const origin=req.headers.get('origin');
  const headers = new Headers({'Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});
  if(allowedOrigin(origin)) headers.set('Access-Control-Allow-Origin',origin!);
  if(origin && !allowedOrigin(origin)) return new Response('Forbidden',{status:403,headers});
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
  let response:Response;
  try {
    const path=new URL(req.url).pathname.split('/').pop();
    if(path==='records' && req.method==='GET') response=await records.GET(req);
    else if(path==='records' && req.method==='POST') response=await records.POST(req);
    else if(path==='monthly' && req.method==='POST') response=await monthly.POST(req);
    else if(path==='import-customers' && req.method==='POST') response=await customers.POST(req);
    else response=Response.json({error:'Not found'},{status:404});
  } catch {response=Response.json({error:'処理に失敗しました。再読み込みしてください。'},{status:503});}
  headers.set('Content-Type','application/json');
  return new Response(response.body,{status:response.status,headers});
}
Deno.serve(handler);
