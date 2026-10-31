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
  // mimo-v2.6-flash-free is the only FREE model on OpenCode.ai with vision/image support
  opencode: { endpoint: '/api/opencode/v1/chat/completions', model: 'mimo-v2.6-flash-free' },
  openrouter: { endpoint: '/api/openrouter/api/v1/chat/completions', model: 'openai/gpt-4o' },
  custom: { endpoint: '', model: '' },
}

/** Pre-filled OpenCode API key */
export const OPENCODE_API_KEY = 'oc_sk_23ed4e7448bd_5MS4TpmFa89S4a_GTqmGfcnXUmbxB6iq'

/** Pre-filled OpenRouter API key */
export const OPENROUTER_API_KEY = 'v1-659ecc54c36de8f896b159586e3d08d268f591aef81707dbbff09749b491304e'
