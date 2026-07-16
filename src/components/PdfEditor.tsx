import { useCallback, useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdfDocument } from '../lib/pdfLoader'
import { downloadBytes, exportPdfWithAnnotations } from '../lib/pdfExport'
import type { Annotation, Tool } from '../types'
import { PdfPage } from './PdfPage'
import { SignatureModal } from './SignatureModal'
import { Toolbar } from './Toolbar'

type PdfEditorProps = {
  file: File
  pdfBytes: ArrayBuffer
  onNewDocument: () => void
}

export function PdfEditor({ file, pdfBytes, onNewDocument }: PdfEditorProps) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [history, setHistory] = useState<Annotation[][]>([[]])
  const [tool, setTool] = useState<Tool>('text')
  const [fontSize, setFontSize] = useState(16)
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [color, setColor] = useState('#1a1a2e')
  const [zoom, setZoom] = useState(1.2)
  const [currentPage, setCurrentPage] = useState(0)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [pendingSignature, setPendingSignature] = useState<{
    dataUrl: string
    width: number
    height: number
  } | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const doc = await loadPdfDocument(pdfBytes)
      if (!cancelled) {
        setPdfDoc(doc)
        setCurrentPage(0)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [pdfBytes])

  useEffect(() => {
    if (tool === 'signature') {
      setShowSignatureModal(true)
    }
  }, [tool])

  const pushAnnotations = useCallback((next: Annotation[]) => {
    setAnnotations(next)
    setHistory((previous) => [...previous, next])
  }, [])

  const addAnnotation = useCallback(
    (annotation: Annotation) => {
      pushAnnotations([...annotations, annotation])
    },
    [annotations, pushAnnotations],
  )

  const undo = useCallback(() => {
    setHistory((previous) => {
      if (previous.length <= 1) return previous
      const nextHistory = previous.slice(0, -1)
      setAnnotations(nextHistory[nextHistory.length - 1])
      return nextHistory
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo])

  const handleSignatureConfirm = (dataUrl: string, width: number, height: number) => {
    setShowSignatureModal(false)
    setPendingSignature({ dataUrl, width, height })
    setTool('select')
  }

  const placeSignature = (pageIndex: number, x: number, y: number) => {
    if (!pendingSignature) return

    const scale = 0.35
    addAnnotation({
      id: crypto.randomUUID(),
      type: 'image',
      pageIndex,
      x: x - (pendingSignature.width * scale) / 2,
      y: y - (pendingSignature.height * scale) / 2,
      width: pendingSignature.width * scale,
      height: pendingSignature.height * scale,
      dataUrl: pendingSignature.dataUrl,
    })
    setPendingSignature(null)
  }

  const handleDownload = async () => {
    setIsExporting(true)
    try {
      const bytes = await exportPdfWithAnnotations(pdfBytes, annotations)
      const baseName = file.name.replace(/\.pdf$/i, '') || 'document'
      downloadBytes(bytes, `${baseName}-modifie.pdf`)
    } finally {
      setIsExporting(false)
    }
  }

  if (!pdfDoc) {
    return <div className="loading">Chargement du PDF…</div>
  }

  return (
    <div className="editor">
      <Toolbar
        tool={tool}
        onToolChange={(nextTool) => {
          if (nextTool !== 'signature') {
            setShowSignatureModal(false)
          }
          setTool(nextTool)
        }}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        color={color}
        onColorChange={setColor}
        zoom={zoom}
        onZoomChange={setZoom}
        currentPage={currentPage}
        totalPages={pdfDoc.numPages}
        onPageChange={setCurrentPage}
        onUndo={undo}
        onDownload={handleDownload}
        canUndo={history.length > 1}
        isExporting={isExporting}
        onNewDocument={onNewDocument}
      />

      <div className="editor-canvas">
        <PdfPage
          pdfDoc={pdfDoc}
          pageIndex={currentPage}
          scale={zoom}
          annotations={annotations}
          tool={tool}
          color={color}
          strokeWidth={strokeWidth}
          fontSize={fontSize}
          pendingSignature={pendingSignature?.dataUrl ?? null}
          onAddAnnotation={addAnnotation}
          onPlaceSignature={placeSignature}
          onClearPendingSignature={() => setPendingSignature(null)}
        />
      </div>

      {showSignatureModal && (
        <SignatureModal
          onClose={() => {
            setShowSignatureModal(false)
            setTool('select')
          }}
          onConfirm={handleSignatureConfirm}
        />
      )}
    </div>
  )
}
