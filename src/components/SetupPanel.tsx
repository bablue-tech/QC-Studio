import { useStore } from '../lib/store'
import { DEFAULT_CHECKS } from '../lib/types'
import { Settings, Cpu, ToggleLeft, ToggleRight, Plus, X, ShieldCheck, Sliders, Brain } from 'lucide-react'
import { useState } from 'react'

export function SetupPanel() {
  const settings    = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const [customCheck, setCustomCheck] = useState('')

  const addCustom = () => {
    const v = customCheck.trim()
    if (v && !settings.checks.includes(v)) {
      setSettings({ checks: [...settings.checks, v] })
      setCustomCheck('')
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 28px' }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-label" style={{ marginBottom: 10 }}>
          <Settings size={11} />
          Configuration
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--text-bright)', marginBottom: 6 }}>
          QC Engine Settings
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
          Customize the quality control checks and analysis parameters.
        </div>
      </div>

      {/* ── Engine Status Card ── */}
      <div className="setup-section" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.15))',
              border: '1px solid rgba(59,130,246,0.35)',
              borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(59,130,246,0.2)',
            }}>
              <Brain size={22} color="var(--azure)" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 3 }}>
                Neural Vision Engine
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-soft)', fontFamily: 'var(--font-mono)' }}>
                OpenRouter Free Vision · Image-capable · Server-side key
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flex: 'row', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 14px',
              borderRadius: 20,
              background: 'var(--emerald-dim)',
              border: '1px solid rgba(16,185,129,0.22)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              color: 'var(--emerald)',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--emerald)',
                boxShadow: '0 0 8px var(--emerald)',
                animation: 'pulseDot 2.5s ease-in-out infinite',
              }} />
              ACTIVE
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 14px',
              borderRadius: 20,
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              color: 'var(--azure)',
            }}>
              <ShieldCheck size={11} />
              PRE-CONFIGURED
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 16,
          padding: '14px 16px',
          borderRadius: 10,
          background: 'rgba(16,185,129,0.04)',
          border: '1px solid rgba(16,185,129,0.12)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 12.5,
          color: 'var(--text-soft)',
        }}>
          <ShieldCheck size={13} color="var(--emerald)" style={{ flexShrink: 0 }} />
          <span>
            Your OpenRouter credential is read by the server from <code>OPENROUTER_API_KEY</code>. It is never sent to or stored in this browser.
          </span>
        </div>
      </div>

      {/* ── Analysis Parameters ── */}
      <div className="setup-section" style={{ marginBottom: 24 }}>
        <div className="section-label" style={{ marginBottom: 18 }}>
          <Sliders size={11} />
          Analysis Parameters
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <label className="form-label">
              Analysis Depth
              <span style={{ color: 'var(--azure)', marginLeft: 8, fontWeight: 700 }}>{settings.temperature}</span>
            </label>
            <input
              type="range" min={0} max={1} step={0.05}
              value={settings.temperature}
              onChange={(e) => setSettings({ temperature: +e.target.value })}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--electric)' }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', marginTop: 5,
            }}>
              <span>Precise</span><span>Creative</span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-soft)', marginTop: 8 }}>
              Lower values yield more deterministic, repeatable analysis results.
            </p>
          </div>

          <div>
            <label className="form-label">Response Length</label>
            <input
              id="input-max-tokens"
              type="number"
              value={settings.maxTokens}
              onChange={(e) => setSettings({ maxTokens: +e.target.value })}
              className="form-input mono"
              style={{ marginTop: 8 }}
            />
            <p style={{ fontSize: 11.5, color: 'var(--text-soft)', marginTop: 8 }}>
              Maximum token count for the AI response. Higher values allow more detailed reports.
            </p>
          </div>
        </div>
      </div>

      {/* ── QC Checks ── */}
      <div className="setup-section">
        <div className="section-label" style={{ marginBottom: 18 }}>
          <Cpu size={11} />
          QC Check Matrix
          <span style={{ color: 'var(--azure)', fontWeight: 700 }}>{settings.checks.length} active</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {DEFAULT_CHECKS.map((c) => {
            const on = settings.checks.includes(c)
            return (
              <label key={c} className={`check-tag${on ? ' on' : ''}`} id={`check-${c.slice(0, 10).replace(/\s/g, '-')}`}>
                {on
                  ? <ToggleRight size={13} color="var(--azure)" />
                  : <ToggleLeft size={13} color="var(--text-muted)" />
                }
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    const next = on ? settings.checks.filter(x => x !== c) : [...settings.checks, c]
                    setSettings({ checks: next })
                  }}
                  style={{ display: 'none' }}
                />
                {c}
              </label>
            )
          })}

          {/* Custom checks */}
          {settings.checks.filter(c => !DEFAULT_CHECKS.includes(c)).map((c) => (
            <span key={c} className="check-tag on" style={{ paddingRight: 6 }}>
              <ToggleRight size={13} color="var(--azure)" />
              {c}
              <button
                onClick={() => setSettings({ checks: settings.checks.filter(x => x !== c) })}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--rose)', padding: '0 0 0 6px',
                  display: 'flex', alignItems: 'center',
                  transition: 'opacity 0.15s',
                }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>

        {/* Add custom check */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={customCheck}
            onChange={(e) => setCustomCheck(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
            className="form-input"
            placeholder="Add custom QC check criteria…"
            style={{ fontSize: 13 }}
          />
          <button
            className="btn-secondary"
            onClick={addCustom}
            style={{ flexShrink: 0, padding: '10px 16px' }}
          >
            <Plus size={13} />
          </button>
        </div>

        <div style={{
          marginTop: 16, padding: '12px 14px',
          borderRadius: 8,
          background: 'rgba(59,130,246,0.04)',
          border: '1px solid var(--border-subtle)',
          fontSize: 12, color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          ◈ Enable or disable checks to focus the AI analysis on what matters most for your workflow.
        </div>
      </div>
    </div>
  )
}
