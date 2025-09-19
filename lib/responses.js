export function ok(res, payload = {}) {
  res.status(200).json({ ok: true, ...payload });
}

export function created(res, payload = {}) {
  res.status(201).json({ ok: true, ...payload });
}

export function badRequest(res, message = 'Bad Request', errors = []) {
  res.status(400).json({ ok: false, error: { code: 400, message, errors } });
}

export function notAllowed(res, methods = ['GET']) {
  res.setHeader('Allow', methods);
  res.status(405).json({ ok: false, error: { code: 405, message: 'Method Not Allowed' } });
}

export function serverError(res, err) {
  console.error('[ServerError]', err);
  res.status(500).json({ ok: false, error: { code: 500, message: 'Internal Server Error' } });
}

