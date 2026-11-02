import { useStore } from '../lib/store'
import { saveAs } from 'file-saver'
import { Download, Copy, FileText, CheckCircle, AlertTriangle, XCircle, MinusCircle, Trophy } from 'lucide-react'

const statusBadge = (s: string) => {
  const map: Record<string, string> = { pass: 'badge-pass', warn: 'badge-warn', fail: 'badge-fail', na: 'badge-na' }
  const icons: Record<string, any> = {
    pass: <CheckCircle size={9} />,
    warn: <AlertTriangle size={9} />,
    fail: <XCircle size={9} />,
    na:   <MinusCircle size={9} />,
  }
  return (
    <span className={`badge ${map[s] || 'badge-na'}`}>
      {icons[s]} {s.toUpperCase()}
    </span>
  )
}

const sevClass = (s: string) => {
  const map: Record<string, string> = {
    critical: 'sev-critical',
    high: 'sev-high',
    medium: 'sev-medium',
    low: 'sev-low',
  }
  return map[s] || 'sev-low'
}

const scoreColor = (n: number) =>
  n >= 75 ? 'var(--emerald)' : n >= 50 ? 'var(--amber)' : 'var(--rose)'

const scoreBarClass = (n: number) =>
  n >= 75 ? 'high' : n >= 50 ? 'mid' : 'low'

function ScoreRing({ score }: { score: number }) {
  const color = scoreColor(score)
  const r = 42
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="score-ring-container">
      <div className="score-ring" style={{ '--ring-color': color + '66' } as any}>
        <svg width="110" height="110" viewBox="0 0 110 110">
          {/* Track */}
          <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          {/* Progress */}
          <circle
            cx="55" cy="55" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)', filter: `drop-shadow(0 0 8px ${color})` }}
          />
        </svg>
        <div className="score-ring-inner">
          <span className="score-num" style={{ color, fontFamily: 'var(--font-display)' }}>{score}</span>
          <span className="score-denom">/ 100</span>
        </div>
      </div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
        Overall Score
      </div>
    </div>
  )
}

export function ReportPanel() {
  const report    = useStore((s) => s.report)
  const imageName = useStore((s) => s.imageName)

  if (!report) return (
    <div className="empty-state">
      <div className="empty-icon">◎</div>
      <p style={{ color: 'var(--text-soft)', fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
        No Report Generated
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
        Run an analysis on the Analyze tab first
      </p>
    </div>
  )

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    saveAs(blob, `${imageName || 'qc'}_report.json`)
  }
  const exportMd = () => {
    let md = `# QC Report — ${imageName}\n\nScore: ${report.overall_score}/100\n\n${report.summary}\n\n`
    report.categories?.forEach((c: any) => {
      md += `## ${c.name} — ${c.status.toUpperCase()} (${c.score})\n`
      c.findings?.forEach((f: any) => {
        md += `- [${f.severity}] ${f.issue}${f.location ? ` (${f.location})` : ''}\n  - Fix: ${f.fix}\n`
      })
      md += '\n'
    })
    md += `## Priority Fixes\n${(report.priority_fixes || []).map((x: string) => `- ${x}`).join('\n')}\n`
    const blob = new Blob([md], { type: 'text/markdown' })
    saveAs(blob, `${imageName || 'qc'}_report.md`)
  }
  const copy = async () => { await navigator.clipboard.writeText(JSON.stringify(report, null, 2)) }

  const score = report.overall_score ?? 0

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px' }}>

      {/* ── Header Row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginBottom: 28 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            <Trophy size={11} />
            QC Analysis Report
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
            color: 'var(--text-bright)', marginBottom: 4,
          }}>
            {imageName || 'Analysis Complete'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {report.categories?.length ?? 0} categories · {(report.priority_fixes?.length ?? 0)} priority fixes
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <ScoreRing score={score} />

          {/* Export Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn-ghost" onClick={exportJson} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={11} /> Export JSON
            </button>
            <button className="btn-ghost" onClick={exportMd} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={11} /> Export MD
            </button>
            <button className="btn-ghost" onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Copy size={11} /> Copy JSON
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary Card ── */}
      <div className="card" style={{
        padding: '20px 22px', marginBottom: 24,
        background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(99,102,241,0.04))',
      }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
          Summary
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-base)', lineHeight: 1.75, margin: 0 }}>
          {report.summary}
        </p>
      </div>

      {/* ── Categories ── */}
      <div className="section-label" style={{ marginBottom: 14 }}>
        Categories · {report.categories?.length ?? 0} checked
      </div>
      <div className="report-categories" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 14, marginBottom: 24 }}>
        {report.categories?.map((c: any, i: number) => (
          <div key={i} className="card" style={{ padding: 18 }}>
            {/* Category Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-bright)', fontFamily: 'var(--font-display)' }}>
                {c.name}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: scoreColor(c.score), fontWeight: 700 }}>
                  {c.score}/100
                </span>
                {statusBadge(c.status)}
              </div>
            </div>

            {/* Score Bar */}
            <div className="score-bar" style={{ marginBottom: 14 }}>
              <div className={`score-bar-fill ${scoreBarClass(c.score)}`} style={{ width: `${c.score}%` }} />
            </div>

            {/* Findings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {c.findings?.length ? c.findings.map((f: any, j: number) => (
                <div key={j} className="finding-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span className={sevClass(f.severity)}>{f.severity}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-base)' }}>{f.issue}</span>
                  </div>
                  {f.location && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 5 }}>
                      ⌖ {f.location}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                    <span style={{ color: 'var(--neon)', marginRight: 5 }}>→</span>{f.fix}
                  </div>
                </div>
              )) : (
                <div style={{ fontSize: 12, color: 'var(--emerald)', fontFamily: 'var(--font-mono)', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={12} /> No issues detected
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Priority Fixes ── */}
      {report.priority_fixes?.length > 0 && (
        <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 14 }}>
            <AlertTriangle size={11} color="var(--amber)" />
            <span style={{ color: 'var(--amber)' }}>Priority Fixes</span>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {report.priority_fixes.map((x: string, i: number) => (
              <li key={i} style={{ fontSize: 13.5, color: 'var(--text-base)', lineHeight: 1.65 }}>
                <span style={{ color: 'var(--amber)', marginRight: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  #{String(i + 1).padStart(2, '0')}
                </span>
                {x}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Extra Observations ── */}
      {report.extra_observations?.length > 0 && (
        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="section-label" style={{ marginBottom: 14 }}>Additional Observations</div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.extra_observations.map((x: string, i: number) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--text-soft)', display: 'flex', gap: 10 }}>
                <span style={{ color: 'var(--azure)', flexShrink: 0, marginTop: 1 }}>◈</span>
                {x}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
