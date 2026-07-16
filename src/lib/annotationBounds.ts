import type { Annotation, ImageAnnotation, Point, StrokeAnnotation, TextAnnotation } from '../types'
import { pdfToCanvas } from './coordinates'

export type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

const HANDLE_SIZE = 10

function measureText(annotation: TextAnnotation, context: CanvasRenderingContext2D, scale: number) {
  context.font = `${annotation.fontSize * scale}px system-ui, sans-serif`
  return context.measureText(annotation.text)
}

export function getTextBounds(
  annotation: TextAnnotation,
  context: CanvasRenderingContext2D,
  scale: number,
): Bounds {
  const metrics = measureText(annotation, context, scale)
  const baseline = pdfToCanvas({ x: annotation.x, y: annotation.y }, scale)
  return {
    x: baseline.x,
    y: baseline.y - annotation.fontSize * scale,
    width: Math.max(metrics.width, 8),
    height: annotation.fontSize * scale,
  }
}

export function getImageBounds(annotation: ImageAnnotation, scale: number): Bounds {
  const topLeft = pdfToCanvas({ x: annotation.x, y: annotation.y }, scale)
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: annotation.width * scale,
    height: annotation.height * scale,
  }
}

function getStrokeBounds(annotation: StrokeAnnotation, scale: number): Bounds {
  const points = annotation.points.map((point) => pdfToCanvas(point, scale))
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const padding = annotation.width * scale

  return {
    x: Math.min(...xs) - padding,
    y: Math.min(...ys) - padding,
    width: Math.max(Math.max(...xs) - Math.min(...xs) + padding * 2, 1),
    height: Math.max(Math.max(...ys) - Math.min(...ys) + padding * 2, 1),
  }
}

export function getAnnotationBounds(
  annotation: Annotation,
  context: CanvasRenderingContext2D,
  scale: number,
): Bounds | null {
  if (annotation.type === 'text') return getTextBounds(annotation, context, scale)
  if (annotation.type === 'image') return getImageBounds(annotation, scale)
  if (annotation.type === 'stroke') return getStrokeBounds(annotation, scale)
  return null
}

function getHandlePositions(bounds: Bounds): Record<ResizeHandle, Point> {
  return {
    nw: { x: bounds.x, y: bounds.y },
    ne: { x: bounds.x + bounds.width, y: bounds.y },
    sw: { x: bounds.x, y: bounds.y + bounds.height },
    se: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
  }
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function isInsideBounds(point: Point, bounds: Bounds) {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

export function hitTestAnnotation(
  point: Point,
  annotations: Annotation[],
  pageIndex: number,
  context: CanvasRenderingContext2D,
  scale: number,
  selectedId: string | null,
): { id: string; mode: 'move' | ResizeHandle } | null {
  const pageAnnotations = annotations
    .filter((annotation) => annotation.pageIndex === pageIndex)
    .reverse()

  if (selectedId) {
    const selected = pageAnnotations.find((annotation) => annotation.id === selectedId)
    if (selected) {
      const bounds = getAnnotationBounds(selected, context, scale)
      if (bounds) {
        const handles = getHandlePositions(bounds)
        for (const [handle, position] of Object.entries(handles) as [ResizeHandle, Point][]) {
          if (distance(point, position) <= HANDLE_SIZE) {
            return { id: selectedId, mode: handle }
          }
        }
        if (isInsideBounds(point, bounds)) {
          return { id: selectedId, mode: 'move' }
        }
      }
    }
  }

  for (const annotation of pageAnnotations) {
    const bounds = getAnnotationBounds(annotation, context, scale)
    if (!bounds) continue
    if (isInsideBounds(point, bounds)) {
      return { id: annotation.id, mode: 'move' }
    }
  }

  return null
}

export function applyMove(
  annotation: Annotation,
  deltaX: number,
  deltaY: number,
): Annotation {
  if (annotation.type === 'text') {
    return {
      ...annotation,
      x: annotation.x + deltaX,
      y: annotation.y + deltaY,
    }
  }
  if (annotation.type === 'image') {
    return {
      ...annotation,
      x: annotation.x + deltaX,
      y: annotation.y + deltaY,
    }
  }
  if (annotation.type === 'stroke') {
    return {
      ...annotation,
      points: annotation.points.map((point) => ({
        x: point.x + deltaX,
        y: point.y + deltaY,
      })),
    }
  }
  return annotation
}

export function applyResize(
  annotation: Annotation,
  handle: ResizeHandle,
  point: Point,
  startBounds: Bounds,
  startAnnotation: Annotation,
  scale: number,
): Annotation {
  if (startAnnotation.type === 'text' && annotation.type === 'text') {
    const anchor = getAnchor(startBounds, handle)
    const newWidth = Math.max(Math.abs(point.x - anchor.x), 20)
    const newHeight = Math.max(Math.abs(point.y - anchor.y), 12)
    const sizeScale = Math.min(newWidth / startBounds.width, newHeight / startBounds.height)
    const fontSize = Math.max(6, Math.min(120, startAnnotation.fontSize * sizeScale))
    const width = startBounds.width * (fontSize / startAnnotation.fontSize)
    const height = fontSize * scale

    const topLeft = getTopLeftFromAnchor(anchor, handle, width, height)
    return {
      ...annotation,
      x: topLeft.x / scale,
      y: (topLeft.y + height) / scale,
      fontSize,
    }
  }

  if (startAnnotation.type === 'image' && annotation.type === 'image') {
    const anchor = getAnchor(startBounds, handle)
    const width = Math.max(Math.abs(point.x - anchor.x), 20)
    const height = Math.max(Math.abs(point.y - anchor.y), 20)
    const topLeft = getTopLeftFromAnchor(anchor, handle, width, height)

    return {
      ...annotation,
      x: topLeft.x / scale,
      y: topLeft.y / scale,
      width: width / scale,
      height: height / scale,
    }
  }

  return annotation
}

function getAnchor(bounds: Bounds, handle: ResizeHandle): Point {
  switch (handle) {
    case 'nw':
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
    case 'ne':
      return { x: bounds.x, y: bounds.y + bounds.height }
    case 'sw':
      return { x: bounds.x + bounds.width, y: bounds.y }
    case 'se':
      return { x: bounds.x, y: bounds.y }
  }
}

function getTopLeftFromAnchor(
  anchor: Point,
  handle: ResizeHandle,
  width: number,
  height: number,
): Point {
  switch (handle) {
    case 'nw':
      return { x: anchor.x - width, y: anchor.y - height }
    case 'ne':
      return { x: anchor.x, y: anchor.y - height }
    case 'sw':
      return { x: anchor.x - width, y: anchor.y }
    case 'se':
      return { x: anchor.x, y: anchor.y }
  }
}
