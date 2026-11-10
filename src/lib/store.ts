import { create } from 'zustand'
import { PROVIDER_DEFAULTS, DEFAULT_CHECKS } from './types'
import type { Settings, RunRecord, ReferenceFrame, RepairState } from './types'

export const IDLE_REPAIR: RepairState = { status: 'idle', stage: null, result: null, error: '' }

const CHECK_MATRIX_VERSION = '4'
const NEW_WEARABLE_CHECKS = [
  'Waist belt / girdle fit, attachment & design continuity',
  'Janeu (sacred thread) route, alignment & attachment',
]
const PREVIOUS_MATRIX_CHECKS = DEFAULT_CHECKS.filter((check) => !NEW_WEARABLE_CHECKS.includes(check))
const LEGACY_DEFAULT_CHECKS = [
  'Symmetry & proportions (left vs right ornaments)',
  'Jewellery design consistency on both sides',
  'Attire / costume continuity top-to-bottom',
  'Footwear matching and correctness',
  'Pose & anatomy naturalness',
  'Lighting & color consistency',
  'Background & composition cleanliness',
  'Overall character fidelity',
  'Skin texture & material realism (pores, fine grain, plastic or waxy finish)',
  'Hair strand texture, volume & natural grooming',
  'Forehead tilak / bindi placement and completeness',
  'Earrings: left-right design, structure, scale & attachment',
  'Nose pin: presence, placement, scale & natural fit when applicable',
  'Crown / headpiece fit and natural attachment to the head',
  'Bangles, bracelets & rings: count, matching design, scale & fit',
  'Footwear match, construction & fit on both feet',
  'Body proportions, anatomy, pose & overall image finish',
  'Viewpoint, visible coverage & crop-aware QC assessment',
  'Hands, fingers, feet & toes: natural anatomy and clear separation',
  'Attire, drape, shawl & pattern continuity from top to bottom',
  'Saree, drape & shawl design continuity (borders, motifs, pleats and transitions)',
  'Attire & textile continuity (dhoti/saree drapes, shawls, borders, motifs and panel transitions)',
  'Attire / costume continuity top-to-bottom',
  'Jewellery design consistency on both sides',
]

type State = {
  settings: Settings
  image: HTMLImageElement | null
  imageUrl: string | null
  imageName: string
  imageWidth: number
  imageHeight: number
  referenceFrames: ReferenceFrame[]
  isAnalyzing: boolean
  progress: string
  report: any | null
  /** The exact image data URL the current report was produced from (sent again by Fix All Flags). */
  reportImage: string | null
  repair: RepairState
  error: string
  history: RunRecord[]
  activeTab: 'setup' | 'analyze' | 'report' | 'history'
  setTab: (t: State['activeTab']) => void
  setSettings: (p: Partial<Settings>) => void
  setImage: (img: HTMLImageElement, url: string, name: string) => void
  clearImage: () => void
  setReferenceFrames: (frames: ReferenceFrame[]) => void
  setAnalyzing: (b: boolean, msg?: string) => void
  setReport: (r: any, image?: string | null) => void
  setRepair: (p: Partial<RepairState>) => void
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
      if (Array.isArray(parsed.checks)) {
        const matrixVersion = localStorage.getItem('qc_checks_version') || '0'
        if (matrixVersion === '3') {
          const selectedPriorChecks = parsed.checks.filter((check: string) => PREVIOUS_MATRIX_CHECKS.includes(check))
          const customChecks = parsed.checks.filter((check: string) => !LEGACY_DEFAULT_CHECKS.includes(check) && !DEFAULT_CHECKS.includes(check))
          parsed.checks = [...selectedPriorChecks, ...NEW_WEARABLE_CHECKS, ...customChecks]
          try { localStorage.setItem('qc_checks_version', CHECK_MATRIX_VERSION) } catch {}
        } else if (matrixVersion !== CHECK_MATRIX_VERSION) {
          const customChecks = parsed.checks.filter((check: string) => !LEGACY_DEFAULT_CHECKS.includes(check) && !DEFAULT_CHECKS.includes(check))
          parsed.checks = [...DEFAULT_CHECKS, ...customChecks]
          try { localStorage.setItem('qc_checks_version', CHECK_MATRIX_VERSION) } catch {}
        }
      }
      try { localStorage.setItem('qc_settings', JSON.stringify(parsed)) } catch {}
      return parsed
    }
  } catch {}
  try { localStorage.setItem('qc_checks_version', CHECK_MATRIX_VERSION) } catch {}
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
  referenceFrames: [],
  isAnalyzing: false,
  progress: '',
  report: null,
  reportImage: null,
  repair: IDLE_REPAIR,
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
    try {
      localStorage.setItem('qc_settings', JSON.stringify(next))
      localStorage.setItem('qc_checks_version', CHECK_MATRIX_VERSION)
    } catch {}
    return { settings: next }
  }),
  setImage: (img, url, name) => set({ image: img, imageUrl: url, imageName: name, imageWidth: img.naturalWidth || img.width, imageHeight: img.naturalHeight || img.height, report: null, reportImage: null, repair: IDLE_REPAIR, error: '' }),
  clearImage: () => set({ image: null, imageUrl: null, imageName: '', imageWidth: 0, imageHeight: 0, report: null, reportImage: null, repair: IDLE_REPAIR }),
  setReferenceFrames: (frames) => set((state) => {
    const retainedUrls = new Set(frames.map((frame) => frame.url))
    state.referenceFrames.forEach((frame) => { if (!retainedUrls.has(frame.url)) URL.revokeObjectURL(frame.url) })
    return { referenceFrames: frames }
  }),
  setAnalyzing: (b, msg = '') => set({ isAnalyzing: b, progress: msg }),
  setReport: (r, image = null) => set({ report: r, reportImage: image, repair: IDLE_REPAIR }),
  setRepair: (p) => set((s) => ({ repair: { ...s.repair, ...p } })),
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
