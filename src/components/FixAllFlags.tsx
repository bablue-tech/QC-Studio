import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, Cog, Copy, ListChecks, RotateCcw, Wrench } from 'lucide-react'
import { useStore } from '../lib/store'
import { generateRepairPrompt } from '../lib/llm'
import { REPAIR_SYSTEM_PROMPT, buildRepairUserText, collectRepairFlags, countVerificationGaps, parseRepairResponse } from '../lib/repair'
import { PROVIDER_DEFAULTS } from '../lib/types'
import type { QCReport, RepairFlag, RepairResult, RepairStage } from '../lib/types'

const STAGES: { id: RepairStage; label: string }[] = [
  { id: 'collect', label: 'Collecting flagged issues…' },
  { id: 'image', label: 'Preparing original image reference…' },
  { id: 'generate', label: 'Building consolidated repair instructions…' },
  { id: 'validate', label: 'Checking the repair prompt…' },
]
const STAGE_SHORT: Record<RepairStage, string> = { collect: 'Flags', image: 'Image', generate: 'Prompt', validate: 'Verify' }

// Lets React paint each real stage change before the next step starts.
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/** Runs the Fix All Flags pipeline for the report currently in the store. */
async function runFixAllFlags() {
  const { report, reportImage, repair, setRepair } = useStore.getState()
  if (repair.status === 'running') return
  if (!report) { setRepair({ status: 'error', error: 'Analyze an image first. Fix All Flags works from a completed QC report.' }); return }

  // Ignore late replies if the user opens a different report meanwhile.
  const isCurrent = () => useStore.getState().report === report
  const update = (p: Parameters<typeof setRepair>[0]) => { if (isCurrent()) setRepair(p) }

  update({ status: 'running', stage: 'collect', error: '' })
  try {
    await nextFrame()
    const flags = collectRepairFlags(report)
    if (!flags.length) throw new Error('No actionable issues detected. Your image is ready for review.')

    update({ stage: 'image' })
    await nextFrame()
    if (!reportImage || !/^data:image\/[\w.+-]+;base64,./.test(reportImage)) {
      throw new Error('The original image for this report is not available. Re-run the analysis on the image to attach it.')
    }

    update({ stage: 'generate' })
    const raw = await generateRepairPrompt(PROVIDER_DEFAULTS.gemini, reportImage, REPAIR_SYSTEM_PROMPT, buildRepairUserText(report, flags))
    if (!isCurrent()) return

    update({ stage: 'validate' })
    await nextFrame()
    const parsed = parseRepairResponse(raw, flags)
    update({ status: 'ready', stage: null, result: { ...parsed, createdAt: Date.now() }, error: '' })
  } catch (e) {
    // Any earlier result stays in place so a failed regeneration never discards it.
    update({ status: 'error', stage: null, error: e instanceof Error ? e.message : String(e) })
  }
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = value
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

const countBySeverity = (flags: RepairFlag[]) =>
  (['critical', 'high', 'medium', 'low'] as const).map((severity) => ({ severity, count: flags.filter((flag) => flag.severity === severity).length })).filter((item) => item.count)

export function FixAllFlags({ report }: { report: QCReport }) {
  const reportImage = useStore((s) => s.reportImage)
  const repair = useStore((s) => s.repair)
  const flags = useMemo(() => collectRepairFlags(report), [report])
  const gaps = useMemo(() => countVerificationGaps(report), [report])
  const gapNote = gaps > 0 && (
    <p className="repair-note subtle"><AlertTriangle size={13} /> {gaps} unverified check{gaps === 1 ? ' is' : 's are'} left out — {gaps === 1 ? 'it is a gap in the review, not a visible defect' : 'they are gaps in the review, not visible defects'}. Re-run the analysis to cover {gaps === 1 ? 'it' : 'them'}.</p>
  )
  const running = repair.status === 'running'
  const activeIndex = running && repair.stage ? STAGES.findIndex((stage) => stage.id === repair.stage) : -1
  const finished = repair.status === 'ready'
  const statusText = running
    ? STAGES[activeIndex]?.label
    : finished ? 'Repair prompt ready.'
      : repair.status === 'error' ? 'Repair stopped. Nothing was lost — you can retry.'
        : `Standing by · ${flags.length} flag${flags.length === 1 ? '' : 's'} queued for one-pass repair`

  return (
    <section className="repair-deck" aria-labelledby="repair-title">
      <div className="repair-head">
        <div>
          <span className="feature-index">04 / ONE-PASS REPAIR</span>
          <h2 id="repair-title">Fix all flags</h2>
          <p>Turn every flagged issue into one Nano Banana edit prompt, written against the original image.</p>
        </div>
        {flags.length > 0 && (
          <div className="repair-severity-row" aria-label="Flags by severity">
            {countBySeverity(flags).map(({ severity, count }) => (
              <span key={severity} className={`severity-chip ${severity}`}><b>{count}</b> {severity}</span>
            ))}
          </div>
        )}
      </div>

      {flags.length === 0 ? (
        <>
          <div className="repair-clear"><CheckCircle2 size={18} /><span>No actionable issues detected. Your image is ready for review.</span></div>
          {gapNote}
        </>
      ) : (
        <div className="repair-console">
          <button
            type="button"
            id="btn-fix-all-flags"
            className={`repair-btn${running ? ' is-running' : ''}${finished ? ' is-done' : ''}`}
            onClick={runFixAllFlags}
            disabled={running || !reportImage}
            aria-busy={running}
            aria-describedby="repair-status"
          >
            <span className="repair-gears" aria-hidden="true">
              <Cog className="gear gear-main" size={30} strokeWidth={1.6} />
              <Cog className="gear gear-small" size={17} strokeWidth={1.8} />
            </span>
            <span className="repair-btn-copy">
              <strong>{running ? 'Repairing…' : 'Fix all flags'}</strong>
              <small>{flags.length} flag{flags.length === 1 ? '' : 's'} · original image attached</small>
            </span>
            <Wrench className="repair-btn-tool" size={16} aria-hidden="true" />
          </button>

          <div className="repair-status">
            <ol className="repair-stages" aria-hidden="true">
              {STAGES.map((stage, i) => {
                const state = finished || (running && i < activeIndex) ? 'done' : i === activeIndex ? 'active' : 'pending'
                return <li key={stage.id} className={`repair-stage ${state}`}><i />{STAGE_SHORT[stage.id]}</li>
              })}
            </ol>
            <p id="repair-status" className={`repair-status-text ${repair.status}`} role="status" aria-live="polite">{statusText}</p>
          </div>

          {gapNote}
          {!reportImage && (
            <p className="repair-note"><AlertTriangle size={13} /> The original image for this report isn't stored. Re-run the analysis on this image to enable Fix All Flags.</p>
          )}
          {repair.status === 'error' && repair.error && (
            <div className="repair-error" role="alert">
              <AlertTriangle size={14} /><span>{repair.error}</span>
              {reportImage && <button type="button" onClick={runFixAllFlags}><RotateCcw size={12} /> Retry</button>}
            </div>
          )}
        </div>
      )}

      {repair.result && <RepairPromptCard result={repair.result} running={running} />}
    </section>
  )
}

function RepairPromptCard({ result, running }: { result: RepairResult; running: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [showFlags, setShowFlags] = useState(false)
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const addressed = new Set(result.addressedIds)
  const words = result.prompt.split(/\s+/).filter(Boolean).length
  const onCopy = async () => {
    const ok = await copyText(result.prompt)
    setCopy(ok ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopy('idle'), 2200)
  }

  return (
    <article className={`repair-result${running ? ' is-refreshing' : ''}`} aria-labelledby="repair-result-title">
      <header className="repair-result-head">
        <div>
          <span className="feature-index">NANO BANANA · IMAGE EDIT</span>
          <h3 id="repair-result-title">Consolidated Repair Prompt</h3>
          <p>All actionable QC flags have been translated into one image-editing instruction.</p>
        </div>
        <div className="repair-result-meta">
          <span>{addressed.size ? `${addressed.size}/${result.flags.length} flags confirmed` : `${result.flags.length} flags included`}</span>
          <span>{words} words</span>
          <span>{new Date(result.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </header>

      <div className="repair-actions">
        <button type="button" className={`repair-action primary${copy === 'copied' ? ' ok' : ''}`} onClick={onCopy}>
          {copy === 'copied' ? <Check size={13} /> : <Copy size={13} />}
          {copy === 'copied' ? 'Copied' : copy === 'failed' ? 'Copy failed' : 'Copy prompt'}
        </button>
        <button type="button" className="repair-action" onClick={runFixAllFlags} disabled={running}>
          <RotateCcw size={13} className={running ? 'spin' : undefined} /> {running ? 'Regenerating…' : 'Regenerate'}
        </button>
        <button type="button" className="repair-action" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} aria-controls="repair-prompt-text">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {expanded ? 'Collapse' : 'Expand'}
        </button>
        <button type="button" className="repair-action" onClick={() => setShowFlags((v) => !v)} aria-expanded={showFlags} aria-controls="repair-flag-list">
          <ListChecks size={13} /> {showFlags ? 'Hide included flags' : 'View included flags'}
        </button>
        <span className="sr-only" aria-live="polite">{copy === 'copied' ? 'Prompt copied to clipboard' : ''}</span>
      </div>

      {running && <p className="repair-refresh-note">Generating a new version — this prompt stays until it's ready.</p>}

      <div className={`repair-prompt${expanded ? ' expanded' : ''}`}>
        <pre id="repair-prompt-text" tabIndex={0}>{result.prompt}</pre>
      </div>

      {(result.conflicts.length > 0 || result.ambiguities.length > 0) && (
        <div className="repair-notes">
          {result.conflicts.length > 0 && <div><span>Conflicts resolved</span><ul>{result.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
          {result.ambiguities.length > 0 && <div><span>Kept conservative</span><ul>{result.ambiguities.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
        </div>
      )}

      {showFlags && (
        <ul className="repair-flag-list" id="repair-flag-list">
          {result.flags.map((flag) => (
            <li key={flag.id} className={flag.severity}>
              <span className={`severity-chip ${flag.severity}`}>{flag.severity}</span>
              <div>
                <strong>{flag.issue}</strong>
                <span>{flag.category}{flag.location ? ` · ${flag.location}` : ''}</span>
              </div>
              <em className={addressed.has(flag.id) ? 'ok' : flag.ambiguous ? 'warn' : ''}>
                {addressed.has(flag.id) ? 'Addressed' : flag.ambiguous ? 'Ambiguous' : addressed.size ? 'Not confirmed' : 'Included'}
              </em>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
