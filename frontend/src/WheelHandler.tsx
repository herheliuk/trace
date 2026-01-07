import { useCallback, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';

export const MouseWheelZoom = () => {
  const { zoomIn, zoomOut } = useReactFlow();

  const onWheel = useCallback(
    (event: WheelEvent) => {
      const isTrackpad =
        Math.abs(event.deltaY) < 50 && event.deltaMode === 0;

      if (isTrackpad) return;

      event.preventDefault();

      if (event.deltaY < 0) {
        zoomIn({ duration: 0 });
      } else {
        zoomOut({ duration: 0 });
      }
    },
    [zoomIn, zoomOut]
  );

  useEffect(() => {
    const pane = document.querySelector('.react-flow__pane');
    if (!pane) return;

    pane.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      pane.removeEventListener('wheel', onWheel);
    };
  }, [onWheel]);

  return null;
}
