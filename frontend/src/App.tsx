import {
  Controls,
  NodeChange,
  ReactFlow,
  applyNodeChanges
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useState, useEffect, useMemo, useProvider } from 'react';
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

  const [fileImported, setFileImported] = useState(true);

  const [nodes, setNodes] = useState<any[]>([]);
  const [nodeIndex, setNodeIndex] = useState<string | null>(null);

  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);

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
        const next = prev.slice();
        next[msg.timeline_index] = msg;
        return next;
      });


      


      const neededId = String(msg.lineno);
          
      setNodes(prev => {
        const idx = prev.findIndex(n => n.id === neededId);
        if (idx === -1) return prev;
      
        const next = [...prev];
        next[idx] = {
          ...prev[idx],
          data: {
            ...prev[idx].data,
            framePointer: msg.frame_pointer,
          },
        };
      
        return next;
      });
      





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

            <ImportPanel setNodes={setNodes} setFileImported={setFileImported} />

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

      <div className="w-full h-16 flex items-center px-4 overflow-x-auto z-20 bg-[#292C33]">
        {timelineEntries?.map((record, idx) => {
          const isSelected = timelineIndex === idx;

          const label =
            record?.event?.includes('line') ?
              record.lineno :
              record?.event?.replace(/^"+|"+$/g, '').charAt(0).toUpperCase();

          return (
            <div
              key={idx}
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
