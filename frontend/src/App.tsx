import {
  Controls,
  ReactFlow,
  applyNodeChanges,
  useStore
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useState, useEffect, useMemo } from 'react';
import { ImportPanel } from './ImportPanel';
import CodeNode from './CodeNode';
import { useWebSocket } from "./useWebSocket";
import { WebSocketPanel } from "./WebSocketPanel";
import { FlowHighlighter } from './FlowHighlighter';
import { server_uri } from './config';

export default function App() {
  const { message, send } = useWebSocket(`ws${server_uri}/api/ws`);

  const [nodes, setNodes] = useState<any[]>([]);
  const [fileImported, setFileImported] = useState(true); //false
  const [reachedEnd, setReachedEnd] = useState(false);

  const [timelineClicked, setTimelineClicked] = useState<boolean | null>(null);

  const [timelineMessages, setTimelineMessages] = useState<any[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState<number | null>(null);

  const [waitingForResponse, setWaitingForResponse] = useState(false);

  // Store highlight ID WITHOUT remapping nodes (major performance fix)
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const nodeTypes = useMemo(() => ({ code: CodeNode }), []);

  useEffect(() => {
  syncFromServer();
}, []);

async function syncFromServer() {
  const res = await fetch(`http${server_uri}/api/sync`);
  const data = await res.json();

  // nodes
  setNodes(data.nodes);

  // timeline
  setTimelineMessages(data.timeline);

  if (data.current_timeline_id != null) {
    const idx = data.timeline.findIndex(
      (t: any) => t.id === data.current_timeline_id
    );

    setCurrentMessageIndex(idx >= 0 ? idx : null);
    setHighlightedId(data.current_timeline_id.toString());
  } else {
    setCurrentMessageIndex(null);
    setHighlightedId(null);
  }
}


  const wipeTimeline = useCallback(() => {
    setTimelineMessages([]);
    setCurrentMessageIndex(null);
  }, []);

  // WebSocket Handler
  useEffect(() => {
    if (!message) return;

    setWaitingForResponse(false);

    console.info(message)

    if (message === 'x') {
      console.log('app died');
      setReachedEnd(true);
      setHighlightedId(null);
      setCurrentMessageIndex(null);
      return;
    }

    setReachedEnd(false);

    try {
      const evt = JSON.parse(message);
      const id = evt.lineno.toString();

      setHighlightedId(id);

      setNodes(nds =>
  nds.map(node => {
    const old = node.data.highlighted;
    const next = node.id === id;
    if (old === next) return node;
    return { ...node, data: { ...node.data, highlighted: next } };
  })
);

      !timelineClicked ? 
        setTimelineMessages(prev => {
          const next = [...prev, evt];
          if (next.length > 500) next.shift(); // PREVENT FPS drop
          setCurrentMessageIndex(next.length - 1);
          return next;
      }) : setTimelineClicked(null);


    } catch (err) {
      console.error('Failed to parse WS message', err);
    }
  }, [message]);

  const onNodesChange = useCallback(
    (changes) => setNodes((snap) => applyNodeChanges(changes, snap)),
    []
  );

const handleTimelineClick = (index: number) => {
  const msg = timelineMessages[index];
  if (!msg) return;

  send(msg.id);              // ✅ authoritative
  setCurrentMessageIndex(index);
  setTimelineClicked(true);
};


  return (
    <div className="w-screen h-screen relative overflow-hidden flex flex-col">

      {/* ---------------- BEAUTIFUL BACKGROUND RESTORED ---------------- */}
      <div
        className="stage fixed inset-0 pointer-events-none"
        style={{
          filter:
            "blur(var(--blur)) brightness(calc(1 + (var(--intensity,1) - 1) * 0.25))",
        }}
      >
        <div className="blob b1"></div>
        <div className="blob b2"></div>
        <div className="blob b3"></div>
      </div>

      <style>{`
        :root {
          --h: 140;
          --s: 24%;
          --l: 30%;
          --intensity: 1;
          --speed: 1;
          --scale: 1;
          --blur: 80px;
          --ease: cubic-bezier(.25,.8,.25,1);
        }

        html, body, #root {
          height: 100%;
          margin: 0;
          background:
            radial-gradient(1200px 800px at 20% 20%, hsl(calc(var(--h) - 4), calc(var(--s) - 6%), calc(var(--l) + 6%)), transparent 40%),
            radial-gradient(900px 600px at 75% 30%, hsl(calc(var(--h) + 6), calc(var(--s)), calc(var(--l) + 4%)), transparent 45%),
            hsl(var(--h), calc(var(--s) - 4%), calc(var(--l) - 4%));
          overflow: hidden;
        }

        .blob {
          position: absolute;
          border-radius: 50%;
          mix-blend-mode: screen;
          opacity: calc(0.6 * var(--intensity));
          will-change: transform;
          background: radial-gradient(circle at 30% 30%,
            hsl(var(--h), calc(var(--s) + 8%), calc(var(--l) + 14%)),
            hsl(var(--h), var(--s), calc(var(--l) + 4%)) 40%,
            transparent 75%);
          width: calc(60vmax * var(--scale));
          height: calc(60vmax * var(--scale));
        }
        .b1 { animation: move1 calc(32s / var(--speed)) var(--ease) infinite; }
        .b2 { animation: move2 calc(42s / var(--speed)) var(--ease) infinite; }
        .b3 { animation: move3 calc(52s / var(--speed)) var(--ease) infinite; }

        @keyframes move1 {
          0% { transform: translate(-20%, -12%) scale(1); }
          50% { transform: translate(-32%, 6%) scale(1.05); }
          100% { transform: translate(-20%, -12%) scale(1); }
        }
        @keyframes move2 {
          0% { transform: translate(14%, 20%) scale(1.1); }
          50% { transform: translate(4%, -6%) scale(0.98); }
          100% { transform: translate(14%, 20%) scale(1.1); }
        }
        @keyframes move3 {
          0% { transform: translate(-4%, 28%) scale(0.95); }
          50% { transform: translate(18%, 16%) scale(1.08); }
          100% { transform: translate(-4%, 28%) scale(0.95); }
        }
      `}</style>

      {/* ------------------- REACT FLOW ------------------- */}
      <div className="flex-1 w-full relative z-20">
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          fitView
          panOnScroll
          proOptions={{ hideAttribution: true }}
          minZoom={0.01}
          maxZoom={1000}
          panOnScrollSpeed={1}
          className="w-full h-full bg-transparent"
        >
          {/* Keeps your highlight effect */}
          <FlowHighlighter highlightedId={highlightedId} />

          {/* Your original UI panels */}
          <ImportPanel setNodes={setNodes} setFileImported={setFileImported} />

          <WebSocketPanel
            send={send}
            reachedEnd={reachedEnd}
            show={fileImported}
            waiting={waitingForResponse}
            setWaiting={setWaitingForResponse}
            wipeTimeline={wipeTimeline}
          />

          <Controls />
        </ReactFlow>
      </div>

      {/* ------------------- TIMELINE ------------------- */}
      <div className="w-full h-16 flex items-center px-4 overflow-x-auto z-20 bg-[#292C33]">
        {timelineMessages.map((msg, idx) => {
          const isSelected = currentMessageIndex === idx;

          return (
            <div
              key={idx}
              onClick={() => handleTimelineClick(idx)}
              className={`flex flex-col items-center flex-none w-8 mx-1 cursor-pointer transition-all duration-300
                ${
                  isSelected
                    ? 'bg-yellow-400 border-yellow-600'
                    : 'bg-gray-400/50 border-gray-600'
                }
                rounded-full border-2 h-8`}
              title={`Timeline index: ${idx}, Line: ${msg.lineno}`}
            >
              <span className="text-xs text-white mt-1">{msg.lineno}</span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
