import type { Annotation, TextAnnotation } from '../types'

type AnnotationEditBarProps = {
  annotation: Annotation
  onUpdate: (id: string, changes: Partial<TextAnnotation>) => void
  onDelete: () => void
}

export function AnnotationEditBar({ annotation, onUpdate, onDelete }: AnnotationEditBarProps) {
  if (annotation.type === 'text') {
    return (
      <div className="annotation-edit-bar">
        <input
          className="annotation-edit-input"
          value={annotation.text}
          onChange={(event) => onUpdate(annotation.id, { text: event.target.value })}
          placeholder="Modifier le texte…"
        />
        <label className="toolbar-control">
          <span>Taille</span>
          <input
            type="number"
            min={6}
            max={120}
            value={Math.round(annotation.fontSize)}
            onChange={(event) =>
              onUpdate(annotation.id, { fontSize: Number(event.target.value) })
            }
          />
        </label>
        <label className="toolbar-control">
          <span>Couleur</span>
          <input
            type="color"
            value={annotation.color}
            onChange={(event) => onUpdate(annotation.id, { color: event.target.value })}
          />
        </label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDelete}>
          Supprimer
        </button>
      </div>
    )
  }

  return (
    <div className="annotation-edit-bar">
      <span className="annotation-edit-label">
        {annotation.type === 'image' ? 'Signature sélectionnée' : 'Dessin sélectionné'}
      </span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onDelete}>
        Supprimer
      </button>
    </div>
  )
}
