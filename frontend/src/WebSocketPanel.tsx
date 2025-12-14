import { useState } from 'react';
import { Panel } from '@xyflow/react';
import { PanelButton } from './ui/PanelButton';
import { server_uri } from './config';

interface WebSocketPanelProps {
  send?: (data: any) => void;
  reachedEnd?: boolean;
  show: boolean;
  waiting: boolean;
  setWaiting: (w: boolean) => void;
  wipeTimeline?: () => void; // optional prop to avoid TS/runtime errors
}

export function WebSocketPanel({ send, reachedEnd, show, waiting, setWaiting, wipeTimeline }: WebSocketPanelProps) {
  if (!show) return null;

  const [started, setStarted] = useState(true); // fasle);

  const onClick = async () => {
    if (!send || waiting) return;

    // ⛔ Disable until a WS response arrives
    setWaiting(true);
    setTimeout(() => setWaiting(false), 200); // safety timeout

    const doStart = !started || reachedEnd;

    if (doStart) {
      // If this is a RESTART, wipe the timeline (only if provided)
      if (started && reachedEnd) {
        try {
          // safe call; won't throw if prop is undefined
          wipeTimeline?.();
        } catch (err) {
          // defensive: log but continue
          console.warn('wipeTimeline failed', err);
        }
      }

      try {
        await fetch(`http${server_uri}/api/app_start`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to POST /app_start', err);
      }
      setStarted(true);
      return;
    }

    send("continue");
  };

  let label = "START";
  if (started && !reachedEnd) label = "CONTINUE";
  if (started && reachedEnd) label = "RESTART";

  return (
    <Panel position="center-right">
      <PanelButton
        onClick={onClick}
        disabled={waiting}          // 🔥 Disable while waiting!
        style={{ marginBottom: 8, opacity: waiting ? 0.5 : 1 }}
      >
        {label}
      </PanelButton>
    </Panel>
  );
}
