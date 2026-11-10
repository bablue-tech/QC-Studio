import { useStore } from '../lib/store'
import { saveAs } from 'file-saver'
import { Trash2, ExternalLink, Download, Clock, Archive } from 'lucide-react'

export function HistoryPanel() {
  const history       = useStore((s) => s.history)
  const removeHistory = useStore((s) => s.removeHistory)
  const clearHistory  = useStore((s) => s.clearHistory)
  const setReport     = useStore((s) => s.setReport)
  const setTab        = useStore((s) => s.setTab)

  if (!history.length) return (
    <div className="empty-state">
      <div className="empty-icon">⟁</div>
      <p style={{ color: 'var(--text-soft)', fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
        No Analysis History
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
        Completed runs will appear here
      </p>
    </div>
  )

  const scoreColor = (n: number) => n >= 75 ? 'var(--emerald)' : n >= 50 ? 'var(--amber)' : 'var(--rose)'
  const scoreBarClass = (n: number) => n >= 75 ? 'high' : n >= 50 ? 'mid' : 'low'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>
            <Archive size={11} />
            Run History
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--text-bright)' }}>
            {history.length} Analysis Record{history.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn-danger" onClick={clearHistory} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trash2 size={11} /> Clear All
        </button>
      </div>

      {/* Grid */}
      <div className="history-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {history.map((h) => {
          const score = h.report?.overall_score ?? 0
          return (
            <div key={h.id} className="history-card">
              <div style={{ display: 'flex', gap: 0 }}>
                {/* Thumbnail */}
                <div style={{ width: 100, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={h.thumbnail}
                    alt={h.imageName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 120 }}
                  />
                  {/* Score overlay */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '6px 8px',
                    background: 'linear-gradient(to top, rgba(9,9,9,0.95), transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{
                      fontSize: 15, fontWeight: 900,
                      color: scoreColor(score),
                      fontFamily: 'var(--font-display)',
                      textShadow: `0 0 12px ${scoreColor(score)}`,
                    }}>
                      {score}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>
                  <div style={{
                    fontSize: 13.5, fontWeight: 700, fontFamily: 'var(--font-display)',
                    color: 'var(--text-bright)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: 5,
                  }}>
                    {h.imageName}
                  </div>

                  <div style={{
                    fontSize: 10.5, color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)', marginBottom: 10,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <Clock size={9} />
                    {new Date(h.createdAt).toLocaleString()}
                  </div>

                  {/* Score bar */}
                  <div className="score-bar" style={{ marginBottom: 12 }}>
                    <div className={`score-bar-fill ${scoreBarClass(score)}`} style={{ width: `${score}%` }} />
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: 11, padding: '5px 10px', gap: 4 }}
                      onClick={() => { setReport(h.report, h.thumbnail || null); setTab('report') }}
                    >
                      <ExternalLink size={10} /> Open
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(h.report, null, 2)], { type: 'application/json' })
                        saveAs(blob, `${h.imageName}_report.json`)
                      }}
                    >
                      <Download size={10} /> Export
                    </button>
                    <button
                      className="btn-danger"
                      style={{ fontSize: 11, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
                      onClick={() => removeHistory(h.id)}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
