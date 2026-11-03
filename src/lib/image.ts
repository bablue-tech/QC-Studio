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

/** Creates a secondary, full-width crop to give vision models more attention on visible garment transitions. */
export function createGarmentDetailImage(img: HTMLImageElement, maxSide = 2048, quality = 0.92): string | null {
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (height < 1200 || height < width * 1.12) return null

  const top = Math.round(height * 0.14)
  const cropHeight = Math.round(height * 0.83)
  const scale = Math.min(1, maxSide / Math.max(width, cropHeight))
  const cropWidth = Math.max(1, Math.round(width * scale))
  const outputHeight = Math.max(1, Math.round(cropHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cropWidth
  canvas.height = outputHeight
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(img, 0, top, width, cropHeight, 0, 0, cropWidth, outputHeight)
  return canvas.toDataURL('image/jpeg', quality)
}

/** Creates a magnified torso/waist textile transition crop from the same target frame. */
export function createTextileTransitionImage(img: HTMLImageElement, maxSide = 2048, quality = 0.94): string | null {
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (Math.min(width, height) < 720) return null

  const portrait = height > width * 1.08
  const cropWidth = Math.round(width * (portrait ? 0.72 : 0.68))
  const cropHeight = Math.round(height * (portrait ? 0.50 : 0.72))
  const left = Math.round((width - cropWidth) / 2)
  const top = portrait ? Math.round(height * 0.25) : Math.round((height - cropHeight) / 2)
  const scale = Math.min(2.5, maxSide / Math.max(cropWidth, cropHeight))
  const outputWidth = Math.max(1, Math.round(cropWidth * scale))
  const outputHeight = Math.max(1, Math.round(cropHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(img, left, top, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight)
  return canvas.toDataURL('image/jpeg', quality)
}

export function dataUrlToBase64(dataUrl: string): { mediaType: string; base64: string } {
  const m = dataUrl.match(/^data:(.*?);base64,(.*)$/)
  if (!m) throw new Error('bad data url')
  return { mediaType: m[1], base64: m[2] }
}
