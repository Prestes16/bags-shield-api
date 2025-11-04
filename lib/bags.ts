import { BAGS_API_BASE, BAGS_TIMEOUT_MS } from './constants';

export type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

export interface BagsFetchInit extends RequestInit {
  timeoutMs?: number;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return Promise.race([
    p.finally(() => clearTimeout(t)),
  ]) as any;
}

export async function bagsFetch<T=any>(path: string, init: BagsFetchInit = {}) {
  const key = process.env.BAGS_API_KEY ?? '';
  const url = new URL(path.replace(/^\//,''), BAGS_API_BASE).toString();
  const headers: Record<string,string> = {
    'Content-Type': 'application/json',
    'x-api-key': key,
    ...(init.headers as any || {}),
  };
  if (!('authorization' in Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(), v as string])))) {
    headers['Authorization'] = Bearer ;
  }

  const res = await withTimeout(fetch(url, { ...init, headers }), init.timeoutMs ?? BAGS_TIMEOUT_MS)
    .catch((e: any) => {
      const err: any = new Error(
etwork_error: );
      err.status = 0;
      throw err;
    });

  let data: any = null;
  try { data = await (res as Response).json(); } catch { /* ignore json parse */ }

  const ok = data?.success === true;
  if (!ok) {
    const err: any = new Error(data?.error ?? data?.response ?? \HTTP \\);
    err.status = (res as Response).status;
    err.rate = {
      limit: (res as Response).headers.get('X-RateLimit-Limit'),
      remaining: (res as Response).headers.get('X-RateLimit-Remaining'),
      reset: (res as Response).headers.get('X-RateLimit-Reset'),
    };
    throw err;
  }
  return { data: data.response as T, res: res as Response };
}