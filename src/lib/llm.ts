import { QC_CHECK_DETAILS } from './types'
import type { Settings } from './types'
import { dataUrlToBase64 } from './image'

export type LLMResult = { text: string }
export type ReviewImageInput = { dataUrl: string; role: 'target' | 'garment-detail' | 'reference'; label?: string }

const imageLabel = (image: ReviewImageInput, index: number, referenceIndex: number) => {
  if (image.role === 'target') return `Image ${index + 1}: primary target frame${image.label ? ` (${image.label})` : ''}.`
  if (image.role === 'garment-detail') return `Image ${index + 1}: focused garment detail crop from the target frame; this is not a separate view or reference.`
  return `Image ${index + 1}: approved continuity reference ${referenceIndex}${image.label ? ` (${image.label})` : ''}; compare stable design/identity details while allowing intentional shot, pose, and lighting changes.`
}

const SYSTEM_PROMPT = (checks: string[]) => `You are the image QC supervisor for an AI filmmaking pipeline. Inspect the target still as production material: catch visible generation defects, minor craft errors, continuity breaks, and delivery risks. Be exact and conservative. Aesthetic preference is not a defect; a visible structural, continuity, or technical error is.
Return ONLY valid JSON with this shape:
{
  "overall_score": number,
  "decision": "ready"|"review"|"hold",
  "summary": string,
  "production_context": { "shot_type": string, "viewpoint": string, "visual_style": string, "coverage_notes": string[], "reference_comparison": string },
  "categories": [{ "domain": string, "name": string, "status": "pass"|"warn"|"fail"|"na", "score": number, "assessment": string,
    "findings": [{ "issue": string, "evidence": string, "location": string, "severity": "low"|"medium"|"high"|"critical", "confidence": number, "fix": string }] }],
  "priority_fixes": string[],
  "extra_observations": string[]
}
Use 0-100 for scores and 0-1 for finding confidence. Return one category per enabled check, preserving the check's name. Every category assessment must state what was inspected or why it was not assessable. Every finding must cite a visible cue, exact image region, confidence, and practical fix. Do not output private reasoning; report concise findings and evidence only.

Enabled QC parameters and inspection cues:
${checks.map((check) => `- ${check}: ${QC_CHECK_DETAILS[check] || 'Inspect the visible evidence relevant to this custom production QC requirement.'}`).join('\n')}

Inspection sequence:
1. Triage the target: identify intended image style, shot size, camera angle, viewpoint (front/three-quarter/profile/rear/overhead/low-angle), sharpness, crop, subject(s), key costume/props, and visibility limits. A detail crop belongs to the same target. Reference frames are separate approved context.
2. Inspect macro structure: composition, subject placement, horizon/perspective, body/object geometry, set continuity, lighting direction, shadows, reflections, focus, and scene integration.
3. Inspect each visible subject at medium scale: face/identity cues, expression/gaze, hair, anatomy, hands/feet, costume layers, textile paths, ornaments/headwear, props, grips, and contact/intersection points.
4. Inspect micro-artifacts: extra/missing/merged details, doubled contours, melted geometry, asymmetry, repeated textures, abrupt sharpness or material changes, seams, halos, edge fringing, garbled marks, compression/banding, and tiny defects that are actually resolvable.
5. Compare only against supplied references. Assess stable design/identity details while allowing intentional changes in pose, camera, lighting, and shot. Without references, mark the reference-continuity category na. A single still cannot validate motion, edit continuity, sound, or unseen angles.

Production severity:
- critical: shot-breaking or unusable defect (identity substitution, major anatomy/prop failure, severe costume discontinuity, or prominent impossible structure). Decision must be hold.
- high: clear, prominent issue requiring correction before final; decision must be at least review.
- medium: visible craft defect that should be fixed before delivery, but is localized or less prominent.
- low: small polish issue, visible at normal or close inspection, with limited impact.
Use confidence 0.85-1.0 for unmistakable evidence, 0.60-0.84 for likely evidence, and below 0.60 for uncertain cues; uncertain cues should normally be warn/low confidence, not a confident failure. Merge repeated symptoms of the same root cause, but retain distinct small defects in different locations. Return up to 3 findings per category and up to 5 prioritized fixes. Do not hide a minor but clear defect merely because it is not a critical failure.

Coverage and interpretation rules:
- Judge only visible pixels. Distinguish absent, defective, occluded, cropped, too small/soft, and not applicable. Do not pass an uninspected category. Use warn when a production-relevant visible detail is unresolved and na only when genuinely irrelevant or absent from the frame.
- For photoreal/semi-real skin, inspect pore/grain detail and flag waxy, airbrushed, rubbery or plastic finish as high-impact. Do not require pores on stylized artwork. Inspect hair for strand separation, painted/molded appearance, clumping, hairline and unnatural edges.
- For all genders and costume traditions, inspect the garments actually shown: saree/pallu/pleats, dhoti/waistband/hem, angavastram/uttariya, robes, shawls, armor layers and transitions. Do not assume historical accuracy or mandatory accessories without a supplied spec/reference.
- For hands, assess four fingers plus thumb when fully visible; account for grip, foreshortening, gloves and occlusion. Check toes only on visible bare feet.
- Inspect AI-generation tells: fused/duplicated anatomy, asymmetric eyes, inconsistent jewelry, broken weapon geometry, floating/embedded objects, impossible object joins, background warping, repeated details, texture discontinuities, ghosting and edge artifacts.
- Check lighting/shadows/reflections for shared direction and grounding. Check signs, scripts and symbols only against readable intent/reference; do not infer language or cultural meaning from illegible marks.
- An assessment must report the actual region or sub-elements checked. The attire assessment must name the visible garment panels/transitions traced. The reference assessment must state what matched or diverged, or say not applicable.
- Set decision to hold for any critical issue; review for high issues, unresolved required checks, or visible medium issues; ready only when no material finding remains and coverage is sufficient. Keep the overall score aligned with this decision. Return a concise 2-4 sentence summary naming view/shot and the main release risk or readiness result.`

export async function analyzeImage(settings: Settings, reviewImages: ReviewImageInput[], onToken?: (t: string) => void): Promise<string> {
  const sys = SYSTEM_PROMPT(settings.checks)
  const hasReferences = reviewImages.some((image) => image.role === 'reference')
  const userText = `First identify the target shot's viewpoint, shot type, and crop. The primary target frame is labeled. A garment-detail image is a crop from that same target, not another shot. ${hasReferences ? 'Images labeled as references are approved design/continuity references, not part of the target frame; compare stable identity, costume, prop and palette details while allowing pose, camera and lighting changes.' : 'No reference frames were supplied; do not claim shot-to-shot continuity was checked.'} Perform all applicable production QC checks on visible evidence and return JSON only.`

  if (settings.provider === 'openai' || settings.provider === 'opencode' || settings.provider === 'openrouter' || settings.provider === 'custom') {
    const body: any = {
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: [
          { type: 'text', text: userText },
          ...reviewImages.flatMap((image, index) => [
            { type: 'text', text: imageLabel(image, index, reviewImages.slice(0, index).filter((candidate) => candidate.role === 'reference').length + 1) },
            { type: 'image_url', image_url: { url: image.dataUrl } },
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
          ...reviewImages.flatMap((image, index) => {
            const { mediaType, base64 } = dataUrlToBase64(image.dataUrl)
            return [
              { type: 'text', text: imageLabel(image, index, reviewImages.slice(0, index).filter((candidate) => candidate.role === 'reference').length + 1) },
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
        ...reviewImages.flatMap((image, index) => {
          const { mediaType, base64 } = dataUrlToBase64(image.dataUrl)
          return [
            { text: imageLabel(image, index, reviewImages.slice(0, index).filter((candidate) => candidate.role === 'reference').length + 1) },
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

export function parseReport(text: string, enabledChecks: string[] = [], hasReferences = false): any {
  // strip code fences
  let t = text.trim()
  if (!t) throw new Error('The free vision model returned no report. Please retry the image review.')
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const finalize = (report: any) => {
    report = ensureSummary(report)
    ensureGarmentAssessment(report, enabledChecks)
    ensureReferenceAssessment(report, enabledChecks, hasReferences)
    report.decision = normalizeDecision(report)
    report.production_context = {
      shot_type: report.production_context?.shot_type || 'Not specified',
      viewpoint: report.production_context?.viewpoint || 'Not specified',
      visual_style: report.production_context?.visual_style || 'Not specified',
      coverage_notes: Array.isArray(report.production_context?.coverage_notes) ? report.production_context.coverage_notes : [],
      reference_comparison: report.production_context?.reference_comparison || (hasReferences ? 'Reference comparison was requested; inspect its category assessment.' : 'Not assessed; no reference frames were supplied.'),
    }
    return report
  }
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
  const garmentCheckEnabled = enabledChecks.some(check => /attire|drape|shawl|saree|sari|dhoti|uttariya|angavastram|garment|fabric|textile|pattern|wardrobe|costume|clothing|wardrobe/i.test(check))
  if (!garmentCheckEnabled) return report

  if (!Array.isArray(report.categories)) report.categories = []
  let category = report.categories.find((item: any) => /attire|drape|shawl|saree|sari|dhoti|uttariya|angavastram|garment|fabric|textile|costume|clothing|wardrobe|vastra|armor|armour/i.test(String(item?.name || '')))
  const missingCategory = !category
  if (!category) {
    category = {
      domain: 'Wardrobe & textiles',
      name: 'Attire & textile continuity: saree/dhoti, drapes, motifs, borders & transitions',
      status: 'warn',
      score: 45,
      assessment: 'The model response omitted the required attire and textile continuity inspection, so the visible design cannot be verified from this result.',
      findings: [],
    }
    report.categories.push(category)
  }

  const assessmentText = typeof category.assessment === 'string' ? category.assessment : ''
  const relatedFindings = Array.isArray(category.findings) ? category.findings.map((finding: any) => `${finding?.issue || ''} ${finding?.location || ''}`).join(' ') : ''
  const evidenceText = `${assessmentText} ${relatedFindings}`
  const namesGarmentDetail = /saree|sari|dhoti|uttariya|angavastram|vastra|drape|shawl|pallu|pleat|waistband|motif|border|hem|panel|fabric|textile|pattern|armor|armour|garment|attire|clothing|robe|tunic/i.test(evidenceText)
  const explainsContinuity = /continu|trac|compar|match|mismatch|consistent|disrupt|change|break|verif|cannot|unable|too small|occlud|cropp|not visible/i.test(evidenceText)
  const saysUnverifiable = /cannot|unable|too small|occlud|cropp|not visible|unverified|unclear|insufficient/i.test(evidenceText)
  const hasFindings = Array.isArray(category.findings) && category.findings.length > 0
  const passContradiction = category.status === 'pass' && (hasFindings || saysUnverifiable)
  const missingTrace = missingCategory || !assessmentText.trim() || (category.status !== 'na' && !(namesGarmentDetail && explainsContinuity)) || passContradiction
  if (missingTrace) {
    if (!assessmentText.trim() || missingCategory || !(namesGarmentDetail && explainsContinuity)) {
    category.assessment = 'No garment/textile trace was returned. Continuity is unverified; inspect the visible panels manually.'
    }
    if (!['warn', 'fail'].includes(category.status)) {
      category.status = 'warn'
      const categoryScore = Number(category.score)
      category.score = Math.min(Number.isFinite(categoryScore) ? categoryScore : 100, 55)
    }
    const overallScore = Number(report.overall_score)
    report.overall_score = Math.min(Number.isFinite(overallScore) ? overallScore : 100, 75)
    if (!/unverified|could not be verified|cannot be verified|unable to verify|not verified|incomplete/i.test(String(report.summary || ''))) {
      report.summary = `Attire continuity is unverified because the response did not document a visible pattern trace. ${report.summary || ''}`.trim()
    }
    if (!Array.isArray(report.priority_fixes)) report.priority_fixes = []
    if (!report.priority_fixes.some((fix: string) => /garment|attire|textile|saree|dhoti|drape|shawl|continuity/i.test(fix))) {
      report.priority_fixes.unshift('Review the visible costume border/motif transitions; the model did not provide a verifiable continuity trace.')
      report.priority_fixes = report.priority_fixes.slice(0, 5)
    }
  }
  if (!Array.isArray(category.findings)) category.findings = []
  if (missingTrace && !category.findings.length) {
    category.findings.push({
      issue: 'The response did not explain which costume panels, motifs, or borders were traced, so continuity is not confirmed.',
      severity: 'medium',
      location: 'Visible costume, drape, or textile panels',
      fix: 'Review the garment detail crop and rerun the continuity check if the pattern remains unclear.',
    })
  }
  return report
}

function ensureReferenceAssessment(report: any, enabledChecks: string[], hasReferences: boolean): void {
  if (!enabledChecks.some((check) => /reference.frame|shot.to.shot|reference comparison/i.test(check))) return
  if (!Array.isArray(report.categories)) report.categories = []
  let category = report.categories.find((item: any) => /reference.frame|shot.to.shot|reference comparison/i.test(String(item?.name || '')))
  if (!category) {
    category = { domain: 'Continuity', name: 'Reference-frame character / costume continuity (when references are supplied)', status: hasReferences ? 'warn' : 'na', score: hasReferences ? 40 : 0, assessment: '', findings: [] }
    report.categories.push(category)
  }
  if (!hasReferences) {
    category.status = 'na'
    category.score = 0
    category.assessment = 'No approved reference frames were supplied; identity and shot-to-shot design continuity were not assessed.'
    category.findings = []
    return
  }

  const assessment = typeof category.assessment === 'string' ? category.assessment : ''
  const evidence = `${assessment} ${(category.findings || []).map((finding: any) => `${finding?.issue || ''} ${finding?.evidence || ''} ${finding?.location || ''}`).join(' ')}`
  const namesComparedElements = /identity|face|costume|wardrobe|ornament|jewelry|jewellery|prop|palette|color|colour|silhouette|design/i.test(evidence)
  const namesComparison = /match|consistent|continu|differ|drift|change|compare|reference|unverif|cannot|unable/i.test(evidence)
  const missingAssessment = !assessment.trim() || !(namesComparedElements && namesComparison)
  const contradictoryPass = category.status === 'pass' && (category.findings?.length > 0 || /drift|differ|change|unverif|cannot|unable/i.test(evidence))
  if (!missingAssessment && !contradictoryPass) return

  category.status = category.status === 'fail' ? 'fail' : 'warn'
  category.score = Math.min(Number.isFinite(Number(category.score)) ? Number(category.score) : 100, 55)
  category.assessment = 'Reference frames were supplied, but the response did not document a reliable comparison of stable character/costume/prop details.'
  if (!Array.isArray(category.findings)) category.findings = []
  if (!category.findings.length) category.findings.push({
    issue: 'Reference continuity was not verified in the model response.',
    evidence: 'The reference comparison did not identify matched or divergent design cues.',
    location: 'Target frame compared with supplied references',
    severity: 'medium',
    confidence: 1,
    fix: 'Review identity, costume, prop, and palette continuity against the supplied reference frames.',
  })
  const overallScore = Number(report.overall_score)
  report.overall_score = Math.min(Number.isFinite(overallScore) ? overallScore : 100, 75)
  if (!Array.isArray(report.priority_fixes)) report.priority_fixes = []
  if (!report.priority_fixes.some((fix: string) => /reference|continuity/i.test(fix))) {
    report.priority_fixes.unshift('Complete the supplied reference-frame comparison before approving this shot.')
    report.priority_fixes = report.priority_fixes.slice(0, 5)
  }
}

function normalizeDecision(report: any): 'ready' | 'review' | 'hold' {
  const categories = Array.isArray(report.categories) ? report.categories : []
  const critical = categories.some((category: any) => category?.status === 'fail' || category?.findings?.some((finding: any) => finding?.severity === 'critical'))
  if (critical) return 'hold'
  const review = categories.some((category: any) => category?.status === 'warn' || category?.status === 'fail' || category?.findings?.some((finding: any) => ['high', 'medium'].includes(finding?.severity)))
  if (review) return 'review'
  return 'ready'
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
