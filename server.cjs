const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

// Load local secrets for development deployments without committing them.
const envPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

const PORT = process.env.PORT || 3000
const DIST_DIR = path.join(__dirname, 'dist')

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function serveStatic(req, res) {
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url)
  const ext = path.extname(filePath)
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404)
          res.end('Not found')
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(data2)
      })
      return
    }
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  })
}

function proxyRequest(req, res) {
  if (req.url.startsWith('/api/openrouter')) {
    if (!process.env.OPENROUTER_API_KEY) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'OpenRouter is not configured. Set OPENROUTER_API_KEY on the server.' }))
      return
    }
    const targetPath = req.url.replace(/^\/api\/openrouter/, '')
    const options = {
      hostname: 'openrouter.ai',
      port: 443,
      path: targetPath,
      method: req.method,
      headers: { ...req.headers, authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, host: 'openrouter.ai' },
    }
    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(res)
    })
    proxyReq.on('error', (err) => {
      res.writeHead(502)
      res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }))
    })
    req.pipe(proxyReq)
    return
  }
  const targetPath = req.url.replace(/^\/api\/opencode/, '')
  if (!process.env.OPENCODE_API_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'OpenCode is not configured. Set OPENCODE_API_KEY on the server.' }))
    return
  }
  const options = {
    hostname: 'opencode.ai',
    port: 443,
    path: '/inference/openai' + targetPath,
    method: req.method,
    headers: { ...req.headers, authorization: `Bearer ${process.env.OPENCODE_API_KEY}`, host: 'opencode.ai' },
  }

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    res.writeHead(502)
    res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }))
  })

  req.pipe(proxyReq)
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/opencode') || req.url.startsWith('/api/openrouter')) {
    proxyRequest(req, res)
  } else {
    serveStatic(req, res)
  }
})

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
