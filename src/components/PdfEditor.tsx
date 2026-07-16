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
  const [tool, setTool] = useState<Tool>('select')
  const [fontSize, setFontSize] = useState(16)
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [color, setColor] = useState('#1a1a2e')
  const [zoom, setZoom] = useState(1.2)
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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

  const updateAnnotationsLive = useCallback((next: Annotation[]) => {
    setAnnotations(next)
  }, [])

  const commitAnnotations = useCallback(
    (next: Annotation[]) => {
      pushAnnotations(next)
    },
    [pushAnnotations],
  )

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    const next = annotations.filter((annotation) => annotation.id !== selectedId)
    pushAnnotations(next)
    setSelectedId(null)
  }, [annotations, pushAnnotations, selectedId])

  const undo = useCallback(() => {
    setHistory((previous) => {
      if (previous.length <= 1) return previous
      const nextHistory = previous.slice(0, -1)
      setAnnotations(nextHistory[nextHistory.length - 1])
      setSelectedId(null)
      return nextHistory
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault()
        undo()
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        const target = event.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        event.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, deleteSelected, selectedId])

  const handleSignatureConfirm = (dataUrl: string, width: number, height: number) => {
    setShowSignatureModal(false)
    setPendingSignature({ dataUrl, width, height })
    setTool('select')
  }

  const placeSignature = (pageIndex: number, x: number, y: number) => {
    if (!pendingSignature) return

    const scale = 0.35
    const newId = crypto.randomUUID()
    addAnnotation({
      id: newId,
      type: 'image',
      pageIndex,
      x: x - (pendingSignature.width * scale) / 2,
      y: y - (pendingSignature.height * scale) / 2,
      width: pendingSignature.width * scale,
      height: pendingSignature.height * scale,
      dataUrl: pendingSignature.dataUrl,
    })
    setPendingSignature(null)
    setSelectedId(newId)
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
          if (nextTool !== 'select') {
            setSelectedId(null)
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
        onPageChange={(page) => {
          setCurrentPage(page)
          setSelectedId(null)
        }}
        onUndo={undo}
        onDownload={handleDownload}
        canUndo={history.length > 1}
        isExporting={isExporting}
        onNewDocument={onNewDocument}
        onDeleteSelected={deleteSelected}
        canDelete={Boolean(selectedId)}
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
          selectedId={selectedId}
          onSelectId={setSelectedId}
          onAddAnnotation={addAnnotation}
          onUpdateAnnotations={updateAnnotationsLive}
          onCommitAnnotations={commitAnnotations}
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
