import type { Point } from '../types'

export function canvasToPdf(point: Point, scale: number): Point {
  return { x: point.x / scale, y: point.y / scale }
}

export function pdfToCanvas(point: Point, scale: number): Point {
  return { x: point.x * scale, y: point.y * scale }
}

export function canvasLengthToPdf(length: number, scale: number): number {
  return length / scale
}

export function pdfLengthToCanvas(length: number, scale: number): number {
  return length * scale
}
