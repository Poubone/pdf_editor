import type { Tool } from '../types'

type ToolbarProps = {
  tool: Tool
  onToolChange: (tool: Tool) => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  strokeWidth: number
  onStrokeWidthChange: (width: number) => void
  color: string
  onColorChange: (color: string) => void
  zoom: number
  onZoomChange: (zoom: number) => void
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onUndo: () => void
  onDownload: () => void
  canUndo: boolean
  isExporting: boolean
  onNewDocument: () => void
}

const tools: { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Sélection', icon: '↖' },
  { id: 'text', label: 'Texte', icon: 'T' },
  { id: 'draw', label: 'Dessin', icon: '✎' },
  { id: 'signature', label: 'Signature', icon: '✍' },
]

export function Toolbar({
  tool,
  onToolChange,
  fontSize,
  onFontSizeChange,
  strokeWidth,
  onStrokeWidthChange,
  color,
  onColorChange,
  zoom,
  onZoomChange,
  currentPage,
  totalPages,
  onPageChange,
  onUndo,
  onDownload,
  canUndo,
  isExporting,
  onNewDocument,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        {tools.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tool-btn ${tool === item.id ? 'active' : ''}`}
            onClick={() => onToolChange(item.id)}
            title={item.label}
          >
            <span className="tool-icon">{item.icon}</span>
            <span className="tool-label">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        {tool === 'text' && (
          <label className="toolbar-control">
            <span>Taille</span>
            <input
              type="number"
              min={8}
              max={72}
              value={fontSize}
              onChange={(event) => onFontSizeChange(Number(event.target.value))}
            />
          </label>
        )}
        {(tool === 'draw' || tool === 'signature') && (
          <label className="toolbar-control">
            <span>Épaisseur</span>
            <input
              type="number"
              min={1}
              max={12}
              value={strokeWidth}
              onChange={(event) => onStrokeWidthChange(Number(event.target.value))}
            />
          </label>
        )}
        <label className="toolbar-control">
          <span>Couleur</span>
          <input
            type="color"
            value={color}
            onChange={(event) => onColorChange(event.target.value)}
          />
        </label>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onZoomChange(Math.max(0.5, zoom - 0.25))}
          title="Zoom arrière"
        >
          −
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
          title="Zoom avant"
        >
          +
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={currentPage <= 0}
          onClick={() => onPageChange(currentPage - 1)}
        >
          ‹
        </button>
        <span className="page-label">
          {totalPages > 0 ? `${currentPage + 1} / ${totalPages}` : '—'}
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={currentPage >= totalPages - 1}
          onClick={() => onPageChange(currentPage + 1)}
        >
          ›
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onUndo}
          disabled={!canUndo}
          title="Annuler (Ctrl+Z)"
        >
          ↩ Annuler
        </button>
        <button type="button" className="btn btn-ghost" onClick={onNewDocument}>
          Nouveau PDF
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onDownload}
          disabled={isExporting}
        >
          {isExporting ? 'Export…' : 'Télécharger'}
        </button>
      </div>
    </div>
  )
}
