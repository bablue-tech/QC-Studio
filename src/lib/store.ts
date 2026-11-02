import { create } from 'zustand'
import { PROVIDER_DEFAULTS, DEFAULT_CHECKS } from './types'
import type { Settings, RunRecord } from './types'

const PREVIOUS_DEFAULT_CHECKS = [
  'Symmetry & proportions (left vs right ornaments)',
  'Jewellery design consistency on both sides',
  'Attire / costume continuity top-to-bottom',
  'Footwear matching and correctness',
  'Pose & anatomy naturalness',
  'Lighting & color consistency',
  'Background & composition cleanliness',
  'Overall character fidelity',
]

type State = {
  settings: Settings
  image: HTMLImageElement | null
  imageUrl: string | null
  imageName: string
  imageWidth: number
  imageHeight: number
  isAnalyzing: boolean
  progress: string
  report: any | null
  error: string
  history: RunRecord[]
  activeTab: 'setup' | 'analyze' | 'report' | 'history'
  setTab: (t: State['activeTab']) => void
  setSettings: (p: Partial<Settings>) => void
  setImage: (img: HTMLImageElement, url: string, name: string) => void
  clearImage: () => void
  setAnalyzing: (b: boolean, msg?: string) => void
  setReport: (r: any) => void
  setError: (e: string) => void
  addHistory: (r: RunRecord) => void
  removeHistory: (id: string) => void
  clearHistory: () => void
}

const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem('qc_settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      // API credentials are kept on the server; remove any previously stored browser key.
      delete parsed.apiKey
      parsed.apiKey = ''
      // Use the configured server-side Gemini account instead of legacy browser keys.
      parsed.provider = 'gemini'
      parsed.endpoint = PROVIDER_DEFAULTS.gemini.endpoint
      parsed.model = PROVIDER_DEFAULTS.gemini.model
      const savedMaxTokens = Number(parsed.maxTokens)
      parsed.maxTokens = Number.isFinite(savedMaxTokens) && savedMaxTokens >= 4000 ? savedMaxTokens : 4000
      if (Array.isArray(parsed.checks) && parsed.checks.some((check: string) => PREVIOUS_DEFAULT_CHECKS.includes(check))) {
        const customChecks = parsed.checks.filter((check: string) => !PREVIOUS_DEFAULT_CHECKS.includes(check))
        parsed.checks = [...DEFAULT_CHECKS, ...customChecks]
      }
      try { localStorage.setItem('qc_settings', JSON.stringify(parsed)) } catch {}
      return parsed
    }
  } catch {}
  return { provider: 'gemini', apiKey: '', model: PROVIDER_DEFAULTS.gemini.model, endpoint: PROVIDER_DEFAULTS.gemini.endpoint, temperature: 0.2, maxTokens: 4000, checks: [...DEFAULT_CHECKS] }

}
const loadHistory = (): RunRecord[] => {
  try {
    const raw = localStorage.getItem('qc_history')
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

export const useStore = create<State>((set) => ({
  settings: loadSettings(),
  image: null,
  imageUrl: null,
  imageName: '',
  imageWidth: 0,
  imageHeight: 0,
  isAnalyzing: false,
  progress: '',
  report: null,
  error: '',
  history: loadHistory(),
  activeTab: 'analyze',
  setTab: (t) => set({ activeTab: t }),
  setSettings: (p) => set((s) => {
    const next = { ...s.settings, ...p }
    // auto-fill endpoint/model when provider changes
    if (p.provider && p.provider !== s.settings.provider) {
      next.endpoint = PROVIDER_DEFAULTS[p.provider].endpoint || next.endpoint
      next.model = PROVIDER_DEFAULTS[p.provider].model || next.model
    }
    // Never persist API credentials in browser storage.
    next.apiKey = ''
    try { localStorage.setItem('qc_settings', JSON.stringify(next)) } catch {}
    return { settings: next }
  }),
  setImage: (img, url, name) => set({ image: img, imageUrl: url, imageName: name, imageWidth: img.naturalWidth || img.width, imageHeight: img.naturalHeight || img.height, report: null, error: '' }),
  clearImage: () => set({ image: null, imageUrl: null, imageName: '', imageWidth: 0, imageHeight: 0, report: null }),
  setAnalyzing: (b, msg = '') => set({ isAnalyzing: b, progress: msg }),
  setReport: (r) => set({ report: r }),
  setError: (e) => set({ error: e }),
  addHistory: (r) => set((s) => {
    const next = [r, ...s.history].slice(0, 30)
    try { localStorage.setItem('qc_history', JSON.stringify(next)) } catch {}
    return { history: next }
  }),
  removeHistory: (id) => set((s) => {
    const next = s.history.filter(h => h.id !== id)
    try { localStorage.setItem('qc_history', JSON.stringify(next)) } catch {}
    return { history: next }
  }),
  clearHistory: () => set(() => { try { localStorage.removeItem('qc_history') } catch {}; return { history: [] } }),
}))
