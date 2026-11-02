import type { Settings } from './types'
import { dataUrlToBase64 } from './image'

export type LLMResult = { text: string }

const SYSTEM_PROMPT = (checks: string[]) => `You are a senior Quality Control (QC) reviewer for character/creature/figure imagery used in production.
Inspect the provided image itself end-to-end. Return ONLY a complete valid JSON object (no markdown or prose) with this exact shape:
{
  "overall_score": number 0-100,
  "summary": string,
  "categories": [
    { "name": string, "status": "pass"|"warn"|"fail"|"na", "score": number 0-100,
      "findings": [ { "issue": string, "severity": "low"|"medium"|"high"|"critical", "location": string, "fix": string } ] }
  ],
  "priority_fixes": string[],
  "extra_observations": string[]
}
QC checks to perform (include as categories where relevant): ${checks.join('; ')}.
Write a concise 2-3 sentence image-grounded summary. Include every requested QC category, but limit each category to at most 2 material findings and priority_fixes to at most 3 items. For symmetry, compare left vs right ornaments/jewellery. For attire, check top-to-bottom continuity and pattern breaks. For footwear, compare both shoes. Also note visible anatomy, artifacts, lighting, background, or watermark defects. Never invent details. If a category is fine, mark pass with empty findings.`

export async function analyzeImage(settings: Settings, imageDataUrl: string, onToken?: (t: string) => void): Promise<string> {
  const { mediaType, base64 } = dataUrlToBase64(imageDataUrl)
  const sys = SYSTEM_PROMPT(settings.checks)
  const userText = 'Perform full QC on this character image and return JSON only.'

  if (settings.provider === 'openai' || settings.provider === 'opencode' || settings.provider === 'openrouter' || settings.provider === 'custom') {
    const body: any = {
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ] },
      ],
    }
    // request json for openai-compatible providers
    if (settings.provider === 'openai' || settings.provider === 'openrouter') body.response_format = { type: 'json_object' }
    try {
      const request = (maxTokens: number) => fetch(settings.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
        body: JSON.stringify({ ...body, max_tokens: maxTokens }),
      })
      const initialMaxTokens = Math.max(settings.maxTokens, 4000)
      let res = await request(initialMaxTokens)
      let data = res.ok ? await res.json() : null
      if (res.ok && data?.choices?.[0]?.finish_reason === 'length' && initialMaxTokens < 8000) {
        res = await request(8000)
        data = res.ok ? await res.json() : null
      }
      if (!res.ok) {
        const body = await res.text()
        if (body.includes('FreeUsageLimitError')) throw new Error('Free model usage limit reached. Please wait and try again later.')
        if (res.status === 429) throw new Error('Rate limited by the AI service. Please wait a moment and try again.')
        if (res.status === 401) throw new Error('Invalid API key. Check your settings.')
        if (res.status === 403) throw new Error('Access forbidden. The AI service may be blocking browser requests.')
        throw new Error(`${settings.provider} error ${res.status}: ${body}`)
      }
      const content = data?.choices?.[0]?.message?.content
      const text = typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((part: any) => typeof part === 'string' ? part : part?.text ?? '').join('')
          : ''
      if (!text.trim()) {
        const reason = data?.choices?.[0]?.finish_reason
        throw new Error(reason === 'length'
          ? 'The free vision model still could not fit the complete report after an automatic retry. Try again with fewer QC checks.'
          : 'The free vision model returned an empty analysis. Please retry the image review.')
      }
      onToken?.(text)
      return text
    } catch (e) {
      if (e instanceof TypeError) throw new Error('Failed to connect to the AI service. Check your network or try a different AI provider. (' + (e.message || 'network error') + ')')
      throw e
    }
  }

  if (settings.provider === 'anthropic') {
    const body = {
      model: settings.model,
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      system: sys,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        ],
      }],
    }
    try {
      const res = await fetch(settings.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const body = await res.text()
        if (res.status === 429) throw new Error('Rate limited by the AI service. Please wait a moment and try again.')
        if (res.status === 401) throw new Error('Invalid API key. Check your settings.')
        throw new Error(`Anthropic error ${res.status}: ${body}`)
      }
      const data = await res.json()
      const text = data?.content?.map((c: any) => c.text).join('') ?? ''
      onToken?.(text)
      return text
    } catch (e) {
      if (e instanceof TypeError) throw new Error('Failed to connect to the AI service. Check your network or try a different AI provider. (' + (e.message || 'network error') + ')')
      throw e
    }
  }

  if (settings.provider === 'gemini') {
    const url = `${settings.endpoint}/models/${settings.model}:generateContent?key=${encodeURIComponent(settings.apiKey)}`
    const body = {
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: 'user', parts: [
        { text: userText },
        { inlineData: { mimeType: mediaType, data: base64 } },
      ] }],
      generationConfig: { temperature: settings.temperature, maxOutputTokens: settings.maxTokens, responseMimeType: 'application/json' },
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const body = await res.text()
        if (res.status === 429) throw new Error('Rate limited by the AI service. Please wait a moment and try again.')
        if (res.status === 401) throw new Error('Invalid API key. Check your settings.')
        throw new Error(`Gemini error ${res.status}: ${body}`)
      }
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? ''
      onToken?.(text)
      return text
    } catch (e) {
      if (e instanceof TypeError) throw new Error('Failed to connect to the AI service. Check your network or try a different AI provider. (' + (e.message || 'network error') + ')')
      throw e
    }
  }

  throw new Error('Unsupported provider')
}

export function parseReport(text: string): any {
  // strip code fences
  let t = text.trim()
  if (!t) throw new Error('The free vision model returned no report. Please retry the image review.')
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try { return ensureSummary(JSON.parse(t)) } catch (error) {
    if (error instanceof Error && error.message.includes('summary')) throw error
  }
  // try to find json object
  const m = t.match(/\{[\s\S]*\}/)
  if (m) {
    try { return ensureSummary(JSON.parse(m[0])) } catch (error) {
      if (error instanceof Error && error.message.includes('summary')) throw error
    }
  }
  return { overall_score: 0, summary: text, categories: [], priority_fixes: [], extra_observations: [], raw: text }
}

function ensureSummary(report: any): any {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('The free vision model returned an invalid report. Please retry the image review.')
  }

  const summary = typeof report.summary === 'string' ? report.summary.trim() : ''
  if (summary) return report

  const categories = Array.isArray(report.categories) ? report.categories : []
  const priorityFixes = Array.isArray(report.priority_fixes) ? report.priority_fixes.filter(Boolean) : []
  const attention = categories.filter((category: any) => category?.status === 'warn' || category?.status === 'fail')
  const findings = categories.flatMap((category: any) =>
    Array.isArray(category?.findings) ? category.findings.map((finding: any) => finding?.issue).filter(Boolean) : [],
  )
  const score = Number.isFinite(Number(report.overall_score)) ? Number(report.overall_score) : null
  const scoreText = score === null ? '' : `Overall score: ${score}/100. `

  if (findings.length || attention.length) {
    const reviewText = attention.length
      ? `Needs attention in ${attention.map((category: any) => category.name).filter(Boolean).slice(0, 4).join(', ') || 'one or more categories'}.`
      : 'The listed findings need review.'
    const findingText = findings.slice(0, 3).join(' ')
    report.summary = `${scoreText}${reviewText}${findingText ? ` Key findings: ${findingText}` : ''}`
    return report
  }

  if (categories.length) {
    report.summary = `${scoreText}The model reviewed ${categories.length} QC categories and reported no specific issues.`
    return report
  }

  if (priorityFixes.length) {
    report.summary = `${scoreText}Priority review: ${priorityFixes.slice(0, 3).join(' ')}`
    return report
  }

  throw new Error('The model returned a report without a summary or QC findings. Please retry the image review.')
}
