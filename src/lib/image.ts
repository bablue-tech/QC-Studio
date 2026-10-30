export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

export async function resizeImage(img: HTMLImageElement, maxSide = 1280, quality = 0.85): Promise<{ dataUrl: string; width: number; height: number }> {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const scale = Math.min(1, maxSide / Math.max(iw, ih))
  const w = Math.round(iw * scale)
  const h = Math.round(ih * scale)
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const dataUrl = c.toDataURL('image/jpeg', quality)
  return { dataUrl, width: w, height: h }
}

export function dataUrlToBase64(dataUrl: string): { mediaType: string; base64: string } {
  const m = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!m) throw new Error('bad data url')
  return { mediaType: m[1], base64: m[2] }
}
