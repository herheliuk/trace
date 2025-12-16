import { useRef, useEffect, useState } from 'react';
//import { Handle, Position } from '@xyflow/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark as mainTheme, oneLight as highlightTheme } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeNodeProps {
  id: string;
  data: {
    label: string;
    highlighted?: boolean;
    framePointer?: string | null;
  };
}

export default function CodeNode({ id, data }: CodeNodeProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const [labelWidth, setLabelWidth] = useState(0);

  useEffect(() => {
    if (labelRef.current) {
      setLabelWidth(labelRef.current.offsetWidth);
    }
  }, [id, data.framePointer]);

  const labelColor = data.highlighted ? '#ffff00' : '#ffffff';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* LABEL — PURE OVERLAY, ZERO LAYOUT IMPACT */}
      <div
        ref={labelRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: -(labelWidth + 8),
          transform: 'translateY(-50%)',
          color: labelColor,
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

      {/* NODE BODY — TRUE SIZE & POSITION */}
      <div
        style={{
          background: data.highlighted ? '#FAFAFA' : '#292C33',
          borderRadius: 6,
          padding: 8,
          width: 'fit-content',
        }}
      >
        <SyntaxHighlighter
          language="python"
          style={data.highlighted ? highlightTheme : mainTheme}
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
          {data.label}
        </SyntaxHighlighter>

        {/*<Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />*/}
      </div>
    </div>
  );
}
