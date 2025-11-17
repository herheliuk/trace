// ImportPanel.tsx
import { useReactFlow, Panel } from '@xyflow/react'
import { useState, useRef } from 'react'
import { PanelButton } from './ui/PanelButton'

export function ImportPanel({ setFileImported, setNodes }: { setFileImported: (v: boolean) => void, setNodes: any }) {
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleFileImport = async (file: File) => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('http://127.0.0.1:8000/api/import', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to import file')

      const data = await response.json()
      setNodes(data.nodes)
      // setEdges(data.edges)
      setFileImported(true)  // <--- mark that a file has been imported
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onImportClick = () => inputRef.current?.click()

  return (
    <Panel position="top-center">
      <PanelButton onClick={onImportClick} disabled={loading}>
        {loading ? 'Importing…' : 'Import Python Script'}
      </PanelButton>

      <input
        ref={inputRef}
        type="file"
        accept=".py"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileImport(file)
        }}
      />
    </Panel>
  )
}
