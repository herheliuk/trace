//CodeNode.tsx
import { useRef, useEffect, useState, useContext } from 'react';
//import { Handle, Position } from '@xyflow/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark as mainTheme, oneLight as highlightTheme } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { NodeContext } from "./NodeContext";

interface CodeNodeProps {
  id: string;
  data: {
    line: string;
    framePointer?: string | null;
  };
}

export default function CodeNode({ id, data }: CodeNodeProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const [labelWidth, setLabelWidth] = useState(0);

  const { nodeIndex, setNodeIndex } = useContext(NodeContext);

  useEffect(() => {
    if (labelRef.current) {
      setLabelWidth(labelRef.current.offsetWidth);
    }
  }, [id, data.framePointer]);

  const highlighted = id === nodeIndex;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        ref={labelRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: -(labelWidth + 8),
          transform: 'translateY(-50%)',
          color: highlighted ? '#ffff00' : '#ffffff',
          fontSize: 12,
          fontFamily: 'monospace',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {data.framePointer && (
          <span style={{ opacity: 0.8 }}>
            {data.framePointer}
          </span>
        )}
        <span>{id}</span>
      </div>

      <div
        style={{
          background: highlighted ? '#FAFAFA' : '#292C33',
          borderRadius: 6,
          padding: 8,
          width: 'fit-content',
        }}
      >
        <SyntaxHighlighter
          language="python"
          style={highlighted ? highlightTheme : mainTheme}
          wrapLines={true}
          showLineNumbers={false}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: 12,
            lineHeight: '18px',
          }}
        >
          {data.line}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
