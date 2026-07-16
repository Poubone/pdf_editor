export type Point = { x: number; y: number }

export type Tool = 'select' | 'text' | 'draw' | 'signature'

export type TextAnnotation = {
  id: string
  type: 'text'
  pageIndex: number
  x: number
  y: number
  text: string
  fontSize: number
  color: string
}

export type StrokeAnnotation = {
  id: string
  type: 'stroke'
  pageIndex: number
  points: Point[]
  color: string
  width: number
}

export type ImageAnnotation = {
  id: string
  type: 'image'
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  dataUrl: string
}

export type Annotation = TextAnnotation | StrokeAnnotation | ImageAnnotation

export type PageDimensions = {
  width: number
  height: number
}
