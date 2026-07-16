import type { Annotation, ImageAnnotation, Point, TextAnnotation } from '../types'

export type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

const HANDLE_SIZE = 10

function measureText(annotation: TextAnnotation, context: CanvasRenderingContext2D) {
  context.font = `${annotation.fontSize}px system-ui, sans-serif`
  return context.measureText(annotation.text)
}

export function getTextBounds(
  annotation: TextAnnotation,
  context: CanvasRenderingContext2D,
): Bounds {
  const metrics = measureText(annotation, context)
  return {
    x: annotation.x,
    y: annotation.y - annotation.fontSize,
    width: Math.max(metrics.width, 8),
    height: annotation.fontSize,
  }
}

export function getImageBounds(annotation: ImageAnnotation): Bounds {
  return {
    x: annotation.x,
    y: annotation.y,
    width: annotation.width,
    height: annotation.height,
  }
}

export function getAnnotationBounds(
  annotation: Annotation,
  context: CanvasRenderingContext2D,
): Bounds | null {
  if (annotation.type === 'text') return getTextBounds(annotation, context)
  if (annotation.type === 'image') return getImageBounds(annotation)
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
  selectedId: string | null,
): { id: string; mode: 'move' | ResizeHandle } | null {
  const pageAnnotations = annotations
    .filter((annotation) => annotation.pageIndex === pageIndex)
    .filter((annotation) => annotation.type === 'text' || annotation.type === 'image')
    .reverse()

  if (selectedId) {
    const selected = pageAnnotations.find((annotation) => annotation.id === selectedId)
    if (selected) {
      const bounds = getAnnotationBounds(selected, context)
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
    const bounds = getAnnotationBounds(annotation, context)
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
  return annotation
}

export function applyResize(
  annotation: Annotation,
  handle: ResizeHandle,
  point: Point,
  startBounds: Bounds,
  startAnnotation: Annotation,
): Annotation {
  if (startAnnotation.type === 'text' && annotation.type === 'text') {
    const anchor = getAnchor(startBounds, handle)
    const newWidth = Math.max(Math.abs(point.x - anchor.x), 20)
    const newHeight = Math.max(Math.abs(point.y - anchor.y), 12)
    const scale = Math.min(newWidth / startBounds.width, newHeight / startBounds.height)
    const fontSize = Math.max(8, Math.min(120, startAnnotation.fontSize * scale))
    const width = startBounds.width * (fontSize / startAnnotation.fontSize)
    const height = fontSize

    const topLeft = getTopLeftFromAnchor(anchor, handle, width, height)
    return {
      ...annotation,
      x: topLeft.x,
      y: topLeft.y + height,
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
      x: topLeft.x,
      y: topLeft.y,
      width,
      height,
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

export function boundsToPercent(bounds: Bounds, canvasWidth: number, canvasHeight: number) {
  return {
    left: `${(bounds.x / canvasWidth) * 100}%`,
    top: `${(bounds.y / canvasHeight) * 100}%`,
    width: `${(bounds.width / canvasWidth) * 100}%`,
    height: `${(bounds.height / canvasHeight) * 100}%`,
  }
}
