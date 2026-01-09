import React, { useMemo, useState } from 'react';
import { useDebuggerState } from './DebuggerStateContext';

interface JsonInspectorPanelProps {
    nodes: any[];
    timeline: any[];
    nodeIndex: string | null;
    timelineIndex: number | null;
}

/* ---------- component ---------- */

export function JsonInspectorPanel({
    nodes,
    timeline,
    nodeIndex,
    timelineIndex,
}: JsonInspectorPanelProps) {
    const [visible, setVisible] = useState(false);
    const [activeTab, setActiveTab] =
        useState<'state' | 'timeline' | 'nodes'>('state');

    const state = useDebuggerState();

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

    const tabContent = {
        state,
        nodes,
        timeline,
    }[activeTab];

    return (
        <div className="absolute bottom-20 right-4 z-50 w-[440px] h-[340px] bg-[#1e1f24] border border-gray-700 rounded shadow-lg flex flex-col">
            {/* Header */}
            <div className="px-2 py-1 border-b border-gray-700 text-xs text-gray-300">
                <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setActiveTab('state')}
                            className={`px-2 py-1 rounded ${activeTab === 'state'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700'
                                }`}
                        >
                            State
                        </button>
                        <button
                            onClick={() => setActiveTab('timeline')}
                            className={`px-2 py-1 rounded ${activeTab === 'timeline'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700'
                                }`}
                        >
                            Timeline
                        </button>
                        <button
                            onClick={() => setActiveTab('nodes')}
                            className={`px-2 py-1 rounded ${activeTab === 'nodes'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700'
                                }`}
                        >
                            Nodes
                        </button>
                    </div>

                    <button
                        onClick={() => setVisible(false)}
                        className="text-gray-400 hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                {/* Index Info */}
                <div className="flex space-x-4 mt-1">
                    <div>
                        <span className="text-gray-400">lineno:</span>{' '}
                        <span className="text-yellow-400">
                            {nodeIndex ?? 'null'}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-400">timeline_id:</span>{' '}
                        <span className="text-yellow-400">
                            {timelineIndex ?? 'null'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <pre className="flex-1 overflow-auto p-2 text-xs text-green-300 bg-black/40">
                {JSON.stringify(tabContent, null, 2)}
            </pre>
        </div>
    );
}
