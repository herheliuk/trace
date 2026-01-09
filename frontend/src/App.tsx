import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  applyNodeChanges,
  Controls,
  NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ImportPanel } from './ImportPanel';
import { WebSocketPanel } from './WebSocketPanel';
import { CodeNode } from './CodeNode';
import { NodeContext } from './NodeContext';
import { Background } from './ui/Background';
import { useWebSocket } from './useWebSocket';
import { server_uri } from './config';
import { JsonInspectorPanel } from './JsonInspectorPanel';
import { DebuggerStateContext } from './DebuggerStateContext';

// Helper: update node code and shift below nodes
function updateNodeCode(nodes, nodeId, newCode) {
  const idx = nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return nodes;

  const node = nodes[idx];
  const oldLines = node.data.source_segment.split('\n').length;
  const newLines = newCode.split('\n').length;
  const deltaY = (newLines - oldLines) * 18; // LINE_HEIGHT

  const updatedNode = {
    ...node,
    data: { ...node.data, source_segment: newCode },
  };

  return nodes.map((n, i) => {
    if (i === idx) return updatedNode;
    if (n.position.y > node.position.y) {
      return { ...n, position: { ...n.position, y: n.position.y + deltaY } };
    }
    return n;
  });
}

function parsePythonDict(str: string) {
  if (!str || str === '{}') return {};
  try {
    return JSON.parse(str.replace(/'/g, '"'));
  } catch {
    return {};
  }
}

function applyDiff(target: Record<string, any>, diffStr: string) {
  const diff = parsePythonDict(diffStr);

  for (const key of Object.keys(diff)) {
    if (diff[key] === '<deleted>') {
      delete target[key];
    } else {
      target[key] = diff[key];
    }
  }
}

function buildCurrentScope(timeline: any[], timelineIndex: number | null) {
  if (timelineIndex == null || timelineIndex < 0) return null;

  const scope: any = {
    event: null,
    file: null,
    function: null,
    frame_id: null,
    line_number: null,
    globals: {},
    locals: {},
    return_value: null,
    error: null,
  };

  for (let i = 0; i <= timelineIndex && i < timeline.length; i++) {
    const e = timeline[i];
    if (!e) continue;

    scope.event = e.event;
    scope.file = e.file;
    scope.function = e.function;
    scope.frame_id = e.frame_id;
    scope.line_number = e.line_number;

    applyDiff(scope.globals, e.global_diff);
    applyDiff(scope.locals, e.local_diff);

    if (e.return_value != null) scope.return_value = e.return_value;
    if (e.error != null) scope.error = e.error;
  }

  return scope;
}

type TerminalEntry = {
  stream: 'stdout' | 'stderr';
  text: string;
  flushed: boolean;
};

export default function App() {
  const inputMethod = ['touch', 'mouse'][0];

  // ================= STATES =================
  const [nodes, setNodes] = useState([]);
  const [nodeIndex, setNodeIndex] = useState<string | null>(null);
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);
  const [fileImported, setFileImported] = useState(true);
  const [waitingForResponse, setWaitingForResponse] = useState(false);

  const timelineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([]);

  const debuggerState = useMemo(
    () => buildCurrentScope(timelineEntries, timelineIndex),
    [timelineEntries, timelineIndex]
  );

  const messageReceived = (jsonString) => {
    if (!jsonString) return;
    setWaitingForResponse(false);
    const message = JSON.parse(jsonString);

    switch (message.type) {
      case 'event':
        handleEvent(message.data);
        break;

      case 'sync':
        handleSync(message.data);
        break;

      case 'stdout':
      case 'stderr': {
        const chunk = message.data;
        if (!chunk) return;

        setTerminalEntries(prev => {
          const last = prev[prev.length - 1];

          // If last entry is same stream and not flushed → append
          if (last && last.stream === message.type && !last.flushed) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                text: last.text + chunk,
              },
            ];
          }

          // Otherwise start a new pending entry
          return [
            ...prev,
            {
              stream: message.type,
              text: chunk,
              flushed: false,
            },
          ];
        });

        break;
      }

      case 'flush': {
        const stream = message.data;
        if (stream !== 'stdout' && stream !== 'stderr') return;

        setTerminalEntries(prev =>
          prev.map(entry =>
            entry.stream === stream
              ? { ...entry, flushed: true }
              : entry
          )
        );
        break;
      }

      default:
        console.warn('WS: Unknown message.type:', message.type);
    }
  };

  const { send, isConnected } = useWebSocket(`ws${server_uri}/api/ws`, messageReceived);

  // ================= NODE TYPES =================
  const nodeTypes = useMemo(
    () => ({
      code: (props) => (
        <CodeNode
          {...props}
          data={{
            ...props.data,
            onChange: (newCode: string) => {
              setNodes((prev) => updateNodeCode(prev, props.id, newCode));
            },
          }}
        />
      ),
    }),
    []
  );

  // ================= SYNC FUNCTIONS =================
  const handleSync = (data) => {
    setNodes(data.nodes);
    setNodeIndex(data.node_id?.toString() || null);
    setTimelineEntries(data.timeline || []);
    setTimelineIndex(data.timeline_id || null);
  };

  const syncFromServer = async () => {
    const res = await fetch(`http${server_uri}/api/sync`);
    const data = await res.json();
    handleSync(data);
  };

  useEffect(() => {
    if (isConnected)
      syncFromServer();
  }, [isConnected]);

  // ================= WEBSOCKET =================
  const handleEvent = (data) => {
    setTimelineEntries((prev) => {
      const next = [...prev];
      next[data.id] = data;
      return next;
    });

    setNodes((prev) => {
      const idx = prev.findIndex((n) => n.id === String(data.line_number));
      if (idx < 0) return prev;
      const node = prev[idx];
      return [
        ...prev.slice(0, idx),
        { ...node, data: { ...node.data, framePointer: data.frame_id } },
        ...prev.slice(idx + 1),
      ];
    });

    setTimelineIndex(data.id ?? null);
    setNodeIndex(data.line_number?.toString() ?? null);
  };

  // ================= REACT FLOW =================
  const onNodesChange = useCallback(
    (changes: NodeChange<any>[]) => setNodes((snapshot) => applyNodeChanges(changes, snapshot)),
    []
  );

  // ================= TIMELINE =================
  const scrollToTimelineItem = (idx: number) => {
    const item = timelineRefs.current[idx];
    if (item) item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  useEffect(() => {
    if (timelineIndex !== null) scrollToTimelineItem(timelineIndex);
  }, [timelineIndex]);

  const handleTimelineClick = useCallback((index: number) => {
    send(JSON.stringify({ type: 'new_timeline_id', new_timeline_id: index }));
  }, [send]);

  return (
    <div className="w-screen h-screen flex flex-col relative overflow-hidden">
      <Background />

      <DebuggerStateContext.Provider value={debuggerState}>
        <NodeContext.Provider value={{ nodeIndex, setNodeIndex }}>
          <div className="flex-1 relative z-20 w-full">
            <ReactFlow
              nodes={nodes}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              fitView
              panOnScroll={inputMethod === 'touch'}
              zoomOnScroll={inputMethod === 'mouse'}
              proOptions={{ hideAttribution: true }}
              minZoom={0.01}
              maxZoom={1000}
              panOnScrollSpeed={1}
              className="w-full h-full bg-transparent"
            >
              <ImportPanel setFileImported={setFileImported} />
              <WebSocketPanel
                send={send}
                show={fileImported}
                waiting={waitingForResponse}
                setWaiting={setWaitingForResponse}
              />
              <Controls />
            </ReactFlow>

            <JsonInspectorPanel
              nodes={nodes}
              timeline={timelineEntries}
              nodeIndex={nodeIndex}
              timelineIndex={timelineIndex}
              terminal={terminalEntries}
            />
          </div>

          <div className="w-full h-16 flex items-center px-4 overflow-x-auto z-20 bg-[#292C33]">
            {timelineEntries.map((record, idx) => {
              const isSelected = timelineIndex === idx;
              const label = record?.event?.includes('line')
                ? record.line_number
                : record?.event?.replace(/^"+|"+$/g, '')?.charAt(0)?.toUpperCase();

              return (
                <div
                  key={idx}
                  ref={(el) => (timelineRefs.current[idx] = el)}
                  onClick={() => handleTimelineClick(idx)}
                  className={`flex flex-col items-center flex-none w-8 mx-1 cursor-pointer transition-all duration-300
                  ${isSelected ? 'bg-yellow-400 border-yellow-600' : 'bg-gray-400/50 border-gray-600'}
                  rounded-full border-2 h-8`}
                  title={`Timeline index: ${idx}, Line: ${record.line_number}`}
                >
                  <span className="text-xs text-white mt-1 font-bold">{label}</span>
                </div>
              );
            })}
          </div>
        </NodeContext.Provider>
      </DebuggerStateContext.Provider>
    </div>
  );
}
