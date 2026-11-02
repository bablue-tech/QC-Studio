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
  'Symmetry & proportions (left vs right ornaments)',
  'Jewellery design consistency on both sides',
  'Attire / costume continuity top-to-bottom',
  'Footwear matching and correctness',
  'Pose & anatomy naturalness',
  'Lighting & color consistency',
  'Background & composition cleanliness',
  'Overall character fidelity',
]

export const PROVIDER_DEFAULTS: Record<Provider, { endpoint: string; model: string }> = {
  openai: { endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
  anthropic: { endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-5' },
  gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
  // Free OpenCode model explicitly designated as vision-language.
  opencode: { endpoint: '/api/opencode/v1/chat/completions', model: 'nemotron-3.5-super-vl-free' },
  openrouter: { endpoint: '/api/openrouter/api/v1/chat/completions', model: 'openai/gpt-4o' },
  custom: { endpoint: '', model: '' },
}
