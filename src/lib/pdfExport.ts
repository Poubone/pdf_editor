import { PDFDocument, rgb } from 'pdf-lib'
import { cloneArrayBuffer } from './cloneArrayBuffer'
import type { Annotation, StrokeAnnotation } from '../types'

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized, 16)
  return rgb(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  )
}

function getStrokeBounds(stroke: StrokeAnnotation) {
  const xs = stroke.points.map((point) => point.x)
  const ys = stroke.points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const padding = stroke.width

  return {
    minX: minX - padding,
    minY: minY - padding,
    width: Math.max(maxX - minX + padding * 2, 1),
    height: Math.max(maxY - minY + padding * 2, 1),
  }
}

async function strokeToPng(stroke: StrokeAnnotation): Promise<Uint8Array> {
  const bounds = getStrokeBounds(stroke)
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(bounds.width)
  canvas.height = Math.ceil(bounds.height)

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Impossible de créer le canvas d\'export')
  }

  context.strokeStyle = stroke.color
  context.lineWidth = stroke.width
  context.lineCap = 'round'
  context.lineJoin = 'round'

  const points = stroke.points
  if (points.length === 0) {
    return new Uint8Array()
  }

  context.beginPath()
  context.moveTo(points[0].x - bounds.minX, points[0].y - bounds.minY)
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x - bounds.minX, points[index].y - bounds.minY)
  }
  context.stroke()

  const dataUrl = canvas.toDataURL('image/png')
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export async function exportPdfWithAnnotations(
  pdfBytes: ArrayBuffer,
  annotations: Annotation[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(cloneArrayBuffer(pdfBytes))
  const pages = pdfDoc.getPages()

  for (const annotation of annotations) {
    const page = pages[annotation.pageIndex]
    if (!page) continue

    const { height: pageHeight } = page.getSize()

    if (annotation.type === 'text') {
      page.drawText(annotation.text, {
        x: annotation.x,
        y: pageHeight - annotation.y,
        size: annotation.fontSize,
        color: hexToRgb(annotation.color),
      })
      continue
    }

    if (annotation.type === 'stroke') {
      if (annotation.points.length < 2) continue
      const bounds = getStrokeBounds(annotation)
      const pngBytes = await strokeToPng(annotation)
      if (pngBytes.length === 0) continue

      const image = await pdfDoc.embedPng(pngBytes)
      page.drawImage(image, {
        x: bounds.minX,
        y: pageHeight - bounds.minY - bounds.height,
        width: bounds.width,
        height: bounds.height,
      })
      continue
    }

    if (annotation.type === 'image') {
      const imageBytes = await fetch(annotation.dataUrl).then((response) =>
        response.arrayBuffer(),
      )
      const image = await pdfDoc.embedPng(imageBytes)
      page.drawImage(image, {
        x: annotation.x,
        y: pageHeight - annotation.y - annotation.height,
        width: annotation.width,
        height: annotation.height,
      })
    }
  }

  return pdfDoc.save()
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes)
  const blob = new Blob([copy], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
