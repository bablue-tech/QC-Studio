import type { Settings } from './types'
import { dataUrlToBase64 } from './image'

export type LLMResult = { text: string }

const SYSTEM_PROMPT = (checks: string[]) => `You are a meticulous visual QC director reviewing production artwork and character renders. Inspect the uploaded image itself at full available detail. Begin by identifying the camera viewpoint and framing, then adapt the QC to the visible surfaces. Never infer an issue from text alone and never invent unseen details.
Return ONLY a complete valid JSON object (no markdown or prose) with this exact shape:
{
  "overall_score": number 0-100,
  "summary": string,
  "categories": [
    { "name": string, "status": "pass"|"warn"|"fail"|"na", "score": number 0-100, "assessment": string,
      "findings": [ { "issue": string, "severity": "low"|"medium"|"high"|"critical", "location": string, "fix": string } ] }
  ],
  "priority_fixes": string[],
  "extra_observations": string[]
}
QC checks (return one category for EACH check below, including na where genuinely inapplicable): ${checks.join('; ')}. Give every category a short assessment describing the visible evidence actually inspected, or the specific reason it could not be assessed. For the saree/drape/shawl category, this assessment must state which visible panels/transitions were traced and whether continuity was verified, a defect was found, or detail was too limited.

Detailed inspection rules:
- VIEWPOINT / CROP FIRST: Identify the view as front, three-quarter, profile, rear/back, overhead, low-angle, close-up or a combination, and state what is cropped, occluded or too small to judge. Evaluate only surfaces visible in this frame. A close-up should receive a focused review of the details it actually shows; do not penalize a missing body part or accessory outside the crop. Mark inaccessible checks na and explicitly distinguish not visible from absent or defective. For partial visibility, give a cautious score and lower confidence rather than assuming a pass.
- SKIN: Judge against the image's intended style. For photoreal or semi-realistic characters, inspect visible skin at the available resolution for natural pore detail, fine grain, tonal variation and believable subsurface texture. A waxy, airbrushed, rubbery or plastic surface is a MAIN ISSUE: mark fail and critical/high severity, explain visible evidence, and give a concrete fix. Do not demand pores on clearly painterly, stylized, distant or low-resolution skin; mark na or note limited visibility instead of guessing.
- HAIR: inspect strand separation, hairline, roots, clumping, flyaways, volume and light response. Flag helmet-like, molded-plastic, melted or painted-on hair when visible; distinguish deliberate stylization from a defect.
- TILAK / BINDI: if present, inspect whether the mark is complete, clean-edged, centered on the intended forehead position, correctly shaped, and not broken, doubled, blurred or floating. If absent, do not assume it is required; say absent only when relevant to the visible design.
- EARRINGS / ORNAMENT SYMMETRY: compare the character's anatomical left and right sides (not simply image-left and image-right) for matching visible earrings and other paired ornaments: design, silhouette, structure, quantity, scale, orientation and natural attachment. In side or rear views, inspect the visible earring backs, fasteners and construction when resolvable. For rear views, compare any paired ornaments visible from behind. Explicitly say when a side or reverse surface is occluded or outside the crop; never call an unseen side mismatched.
- NOSE PIN: when the visible character design calls for one, inspect presence, design, scale, position, side-to-side consistency where applicable, and whether it sits naturally on the nose. Do not infer gender or penalize absence without a visual design cue.
- SAREE / DRAPE / SHAWL CONTINUITY (priority check): Do a deliberate pattern-trace instead of a general costume impression. First identify each visible fabric panel separately (saree body, pallu, pleats, blouse, shawl/scarf, border/hem). Trace each panel's visible border and at least one repeated motif path from its start to end, following it across folds and panel transitions. Compare motif identity, repeat spacing, scale, orientation, color, embroidery/weave density, border width, and edge alignment. Flag visible abrupt pattern swaps, missing or duplicated motifs, a broken or suddenly changing border, inconsistent motif scale, impossible print direction, blank patches, mismatched joins, or a shawl whose design changes between connected visible sections. Name the exact transition/location (for example shoulder-to-torso, pallu-to-pleats, waist fold, shawl edge, or hem) and give a concrete fix. Do not confuse a fold hiding part of a motif, perspective, shadow, natural overlap, or a true panel seam with a design defect. Use the full-frame image for construction and the accompanying focused crop (if present) to inspect fabric detail; both depict the same original image, not separate views or references. Mark pass only after tracing the visible pattern/border through the assessable sections. If clothing is visible but the motif is too soft, small, occluded, or cropped to trace, use warn and state exactly what could not be verified; use na only when the relevant clothing is not visible. A single view cannot prove continuity across unseen front/back surfaces.
- CROWN / HEADPIECE: check proportion, alignment, perspective, contact points, hair interaction and whether it appears naturally secured rather than floating, clipping or sinking. In a rear or side view, inspect the visible back/side structure and attachment points too.
- BANGLES / BRACELETS / RINGS: compare visible wrists for count, design, material, size and spacing. Check rings on visible fingers for plausible scale, finger alignment and natural fit; note occlusion instead of assuming a mismatch.
- FOOTWEAR: compare left and right shoes/sandals for design, construction, color, scale, orientation and attachment to the feet.
- HANDS / FINGERS / FEET / TOES: inspect each visible hand and foot at the available resolution. Where a hand is fully visible and not holding or hiding digits, check for the expected five distinct digits (four fingers and a thumb), sensible joints and lengths, clean separation, natural attachment and no merged, fused, extra, missing or distorted digits. Account for perspective, foreshortening, pose, gloves and deliberate stylization; do not flag an obscured or cropped digit as missing. For bare feet with visible toes, check plausible toe count and separation; do not expect visible toes in footwear. State limits when hands/feet are tiny, occluded or outside the crop.
- BODY: inspect visible anatomy, limb lengths, joints, pose and overall proportions for mismatches. Do not score cropped-out anatomy as a defect.

Give a concise, image-grounded 2-3 sentence summary that starts by naming the viewpoint/framing and its inspection limits, then calls out the most important visible pass or defect. Prioritize plastic/waxy skin and unnatural hair when present. Include no more than 2 material findings per category and 3 priority fixes. If a detail is too small, hidden, cropped or soft to judge, say so and lower confidence rather than claiming it passed.`

export async function analyzeImage(settings: Settings, imageDataUrls: string | string[], onToken?: (t: string) => void): Promise<string> {
  const reviewImages = Array.isArray(imageDataUrls) ? imageDataUrls : [imageDataUrls]
  const sys = SYSTEM_PROMPT(settings.checks)
  const userText = 'First identify the character viewpoint and crop. Image 1 is the full frame. Any following image is a focused crop from that same frame, supplied to help inspect fabric; it is not a second view or a design reference. Perform angle-aware QC only on visible details, explicitly trace saree/drape/shawl pattern continuity, and return JSON only.'

  if (settings.provider === 'openai' || settings.provider === 'opencode' || settings.provider === 'openrouter' || settings.provider === 'custom') {
    const body: any = {
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: [
          { type: 'text', text: userText },
          ...reviewImages.flatMap((url, index) => [
            ...(index > 0 ? [{ type: 'text', text: `Image ${index + 1}: focused clothing crop from the same original frame.` }] : []),
            { type: 'image_url', image_url: { url } },
          ]),
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
          ...reviewImages.flatMap((url, index) => {
            const { mediaType, base64 } = dataUrlToBase64(url)
            return [
              ...(index > 0 ? [{ type: 'text', text: `Image ${index + 1}: focused clothing crop from the same original frame.` }] : []),
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            ]
          }),
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
        ...reviewImages.flatMap((url, index) => {
          const { mediaType, base64 } = dataUrlToBase64(url)
          return [
            ...(index > 0 ? [{ text: `Image ${index + 1}: focused clothing crop from the same original frame.` }] : []),
            { inlineData: { mimeType: mediaType, data: base64 } },
          ]
        }),
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

export function parseReport(text: string, enabledChecks: string[] = []): any {
  // strip code fences
  let t = text.trim()
  if (!t) throw new Error('The free vision model returned no report. Please retry the image review.')
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const finalize = (report: any) => ensureGarmentAssessment(ensureSummary(report), enabledChecks)
  try { return finalize(JSON.parse(t)) } catch (error) {
    if (error instanceof Error && error.message.includes('summary')) throw error
  }
  // try to find json object
  const m = t.match(/\{[\s\S]*\}/)
  if (m) {
    try { return finalize(JSON.parse(m[0])) } catch (error) {
      if (error instanceof Error && error.message.includes('summary')) throw error
    }
  }
  return finalize({ overall_score: 0, summary: text, categories: [], priority_fixes: [], extra_observations: [], raw: text })
}

function ensureGarmentAssessment(report: any, enabledChecks: string[]): any {
  const garmentCheckEnabled = enabledChecks.some(check => /attire|drape|shawl|saree|sari|garment|fabric|pattern/i.test(check))
  if (!garmentCheckEnabled) return report

  if (!Array.isArray(report.categories)) report.categories = []
  let category = report.categories.find((item: any) => /attire|drape|shawl|saree|sari|garment|fabric|costume/i.test(String(item?.name || '')))
  const missingCategory = !category
  if (!category) {
    category = {
      name: 'Saree, drape & shawl design continuity (borders, motifs, pleats and transitions)',
      status: 'warn',
      score: 45,
      assessment: 'The model response omitted the required garment-continuity inspection, so the visible design cannot be verified from this result.',
      findings: [],
    }
    report.categories.push(category)
  }

  const assessmentText = typeof category.assessment === 'string' ? category.assessment : ''
  const relatedFindings = Array.isArray(category.findings) ? category.findings.map((finding: any) => `${finding?.issue || ''} ${finding?.location || ''}`).join(' ') : ''
  const evidenceText = `${assessmentText} ${relatedFindings}`
  const namesGarmentDetail = /saree|sari|drape|shawl|pallu|pleat|motif|border|hem|panel|fabric|pattern/i.test(evidenceText)
  const explainsContinuity = /continu|trac|compar|match|mismatch|consistent|disrupt|change|break|verif|cannot|unable|too small|occlud|cropp|not visible/i.test(evidenceText)
  const saysUnverifiable = /cannot|unable|too small|occlud|cropp|not visible|unverified|unclear|insufficient/i.test(evidenceText)
  const hasFindings = Array.isArray(category.findings) && category.findings.length > 0
  const passContradiction = category.status === 'pass' && (hasFindings || saysUnverifiable)
  const missingTrace = missingCategory || !assessmentText.trim() || (category.status !== 'na' && !(namesGarmentDetail && explainsContinuity)) || passContradiction
  if (missingTrace) {
    if (!assessmentText.trim() || missingCategory || !(namesGarmentDetail && explainsContinuity)) {
      category.assessment = 'No garment-pattern trace was returned. Continuity is unverified; inspect the visible drape and shawl manually.'
    }
    if (!['warn', 'fail'].includes(category.status)) {
      category.status = 'warn'
      const categoryScore = Number(category.score)
      category.score = Math.min(Number.isFinite(categoryScore) ? categoryScore : 100, 55)
    }
    const overallScore = Number(report.overall_score)
    report.overall_score = Math.min(Number.isFinite(overallScore) ? overallScore : 100, 75)
    if (!/unverified|could not be verified|cannot be verified|unable to verify|not verified|incomplete/i.test(String(report.summary || ''))) {
      report.summary = `Garment continuity is unverified because the response did not document a visible pattern trace. ${report.summary || ''}`.trim()
    }
    if (!Array.isArray(report.priority_fixes)) report.priority_fixes = []
    if (!report.priority_fixes.some((fix: string) => /garment|saree|drape|shawl|continuity/i.test(fix))) {
      report.priority_fixes.unshift('Review the saree and shawl border/motif transitions; the model did not provide a verifiable continuity trace.')
      report.priority_fixes = report.priority_fixes.slice(0, 3)
    }
  }
  if (!Array.isArray(category.findings)) category.findings = []
  if (missingTrace && !category.findings.length) {
    category.findings.push({
      issue: 'The response did not explain which fabric panels, motifs, or borders were traced, so continuity is not confirmed.',
      severity: 'medium',
      location: 'Visible saree, drape, or shawl',
      fix: 'Review the garment detail crop and rerun the continuity check if the pattern remains unclear.',
    })
  }
  return report
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
