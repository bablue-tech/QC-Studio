import { ShieldCheck, ScanLine, FileText, History, Settings, Brain, Zap, AlertCircle, Activity } from 'lucide-react'
import { useStore } from './lib/store'
import { SetupPanel } from './components/SetupPanel'
import { AnalyzePanel } from './components/AnalyzePanel'
import { ReportPanel } from './components/ReportPanel'
import { HistoryPanel } from './components/HistoryPanel'
import './App.css'

const tabs = [
  { id: 'analyze', label: 'Analyze',  icon: ScanLine,  num: '01' },
  { id: 'report',  label: 'Report',   icon: FileText,   num: '02' },
  { id: 'history', label: 'History',  icon: History,    num: '03' },
  { id: 'setup',   label: 'Settings', icon: Settings,   num: '04' },
] as const

const MARQUEE_TEXT = [
  { label: 'Developed & Designed by', hl: 'Sai Charan Sandeveni' },
  { label: 'Powered by', hl: 'Neural Vision Engine' },
  { label: '', hl: 'Character & Brand Compliance' },
  { label: '', hl: 'Zero Credentials Stored' },
  { label: '', hl: 'Multimodal AI Analysis' },
  { label: 'Real-time', hl: 'QC Scoring & Reporting' },
]

export default function App() {
  const activeTab = useStore((s) => s.activeTab)
  const setTab    = useStore((s) => s.setTab)
  const error     = useStore((s) => s.error)
  const report    = useStore((s) => s.report)
  const history   = useStore((s) => s.history)

  return (
    <>
      {/* ── Ambient Background ── */}
      <div className="bg-layer">
        <div className="node-grid" />
        <div className="node-dots" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="scanlines" />
      </div>

      <div id="app-root">
        {/* ── Header ── */}
        <header className="app-header">
          <div className="app-logo">
            <div className="logo-icon">
              <ShieldCheck size={18} color="#60a5fa" strokeWidth={2.2} />
            </div>
            <span className="logo-name">BrandGuard</span>
            <span className="logo-badge">QC STUDIO</span>
          </div>

          <div className="header-right">
            <div className="ai-engine-badge">
              <Brain size={11} />
              <span>Neural QC Engine</span>
            </div>
            <div className="sys-badge">
              <div className="pulse-dot" />
              <span>SYSTEM ONLINE</span>
            </div>
          </div>
        </header>

        {/* ── Navigation ── */}
        <nav className="app-nav">
          {tabs.map(t => {
            const Icon = t.icon
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`nav-btn${isActive ? ' active' : ''}`}
                id={`nav-${t.id}`}
              >
                <span className="nav-btn-num">{t.num}</span>
                <Icon size={13} />
                {t.label}
                {t.id === 'report' && report && (
                  <span className="nav-badge-dot" />
                )}
                {t.id === 'history' && history.length > 0 && (
                  <span className="nav-count-pill">{history.length}</span>
                )}
              </button>
            )
          })}

          <div className="nav-spacer" />
          <div className="nav-ai-indicator">
            <Activity size={10} color="var(--electric)" />
            <Zap size={10} color="var(--violet)" />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
              AI · VISION · QC
            </span>
          </div>
        </nav>

        {/* ── Error Banner ── */}
        {error && (
          <div className="error-banner">
            <AlertCircle size={13} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Main Panels ── */}
        <main className="app-main">
          {activeTab === 'analyze' && <div className="panel-enter" key="analyze"><AnalyzePanel /></div>}
          {activeTab === 'report'  && <div className="panel-enter" key="report"><ReportPanel /></div>}
          {activeTab === 'history' && <div className="panel-enter" key="history"><HistoryPanel /></div>}
          {activeTab === 'setup'   && <div className="panel-enter" key="setup"><SetupPanel /></div>}
        </main>

        {/* ── Marquee Footer ── */}
        <footer className="app-footer">
          <div className="marquee-track">
            {[0, 1].map(idx => (
              <div key={idx} className="marquee-content">
                {MARQUEE_TEXT.map((item, i) => (
                  <span key={i}>
                    {item.label && <>{item.label} </>}
                    <span className="hl">{item.hl}</span>
                    {i < MARQUEE_TEXT.length - 1 && (
                      <span className="marquee-sep" style={{ margin: '0 24px' }}>◈</span>
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </footer>
      </div>
    </>
  )
}
