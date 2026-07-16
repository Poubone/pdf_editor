import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  applyMove,
  applyResize,
  getAnnotationBounds,
  hitTestAnnotation,
  type ResizeHandle,
} from '../lib/annotationBounds'
import { canvasLengthToPdf, canvasToPdf, pdfLengthToCanvas, pdfToCanvas } from '../lib/coordinates'
import { renderPageToCanvas } from '../lib/pdfLoader'
import type { Annotation, Point, Tool } from '../types'
import { SelectionOverlay } from './SelectionOverlay'

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
  selectedId: string | null
  onSelectId: (id: string | null) => void
  onAddAnnotation: (annotation: Annotation) => void
  onUpdateAnnotations: (annotations: Annotation[]) => void
  onCommitAnnotations: (annotations: Annotation[]) => void
  onPlaceSignature: (pageIndex: number, x: number, y: number, renderScale: number) => void
  onClearPendingSignature: () => void
}

type DragState = {
  id: string
  mode: 'move' | ResizeHandle
  startPoint: Point
  startAnnotations: Annotation[]
}

const imageCache = new Map<string, HTMLImageElement>()

function getCachedImage(dataUrl: string): HTMLImageElement {
  const cached = imageCache.get(dataUrl)
  if (cached) return cached
  const image = new Image()
  image.src = dataUrl
  imageCache.set(dataUrl, image)
  return image
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
  selectedId,
  onSelectId,
  onAddAnnotation,
  onUpdateAnnotations,
  onCommitAnnotations,
  onPlaceSignature,
  onClearPendingSignature,
}: PdfPageProps) {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const measureContextRef = useRef<CanvasRenderingContext2D | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pageMetrics, setPageMetrics] = useState({ width: 0, height: 0, renderScale: 1 })
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [textPrompt, setTextPrompt] = useState<{ x: number; y: number } | null>(null)
  const [textValue, setTextValue] = useState('')
  const [dragState, setDragState] = useState<DragState | null>(null)
  const annotationsRef = useRef(annotations)

  useEffect(() => {
    annotationsRef.current = annotations
  }, [annotations])

  useEffect(() => {
    const canvas = document.createElement('canvas')
    measureContextRef.current = canvas.getContext('2d')
  }, [])

  useEffect(() => {
    let cancelled = false

    async function render() {
      const canvas = pdfCanvasRef.current
      if (!canvas) return

      const page = await pdfDoc.getPage(pageIndex + 1)
      if (cancelled) return
      const dimensions = await renderPageToCanvas(page, canvas, scale)
      setPageMetrics({
        width: dimensions.width,
        height: dimensions.height,
        renderScale: dimensions.scale,
      })
      redrawOverlay(dimensions.scale)
    }

    render()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pageIndex, scale])

  useEffect(() => {
    redrawOverlay(pageMetrics.renderScale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, currentStroke, selectedId, pageMetrics.renderScale])

  const redrawOverlay = (renderScale: number) => {
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
        const position = pdfToCanvas({ x: annotation.x, y: annotation.y }, renderScale)
        context.fillStyle = annotation.color
        context.font = `${annotation.fontSize * renderScale}px system-ui, sans-serif`
        context.fillText(annotation.text, position.x, position.y)
      } else if (annotation.type === 'stroke') {
        const canvasPoints = annotation.points.map((point) => pdfToCanvas(point, renderScale))
        drawStroke(
          context,
          canvasPoints,
          annotation.color,
          pdfLengthToCanvas(annotation.width, renderScale),
        )
      } else if (annotation.type === 'image') {
        const topLeft = pdfToCanvas({ x: annotation.x, y: annotation.y }, renderScale)
        const image = getCachedImage(annotation.dataUrl)
        const drawWidth = pdfLengthToCanvas(annotation.width, renderScale)
        const drawHeight = pdfLengthToCanvas(annotation.height, renderScale)
        if (image.complete) {
          context.drawImage(image, topLeft.x, topLeft.y, drawWidth, drawHeight)
        } else {
          image.onload = () => redrawOverlay(renderScale)
        }
      }
    }

    if (currentStroke.length > 0) {
      drawStroke(
        context,
        currentStroke,
        color,
        pdfLengthToCanvas(strokeWidth, renderScale),
      )
    }
  }

  const getPoint = (event: React.PointerEvent): Point => {
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

  const getMeasureContext = () => {
    if (!measureContextRef.current) {
      const canvas = document.createElement('canvas')
      measureContextRef.current = canvas.getContext('2d')
    }
    return measureContextRef.current
  }

  const startDrag = (id: string, mode: 'move' | ResizeHandle, point: Point) => {
    onSelectId(id)
    setDragState({
      id,
      mode,
      startPoint: point,
      startAnnotations: annotations,
    })
  }

  useEffect(() => {
    if (!dragState) return

    const renderScale = pageMetrics.renderScale

    const handleWindowPointerMove = (event: PointerEvent) => {
      const canvas = overlayRef.current
      const measureContext = getMeasureContext()
      if (!canvas || !measureContext) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const point = {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      }

      const startAnnotation = dragState.startAnnotations.find(
        (annotation) => annotation.id === dragState.id,
      )
      if (!startAnnotation) return

      const startBounds = getAnnotationBounds(startAnnotation, measureContext, renderScale)
      if (!startBounds) return

      const nextAnnotations = dragState.startAnnotations.map((annotation) => {
        if (annotation.id !== dragState.id) return annotation

        if (dragState.mode === 'move') {
          const deltaX = (point.x - dragState.startPoint.x) / renderScale
          const deltaY = (point.y - dragState.startPoint.y) / renderScale
          return applyMove(annotation, deltaX, deltaY)
        }

        return applyResize(
          annotation,
          dragState.mode,
          point,
          startBounds,
          startAnnotation,
          renderScale,
        )
      })

      onUpdateAnnotations(nextAnnotations)
    }

    const handleWindowPointerUp = () => {
      onCommitAnnotations(annotationsRef.current)
      setDragState(null)
    }

    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', handleWindowPointerUp)
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
    }
  }, [dragState, onUpdateAnnotations, onCommitAnnotations, pageMetrics.renderScale])

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(event)
    const measureContext = getMeasureContext()
    const renderScale = pageMetrics.renderScale
    if (!measureContext) return

    if (pendingSignature) {
      const pdfPoint = canvasToPdf(point, renderScale)
      onPlaceSignature(pageIndex, pdfPoint.x, pdfPoint.y, renderScale)
      return
    }

    if (tool === 'select') {
      const hit = hitTestAnnotation(
        point,
        annotations,
        pageIndex,
        measureContext,
        renderScale,
        selectedId,
      )
      if (hit) {
        startDrag(hit.id, hit.mode, point)
        return
      }
      onSelectId(null)
      return
    }

    if (tool === 'text') {
      setTextPrompt(point)
      setTextValue('')
      onSelectId(null)
      return
    }

    if (tool === 'draw') {
      overlayRef.current?.setPointerCapture(event.pointerId)
      setIsDrawing(true)
      setCurrentStroke([point])
      onSelectId(null)
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

    const renderScale = pageMetrics.renderScale
    if (currentStroke.length >= 2) {
      onAddAnnotation({
        id: crypto.randomUUID(),
        type: 'stroke',
        pageIndex,
        points: currentStroke.map((strokePoint) => canvasToPdf(strokePoint, renderScale)),
        color,
        width: canvasLengthToPdf(strokeWidth, renderScale),
      })
    }
    setCurrentStroke([])
  }

  const submitText = () => {
    if (!textPrompt || !textValue.trim()) {
      setTextPrompt(null)
      return
    }

    const pdfPoint = canvasToPdf(textPrompt, pageMetrics.renderScale)
    const newId = crypto.randomUUID()
    onAddAnnotation({
      id: newId,
      type: 'text',
      pageIndex,
      x: pdfPoint.x,
      y: pdfPoint.y,
      text: textValue.trim(),
      fontSize,
      color,
    })
    onSelectId(newId)
    setTextPrompt(null)
    setTextValue('')
  }

  const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedId)
  const measureContext = getMeasureContext()
  const selectionBounds =
    selectedAnnotation && measureContext && tool === 'select'
      ? getAnnotationBounds(selectedAnnotation, measureContext, pageMetrics.renderScale)
      : null

  const cursorClass = pendingSignature
    ? 'cursor-place'
    : tool === 'text'
      ? 'cursor-text'
      : tool === 'draw'
        ? 'cursor-draw'
        : dragState?.mode === 'move'
          ? 'cursor-grabbing'
          : tool === 'select'
            ? 'cursor-default'
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
      {selectionBounds && pageMetrics.width > 0 && (
        <SelectionOverlay
          bounds={selectionBounds}
          canvasWidth={pageMetrics.width}
          canvasHeight={pageMetrics.height}
          onMovePointerDown={(event) => {
            event.preventDefault()
            const point = getPoint(event)
            if (selectedId) {
              startDrag(selectedId, 'move', point)
            }
          }}
          onHandlePointerDown={(handle, event) => {
            event.preventDefault()
            const point = getPoint(event)
            if (selectedId) {
              startDrag(selectedId, handle, point)
            }
          }}
        />
      )}
      {pendingSignature && (
        <div className="placement-hint">
          Cliquez sur la page pour placer votre signature
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClearPendingSignature}>
            Annuler
          </button>
        </div>
      )}
      {tool === 'select' && selectedId && (
        <div className="selection-hint">
          Glissez pour déplacer · Poignées pour redimensionner · Double-clic pour modifier le texte
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
