import type { Settings } from './types'
import { dataUrlToBase64 } from './image'

export type LLMResult = { text: string }

const SYSTEM_PROMPT = (checks: string[]) => `You are a senior Quality Control (QC) reviewer for character/creature/figure imagery used in production.
Analyze the provided image end-to-end and return ONLY a valid JSON object (no markdown, no prose) with this exact shape:
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
Be specific and actionable. For symmetry, compare left vs right ornaments/jewellery and note mismatches in size/position/design. For attire, check top-to-bottom continuity, pattern breaks, asymmetry, missing elements. For footwear, check both shoes match and are correct. Also report any other defects you notice (anatomy, artifacts, lighting, background, text/watermarks). If an area is fine, mark pass with empty findings.`

export async function analyzeImage(settings: Settings, imageDataUrl: string, onToken?: (t: string) => void): Promise<string> {
  const { mediaType, base64 } = dataUrlToBase64(imageDataUrl)
  const sys = SYSTEM_PROMPT(settings.checks)
  const userText = 'Perform full QC on this character image and return JSON only.'

  if (settings.provider === 'openai' || settings.provider === 'opencode' || settings.provider === 'custom') {
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
    // request json for openai
    if (settings.provider === 'openai') body.response_format = { type: 'json_object' }
    try {
      const res = await fetch(settings.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const body = await res.text()
        if (body.includes('FreeUsageLimitError')) throw new Error('Free usage limit reached for this API key. Please use your own OpenCode API key or subscribe to OpenCode Go at https://opencode.ai/go')
        if (res.status === 429) throw new Error('Rate limited by the AI service. Please wait a moment and try again.')
        if (res.status === 401) throw new Error('Invalid API key. Check your settings.')
        if (res.status === 403) throw new Error('Access forbidden. The AI service may be blocking browser requests.')
        throw new Error(`${settings.provider} error ${res.status}: ${body}`)
      }
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content ?? ''
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
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try { return JSON.parse(t) } catch {}
  // try to find json object
  const m = t.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch {} }
  return { overall_score: 0, summary: text, categories: [], priority_fixes: [], extra_observations: [], raw: text }
}
