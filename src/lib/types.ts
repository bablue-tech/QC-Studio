export type Provider = 'openai' | 'anthropic' | 'gemini' | 'opencode' | 'openrouter' | 'custom'

export type ReferenceFrame = { image: HTMLImageElement; url: string; name: string }

export type QCDecision = 'ready' | 'review' | 'hold'

export type Finding = {
  issue: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  location?: string
  evidence?: string
  fix: string
  confidence?: number
}

export type TextileTrace = {
  garment_segment: string
  path: string
  observed_design: string
  transitions_checked: string[]
  result: 'consistent' | 'break' | 'unverified'
  location?: string
  evidence?: string
}

export type QCCategory = {
  domain?: string
  name: string
  status: 'pass' | 'warn' | 'fail' | 'na'
  score: number
  assessment?: string
  findings: Finding[]
  continuity_traces?: TextileTrace[]
  textile_path_coverage?: 'all_visible_paths' | 'partial' | 'none'
}

export type QCProductionContext = {
  shot_type?: string
  viewpoint?: string
  visual_style?: string
  coverage_notes?: string[]
  reference_comparison?: string
}

export type QCReport = {
  overall_score: number
  decision?: QCDecision
  summary: string
  production_context?: QCProductionContext
  source_reference_names?: string[]
  categories: QCCategory[]
  priority_fixes: string[]
  extra_observations: string[]
  raw?: string
}

export type RunRecord = {
  id: string
  createdAt: number
  imageName: string
  thumbnail: string
  report: QCReport
  provider: Provider
  model: string
}

export type Settings = {
  provider: Provider
  apiKey: string
  model: string
  endpoint: string
  temperature: number
  maxTokens: number
  checks: string[]
}

export const DEFAULT_CHECKS = [
  'Shot framing, camera view & visible coverage',
  'Character face, identity coherence & expression',
  'Skin material, microtexture & facial detail',
  'Hair, facial hair, hairline & silhouette',
  'Anatomy, proportions, pose & contact points',
  'Hands, fingers, feet & toes: structure and separation',
  'Wardrobe silhouette, fit, layers & construction',
  'Attire & textile continuity: saree/dhoti, drapes, motifs, borders & transitions',
  'Waist belt / girdle fit, attachment & design continuity',
  'Janeu (sacred thread) route, alignment & attachment',
  'Jewelry, ornaments, tilak & paired accessory consistency',
  'Crown, headwear & attachment to the character',
  'Props, weapons & object geometry / grip',
  'Environment, set geometry & spatial relationships',
  'Lighting, shadows, reflections & material response',
  'Camera perspective, depth of field, focus & composition',
  'AI generation artifacts, edges, seams & duplicated details',
  'Text, symbols, logos & inscriptions against intended design',
  'Style, palette, color continuity & finish',
  'Reference-frame character / costume continuity (when references are supplied)',
]

export const QC_CHECK_DETAILS: Record<string, string> = {
  'Shot framing, camera view & visible coverage': 'Classify shot size, angle, orientation, crop, occlusion, subject scale, headroom and footroom. Record what is outside frame; never fail a hidden feature.',
  'Character face, identity coherence & expression': 'Inspect eye alignment and gaze, pupils, eyelids, brows, ears, nose, mouth, teeth, expression symmetry, facial feature duplication and visible identity drift. Compare identity only when references are attached.',
  'Skin material, microtexture & facial detail': 'At useful resolution inspect pores, fine grain, tonal transitions, subsurface response, sharpness and texture seams. Flag waxy, plastic, airbrushed or melted skin on realistic work; respect stylized art.',
  'Hair, facial hair, hairline & silhouette': 'Check strand flow, clumps, flyaways, roots, hairline, beard/moustache edges, silhouette continuity, intersections and helmet-like or painted-on appearance.',
  'Anatomy, proportions, pose & contact points': 'Review limb lengths, joints, neck/shoulder attachment, posture, balance, foreshortening, body intersections and whether contact with ground, seat or other objects reads physically plausible.',
  'Hands, fingers, feet & toes: structure and separation': 'Inspect each sufficiently visible hand for four fingers plus thumb, joints, separation, grip and attachment. Review visible bare toes and feet; account for crop, pose, gloves, footwear and occlusion.',
  'Wardrobe silhouette, fit, layers & construction': 'Check garment fit, shoulder/waist attachment, seams, closures, folds, thickness, layer order, clipping, floating fabric, impossible intersections and whether cloth follows the pose.',
  'Attire & textile continuity: saree/dhoti, drapes, motifs, borders & transitions': 'Trace every visible connected border path separately from its start to end, especially shoulder/chest → waist/hand overlap → lower drape and any shawl-to-body transition. At each seam, fold, overlap and motif-repeat boundary compare motif identity, order, spacing, scale, orientation, color, border width and edge trims. Name the exact transition; treat occluded joins as unverified, not continuous.',
  'Waist belt / girdle fit, attachment & design continuity': 'Inspect the visible waist belt/girdle for correct anatomical height, centering, perspective, fit, closure/end alignment, continuous attachment, stable width, repeated ornament design, floating gaps, clipping, body penetration, twisting, and how it sits over/under the drape. State what is hidden or not specified; do not assume every design requires a belt.',
  'Janeu (sacred thread) route, alignment & attachment': 'When present or required by the approved character design, trace the visible janeu/sacred-thread route across the body and compare its orientation to the model sheet/reference and anatomy. Check shoulder/torso/waist alignment, strand continuity, natural contact, secure endpoints where visible, scale, crossings with the belt/necklaces, clipping, floating, doubling, and whether it disappears/reappears plausibly under occlusion. Do not assume it is required or infer a specific ritual convention without design guidance; mark absent/unseen areas not applicable or unverifiable.',
  'Jewelry, ornaments, tilak & paired accessory consistency': 'Check visible earrings, nose pin when design calls for it, necklaces, armlets, bangles, rings, tilak and paired ornaments for count, symmetry, structure, fit, attachment, duplication and intersections.',
  'Crown, headwear & attachment to the character': 'Inspect scale, perspective, centerline, contact points, hair interaction, floating/clipping, rear construction and whether the headwear is physically seated on the head.',
  'Props, weapons & object geometry / grip': 'Check weapon/prop topology, symmetry, handles, blades, repeated parts, material transitions, hand grip, object-to-body intersections, duplicate/melted geometry and plausible scale.',
  'Environment, set geometry & spatial relationships': 'Inspect architecture, horizon, perspective lines, repeated set pieces, object count, scale, intersections, support, ground contact, background warping and subject-to-set placement.',
  'Lighting, shadows, reflections & material response': 'Check key/fill/rim direction, cast-shadow direction and contact, highlight placement, reflection consistency, exposure, mixed color temperature and whether materials respond coherently to the scene light.',
  'Camera perspective, depth of field, focus & composition': 'Check vanishing lines, lens/perspective distortion, horizon, focus plane, depth cues, motion blur if present, subject separation, negative space and crop quality for intended shot use.',
  'AI generation artifacts, edges, seams & duplicated details': 'Search for ghosting, double contours, halos, melted or fused forms, texture repetition, abrupt detail changes, broken silhouettes, impossible microgeometry, compression, banding, aliasing and patch-like transitions.',
  'Text, symbols, logos & inscriptions against intended design': 'Inspect only legible or referenceable marks. Flag garbled/mutated text, malformed symbols, inconsistent lettering or accidental pseudo-text; do not guess unreadable scripts or culturally specific meaning.',
  'Style, palette, color continuity & finish': 'Check whether rendering style, detail density, palette, sharpness, grain, saturation and contrast remain coherent across subject, costume, props and environment.',
  'Reference-frame character / costume continuity (when references are supplied)': 'Compare identity cues, costume construction, motifs, ornaments, props and palette against supplied references while allowing intentional pose, camera, lighting and view changes. Without references, report not applicable.',
}

/** Tried in order when the main Gemini model is overloaded or rate limited. */
export const GEMINI_FALLBACK_MODELS = ['gemini-3-flash-preview', 'gemini-3.5-flash-lite']

export const PROVIDER_DEFAULTS: Record<Provider, { endpoint: string; model: string }> = {
  openai: { endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
  anthropic: { endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-5' },
  // gemini-3.1-flash-lite was the most reliable and fastest image model in live tests (Nov 2026).
  gemini: { endpoint: '/api/gemini/v1beta', model: 'gemini-3.1-flash-lite' },
  opencode: { endpoint: '/api/opencode/v1/chat/completions', model: 'mimo-v2.6-flash-free' },
  // OpenRouter routes to a free model that supports the request's image input.
  openrouter: { endpoint: '/api/openrouter/api/v1/chat/completions', model: 'openrouter/free' },
  custom: { endpoint: '', model: '' },
}

/** One QC finding normalized for the Fix All Flags repair prompt. */
export type RepairFlag = {
  id: string
  category: string
  domain?: string
  issue: string
  severity: Finding['severity']
  location?: string
  evidence?: string
  fix?: string
  confidence?: number
  /** Low confidence or no usable fix: the prompt must stay conservative here. */
  ambiguous: boolean
  source: 'finding' | 'textile-trace'
}

export type RepairStage = 'collect' | 'image' | 'generate' | 'validate'

export type RepairResult = {
  prompt: string
  flags: RepairFlag[]
  addressedIds: string[]
  ambiguities: string[]
  conflicts: string[]
  createdAt: number
}

export type RepairState = {
  status: 'idle' | 'running' | 'ready' | 'error'
  stage: RepairStage | null
  result: RepairResult | null
  error: string
}
