type UploadZoneProps = {
  onFileSelect: (file: File) => void
}

export function UploadZone({ onFileSelect }: UploadZoneProps) {
  const handleFile = (file: File | undefined) => {
    if (!file || file.type !== 'application/pdf') return
    onFileSelect(file)
  }

  return (
    <div className="upload-zone">
      <div
        className="upload-card"
        onDragOver={(event) => {
          event.preventDefault()
          event.currentTarget.classList.add('drag-over')
        }}
        onDragLeave={(event) => {
          event.currentTarget.classList.remove('drag-over')
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.currentTarget.classList.remove('drag-over')
          handleFile(event.dataTransfer.files[0])
        }}
      >
        <div className="upload-icon">📄</div>
        <h2>Importer un PDF</h2>
        <p>Glissez-déposez votre fichier ou cliquez pour parcourir</p>
        <label className="btn btn-primary upload-btn">
          Choisir un fichier
          <input
            type="file"
            accept="application/pdf"
            hidden
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>
        <p className="privacy-note">
          🔒 Traitement 100% local — votre PDF ne quitte jamais votre navigateur
        </p>
      </div>
    </div>
  )
}
