import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderPageToCanvas } from '../lib/pdfLoader'
import type { Annotation, Point, Tool } from '../types'

type PdfPageProps = {
  pdfDoc: PDFDocumentProxy
  pageIndex: number
  scale: number
  annotations: Annotation[]
  tool: Tool
  color: string
  strokeWidth: number
  fontSize: number
  pendingSignature: string | null
  onAddAnnotation: (annotation: Annotation) => void
  onPlaceSignature: (pageIndex: number, x: number, y: number) => void
  onClearPendingSignature: () => void
}

function drawStroke(
  context: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  width: number,
) {
  if (points.length < 2) return
  context.strokeStyle = color
  context.lineWidth = width
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y)
  }
  context.stroke()
}

export function PdfPage({
  pdfDoc,
  pageIndex,
  scale,
  annotations,
  tool,
  color,
  strokeWidth,
  fontSize,
  pendingSignature,
  onAddAnnotation,
  onPlaceSignature,
  onClearPendingSignature,
}: PdfPageProps) {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [textPrompt, setTextPrompt] = useState<{ x: number; y: number } | null>(null)
  const [textValue, setTextValue] = useState('')

  useEffect(() => {
    let cancelled = false

    async function render() {
      const canvas = pdfCanvasRef.current
      if (!canvas) return

      const page = await pdfDoc.getPage(pageIndex + 1)
      if (cancelled) return
      await renderPageToCanvas(page, canvas, scale)
      redrawOverlay()
    }

    render()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pageIndex, scale])

  useEffect(() => {
    redrawOverlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, currentStroke])

  const redrawOverlay = () => {
    const overlay = overlayRef.current
    const pdfCanvas = pdfCanvasRef.current
    if (!overlay || !pdfCanvas) return

    overlay.width = pdfCanvas.width
    overlay.height = pdfCanvas.height

    const context = overlay.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, overlay.width, overlay.height)

    for (const annotation of annotations) {
      if (annotation.pageIndex !== pageIndex) continue

      if (annotation.type === 'text') {
        context.fillStyle = annotation.color
        context.font = `${annotation.fontSize}px system-ui, sans-serif`
        context.fillText(annotation.text, annotation.x, annotation.y)
      } else if (annotation.type === 'stroke') {
        drawStroke(context, annotation.points, annotation.color, annotation.width)
      } else if (annotation.type === 'image') {
        const image = new Image()
        image.src = annotation.dataUrl
        image.onload = () => {
          context.drawImage(
            image,
            annotation.x,
            annotation.y,
            annotation.width,
            annotation.height,
          )
        }
      }
    }

    if (currentStroke.length > 0) {
      drawStroke(context, currentStroke, color, strokeWidth)
    }
  }

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = overlayRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(event)

    if (pendingSignature) {
      onPlaceSignature(pageIndex, point.x, point.y)
      return
    }

    if (tool === 'text') {
      setTextPrompt(point)
      setTextValue('')
      return
    }

    if (tool === 'draw') {
      overlayRef.current?.setPointerCapture(event.pointerId)
      setIsDrawing(true)
      setCurrentStroke([point])
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool !== 'draw') return
    const point = getPoint(event)
    setCurrentStroke((previous) => [...previous, point])
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool !== 'draw') return
    overlayRef.current?.releasePointerCapture(event.pointerId)
    setIsDrawing(false)

    if (currentStroke.length >= 2) {
      onAddAnnotation({
        id: crypto.randomUUID(),
        type: 'stroke',
        pageIndex,
        points: currentStroke,
        color,
        width: strokeWidth,
      })
    }
    setCurrentStroke([])
  }

  const submitText = () => {
    if (!textPrompt || !textValue.trim()) {
      setTextPrompt(null)
      return
    }

    onAddAnnotation({
      id: crypto.randomUUID(),
      type: 'text',
      pageIndex,
      x: textPrompt.x,
      y: textPrompt.y,
      text: textValue.trim(),
      fontSize,
      color,
    })
    setTextPrompt(null)
    setTextValue('')
  }

  const cursorClass = pendingSignature
    ? 'cursor-place'
    : tool === 'text'
      ? 'cursor-text'
      : tool === 'draw'
        ? 'cursor-draw'
        : 'cursor-default'

  return (
    <div className="pdf-page" ref={containerRef}>
      <canvas ref={pdfCanvasRef} className="pdf-canvas" />
      <canvas
        ref={overlayRef}
        className={`annotation-layer ${cursorClass}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      {pendingSignature && (
        <div className="placement-hint">
          Cliquez sur la page pour placer votre signature
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClearPendingSignature}>
            Annuler
          </button>
        </div>
      )}
      {textPrompt && (
        <div
          className="text-prompt"
          style={{
            left: `${(textPrompt.x / (overlayRef.current?.width ?? 1)) * 100}%`,
            top: `${(textPrompt.y / (overlayRef.current?.height ?? 1)) * 100}%`,
          }}
        >
          <input
            autoFocus
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitText()
              if (event.key === 'Escape') setTextPrompt(null)
            }}
            placeholder="Saisir du texte…"
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={submitText}>
            OK
          </button>
        </div>
      )}
    </div>
  )
}
