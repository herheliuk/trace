// JsonInspectorPanel.tsx

import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { useDebuggerState } from './DebuggerStateContext';

type TerminalEntry = {
    stream: 'stdout' | 'stderr';
    text: string;
    flushed: boolean;
};

interface JsonInspectorPanelProps {
    nodes: any[];
    timeline: any[];
    nodeIndex: string | null;
    timelineIndex: number | null;
    terminal: TerminalEntry[];
    clearTerminal: () => void;
}

export function JsonInspectorPanel({
    nodes,
    timeline,
    nodeIndex,
    timelineIndex,
    terminal,
    clearTerminal,
}: JsonInspectorPanelProps) {
    const [visible, setVisible] = useState(true);
    const [activeTab, setActiveTab] =
        useState<'state' | 'timeline' | 'nodes' | 'terminal'>('state');

    const state = useDebuggerState();

    const [rect, setRect] = useState({
        x: window.innerWidth - 460,
        y: window.innerHeight - 420,
        width: 440,
        height: 340,
    });

    useLayoutEffect(() => {
        const el = terminalRef.current;
        if (!el) return;

        if (!wasAtBottomRef.current) return;

        // wait for DOM + layout + wrapping
        requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
    }, [terminal]);

        const handleScroll = useCallback(() => {
        const el = terminalRef.current;
        if (!el) return;

        const threshold = 24; // px tolerance
        wasAtBottomRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    }, []);

    const terminalRef = useRef<HTMLDivElement | null>(null);
    const wasAtBottomRef = useRef(true);

    if (!visible) {
        return (
            <button
                onClick={() => setVisible(true)}
                className="absolute bottom-20 right-4 z-50 bg-gray-800 text-white px-3 py-1 rounded shadow"
            >
                Inspect
            </button>
        );
    }

    return (
        <Rnd
            size={{ width: rect.width, height: rect.height }}
            position={{ x: rect.x, y: rect.y }}
            onDragStop={(_, d) => setRect(r => ({ ...r, x: d.x, y: d.y }))}
            onResizeStop={(_, __, ref, ___, pos) =>
                setRect({
                    width: ref.offsetWidth,
                    height: ref.offsetHeight,
                    x: pos.x,
                    y: pos.y,
                })
            }
            minWidth={300}
            minHeight={200}
            bounds="window"
            dragHandleClassName="inspector-drag-handle"
            className="z-50"
        >
            <div className="w-full h-full bg-[#1e1f24] border border-gray-700 rounded shadow-lg flex flex-col overflow-hidden">
                {/* ───────── Header (drag handle) ───────── */}
                <div className="inspector-drag-handle cursor-move px-2 py-1 border-b border-gray-700 text-xs text-gray-300 bg-[#2a2c34]">
                    <div className="flex items-center justify-between">
                        <div className="flex space-x-2">
                            {['state', 'timeline', 'nodes', 'terminal'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`px-2 py-1 rounded ${activeTab === tab
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'terminal' && (
                            <button
                                onClick={clearTerminal}
                                className="px-2 py-1 rounded bg-red-600 text-white text-xs"
                            >
                                Clear
                            </button>
                        )}

                        <button
                            onClick={() => setVisible(false)}
                            className="text-gray-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="flex space-x-4 mt-1">
                        <div>
                            <span className="text-gray-400">lineno:</span>{' '}
                            <span className="text-yellow-400">{nodeIndex ?? 'null'}</span>
                        </div>
                        <div>
                            <span className="text-gray-400">timeline_id:</span>{' '}
                            <span className="text-yellow-400">
                                {timelineIndex ?? 'null'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ───────── Content ───────── */}
                <div
                    ref={terminalRef}
                    onScroll={handleScroll}
                    className={`flex-1 overflow-auto p-2 text-xs font-mono bg-black/60 whitespace-pre-wrap`}
                >
                    {activeTab === 'terminal' ? (
                        terminal.length === 0 ? (
                            <div className="text-gray-500">No output yet.</div>
                        ) : (
                            terminal.map((entry, i) => {
                                let colorClass = 'text-gray-500';

                                if (entry.flushed) {
                                    colorClass =
                                        entry.stream === 'stderr'
                                            ? 'text-red-400'
                                            : 'text-white';
                                }

                                return (
                                    <pre
                                        key={i}
                                        className={colorClass}
                                    >
                                        {entry.text}
                                    </pre>
                                );
                            })
                        )
                    ) : (
                        <pre className="text-green-300">
                            {JSON.stringify({ state, nodes, timeline }[activeTab], null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        </Rnd>
    );
}
