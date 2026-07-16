import { useRef, useState } from 'react'

type SignatureModalProps = {
  onClose: () => void
  onConfirm: (dataUrl: string, width: number, height: number) => void
}

export function SignatureModal({ onClose, onConfirm }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    canvas.setPointerCapture(event.pointerId)
    const point = getPoint(event)
    context.strokeStyle = '#1a1a2e'
    context.lineWidth = 2.5
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    context.moveTo(point.x, point.y)
    setIsDrawing(true)
    setHasContent(true)
  }

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const point = getPoint(event)
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  const stopDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    canvasRef.current?.releasePointerCapture(event.pointerId)
    setIsDrawing(false)
  }

  const clear = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    setHasContent(false)
  }

  const confirm = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasContent) return
    onConfirm(canvas.toDataURL('image/png'), canvas.width, canvas.height)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>Créer une signature</h2>
        <p className="modal-hint">Dessinez votre signature ci-dessous</p>
        <canvas
          ref={canvasRef}
          className="signature-canvas"
          width={480}
          height={180}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={clear}>
            Effacer
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={confirm}
            disabled={!hasContent}
          >
            Placer sur le PDF
          </button>
        </div>
      </div>
    </div>
  )
}
