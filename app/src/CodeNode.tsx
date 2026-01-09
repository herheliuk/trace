import React, { useState, useEffect, useContext } from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-python';
import { NodeContext } from './NodeContext';
import 'prismjs/themes/prism-tomorrow.css';

export function CodeNode({ id, data, send }: any) {
  const { nodeIndex } = useContext(NodeContext);
  const [code, setCode] = useState(data.source_segment);

  useEffect(() => setCode(data.source_segment), [data.source_segment]);

  const highlighted = id === nodeIndex;

  const handleChange = (newCode: string) => {
    setCode(newCode);
    data.onChange?.(newCode);
  };

  const handleBlur = () => {
    send?.({
      type: 'update_node_code',
      lineno: id,
      code_segment: code,
    });
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {data.framePointer && (
        <div
          style={{
            position: 'absolute',
            right: '100%',
            top: 6,
            marginRight: 8,
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
            fontSize: 12,
            color: highlighted ? '#ffff00' : '#ffffff',
            pointerEvents: 'none',
          }}
        >
          {data.framePointer} · {id}
        </div>
      )}
      <Editor
        value={code}
        onValueChange={handleChange}
        onBlur={handleBlur}
        highlight={(code) => highlight(code, languages.python, 'python')}
        padding={10}
        style={{
          fontFamily: '"Fira Code", monospace',
          fontSize: 12,
          borderRadius: 6,
          background: highlighted ? '#FAFAFA' : '#292C33',
          color: highlighted ? '#000' : '#FFF',
          lineHeight: 1.4,
        }}
      />
    </div>
  );
}
