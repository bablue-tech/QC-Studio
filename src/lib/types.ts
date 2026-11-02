export type Provider = 'openai' | 'anthropic' | 'gemini' | 'opencode' | 'openrouter' | 'custom'

export type QCCategory = {
  name: string
  status: 'pass' | 'warn' | 'fail' | 'na'
  score: number
  findings: { issue: string; severity: 'low' | 'medium' | 'high' | 'critical'; location?: string; fix: string }[]
}

export type QCReport = {
  overall_score: number
  summary: string
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
  'Skin texture & material realism (pores, fine grain, plastic or waxy finish)',
  'Hair strand texture, volume & natural grooming',
  'Forehead tilak / bindi placement and completeness',
  'Earrings: left-right design, structure, scale & attachment',
  'Nose pin: presence, placement, scale & natural fit when applicable',
  'Attire, drape, shawl & pattern continuity from top to bottom',
  'Crown / headpiece fit and natural attachment to the head',
  'Bangles, bracelets & rings: count, matching design, scale & fit',
  'Footwear match, construction & fit on both feet',
  'Body proportions, anatomy, pose & overall image finish',
]

export const PROVIDER_DEFAULTS: Record<Provider, { endpoint: string; model: string }> = {
  openai: { endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
  anthropic: { endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-5' },
  gemini: { endpoint: '/api/gemini/v1beta', model: 'gemini-3.5-flash-lite' },
  opencode: { endpoint: '/api/opencode/v1/chat/completions', model: 'mimo-v2.6-flash-free' },
  // OpenRouter routes to a free model that supports the request's image input.
  openrouter: { endpoint: '/api/openrouter/api/v1/chat/completions', model: 'openrouter/free' },
  custom: { endpoint: '', model: '' },
}
