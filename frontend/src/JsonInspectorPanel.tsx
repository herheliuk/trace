import React, { useMemo, useState } from 'react';

interface JsonInspectorPanelProps {
  nodes: any[];
  timeline: any[];
  nodeIndex: string | null;
  timelineIndex: number | null;
}

/* ---------- helpers ---------- */

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

  const scope = useMemo(
    () => buildCurrentScope(timeline, timelineIndex),
    [timeline, timelineIndex]
  );

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
    <div className="absolute bottom-20 right-4 z-50 w-[440px] h-[340px] bg-[#1e1f24] border border-gray-700 rounded shadow-lg flex flex-col">
      {/* Header */}
      <div className="px-2 py-1 border-b border-gray-700 text-xs text-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('state')}
              className={`px-2 py-1 rounded ${
                activeTab === 'state'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700'
              }`}
            >
              State
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-2 py-1 rounded ${
                activeTab === 'timeline'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveTab('nodes')}
              className={`px-2 py-1 rounded ${
                activeTab === 'nodes'
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
        {JSON.stringify(
          activeTab === 'nodes'
            ? nodes
            : activeTab === 'timeline'
            ? timeline
            : scope,
          null,
          2
        )}
      </pre>
    </div>
  );
}
