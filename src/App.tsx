import { useState } from 'react'
import { PdfEditor } from './components/PdfEditor'
import { UploadZone } from './components/UploadZone'
import './App.css'

type LoadedPdf = {
  file: File
  bytes: ArrayBuffer
}

function App() {
  const [loadedPdf, setLoadedPdf] = useState<LoadedPdf | null>(null)

  const handleFileSelect = async (file: File) => {
    const bytes = await file.arrayBuffer()
    setLoadedPdf({ file, bytes: bytes.slice(0) })
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <span className="logo">🔐</span>
          <div>
            <h1>PDF Local</h1>
            <p className="tagline">Éditeur de PDF privé — 100% dans votre navigateur</p>
          </div>
        </div>
        <div className="header-badge">Aucun envoi serveur</div>
      </header>

      <main className="main">
        {loadedPdf ? (
          <PdfEditor
            file={loadedPdf.file}
            pdfBytes={loadedPdf.bytes}
            onNewDocument={() => setLoadedPdf(null)}
          />
        ) : (
          <UploadZone onFileSelect={handleFileSelect} />
        )}
      </main>

      <footer className="footer">
        <p>
          Vos fichiers sont traités localement via JavaScript. Aucune donnée n&apos;est
          transmise à un serveur.
        </p>
      </footer>
    </div>
  )
}

export default App
