module.exports = (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).end(JSON.stringify({
      success: true,
      response: { message: 'pong' },
      meta: { ts: Date.now() }
    }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ success: false, error: String(e && e.message || e) }));
  }
};