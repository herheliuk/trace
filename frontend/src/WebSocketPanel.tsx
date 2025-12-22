import { Panel } from '@xyflow/react';
import { PanelButton } from './ui/PanelButton';

interface WebSocketPanelProps {
  send?: (data: any) => void;
  show: boolean;
  waiting: boolean;
  setWaiting: (w: boolean) => void;
}

export function WebSocketPanel({ send, show, waiting, setWaiting }: WebSocketPanelProps) {
  if (show) return (
    <Panel position="center-right">
      <PanelButton
        onClick={() => {
          setWaiting(true);
          setTimeout(() => setWaiting(false), 2000);
          send?.(JSON.stringify({ type: 'continue' }));
        }}
        disabled={!send || waiting}
        style={{ marginBottom: 8, opacity: waiting ? 0.5 : 1 }}
      >
        {"CONTINUE"}
      </PanelButton>
    </Panel>
  );
}
