import http from 'http';
import { fetchPlans } from './modules/planFetcher.js';
import { generateClosingScript } from './modules/aiAssistant.js';

const PORT = process.env.PORT || 3000;

/**
 * Helper to send JSON response with appropriate CORS headers.  Chrome
 * extensions make XHR/fetch requests from a `chrome-extension://` origin,
 * which counts as a cross‑origin request.  Without the
 * `Access-Control-Allow-Origin` header, the browser will block the response.
 * We allow any origin here because this API does not handle sensitive data.
 * Adjust the allowed origin as needed for more restrictive deployments.
 *
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {Object} payload
 */
/**
 * Helper to send a JSON response.  CORS headers are not set here;
 * they should be configured via {@link setCors} before calling
 * this function.  The caller is responsible for ensuring the
 * appropriate CORS headers have already been written to the
 * response.  We still include Content-Type and Content-Length
 * headers for efficiency.
 *
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {Object} payload
 */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

/**
 * Set CORS headers based on the request's origin.  Instead of
 * blindly allowing all origins, we reflect the origin for known
 * approved origins.  This ensures that browsers will accept the
 * response while still preventing other sites from embedding this
 * API.  If the origin matches a Sunfire domain, the local
 * development host, or a Chrome extension, the origin is echoed
 * back.  Otherwise no Access-Control-Allow-Origin header is set.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function setCors(req, res) {
  const origin = req.headers.origin || '';
  const isSunfire = /https:\/\/([^.]+\.)*sunfirematrix\.com$/i.test(origin);
  // Allow localhost during development (ports may vary)
  const isLocal = /^http:\/\/localhost(?::\d+)?$/i.test(origin);
  // Chrome extension origins start with "chrome-extension://"
  const isExtension = origin.startsWith('chrome-extension://');
  if (isSunfire || isLocal || isExtension) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    // Ensure caches vary by origin
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Preflight cache max age: 1 day
  res.setHeader('Access-Control-Max-Age', '86400');
}

const server = http.createServer(async (req, res) => {
  // Always set CORS headers based on the request origin.  This must
  // happen before any response is written to ensure the headers are
  // included in all replies (including preflight and errors).
  setCors(req, res);

  // Handle CORS preflight requests.  Browsers send an OPTIONS request
  // before certain cross‑origin requests to check allowed methods/headers.
  if (req.method === 'OPTIONS') {
    // We already set CORS headers above.  Simply respond with 204 (no content).
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check: respond to GET /api/health or /health with OK.  This is
  // used by the extension to verify connectivity to the Azure backend.
  if (req.method === 'GET' && (req.url === '/api/health' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // We only handle POST requests for our API actions.  All other GETs
  // (except health above) return 404.
  if (req.method !== 'POST') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  // Collect request body
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', async () => {
    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
    try {
      // Support both legacy paths (/plans, /ai-recommend) and new prefixed paths
      // (/api/plans, /api/recommend) to ease migration.
      if (req.url === '/plans' || req.url === '/api/plans') {
        const plans = await fetchPlans(payload);
        sendJson(res, 200, plans);
      } else if (req.url === '/ai-recommend' || req.url === '/api/recommend') {
        const result = await generateClosingScript(payload);
        sendJson(res, 200, result);
      } else {
        sendJson(res, 404, { error: 'Not found' });
      }
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});