// CodeNode.tsx
import { useRef, useEffect, useState } from 'react';
//import { Handle, Position } from '@xyflow/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark as mainTheme, oneLight as highlightTheme } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeNodeProps {
  id: string;
  data: {
    label: string;
    highlighted?: boolean; // add this
  };
}

/*const availableStyles = [
  coy, dark, funky, okaidia, solarizedlight,
  tomorrow, twilight, prism, a11yDark, atomDark, base16AteliersulphurpoolLight,
  cb, coldarkCold, coldarkDark, coyWithoutShadows, darcula, dracula, duotoneDark,
  duotoneEarth, duotoneForest, duotoneLight, duotoneSea, duotoneSpace, ghcolors,
  gruvboxDark, gruvboxLight, holiTheme, hopscotch, lucario, materialDark,
  materialLight, materialOceanic, nightOwl, nord, oneDark, oneLight, pojoaque,
  shadesOfPurple, solarizedDarkAtom, synthwave84, vs, vscDarkPlus, xonokai, zTouch
];*/

export default function CodeNode({ id, data }: CodeNodeProps) {
  const idRef = useRef<HTMLDivElement>(null);
  const [idWidth, setIdWidth] = useState(0);

  useEffect(() => {
    if (idRef.current) {
      setIdWidth(idRef.current.offsetWidth);
    }
  }, [id]);

  const idColor = data.highlighted ? '#ffff00' : '#ffffff';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        ref={idRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: -(idWidth + 8),
          transform: 'translateY(-50%)',
          color: idColor,
          fontSize: 12,
          fontFamily: 'monospace',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {id}
      </div>

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
