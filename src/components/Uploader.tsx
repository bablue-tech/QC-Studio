import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { loadImageFromFile } from '../lib/image'
import { useStore } from '../lib/store'
import { Upload, ImagePlus, AlertCircle } from 'lucide-react'

export function Uploader() {
  const setImage = useStore((s) => s.setImage)
  const [err, setErr] = useState('')

  const onDrop = async (files: File[]) => {
    const f = files[0]; if (!f) return
    setErr('')
    try {
      const img = await loadImageFromFile(f)
      setImage(img, URL.createObjectURL(f), f.name)
    } catch (e) { setErr(String(e)) }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={`drop-zone${isDragActive ? ' active' : ''}`}
        id="drop-zone"
      >
        <input {...getInputProps()} />

        <div className="drop-icon">
          {isDragActive
            ? <ImagePlus size={32} color="var(--azure)" />
            : <Upload size={32} color="var(--azure)" />
          }
        </div>

        <p style={{
          fontSize: 18,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--text-bright)',
          marginBottom: 8,
          position: 'relative', zIndex: 1,
        }}>
          {isDragActive ? 'Release to add image' : 'Drop an image to begin'}
        </p>
        <p style={{
          fontSize: 13,
          color: 'var(--text-soft)',
          marginBottom: 24,
          position: 'relative', zIndex: 1,
        }}>
          PNG, JPG, or WEBP · Your image is sent to the selected vision service for review
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          {['Symmetry Check', 'Attire QC', 'Jewellery Match', 'Anatomy Scan', 'Color Fidelity'].map(tag => (
            <span key={tag} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11,
              background: 'var(--electric-dim)',
              border: '1px solid var(--border-soft)',
              color: 'var(--azure)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: 0.5,
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {err && (
        <div style={{
          marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 10,
          background: 'rgba(244,63,66,0.06)',
          border: '1px solid rgba(244,63,66,0.2)',
          color: '#fb7173', fontSize: 13,
          fontFamily: 'var(--font-mono)',
        }}>
          <AlertCircle size={14} />
          {err}
        </div>
      )}
    </div>
  )
}
