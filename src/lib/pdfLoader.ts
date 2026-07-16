import * as pdfjs from 'pdfjs-dist'
import { cloneArrayBuffer } from './cloneArrayBuffer'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export async function loadPdfDocument(data: ArrayBuffer) {
  const loadingTask = pdfjs.getDocument({ data: cloneArrayBuffer(data) })
  return loadingTask.promise
}

export async function renderPageToCanvas(
  page: pdfjs.PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
) {
  const viewport = page.getViewport({ scale })
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Impossible d\'obtenir le contexte canvas')
  }

  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
  }).promise

  return {
    width: viewport.width,
    height: viewport.height,
  }
}
