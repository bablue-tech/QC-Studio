import { useStore } from '../lib/store'
import { saveAs } from 'file-saver'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, CircleHelp,
  Download, FileText, ShieldAlert, Sparkles, Target, Trophy, XCircle,
} from 'lucide-react'

const scoreColor = (score: number) => score >= 80 ? 'var(--good)' : score >= 60 ? 'var(--watch)' : 'var(--alert)'
const scoreBand = (score: number) => score >= 80 ? 'strong' : score >= 60 ? 'review' : 'urgent'

function ScoreRing({ score }: { score: number }) {
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  return (
    <div className="visual-score-wrap" aria-label={`Overall QC score ${score} out of 100`}>
      <svg className="visual-score-ring" viewBox="0 0 148 148" role="img" aria-hidden="true">
        <circle className="visual-score-track" cx="74" cy="74" r={radius} />
        <circle className="visual-score-progress" cx="74" cy="74" r={radius}
          style={{ strokeDasharray: circumference, strokeDashoffset: offset, stroke: scoreColor(score) }} />
      </svg>
      <div className="visual-score-center">
        <strong>{score}</strong>
        <span>QUALITY INDEX</span>
      </div>
    </div>
  )
}

function QualityRadar({ categories }: { categories: any[] }) {
  const items = categories.slice(0, 8)
  if (items.length < 3) return (
    <div className="radar-empty"><Activity size={18} /><span>More categories are needed to map a quality profile.</span></div>
  )
  const center = 120
  const radius = 85
  const point = (i: number, value: number) => {
    const angle = i / items.length * Math.PI * 2 - Math.PI / 2
    const r = radius * Math.max(0, Math.min(100, Number(value) || 0)) / 100
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`
  }
  const axisPoint = (i: number) => {
    const angle = i / items.length * Math.PI * 2 - Math.PI / 2
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`
  }

  return (
    <div className="radar-wrap">
      <svg className="quality-radar" viewBox="0 0 240 240" role="img" aria-label="Radar chart showing QC category scores">
        {[20, 40, 60, 80, 100].map(level => (
          <polygon key={level} className="radar-grid" points={items.map((_, i) => axisPoint(i).split(',').map(n => center + (Number(n) - center) * level / 100).join(',')).join(' ')} />
        ))}
        {items.map((_, i) => <line key={`axis-${i}`} className="radar-axis" x1={center} y1={center} x2={axisPoint(i).split(',')[0]} y2={axisPoint(i).split(',')[1]} />)}
        <polygon className="radar-area" points={items.map((item, i) => point(i, item.score)).join(' ')} />
        {items.map((item, i) => {
          const [cx, cy] = point(i, item.score).split(',')
          return <circle key={`point-${i}`} className="radar-point" cx={cx} cy={cy} r="3.2" />
        })}
      </svg>
      <div className="radar-caption"><span className="radar-caption-dot" /> Category score <span>·</span> outer edge = 100</div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const state = ['pass', 'warn', 'fail', 'na'].includes(status) ? status : 'na'
  const Icon = state === 'pass' ? CheckCircle2 : state === 'fail' ? XCircle : state === 'warn' ? AlertTriangle : CircleHelp
  return <span className={`visual-status ${state}`}><Icon size={13} /> {state === 'na' ? 'NOT VISIBLE' : state.toUpperCase()}</span>
}

export function ReportPanel() {
  const report = useStore((s) => s.report)
  const imageName = useStore((s) => s.imageName)

  if (!report) return (
    <div className="empty-state">
      <div className="empty-icon"><Activity size={34} /></div>
      <p className="empty-state-title">Your visual report will appear here</p>
      <p className="empty-state-copy">Upload a character image and start a QC review.</p>
    </div>
  )

  const categories = Array.isArray(report.categories) ? report.categories : []
  const score = Math.max(0, Math.min(100, Number(report.overall_score) || 0))
  const passed = categories.filter((category: any) => category.status === 'pass').length
  const attention = categories.filter((category: any) => category.status === 'warn' || category.status === 'fail').length
  const critical = categories.reduce((total: number, category: any) => total + (Array.isArray(category.findings) ? category.findings.filter((finding: any) => finding.severity === 'critical').length : 0), 0)
  const firstAttention = categories.findIndex((category: any) => category.status === 'warn' || category.status === 'fail')
  const decision = report.decision || (critical || categories.some((category: any) => category.status === 'fail') ? 'hold' : attention ? 'review' : 'ready')
  const production = report.production_context || {}

  const exportJson = () => saveAs(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `${imageName || 'qc'}_report.json`)
  const exportMd = () => {
    let md = `# QC Review — ${imageName || 'Image'}\n\nDecision: ${decision.toUpperCase()}\nScore: ${score}/100\n\n${report.summary || ''}\n\n`
    md += `## Shot Context\n- Shot type: ${production.shot_type || 'Not classified'}\n- Viewpoint: ${production.viewpoint || 'Not classified'}\n- Visual style: ${production.visual_style || 'Not classified'}\n- Visible coverage: ${Array.isArray(production.coverage_notes) ? production.coverage_notes.join('; ') : production.coverage_notes || 'Not described'}\n- Reference comparison: ${production.reference_comparison || 'Not supplied'}\n\n`
    categories.forEach((category: any) => {
      md += `## ${category.name} — ${(category.status || 'na').toUpperCase()} (${category.score ?? 0})\n`
      if (category.domain) md += `Domain: ${category.domain}\n`
      if (category.assessment) md += `Assessment: ${category.assessment}\n`
      if (category.textile_path_coverage) md += `Textile path coverage: ${category.textile_path_coverage}\n`
      ;(category.continuity_traces || []).forEach((trace: any) => {
        md += `- Textile trace (${trace.result || 'unverified'}): ${trace.garment_segment || 'Garment'} — ${trace.path || 'path not specified'}\n  - Observed: ${trace.observed_design || 'Not described'}\n  - Transitions: ${(trace.transitions_checked || []).join('; ') || 'None listed'}\n  - Evidence: ${trace.evidence || 'Not recorded'}\n`
      })
      ;(category.findings || []).forEach((finding: any) => {
        md += `- [${finding.severity || 'note'}] ${finding.issue || ''}${finding.location ? ` (${finding.location})` : ''}${Number.isFinite(Number(finding.confidence)) ? ` — confidence ${Math.round(Number(finding.confidence) * 100)}%` : ''}\n  - Evidence: ${finding.evidence || 'Not recorded'}\n  - Fix: ${finding.fix || 'Review manually'}\n`
      })
      md += '\n'
    })
    md += `## Priority Fixes\n${(report.priority_fixes || []).map((fix: string) => `- ${fix}`).join('\n')}\n`
    saveAs(new Blob([md], { type: 'text/markdown' }), `${imageName || 'qc'}_report.md`)
  }
  const copyJson = async () => { await navigator.clipboard.writeText(JSON.stringify(report, null, 2)) }

  return (
    <div className="report-visualizer">
      <header className="report-heading">
        <div>
          <div className="report-kicker"><span className="kicker-orbit"><Sparkles size={13} /></span> CHARACTER QUALITY INTELLIGENCE</div>
          <h1>{imageName || 'Visual QC report'}</h1>
          <p>{report.summary}</p>
        </div>
        <div className="report-actions">
          <button className="btn-ghost" onClick={exportMd}><FileText size={14} /> Export report</button>
          <button className="btn-ghost" onClick={exportJson}><Download size={14} /> Export data</button>
          <button className="btn-ghost" onClick={copyJson}><FileText size={14} /> Copy data</button>
        </div>
      </header>

      <section className="report-overview">
        <article className={`score-feature ${scoreBand(score)}`}>
          <div className="feature-orbit feature-orbit-one" />
          <div className="feature-orbit feature-orbit-two" />
          <div className="score-feature-copy">
            <span className="feature-index">01 / OVERALL READ</span>
            <span className={`decision-badge ${decision}`}><i /> {decision === 'ready' ? 'READY FOR REVIEW' : decision === 'hold' ? 'HOLD FOR FIXES' : 'REVIEW REQUIRED'}</span>
            <h2>{decision === 'ready' ? 'Ready for review' : decision === 'hold' ? 'Hold this frame' : 'Review before approval'}</h2>
            <p>{attention ? `${attention} of ${categories.length} checks need attention.` : 'No significant defects were flagged in the visible details. Confirm shot-level requirements before approval.'}</p>
            <div className="score-feature-meta"><span><i className="live-dot" /> STILL FRAME QC</span><span>{categories.length} DOMAINS</span></div>
          </div>
          <ScoreRing score={score} />
        </article>

        <article className="visual-card radar-card">
          <div className="visual-card-head"><div><span className="feature-index">02 / CATEGORY MAP</span><h3>Quality profile</h3></div><Target size={18} /></div>
          <QualityRadar categories={categories} />
        </article>
      </section>

      <section className="production-context-card">
        <div className="production-context-heading"><span className="feature-index">SHOT CONTEXT</span>{report.source_reference_names?.length ? <span>{report.source_reference_names.length} REFERENCE FRAME{report.source_reference_names.length === 1 ? '' : 'S'}</span> : <span>SINGLE FRAME REVIEW</span>}</div>
        <div className="production-context-grid">
          <div><span>Shot type</span><strong>{production.shot_type || 'Not classified'}</strong></div>
          <div><span>Viewpoint</span><strong>{production.viewpoint || 'Not classified'}</strong></div>
          <div><span>Visual style</span><strong>{production.visual_style || 'Not classified'}</strong></div>
        </div>
        <p>{Array.isArray(production.coverage_notes) && production.coverage_notes.length ? production.coverage_notes.join(' · ') : production.coverage_notes || 'Findings apply only to details visible in this frame. Occluded or cropped areas are marked not visible.'}</p>
        {report.source_reference_names?.length > 0 && <p className="reference-source-line">Compared with: {report.source_reference_names.join(', ')}</p>}
        {production.reference_comparison && <p className="reference-source-line">Reference result: {production.reference_comparison}</p>}
      </section>

      <section className="signal-strip" aria-label="Quality check totals">
        <article className="signal-tile"><span className="signal-icon good"><CheckCircle2 size={16} /></span><div><strong>{passed}</strong><span>Clear checks</span></div><span className="signal-mark">01</span></article>
        <article className="signal-tile"><span className="signal-icon watch"><Activity size={16} /></span><div><strong>{attention}</strong><span>Need review</span></div><span className="signal-mark">02</span></article>
        <article className="signal-tile"><span className="signal-icon alert"><ShieldAlert size={16} /></span><div><strong>{critical}</strong><span>Critical findings</span></div><span className="signal-mark">03</span></article>
        <article className="signal-tile"><span className="signal-icon neutral"><Trophy size={16} /></span><div><strong>{categories.length}</strong><span>Categories scanned</span></div><span className="signal-mark">04</span></article>
      </section>

      {report.priority_fixes?.length > 0 && (
        <section className="priority-deck">
          <div className="priority-head"><div><span className="feature-index">03 / RECOMMENDED NEXT</span><h2>Fix these first</h2></div><span className="priority-count">{String(report.priority_fixes.length).padStart(2, '0')} ACTIONS</span></div>
          <div className="priority-grid">
            {report.priority_fixes.map((fix: string, i: number) => (
              <article className="priority-item" key={i} style={{ animationDelay: `${i * 90}ms` }}>
                <span className="priority-number">{String(i + 1).padStart(2, '0')}</span><p>{fix}</p><ArrowUpRight size={15} />
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="category-section">
        <div className="category-section-head"><div><span className="feature-index">04 / DETAIL SCAN</span><h2>Craft &amp; consistency</h2><p>Open a signal to inspect the visual evidence and suggested fix.</p></div><span className="scan-stamp"><Activity size={12} /> {categories.length} VISUAL SIGNALS</span></div>
        <div className="visual-category-list">
          {categories.map((category: any, i: number) => {
            const value = Math.max(0, Math.min(100, Number(category.score) || 0))
            const findings = Array.isArray(category.findings) ? category.findings : []
            const impact = findings.some((finding: any) => finding.severity === 'critical' || finding.severity === 'high')
            return (
              <details className={`visual-category ${category.status || 'na'}`} key={`${category.name}-${i}`} open={i === firstAttention} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                <summary>
                  <span className="category-index">{String(i + 1).padStart(2, '0')}</span>
                  <span className="category-main"><strong>{category.name}</strong><span>{category.domain ? `${category.domain} · ` : ''}{findings.length ? `${findings.length} finding${findings.length === 1 ? '' : 's'}${impact ? ' · high impact' : ''}` : category.status === 'na' ? 'Not visible or not assessed' : 'No visible defect flagged'}</span></span>
                  <span className="category-meter"><span style={{ width: `${value}%`, background: scoreColor(value) }} /></span>
                  <span className="category-score" style={{ color: scoreColor(value) }}>{value}<small>/100</small></span>
                  <StatusPill status={category.status || 'na'} />
                  <ArrowDownRight className="category-chevron" size={16} />
                </summary>
                <div className="category-detail">
                  {category.assessment && <p className="category-assessment"><span>INSPECTION NOTE</span>{category.assessment}</p>}
                  {category.continuity_traces?.length > 0 && (
                    <div className="textile-trace-list">
                      <div className="textile-trace-heading"><span>TEXTILE PATH TRACE</span><b>{category.textile_path_coverage === 'all_visible_paths' ? 'ALL VISIBLE PATHS COVERED' : 'PARTIAL COVERAGE'}</b></div>
                      {category.continuity_traces.map((trace: any, traceIndex: number) => (
                        <article className={`textile-trace ${trace.result || 'unverified'}`} key={traceIndex}>
                          <div><strong>{trace.garment_segment || 'Garment segment'}</strong><span>{(trace.result || 'unverified').replace('_', ' ').toUpperCase()}</span></div>
                          <p><b>Path</b> {trace.path || 'Not specified'}</p>
                          <p><b>Observed design</b> {trace.observed_design || 'Not described'}</p>
                          <p><b>Transitions checked</b> {(trace.transitions_checked || []).join(' · ') || 'None listed'}</p>
                          {trace.evidence && <p><b>Evidence</b> {trace.evidence}</p>}
                        </article>
                      ))}
                    </div>
                  )}
                  {findings.length ? findings.map((finding: any, j: number) => (
                    <article className={`visual-finding ${finding.severity || 'low'}`} key={j}>
                      <div className="finding-topline"><span className={`finding-severity ${finding.severity || 'low'}`}>{(finding.severity || 'note').toUpperCase()}</span>{finding.location && <span className="finding-location">{finding.location}</span>}</div>
                      <h4>{finding.issue}</h4>
                      {finding.evidence && <p className="finding-evidence"><strong>Evidence</strong>{finding.evidence}</p>}
                      {Number.isFinite(Number(finding.confidence)) && <span className="finding-confidence">MODEL CONFIDENCE {Math.round(Number(finding.confidence) * 100)}%</span>}
                      <p><ArrowUpRight size={13} /> {finding.fix || 'Review this detail at full resolution.'}</p>
                    </article>
                  )) : (
                    <div className="all-clear"><CheckCircle2 size={17} /><span>Nothing visibly inconsistent in this category.</span></div>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      </section>

      {report.extra_observations?.length > 0 && (
        <section className="observation-rail"><Sparkles size={15} /><div><span className="feature-index">ADDITIONAL SIGNALS</span><p>{report.extra_observations.join('  ·  ')}</p></div></section>
      )}
    </div>
  )
}

