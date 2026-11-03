import { useState } from 'react'
import { useStore } from '../lib/store'
import { loadImageFromFile } from '../lib/image'
import { Film, Plus, Trash2 } from 'lucide-react'

const MAX_REFERENCE_FRAMES = 3

export function ReferenceFramesPanel() {
  const frames = useStore((s) => s.referenceFrames)
  const setFrames = useStore((s) => s.setReferenceFrames)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadReferences = async (files: FileList | null) => {
    if (!files?.length) return
    setError('')
    setLoading(true)
    const selected = Array.from(files).slice(0, MAX_REFERENCE_FRAMES)
    try {
      const images = await Promise.all(selected.map((file) => loadImageFromFile(file)))
      const next = selected.map((file, index) => ({
        image: images[index],
        url: URL.createObjectURL(file),
        name: file.name,
      }))
      setFrames(next)
      if (files.length > MAX_REFERENCE_FRAMES) setError(`Only the first ${MAX_REFERENCE_FRAMES} reference frames were added.`)
    } catch {
      setError('One or more reference images could not be opened. Try PNG, JPG, or WEBP files.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="reference-panel" aria-labelledby="reference-panel-title">
      <div className="reference-panel-head">
        <div className="reference-panel-icon"><Film size={15} /></div>
        <div>
          <h3 id="reference-panel-title">Continuity references <span>OPTIONAL</span></h3>
          <p>Add up to 3 approved frames to compare character, costume, props, and palette.</p>
        </div>
      </div>
      <label className="reference-add">
        <input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={loading}
          onChange={(event) => { void loadReferences(event.target.files); event.currentTarget.value = '' }} />
        <Plus size={14} /> {loading ? 'Loading references…' : frames.length ? 'Replace reference frames' : 'Add reference frames'}
      </label>
      {frames.length > 0 && (
        <div className="reference-list">
          {frames.map((frame, index) => (
            <div className="reference-thumb" key={`${frame.name}-${index}`}>
              <img src={frame.url} alt={`Reference frame ${index + 1}: ${frame.name}`} />
              <span title={frame.name}>{String(index + 1).padStart(2, '0')} · {frame.name}</span>
            </div>
          ))}
          <button type="button" className="reference-clear" onClick={() => setFrames([])} aria-label="Remove all reference frames">
            <Trash2 size={13} /> Clear
          </button>
        </div>
      )}
      <p className="reference-privacy">References are sent with this review for comparison and are not added to run history.</p>
      {error && <p className="reference-error" role="status">{error}</p>}
    </section>
  )
}
