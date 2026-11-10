// Fix All Flags: turns a QC report into one Nano Banana image-editing prompt.
// This module has no runtime imports so it stays pure and easy to test.
import type { Finding, QCCategory, QCReport, RepairFlag, RepairResult } from './types'

const SEVERITY_RANK: Record<Finding['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3 }
const SEVERITIES = Object.keys(SEVERITY_RANK) as Finding['severity'][]
const LOW_CONFIDENCE = 0.5

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''

// Placeholders parseReport adds when the model skipped a check (see llm.ts). They describe a
// gap in the review, not a visible defect, so editing the image cannot fix them.
const VERIFICATION_GAP = /not verified path by path|^the response did not document the |was not verified in the model response/i
export const isVerificationGap = (issue: unknown) => VERIFICATION_GAP.test(text(issue))

/** Counts review-coverage placeholders that Fix All Flags leaves out of the repair prompt. */
export function countVerificationGaps(report: QCReport | null | undefined): number {
  return (Array.isArray(report?.categories) ? report!.categories : [])
    .reduce((total, category) => total + (Array.isArray(category?.findings) ? category.findings.filter((finding) => isVerificationGap(finding?.issue)) : []).length, 0)
}

const normalizeConfidence = (value: unknown): number | undefined => {
  const n = Number(value)
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return undefined
  // Some model replies use 0-100 instead of 0-1.
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n))
}

/**
 * Collects every actionable flag in the report, removes duplicates and sorts by severity.
 * The report itself is never modified.
 */
export function collectRepairFlags(report: QCReport | null | undefined): RepairFlag[] {
  const categories: QCCategory[] = Array.isArray(report?.categories) ? report!.categories : []
  const seen = new Set<string>()
  const flags: Omit<RepairFlag, 'id'>[] = []

  const add = (flag: Omit<RepairFlag, 'id'>) => {
    const key = `${flag.issue}|${flag.location || ''}`.toLowerCase().replace(/[^a-z0-9|]+/g, ' ').trim()
    if (seen.has(key)) return
    seen.add(key)
    flags.push(flag)
  }

  for (const category of categories) {
    const name = text(category?.name) || 'Unnamed check'
    const findings = Array.isArray(category?.findings) ? category.findings : []
    for (const finding of findings) {
      const issue = text(finding?.issue)
      if (!issue || isVerificationGap(issue)) continue
      const severity = SEVERITIES.includes(finding.severity) ? finding.severity : 'low'
      const confidence = normalizeConfidence(finding.confidence)
      const fix = text(finding.fix)
      const location = text(finding.location)
      add({
        category: name,
        domain: text(category.domain) || undefined,
        issue,
        severity,
        location: location || undefined,
        evidence: text(finding.evidence) || undefined,
        fix: fix || undefined,
        confidence,
        ambiguous: (confidence !== undefined && confidence < LOW_CONFIDENCE) || (!fix && !location),
        source: 'finding',
      })
    }

    // A traced textile break is a flag even when the model forgot to file a finding for it.
    if (!findings.some((finding) => text(finding?.issue))) {
      for (const trace of Array.isArray(category?.continuity_traces) ? category.continuity_traces : []) {
        if (trace?.result !== 'break') continue
        const segment = text(trace.garment_segment) || 'garment'
        const path = text(trace.path)
        add({
          category: name,
          domain: text(category.domain) || undefined,
          issue: `Textile continuity break on the ${segment}${path ? ` along ${path}` : ''}`,
          severity: 'medium',
          location: text(trace.location) || path || undefined,
          evidence: text(trace.evidence) || text(trace.observed_design) || undefined,
          fix: `Make the border and motif design continuous across ${(trace.transitions_checked || []).filter(Boolean).join(', ') || 'the broken transition'}, matching the design visible on the rest of the ${segment}.`,
          ambiguous: !text(trace.location) && !path,
          source: 'textile-trace',
        })
      }
    }
  }

  return flags
    .map((flag, index) => ({ flag, index }))
    .sort((a, b) => SEVERITY_RANK[a.flag.severity] - SEVERITY_RANK[b.flag.severity]
      || (b.flag.confidence ?? 0.5) - (a.flag.confidence ?? 0.5)
      || a.index - b.index)
    .map(({ flag }, i) => ({ ...flag, id: `F${i + 1}` }))
}

export const REPAIR_SYSTEM_PROMPT = `You are a senior retouching supervisor writing an instruction for Nano Banana (Gemini image editing). You receive the ORIGINAL image that will be edited and the list of QC flags found on it. Write ONE consolidated image-editing prompt that the user will paste into Nano Banana together with this same image, so every flagged defect is corrected in a single edit.

Study the attached image yourself. Use what you see to make every instruction visually specific: name the actual colors, materials, motifs, ornaments, body side and position in frame. Confirm where each flagged region is. Never invent defects that are not in the flag list and never drop a flag.

The prompt you write must contain, in this order:
1. Opening line: edit the supplied image directly (do not generate a new image or re-imagine the scene) and return the same image with only the corrections below.
2. "Preserve:" block. Keep the character's identity, facial structure and features, expression, skin tone, hairstyle, pose, body proportions, wardrobe design, colors and motifs, jewellery and accessories, props, background and environment, composition, camera angle, framing, crop, aspect ratio, lighting direction, color grading and rendering style, except where a correction below explicitly changes that element. Name the concrete visible traits (for example "the gold temple necklace", "the saffron dhoti with the red woven border") so preservation is unambiguous.
3. "Corrections:" block. One numbered instruction per flag, most severe first. Merge two flags only when they describe the same defect in the same region. Each instruction states: the region (body part, garment or object, the character's left/right plus where it sits in the frame) — what is currently wrong, as a visible description — exactly what it should look like after the edit — what immediately around it must remain unchanged.
4. Conflict handling: if two corrections compete (for example adding detail versus keeping an approved garment design), resolve in favour of preserving identity, composition and the existing design, and apply the smallest edit that removes the defect. Write only the resolved instruction, not the debate.
5. Ambiguous flags (ambiguous: true, or too vague to locate): give a conservative instruction such as "make the right hand anatomically correct with five clearly separated fingers while keeping its current pose and grip". If a flag does not say which character, side or region it refers to and you cannot see the defect yourself with certainty, do not guess one: phrase the instruction to cover every matching visible instance (for example "on any visible hand where fingers are fused, separate them…"). Never invent new designs, ornaments, text, symbols or colors that are not visible or stated in the flag.
6. Closing line: blend every correction seamlessly into the surrounding pixels with matching grain, sharpness, lighting and color; add no new elements, text or watermarks; keep the original resolution and aspect ratio.

Style: imperative, concrete and positive ("keep", "make", "restore", "align"). Plain text with the short section labels above and numbered lines. No markdown headings, no bold, no commentary, no analysis summary, and no mention of QC, scores, flag IDs or confidence. About 200-700 words depending on how many flags there are.

Return ONLY valid JSON:
{"prompt": string, "addressed_flag_ids": string[], "conflicts_resolved": string[], "ambiguities": string[]}
- addressed_flag_ids: ids of the flags covered by an instruction in the prompt.
- conflicts_resolved: one short sentence per conflict you resolved; empty if none.
- ambiguities: one short sentence per flag you could not make specific, starting with its id; empty if none.`

const clip = (value: string | undefined, max: number) => value && value.length > max ? `${value.slice(0, max - 1)}…` : value

/** Builds the text half of the multimodal request. The original image is attached separately. */
export function buildRepairUserText(report: QCReport, flags: RepairFlag[]): string {
  const context = report.production_context || {}
  const preserved = (Array.isArray(report.categories) ? report.categories : [])
    .filter((category) => category?.status === 'pass')
    .map((category) => ({ area: category.name, note: clip(text(category.assessment), 220) || undefined }))

  const payload = {
    frame: {
      shot_type: context.shot_type,
      viewpoint: context.viewpoint,
      visual_style: context.visual_style,
      coverage_notes: context.coverage_notes,
    },
    qc_summary: clip(text(report.summary), 600),
    flags: flags.map((flag) => ({
      id: flag.id,
      severity: flag.severity,
      check: flag.category,
      issue: flag.issue,
      location: flag.location,
      evidence: clip(flag.evidence, 400),
      suggested_fix: flag.fix,
      ambiguous: flag.ambiguous || undefined,
    })),
    reviewer_priority_fixes: (Array.isArray(report.priority_fixes) ? report.priority_fixes : []).filter((fix) => text(fix)),
    verified_ok_areas_to_preserve: preserved,
    approved_reference_frames: report.source_reference_names?.length ? report.source_reference_names : undefined,
  }

  return `The attached image is the ORIGINAL frame that will be edited. Below is the QC data for it. Write the consolidated Nano Banana edit prompt that corrects all ${flags.length} flag${flags.length === 1 ? '' : 's'} in one pass.\n\n${JSON.stringify(payload, null, 2)}`
}

const toStringList = (value: unknown, max = 8) =>
  (Array.isArray(value) ? value : []).map(text).filter(Boolean).slice(0, max)

/** Turns the raw model reply into a validated repair result, or throws a readable error. */
export function parseRepairResponse(raw: string, flags: RepairFlag[]): Omit<RepairResult, 'createdAt'> {
  const body = text(raw).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  if (!body) throw new Error('The AI returned an empty repair prompt. Please try again.')

  let data: any = null
  try { data = JSON.parse(body) } catch {
    const match = body.match(/\{[\s\S]*\}/)
    if (match) { try { data = JSON.parse(match[0]) } catch { data = null } }
  }

  let prompt = data && typeof data === 'object' ? text(data.prompt) : body.startsWith('{') ? '' : body
  prompt = prompt
    .replace(/^(?:sure|certainly|of course|here(?:'s| is))\b[^\n]{0,80}\n+/i, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    // Models sometimes echo instruction fragments in lower case; start every line properly.
    .replace(/(^|\n)([a-z])/g, (_, start: string, letter: string) => start + letter.toUpperCase())

  // Some replies come back as one paragraph; restore the section layout so it stays scannable.
  if (!prompt.includes('\n')) {
    const split = prompt.indexOf('Corrections:')
    const head = split >= 0 ? prompt.slice(0, split) : prompt
    const tail = split >= 0 ? prompt.slice(split).replace(/\s+(\d{1,2}\.\s)(?=[A-Z])/g, '\n$1') : ''
    prompt = (head.replace(/\s+(Preserve:)/, '\n\n$1').trimEnd() + (tail ? `\n\n${tail}` : ''))
      .replace(/\s+(Blend every correction)/, '\n\n$1')
  }

  if (prompt.length < 120) {
    throw new Error('The AI response was incomplete and did not contain a usable editing prompt. Please regenerate.')
  }
  if (!/\b(edit|preserve|keep|retain|correct|fix|restore|repair)\w*/i.test(prompt)) {
    throw new Error('The AI response did not read as image-editing instructions. Please regenerate.')
  }

  const knownIds = new Set(flags.map((flag) => flag.id))
  return {
    prompt,
    flags,
    addressedIds: toStringList(data?.addressed_flag_ids, flags.length).filter((id) => knownIds.has(id)),
    conflicts: toStringList(data?.conflicts_resolved),
    ambiguities: toStringList(data?.ambiguities),
  }
}
