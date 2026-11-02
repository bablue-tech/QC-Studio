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

export default function App() {
  const activeTab = useStore((s) => s.activeTab)
  const setTab    = useStore((s) => s.setTab)
  const error     = useStore((s) => s.error)
  const report    = useStore((s) => s.report)
  const history   = useStore((s) => s.history)
  const isAnalyzing = useStore((s) => s.isAnalyzing)

  return (
    <>
      {/* ── Ambient Background ── */}
      <div className={`bg-layer${isAnalyzing ? ' is-analyzing' : ''}`} aria-hidden="true">
        <div className="network-glow network-glow-one" />
        <div className="network-glow network-glow-two" />
        <svg className="network-canvas" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="nodeCore"><stop stopColor="#fff2d1" /><stop offset=".28" stopColor="#ff9872" /><stop offset="1" stopColor="#f27650" stopOpacity="0" /></radialGradient>
            <linearGradient id="linkWarm" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f27650" stopOpacity="0" /><stop offset=".48" stopColor="#f27650" stopOpacity=".5" /><stop offset="1" stopColor="#d9df83" stopOpacity=".12" /></linearGradient>
          </defs>
          <g className="network-links">
            <path d="M-20 200 112 142 235 210 338 115 470 170 570 92 710 158 832 92 960 165 1088 96 1225 166 1455 82" />
            <path d="M-20 200 90 330 235 210 285 370 430 300 470 170 590 340 710 158 780 330 960 165 1010 360 1160 280 1225 166 1455 280" />
            <path d="M90 330 42 515 190 590 285 370 430 470 590 340 640 520 780 330 900 510 1010 360 1160 480 1160 280 1330 500 1455 420" />
            <path d="M42 515 160 730 320 650 430 470 510 700 640 520 760 740 900 510 1020 710 1160 480 1300 680 1455 590" />
            <path d="M160 730 310 870 510 700 650 860 760 740 920 865 1020 710 1175 860 1300 680 1455 810" />
            <path d="M338 115 285 370 430 470 320 650 510 700M832 92 780 330 900 510 760 740 920 865M1088 96 1010 360 1160 480 1020 710 1175 860" />
          </g>
          <g className="network-nodes">
            {[[112,142],[235,210],[338,115],[470,170],[570,92],[710,158],[832,92],[960,165],[1088,96],[1225,166],[90,330],[285,370],[430,300],[590,340],[780,330],[1010,360],[1160,280],[42,515],[190,590],[430,470],[640,520],[900,510],[1160,480],[1330,500],[160,730],[320,650],[510,700],[760,740],[1020,710],[1300,680],[310,870],[650,860],[920,865],[1175,860]].map(([cx, cy], i) => (
              <circle key={i} className={`network-node${i % 7 === 0 ? ' is-bright' : ''}`} cx={cx} cy={cy} r={i % 7 === 0 ? 3.5 : 2} style={{ animationDelay: `${(i % 9) * -0.42}s` }} />
            ))}
          </g>
          <g className="network-packets">
            <circle r="4" fill="url(#nodeCore)"><animateMotion dur="16s" repeatCount="indefinite" path="M-20 200 112 142 235 210 338 115 470 170 570 92 710 158 832 92 960 165 1088 96 1225 166 1455 82" /></circle>
            <circle r="3.5" fill="url(#nodeCore)"><animateMotion dur="21s" begin="-8s" repeatCount="indefinite" path="M90 330 42 515 190 590 285 370 430 470 590 340 640 520 780 330 900 510 1010 360 1160 480 1300 680" /></circle>
            <circle r="3" fill="#d9df83"><animateMotion dur="18s" begin="-5s" repeatCount="indefinite" path="M160 730 310 870 510 700 650 860 760 740 920 865 1020 710 1175 860" /></circle>
          </g>
        </svg>
        <div className="network-vignette" />
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
              <span>{isAnalyzing ? 'Vision analysis running' : 'Neural QC Engine'}</span>
            </div>
            <div className={`sys-badge${isAnalyzing ? ' analyzing' : ''}`}>
              <div className="pulse-dot" />
              <span>{isAnalyzing ? 'ANALYSIS IN PROGRESS' : 'READY FOR REVIEW'}</span>
            </div>
          </div>
        </header>

        {/* ── Navigation ── */}
        <nav className="app-nav" aria-label="Main navigation">
          {tabs.map(t => {
            const Icon = t.icon
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as any)}
                className={`nav-btn${isActive ? ' active' : ''}`}
                id={`nav-${t.id}`}
                aria-current={isActive ? 'page' : undefined}
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

        {/* ── Footer ── */}
        <footer className="app-footer" aria-label="Precision in every detail. Confidence in every review. Developed and designed by Sai Charan Bablue.">
          <div className="marquee-track">
            <div className="marquee-content" aria-hidden="true">
              <span className="marquee-tagline">Precision in every detail. Confidence in every review.</span>
              <span className="marquee-star">✦</span>
              <span className="marquee-credit">Developed and designed by <strong>SAI CHARAN BABLUE</strong></span>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
