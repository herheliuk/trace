import React, {
    useState,
    useRef,
    useLayoutEffect,
    useCallback,
} from 'react';
import { Rnd } from 'react-rnd';
import { useDebuggerState } from './DebuggerStateContext';

type TerminalEntry = {
    stream: 'stdout' | 'stderr' | 'stdin';
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
    sendStdin: (text: string) => void;
}

export function JsonInspectorPanel({
    nodes,
    timeline,
    nodeIndex,
    timelineIndex,
    terminal,
    clearTerminal,
    sendStdin,
}: JsonInspectorPanelProps) {
    const [visible, setVisible] = useState(true);
    const [activeTab, setActiveTab] =
        useState<'state' | 'timeline' | 'nodes' | 'terminal'>('state');

    const state = useDebuggerState();

    const [rect, setRect] = useState({
        x: window.innerWidth - 460,
        y: window.innerHeight - 420,
        width: 440,
        height: 360,
    });

    // ───────────────── Terminal scrolling ─────────────────
    const terminalRef = useRef<HTMLDivElement | null>(null);
    const wasAtBottomRef = useRef(true);

    const handleScroll = useCallback(() => {
        const el = terminalRef.current;
        if (!el) return;

        const threshold = 24;
        wasAtBottomRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    }, []);

    useLayoutEffect(() => {
        const el = terminalRef.current;
        if (!el || !wasAtBottomRef.current) return;

        requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
    }, [terminal]);

    // ───────────────── stdin input ─────────────────
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
        // Let IME composition finish
        if (e.nativeEvent.isComposing) return;

        // TAB → insert literal tab
        if (e.key === 'Tab') {
            e.preventDefault();

            const el = textareaRef.current;
            if (!el) return;

            const start = el.selectionStart;
            const end = el.selectionEnd;

            const next =
                input.slice(0, start) + '\t' + input.slice(end);

            setInput(next);

            // restore caret position
            requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = start + 1;
            });

            return;
        }

        // ENTER → send
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();

            if (input.trim() !== '') {
                sendStdin(input + '\n');
                setInput('');
            }

            return;
        }

        // Shift+Enter → newline (default)
    };

    // Auto-grow textarea
    useLayoutEffect(() => {
        const el = textareaRef.current;
        if (!el) return;

        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [input]);

    // ───────────────── Render helpers ─────────────────
    const renderTerminal = () => {
        if (terminal.length === 0) {
            return <div className="text-gray-500">No output yet.</div>;
        }

        return terminal.map((entry, i) => {
            let colorClass = 'text-gray-400';

            if (entry.stream === 'stderr') colorClass = 'text-red-400';
            if (entry.stream === 'stdout') colorClass = 'text-white';
            if (entry.stream === 'stdin') colorClass = 'text-blue-400';

            return (
                <pre key={i} className={colorClass}>
                    {entry.text}
                </pre>
            );
        });
    };

    // ───────────────── Hidden state ─────────────────
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
            onDragStop={(_, d) =>
                setRect(r => ({ ...r, x: d.x, y: d.y }))
            }
            onResizeStop={(_, __, ref, ___, pos) =>
                setRect({
                    width: ref.offsetWidth,
                    height: ref.offsetHeight,
                    x: pos.x,
                    y: pos.y,
                })
            }
            minWidth={300}
            minHeight={220}
            bounds="window"
            dragHandleClassName="inspector-drag-handle"
            className="z-50"
        >
            <div className="w-full h-full bg-[#1e1f24] border border-gray-700 rounded shadow-lg flex flex-col overflow-hidden">
                {/* ───────── Header ───────── */}
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
                            <span className="text-yellow-400">
                                {nodeIndex ?? 'null'}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-400">
                                timeline_id:
                            </span>{' '}
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
                    className="flex-1 overflow-auto p-2 text-xs font-mono bg-black/60 whitespace-pre-wrap"
                >
                    {activeTab === 'terminal'
                        ? renderTerminal()
                        : (
                            <pre className="text-green-300">
                                {JSON.stringify(
                                    { state, nodes, timeline }[activeTab],
                                    null,
                                    2
                                )}
                            </pre>
                        )}
                </div>

                {/* ───────── stdin input ───────── */}
                {activeTab === 'terminal' && (
                    <div className="border-t border-gray-700 p-1 bg-[#1a1b20]">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="stdin…"
                            rows={1}

                            /* ─── Kill browser behavior ─── */
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            inputMode="text"

                            /* ─── Terminal look & feel ─── */
                            className="w-full resize-none bg-black text-white text-xs font-mono px-2 py-1 outline-none caret-white"
                        />
                    </div>
                )}
            </div>
        </Rnd>
    );
}
