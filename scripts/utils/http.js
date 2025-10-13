export async function request(method, url, { headers = {}, body } = {}) {
  const init = {
    method,
    headers: {
      'Accept': 'application/json',
      ...headers,
    },
  };

  if (body !== undefined) {
    if (typeof body === 'object' && !(body instanceof Buffer)) {
      init.headers['Content-Type'] = init.headers['Content-Type'] ?? 'application/json; charset=utf-8';
      init.body = JSON.stringify(body);
    } else {
      init.body = body;
    }
  }

  const res = await fetch(url, init);
  const contentType = res.headers.get('content-type') || '';
  let data;
  try {
    data = contentType.includes('application/json') ? await res.json() : await res.text();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, headers: res.headers, data };
}

export const http = {
  get: (url, opts) => request('GET', url, opts),
  post: (url, opts) => request('POST', url, opts),
  put: (url, opts) => request('PUT', url, opts),
  patch: (url, opts) => request('PATCH', url, opts),
  del: (url, opts) => request('DELETE', url, opts),
};