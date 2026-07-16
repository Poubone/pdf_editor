import type { Bounds } from '../lib/annotationBounds'
import type { ResizeHandle } from '../lib/annotationBounds'

type SelectionOverlayProps = {
  bounds: Bounds
  canvasWidth: number
  canvasHeight: number
  onHandlePointerDown: (handle: ResizeHandle, event: React.PointerEvent) => void
  onMovePointerDown: (event: React.PointerEvent) => void
}

const handles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se']

export function SelectionOverlay({
  bounds,
  canvasWidth,
  canvasHeight,
  onHandlePointerDown,
  onMovePointerDown,
}: SelectionOverlayProps) {
  const style = {
    left: `${(bounds.x / canvasWidth) * 100}%`,
    top: `${(bounds.y / canvasHeight) * 100}%`,
    width: `${(bounds.width / canvasWidth) * 100}%`,
    height: `${(bounds.height / canvasHeight) * 100}%`,
  }

  return (
    <div className="selection-overlay" style={style}>
      <div
        className="selection-move-area"
        onPointerDown={onMovePointerDown}
      />
      {handles.map((handle) => (
        <div
          key={handle}
          className={`selection-handle selection-handle-${handle}`}
          onPointerDown={(event) => {
            event.stopPropagation()
            onHandlePointerDown(handle, event)
          }}
        />
      ))}
    </div>
  )
}
