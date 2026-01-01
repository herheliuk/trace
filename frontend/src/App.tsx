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
import { Background } from './ui/Background';

export default function App() {
  const nodeTypes = useMemo(() => ({ code: CodeNode }), []);

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

  const handleSync = async (data) => {
    setNodes(data.nodes);
    setNodeIndex(data.node_id?.toString());
    setTimelineEntries(data.timeline);
    setTimelineIndex(data.timeline_id);
  };

  const syncFromServer = async () => {
    const res = await fetch(`http${server_uri}/api/sync`);
    const data = await res.json();

    handleSync(data);
  };

  let didSync = false;
  useEffect(() => {
    if (!didSync) {
      syncFromServer();
      didSync = true;
    }
  }, []);

  const handleEvent = async (data) => {
    setTimelineEntries(prev => {
      const existing = prev[data.id];

      if (!existing) {
        const next = prev.slice();
        next[data.id] = data;
        return next;
      } else {
        if (JSON.stringify(prev[data.id]) === JSON.stringify(data)) return prev;
        const next = prev.slice(0, data.id);
        next[data.id] = data;
        return next;
      }
    });

    const nodeId = String(data.line_number);

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
            framePointer: data.frame_id,
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

    setTimelineIndex(data.id ?? null);
    setNodeIndex(data.line_number.toString() ?? null);
  }

  const messageReceived = (jsonString) => {
    if (!jsonString) return;
    setWaitingForResponse(false);

    const message = JSON.parse(jsonString);

    switch (message.type) {
      case "event":
        handleEvent(message.data)
        break;

      case "sync":
        handleSync(message.data)
        break;

      case "stdout":
        console.debug(message.data)
        break;

      case "stderr":
        console.error(message.data)
        break;

      case "flush":
        switch (message.data) {
          case "stdout":
            // Unsupported
            break;

          case "stderr":
            // Unsupported
            break;
        }
        break;

      default:
        console.warn("WS: Unknown message.type:", message.type);
    }
  }

  const { isConnected, send } = useWebSocket(`ws${server_uri}/api/ws`, messageReceived);

  const onNodesChange = useCallback(
    (changes: NodeChange<any>[]) => setNodes((snapshot) => applyNodeChanges(changes, snapshot)),
    []
  );

  const handleTimelineClick = useCallback((index: number) => {
    send(JSON.stringify({ type: 'new_timeline_id', new_timeline_id: index }));
  }, [send]);

  const onNodeClick = useCallback(
    (node: any) => {
      send(JSON.stringify({ type: 'new_node_index', new_node_index: node.data.index }));
    },
    [send]
  );

  return (
    <div className="w-screen h-screen relative overflow-hidden flex flex-col">
      <Background />

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

            <ImportPanel setFileImported={setFileImported} />

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
              record.line_number :
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
              title={`Timeline index: ${idx}, Line: ${record.line_number}`}
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
