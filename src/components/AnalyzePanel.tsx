import { useState } from 'react'
import { useStore } from '../lib/store'
import { createGarmentDetailImage, createTextileTransitionImage, resizeImage } from '../lib/image'
import { analyzeImage, parseReport } from '../lib/llm'
import { PROVIDER_DEFAULTS } from '../lib/types'
import { Uploader } from './Uploader'
import { ReferenceFramesPanel } from './ReferenceFramesPanel'
import { ScanLine, X, Cpu, BarChart3, RefreshCw, Layers, Zap, ChevronRight } from 'lucide-react'

const PIPELINE_NODES = [
  {
    icon: '⬡',
    label: 'Preprocess',
    desc: 'Full frame + fabric detail when available',
    color: 'rgba(242,118,80,0.15)',
    border: 'rgba(242,118,80,0.3)',
  },
  {
    icon: '◈',
    label: 'Neural Vision',
    desc: 'Multimodal AI image analysis',
    color: 'rgba(217,223,131,0.11)',
    border: 'rgba(217,223,131,0.28)',
  },
  {
    icon: '◎',
    label: 'QC Report',
    desc: 'Structured JSON scoring',
    color: 'rgba(233,191,105,0.12)',
    border: 'rgba(233,191,105,0.3)',
  },
  {
    icon: '⟁',
    label: 'Transient Review',
    desc: 'Images sent for model analysis',
    color: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.3)',
  },
]

export function AnalyzePanel() {
  const image       = useStore((s) => s.image)
  const imageUrl    = useStore((s) => s.imageUrl)
  const imageName   = useStore((s) => s.imageName)
  const imageWidth  = useStore((s) => s.imageWidth)
  const imageHeight = useStore((s) => s.imageHeight)
  const referenceFrames = useStore((s) => s.referenceFrames)
  const settings    = useStore((s) => s.settings)
  const isAnalyzing = useStore((s) => s.isAnalyzing)
  const progress    = useStore((s) => s.progress)
  const setAnalyzing= useStore((s) => s.setAnalyzing)
  const setReport   = useStore((s) => s.setReport)
  const setError    = useStore((s) => s.setError)
  const setSettings = useStore((s) => s.setSettings)
  const clearImage  = useStore((s) => s.clearImage)
  const addHistory  = useStore((s) => s.addHistory)
  const setTab      = useStore((s) => s.setTab)
  const [raw, setRaw] = useState('')

  const run = async () => {
    if (!image) { setError('Upload an image first.'); return }
    // Pin all QC calls to Google's free-tier image-capable Gemini model.
    if (settings.provider !== 'gemini' || settings.endpoint !== PROVIDER_DEFAULTS.gemini.endpoint || settings.model !== PROVIDER_DEFAULTS.gemini.model) {
      setSettings({ provider: 'gemini', endpoint: PROVIDER_DEFAULTS.gemini.endpoint, model: PROVIDER_DEFAULTS.gemini.model })
    }
    const inspectGarments = settings.checks.some((check) => /attire|drape|shawl|saree|sari|dhoti|uttariya|angavastram|garment|fabric|textile|pattern|wardrobe|costume|clothing/i.test(check))
    setError(''); setRaw(''); setAnalyzing(true, inspectGarments ? 'Preparing full frame and fabric detail…' : 'Preprocessing image…')
    try {
      const { dataUrl } = await resizeImage(image, 2048, 0.94)
      const garmentDetail = inspectGarments ? createGarmentDetailImage(image) : null
      const textileTransition = inspectGarments ? createTextileTransitionImage(image) : null
      const reviewImages = [
        { dataUrl, role: 'target' as const, label: imageName },
        ...(garmentDetail ? [{ dataUrl: garmentDetail, role: 'garment-detail' as const, label: 'full garment context crop' }] : []),
        ...(textileTransition ? [{ dataUrl: textileTransition, role: 'garment-detail' as const, label: 'magnified torso/waist textile transition crop' }] : []),
        ...await Promise.all(referenceFrames.map(async (frame) => ({
          dataUrl: (await resizeImage(frame.image, 2048, 0.9)).dataUrl,
          role: 'reference' as const,
          label: frame.name,
        }))),
      ]
      setAnalyzing(true, referenceFrames.length
        ? `Comparing target with ${referenceFrames.length} reference frame${referenceFrames.length === 1 ? '' : 's'}…`
        : garmentDetail || textileTransition ? 'Tracing garment paths across full frame and magnified transitions…' : 'Running production QC analysis…')
      const text = await analyzeImage({
        ...settings,
        provider: 'gemini',
        apiKey: '',
        endpoint: PROVIDER_DEFAULTS.gemini.endpoint,
        model: PROVIDER_DEFAULTS.gemini.model,
      }, reviewImages, (t) => setRaw(t))
      setAnalyzing(true, 'Parsing QC report…')
      const report = parseReport(text, settings.checks, referenceFrames.length > 0)
      report.raw = text
      report.source_reference_names = referenceFrames.map((frame) => frame.name)
      setReport(report)
      addHistory({
        id: 'run_' + Date.now(),
        createdAt: Date.now(),
        imageName: imageName || 'image',
        thumbnail: dataUrl,
        report,
        provider: 'gemini',
        model: PROVIDER_DEFAULTS.gemini.model,
      })
      setTab('report')
    } catch (e) {
      setError(String(e))
    } finally {
      setAnalyzing(false, '')
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px' }}>
      {!image ? (
        <div>
          <div className="analyze-intro">
            <p className="intro-kicker">VISUAL QUALITY CONTROL</p>
            <h1>Make every detail<br /><em>ready for review.</em></h1>
            <p>Upload an image to receive a clear, structured assessment of consistency, finish, and presentation.</p>
          </div>
          {/* Upload Section */}
          <div style={{ marginBottom: 32 }}>
            <div className="section-label" style={{ marginBottom: 20 }}>
              <ScanLine size={11} />
              Start a review
            </div>
            <Uploader />
          </div>

          {/* Pipeline Nodes */}
          <div className="section-label" style={{ marginBottom: 16 }}>
            <Layers size={11} />
            What your review includes
          </div>
          <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap' }}>
            {PIPELINE_NODES.map((node, i) => (
              <div key={node.label} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 160 }}>
                <div className="pipeline-card" style={{ flex: 1 }}>
                  <div className="pipeline-node-icon" style={{ background: node.color, border: `1px solid ${node.border}` }}>
                    <span style={{ fontSize: 20 }}>{node.icon}</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-bright)', marginBottom: 4, fontFamily: 'var(--font-display)' }}>
                    {node.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', fontFamily: 'var(--font-mono)' }}>
                    {node.desc}
                  </div>
                </div>
                {i < PIPELINE_NODES.length - 1 && (
                  <div style={{ padding: '0 8px', color: 'var(--text-ghost)', flexShrink: 0 }}>
                    <ChevronRight size={14} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="review-workspace" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
          {/* Image Preview */}
          <div>
            <div className="section-label" style={{ marginBottom: 14 }}>
              <ScanLine size={11} />
              Image preview
            </div>
            <div className="card card-glow" style={{ padding: 14, position: 'relative' }}>
              <img
                src={imageUrl!}
                alt="preview"
                style={{ width: '100%', borderRadius: 10, display: 'block', maxHeight: 520, objectFit: 'contain' }}
              />
              {/* Corner brackets */}
              <div className="corner-bracket tl" />
              <div className="corner-bracket tr" />
              <div className="corner-bracket bl" />
              <div className="corner-bracket br" />

              {/* Scanning overlay */}
              {isAnalyzing && (
                <div className="scan-overlay">
                  <div className="scan-line-anim" />
                  <div className="thinking-dots">
                    <span /><span /><span />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-soft)', fontFamily: 'var(--font-mono)', letterSpacing: 0.5 }}>
                    {progress}
                  </span>
                </div>
              )}
            </div>

            {/* Image meta */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginTop: 10,
              fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
            }}>
              <span className="text-azure">{imageName}</span>
              <span style={{ color: 'var(--border-med)' }}>·</span>
              <span>{imageWidth}×{imageHeight}px</span>
              <button
                onClick={clearImage}
                style={{
                  marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px', borderRadius: 7,
                  background: 'rgba(244,63,94,0.06)',
                  border: '1px solid rgba(244,63,94,0.2)',
                  color: '#fb7185', cursor: 'pointer', fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  transition: 'all 0.2s',
                }}
              >
                <X size={10} /> Remove
              </button>
            </div>
          </div>

          {/* Control Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="section-label">
              <Cpu size={11} />
              QC Engine
            </div>

            {/* Engine status card */}
            <div className="engine-card">
              <div className="engine-label">
                <Zap size={9} />
              Visual review · Ready
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'var(--font-display)', marginBottom: 4 }}>
                Visual Intelligence System
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-soft)', fontFamily: 'var(--font-mono)' }}>
                {settings.checks.length} quality checks · Vision-enabled
              </div>
            </div>

            <ReferenceFramesPanel />

            {/* Run Button */}
            <button
              id="btn-run-qc"
              onClick={run}
              disabled={isAnalyzing}
              className="btn-primary"
              style={{ width: '100%', padding: '15px 24px', fontSize: 14 }}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  {progress || 'Analyzing…'}
                </>
              ) : (
                <>
                  <ScanLine size={14} />
                Run visual review
                </>
              )}
            </button>

            {isAnalyzing && (
              <div className="progress-bar-track">
                <div className="progress-bar-fill" />
              </div>
            )}

            {/* Active Checks */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
                letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <BarChart3 size={10} />
                Active QC Checks · {settings.checks.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {settings.checks.map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 11.5, color: 'var(--text-soft)',
                    padding: '4px 0',
                    borderBottom: i < settings.checks.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--electric), var(--violet))',
                      flexShrink: 0,
                      boxShadow: '0 0 6px rgba(59,130,246,0.5)',
                    }} />
                    {c}
                  </div>
                ))}
              </div>
            </div>

            {/* Raw output (debug, hidden by default) */}
            {raw && (
              <details style={{ marginTop: 4 }}>
                <summary style={{
                  fontSize: 10.5, color: 'var(--text-muted)', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', userSelect: 'none', letterSpacing: 0.5,
                }}>
                  ▸ Raw engine output
                </summary>
                <div className="card" style={{ padding: 12, marginTop: 8, maxHeight: 200, overflow: 'auto' }}>
                  <pre style={{
                    fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-mono)',
                  }}>{raw}</pre>
                </div>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
