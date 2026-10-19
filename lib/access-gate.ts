export async function validCredentials(header: string | null, expected: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(expected) || !header || header.length > 2048) return false;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
  if (!match) return false;
  let raw: string;
  try { raw = atob(match[1]); } catch { return false; }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(raw, c => c.charCodeAt(0))));
  let difference = 0;
  for (let i = 0; i < digest.length; i++) difference |= digest[i] ^ parseInt(expected.slice(i * 2, i * 2 + 2), 16);
  return difference === 0;
}
