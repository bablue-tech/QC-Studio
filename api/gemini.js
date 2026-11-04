export default {
  async fetch(request) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'Gemini is not configured. Set GEMINI_API_KEY on the server.' }, { status: 503 })
    }

    const incomingUrl = new URL(request.url)
    const routePath = incomingUrl.searchParams.get('path') || ''
    const targetPath = `/${routePath.replace(/^\/+/, '')}`
    if (!/^\/v1beta\/models\/[A-Za-z0-9._-]+:generateContent$/.test(targetPath)) {
      return Response.json({ error: 'A valid Gemini generateContent path is required.' }, { status: 400 })
    }

    const upstreamUrl = new URL(targetPath, 'https://generativelanguage.googleapis.com')
    for (const [key, value] of incomingUrl.searchParams) {
      if (key !== 'path') upstreamUrl.searchParams.append(key, value)
    }

    try {
      const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
      const upstreamResponse = await fetch(upstreamUrl, {
        method: request.method,
        headers: {
          'x-goog-api-key': apiKey,
          'content-type': request.headers.get('content-type') || 'application/json',
        },
        body: hasBody ? request.body : undefined,
        ...(hasBody ? { duplex: 'half' } : {}),
        cache: 'no-store',
        redirect: 'manual',
      })

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: {
          'content-type': upstreamResponse.headers.get('content-type') || 'application/json',
          'cache-control': 'no-store',
        },
      })
    } catch {
      return Response.json({ error: 'Gemini proxy error. Please retry the analysis.' }, { status: 502 })
    }
  },
}
