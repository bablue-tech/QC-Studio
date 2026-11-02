import type { Settings } from './types'
import { dataUrlToBase64 } from './image'

export type LLMResult = { text: string }

const SYSTEM_PROMPT = (checks: string[]) => `You are a meticulous visual QC director reviewing production artwork and character renders. Inspect the uploaded image itself at full available detail. Begin by identifying the camera viewpoint and framing, then adapt the QC to the visible surfaces. Never infer an issue from text alone and never invent unseen details.
Return ONLY a complete valid JSON object (no markdown or prose) with this exact shape:
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
QC checks (return one category for EACH check below, including na where genuinely inapplicable): ${checks.join('; ')}.

Detailed inspection rules:
- VIEWPOINT / CROP FIRST: Identify the view as front, three-quarter, profile, rear/back, overhead, low-angle, close-up or a combination, and state what is cropped, occluded or too small to judge. Evaluate only surfaces visible in this frame. A close-up should receive a focused review of the details it actually shows; do not penalize a missing body part or accessory outside the crop. Mark inaccessible checks na and explicitly distinguish not visible from absent or defective. For partial visibility, give a cautious score and lower confidence rather than assuming a pass.
- SKIN: Judge against the image's intended style. For photoreal or semi-realistic characters, inspect visible skin at the available resolution for natural pore detail, fine grain, tonal variation and believable subsurface texture. A waxy, airbrushed, rubbery or plastic surface is a MAIN ISSUE: mark fail and critical/high severity, explain visible evidence, and give a concrete fix. Do not demand pores on clearly painterly, stylized, distant or low-resolution skin; mark na or note limited visibility instead of guessing.
- HAIR: inspect strand separation, hairline, roots, clumping, flyaways, volume and light response. Flag helmet-like, molded-plastic, melted or painted-on hair when visible; distinguish deliberate stylization from a defect.
- TILAK / BINDI: if present, inspect whether the mark is complete, clean-edged, centered on the intended forehead position, correctly shaped, and not broken, doubled, blurred or floating. If absent, do not assume it is required; say absent only when relevant to the visible design.
- EARRINGS / ORNAMENT SYMMETRY: compare the character's anatomical left and right sides (not simply image-left and image-right) for matching visible earrings and other paired ornaments: design, silhouette, structure, quantity, scale, orientation and natural attachment. In side or rear views, inspect the visible earring backs, fasteners and construction when resolvable. For rear views, compare any paired ornaments visible from behind. Explicitly say when a side or reverse surface is occluded or outside the crop; never call an unseen side mismatched.
- NOSE PIN: when the visible character design calls for one, inspect presence, design, scale, position, side-to-side consistency where applicable, and whether it sits naturally on the nose. Do not infer gender or penalize absence without a visual design cue.
- ATTIRE / DRAPE: inspect all visible garment surfaces from the current angle. Trace drapes from shoulder toward hem where in frame; check borders, motifs, embroidery, shawls, seams, closures, back panels and overlapping layers for design continuity, consistent fabric direction, plausible folds, intact edges and abrupt changes. On rear views, specifically review the back of the attire and whether its design continues coherently from the visible front/side portions; do not claim unseen continuity.
- CROWN / HEADPIECE: check proportion, alignment, perspective, contact points, hair interaction and whether it appears naturally secured rather than floating, clipping or sinking. In a rear or side view, inspect the visible back/side structure and attachment points too.
- BANGLES / BRACELETS / RINGS: compare visible wrists for count, design, material, size and spacing. Check rings on visible fingers for plausible scale, finger alignment and natural fit; note occlusion instead of assuming a mismatch.
- FOOTWEAR: compare left and right shoes/sandals for design, construction, color, scale, orientation and attachment to the feet.
- HANDS / FINGERS / FEET / TOES: inspect each visible hand and foot at the available resolution. Where a hand is fully visible and not holding or hiding digits, check for the expected five distinct digits (four fingers and a thumb), sensible joints and lengths, clean separation, natural attachment and no merged, fused, extra, missing or distorted digits. Account for perspective, foreshortening, pose, gloves and deliberate stylization; do not flag an obscured or cropped digit as missing. For bare feet with visible toes, check plausible toe count and separation; do not expect visible toes in footwear. State limits when hands/feet are tiny, occluded or outside the crop.
- BODY: inspect visible anatomy, limb lengths, joints, pose and overall proportions for mismatches. Do not score cropped-out anatomy as a defect.

Give a concise, image-grounded 2-3 sentence summary that starts by naming the viewpoint/framing and its inspection limits, then calls out the most important visible pass or defect. Prioritize plastic/waxy skin and unnatural hair when present. Include no more than 2 material findings per category and 3 priority fixes. If a detail is too small, hidden, cropped or soft to judge, say so and lower confidence rather than claiming it passed.`

export async function analyzeImage(settings: Settings, imageDataUrl: string, onToken?: (t: string) => void): Promise<string> {
  const { mediaType, base64 } = dataUrlToBase64(imageDataUrl)
  const sys = SYSTEM_PROMPT(settings.checks)
  const userText = 'First identify the character viewpoint and crop, then perform angle-aware QC only on visible details. Return JSON only.'

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
    const url = `${settings.endpoint}/models/${settings.model}:generateContent`
    const body = (maxOutputTokens: number) => ({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: 'user', parts: [
        { text: userText },
        { inlineData: { mimeType: mediaType, data: base64 } },
      ] }],
      generationConfig: { temperature: settings.temperature, maxOutputTokens, responseMimeType: 'application/json' },
    })
    try {
      const request = (maxOutputTokens: number) => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body(maxOutputTokens)),
      })
      const initialMaxOutputTokens = Math.max(settings.maxTokens, 4000)
      let res = await request(initialMaxOutputTokens)
      let data = res.ok ? await res.json() : null
      if (res.ok && data?.candidates?.[0]?.finishReason === 'MAX_TOKENS' && initialMaxOutputTokens < 8000) {
        res = await request(8000)
        data = res.ok ? await res.json() : null
      }
      if (!res.ok) {
        const body = await res.text()
        if (res.status === 429) throw new Error('Rate limited by the AI service. Please wait a moment and try again.')
        if (res.status === 401) throw new Error('Invalid API key. Check your settings.')
        throw new Error(`Gemini error ${res.status}: ${body}`)
      }
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? ''
      if (!text.trim()) {
        const reason = data?.candidates?.[0]?.finishReason
        throw new Error(reason === 'MAX_TOKENS'
          ? 'Gemini still could not fit the complete report after an automatic retry. Try again with fewer QC checks.'
          : 'Gemini returned an empty analysis. Please retry the image review.')
      }
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
