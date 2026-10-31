import { create } from 'zustand'
import { PROVIDER_DEFAULTS, DEFAULT_CHECKS, OPENROUTER_API_KEY } from './types'
import type { Settings, RunRecord } from './types'

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
      // migrate opencode provider to openrouter
      if (parsed.provider === 'opencode') {
        parsed.provider = 'openrouter'
        parsed.apiKey = OPENROUTER_API_KEY
        parsed.endpoint = PROVIDER_DEFAULTS.openrouter.endpoint
        parsed.model = PROVIDER_DEFAULTS.openrouter.model
      }
      // migrate old openrouter API key to new one
      if (parsed.provider === 'openrouter' && parsed.apiKey === 'oc_sk_fe53ce320478_pR4071BE3ljZVZKkElPsvVwPFM6ieKZj') {
        parsed.apiKey = OPENROUTER_API_KEY
      }
      if (parsed.provider === 'openrouter' && parsed.apiKey === 'oc_sk_23ed4e7448bd_5MS4TpmFa89S4a_GTqmGfcnXUmbxB6iq') {
        parsed.apiKey = OPENROUTER_API_KEY
      }
      return parsed
    }
  } catch {}
  return { provider: 'openrouter', apiKey: OPENROUTER_API_KEY, model: PROVIDER_DEFAULTS.openrouter.model, endpoint: PROVIDER_DEFAULTS.openrouter.endpoint, temperature: 0.2, maxTokens: 2000, checks: [...DEFAULT_CHECKS] }

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
  activeTab: 'setup',
  setTab: (t) => set({ activeTab: t }),
  setSettings: (p) => set((s) => {
    const next = { ...s.settings, ...p }
    // auto-fill endpoint/model when provider changes
    if (p.provider && p.provider !== s.settings.provider) {
      next.endpoint = PROVIDER_DEFAULTS[p.provider].endpoint || next.endpoint
      next.model = PROVIDER_DEFAULTS[p.provider].model || next.model
    }
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
