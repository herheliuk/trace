import {
  Controls,
  NodeChange,
  ReactFlow,
  applyNodeChanges
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { ImportPanel } from './ImportPanel';
import CodeNode from './CodeNode';
import { useWebSocket } from "./useWebSocket";
import { WebSocketPanel } from "./WebSocketPanel";
import { server_uri } from './config';
import { NodeContext } from './NodeContext';

export default function App() {
  const nodeTypes = useMemo(() => ({ code: CodeNode }), []);

  const { message, send } = useWebSocket(`ws${server_uri}/api/ws`);
  const [waitingForResponse, setWaitingForResponse] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [fileImported, setFileImported] = useState(true);

  const [nodes, setNodes] = useState<any[]>([]);
  const [nodeIndex, setNodeIndex] = useState<string | null>(null);

  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);

  const scrollToTimelineItem = (idx: number) => {
    const item = timelineRefs.current[idx];
    if (item) {
      item.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  };

  useEffect(() => {
    if (timelineIndex !== null) {
      scrollToTimelineItem(timelineIndex);
    }
  }, [timelineIndex]);

  const syncFromServer = async () => {
    const res = await fetch(`http${server_uri}/api/sync`);
    const data = await res.json();

    setNodes(data.nodes);
    setNodeIndex(data.node_index?.toString());
    setTimelineEntries(data.timeline_entries);
    setTimelineIndex(data.timeline_index);
  };

  let didSync = false;
  useEffect(() => {
    if (!didSync) {
      syncFromServer();
      didSync = true;
    }
  }, []);

  const treatMessage = () => {
    setWaitingForResponse(false);
    if (!message) return;

    console.info(message)

    try {
      const msg = JSON.parse(message);

      setTimelineEntries(prev => {
        const existing = prev[msg.timeline_index];

        if (!existing) {
          const next = prev.slice();
          next[msg.timeline_index] = msg;
          return next;
        } else {
          if (JSON.stringify(prev[msg.timeline_index]) === JSON.stringify(msg)) return prev;
          const next = prev.slice(0, msg.timeline_index - 1);
          next[msg.timeline_index] = msg;
          return next;
        }
      });


      const nodeId = String(msg.lineno);

      setNodes(prev => {
        const idx = prev.findIndex(node => node.id === nodeId);
        if (idx < 0) return prev;

        const node = prev[idx];

        return [
          ...prev.slice(0, idx),
          {
            ...node,
            data: {
              ...node.data,
              framePointer: msg.frame_pointer,
            },
          },
          ...prev.slice(idx + 1),
        ];
      });


      /*
      const reactFlow = useReactFlow();

      const node = reactFlow.getNode(nodeId);

      const { x, y } = node.position;

      const width = node.width ?? 0;
      const height = node.height ?? 0;

      reactFlow.setCenter(x + width / 2, y + height / 2, {
        duration: 400,
        zoom: reactFlow.getZoom(),
      });
      */




      setTimelineIndex(msg.timeline_index ?? null);
      setNodeIndex(msg.lineno.toString() ?? null);

    } catch (err) {
      console.error('Failed to parse WS message', err);
    }
  }

  useEffect(() => {
    treatMessage()
  }, [message]);

  const onNodesChange = useCallback(
    (changes: NodeChange<any>[]) => setNodes((snap) => applyNodeChanges(changes, snap)),
    []
  );

  const handleTimelineClick = useCallback((idx: number) => {
    send(JSON.stringify({ type: 'new_timeline_index', new_timeline_index: idx }));
  }, [send]);

  const onNodeClick = useCallback(
    (node: any) => {
      send(JSON.stringify({ type: 'new_node_index', new_node_index: node.data.index }));
    },
    [send]
  );

  return (
    <div className="w-screen h-screen relative overflow-hidden flex flex-col">
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

      <div className="flex-1 w-full relative z-20">
        <NodeContext.Provider value={{ nodeIndex, setNodeIndex }}>
          <ReactFlow
            nodes={nodes}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            fitView
            panOnScroll
            proOptions={{ hideAttribution: true }}
            minZoom={0.01}
            maxZoom={1000}
            panOnScrollSpeed={1}
            className="w-full h-full bg-transparent"
          >

            <ImportPanel setNodes={setNodes} setFileImported={setFileImported} syncFromServer={syncFromServer} />

            <WebSocketPanel
              send={send}
              show={fileImported}
              waiting={waitingForResponse}
              setWaiting={setWaitingForResponse}
            />

            <Controls />
          </ReactFlow>
        </NodeContext.Provider>
      </div>

      <div
        ref={timelineRef}
        className="w-full h-16 flex items-center px-4 overflow-x-auto z-20 bg-[#292C33]"
      >
        {timelineEntries?.map((record, idx) => {
          const isSelected = timelineIndex === idx;

          const label =
            record?.event?.includes('line') ?
              record.lineno :
              record?.event?.replace(/^"+|"+$/g, '').charAt(0).toUpperCase();

          return (
            <div
              key={idx}
              ref={(el) => (timelineRefs.current[idx] = el)}
              onClick={() => handleTimelineClick(idx)}
              className={`flex flex-col items-center flex-none w-8 mx-1 cursor-pointer transition-all duration-300
                ${isSelected
                  ? 'bg-yellow-400 border-yellow-600'
                  : 'bg-gray-400/50 border-gray-600'
                }
                rounded-full border-2 h-8`}
              title={`Timeline index: ${idx}, Line: ${record.lineno}`}
            >
              <span className="text-xs text-white mt-1 font-bold">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
