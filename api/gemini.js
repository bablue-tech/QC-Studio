const https = require('https')

module.exports = (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Gemini is not configured. Set GEMINI_API_KEY on the server.' }))
    return
  }

  const routePath = req.query?.path
  const pathParts = Array.isArray(routePath) ? routePath : [routePath]
  const targetPath = `/${pathParts.filter(Boolean).join('/')}`
  if (targetPath === '/' || targetPath.includes('..')) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'A valid Gemini API path is required.' }))
    return
  }

  const headers = {
    'x-goog-api-key': apiKey,
    'content-type': req.headers['content-type'] || 'application/json',
  }
  if (req.headers['content-length']) headers['content-length'] = req.headers['content-length']

  const upstream = https.request({
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: targetPath,
    method: req.method,
    headers,
  }, (upstreamResponse) => {
    res.statusCode = upstreamResponse.statusCode || 502
    res.setHeader('Content-Type', upstreamResponse.headers['content-type'] || 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    upstreamResponse.pipe(res)
  })

  upstream.on('error', () => {
    if (res.headersSent) return res.end()
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Gemini proxy error. Please retry the analysis.' }))
  })

  req.pipe(upstream)
}

module.exports.config = {
  api: { bodyParser: false },
}
