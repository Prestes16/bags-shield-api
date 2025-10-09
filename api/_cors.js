/** CORS helpers (JS) para compat no Vercel Dev (Windows) */
export function setCors(res, origin = '*', methods = ['GET','POST','OPTIONS'], headers = ['Content-Type','Authorization','X-Requested-With']) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', headers.join(', '));
  res.setHeader('Access-Control-Max-Age', '86400');
}
export function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}
export function preflight(req, res) {
  if ((req.method || '').toUpperCase() === 'OPTIONS') {
    setCors(res); noStore(res);
    res.status(204).end();
    return true;
  }
  return false;
}
export function guardMethod(req, res, allowed) {
  const method = String(req.method || 'GET').toUpperCase();
  if (!allowed.includes(method)) {
    setCors(res); noStore(res);
    res.setHeader('Allow', allowed.join(', '));
    res.status(405).json({ ok: false, error: 'Method Not Allowed', allow: allowed });
    return false;
  }
  return true;
}
