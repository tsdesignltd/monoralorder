import { NextResponse, type NextRequest } from 'next/server';
import { env } from 'cloudflare:workers';
import { validCredentials } from './lib/access-gate';

export async function middleware(request: NextRequest) {
  const runtime = env as unknown as Record<string, string | undefined>;
  const expected = runtime.MONORAL_ACCESS_SHA256 || process.env.MONORAL_ACCESS_SHA256;
  if (!expected) return new Response('ログイン設定が完了していません。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (!await validCredentials(request.headers.get('authorization'), expected)) {
    return new Response('ログインが必要です。', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="MONORAL", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: '/:path*' };
